import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../schemas/room.schema';
import { Bed, BedDocument } from '../schemas/bed.schema';
import { Registration, RegistrationDocument } from '../schemas/registration.schema';
import { AssignRoomDto } from '../dto/assign-room.dto';
import { TransferRoomDto } from '../dto/transfer-room.dto';
import { Contract, ContractDocument } from '../schemas/contract.schema';
import { PublicRegistration, PublicRegistrationDocument } from '../schemas/public-registration.schema';
import { RoomsService } from './rooms.service';
import { DORMITORY_ENUMS } from '../dormitory-enums';

@Injectable()
export class RoomAssignmentService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Bed.name) private bedModel: Model<BedDocument>,
    @InjectModel(Registration.name) private registrationModel: Model<RegistrationDocument>,
    @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
    @InjectModel(PublicRegistration.name) private publicRegistrationModel: Model<PublicRegistrationDocument>,
    private roomsService: RoomsService,
  ) {}

  private id(value: any): string | undefined {
    return value?._id?.toString?.() || value?.toString?.();
  }

  private async reserveBed(roomId: string, bedId: string): Promise<any> {
    return this.bedModel.findOneAndUpdate(
      { _id: bedId, room_id: roomId, status: DORMITORY_ENUMS.bedStatus[0] },
      { $set: { status: DORMITORY_ENUMS.bedStatus[1] } },
      { new: true },
    );
  }

  private async releaseBed(bedId: any): Promise<any> {
    return this.bedModel.findOneAndUpdate(
      { _id: bedId, status: DORMITORY_ENUMS.bedStatus[1] },
      { $set: { status: DORMITORY_ENUMS.bedStatus[0] } },
    );
  }

  private async restoreRegistration(
    model: any,
    registrationId: string,
    newBedId: any,
    oldRoomId: any,
    oldBedId: any,
    isPublic: boolean,
  ): Promise<void> {
    const update: any = oldBedId
      ? { $set: { room_id: oldRoomId, bed_id: oldBedId } }
      : { $unset: { room_id: '', bed_id: '' } };
    if (!oldBedId && isPublic) update.$unset.room_code = '';
    await model.findOneAndUpdate({ _id: registrationId, bed_id: newBedId }, update, { new: true });
  }

  private async syncRooms(oldRoomId: any, newRoomId: any): Promise<void> {
    const oldId = this.id(oldRoomId);
    const newId = this.id(newRoomId);
    if (oldId) await this.roomsService.syncRoomAvailability(oldId);
    if (newId && newId !== oldId) await this.roomsService.syncRoomAvailability(newId);
  }

  /**
   * Assign or reassign the effective bed. Conditional bed and registration
   * updates make concurrent requests fail without releasing the old bed first.
   */
  async assignRoom(dto: AssignRoomDto, user: any) {
    const reg = await this.registrationModel.findById(dto.registration_id);
    const publicRegistration = reg ? null : await this.publicRegistrationModel.findById(dto.registration_id);
    if (!reg && !publicRegistration) throw new NotFoundException('Không tìm thấy đơn đăng ký');
    if (reg && reg.status !== DORMITORY_ENUMS.registrationStatus[1]) {
      throw new BadRequestException('Đơn đăng ký chưa được duyệt');
    }

    const activeContract = reg
      ? await this.contractModel.findOne({ registration_id: dto.registration_id, status: DORMITORY_ENUMS.contractStatus[0] })
      : null;
    const currentRoomId = activeContract?.room_id || reg?.room_id || publicRegistration?.room_id;
    const currentBedId = activeContract?.bed_id || reg?.bed_id || publicRegistration?.bed_id;
    if (currentBedId && this.id(currentBedId) === dto.bed_id) {
      throw new ConflictException('Sinh viên đã được phân giường này');
    }

    const room = await this.roomModel.findById(dto.room_id);
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    if ([DORMITORY_ENUMS.roomStatus[2], DORMITORY_ENUMS.roomStatus[3]].includes(room.status as any)) {
      throw new BadRequestException('Phòng hiện không thể phân giường');
    }

    const newBed = await this.reserveBed(dto.room_id, dto.bed_id);
    if (!newBed) throw new BadRequestException('Giường không hợp lệ hoặc đã được sử dụng');

    if (activeContract) {
      return this.reassignActiveContract({
        contract: activeContract,
        registration: reg,
        registrationModel: this.registrationModel,
        room,
        newBed,
        newRoomId: dto.room_id,
        isPublic: false,
      });
    }

    const assignmentModel: any = reg ? this.registrationModel : this.publicRegistrationModel;
    const assignmentFilter: any = { _id: dto.registration_id };
    if (currentBedId) assignmentFilter.bed_id = currentBedId;
    else assignmentFilter.$or = [{ bed_id: { $exists: false } }, { bed_id: null }];
    const assignment: any = {
      $set: {
        room_id: room._id,
        bed_id: newBed._id,
        ...(publicRegistration ? { room_code: room.room_code } : {}),
      },
    };

    let assignedRegistration: any;
    try {
      assignedRegistration = await assignmentModel.findOneAndUpdate(assignmentFilter, assignment, { new: true });
    } catch (error) {
      await this.releaseBed(newBed._id);
      throw error;
    }
    if (!assignedRegistration) {
      await this.releaseBed(newBed._id);
      throw new ConflictException('Sinh viên đã được phân giường');
    }

    try {
      if (currentBedId) {
        const released = await this.bedModel.findOneAndUpdate(
          { _id: currentBedId, status: DORMITORY_ENUMS.bedStatus[1] },
          { $set: { status: DORMITORY_ENUMS.bedStatus[0] } },
        );
        if (!released) throw new ConflictException('Giường cũ không thể được giải phóng');
      }
      await this.syncRooms(currentRoomId, dto.room_id);
    } catch (error) {
      await this.restoreRegistration(assignmentModel, dto.registration_id, newBed._id, currentRoomId, currentBedId, Boolean(publicRegistration));
      await this.releaseBed(newBed._id);
      if (currentBedId) {
        await this.bedModel.findOneAndUpdate(
          { _id: currentBedId, status: DORMITORY_ENUMS.bedStatus[0] },
          { $set: { status: DORMITORY_ENUMS.bedStatus[1] } },
        );
      }
      try { await this.syncRooms(currentRoomId, dto.room_id); } catch { /* preserve the assignment rollback */ }
      throw error;
    }

    return {
      registration: assignedRegistration,
      room,
      bed: newBed,
      active_contract_id: undefined,
      message: currentBedId ? 'Chuyển phòng thành công' : 'Phân phòng thành công',
    };
  }

  private async reassignActiveContract(args: {
    contract: any;
    registration: any;
    registrationModel: any;
    room: any;
    newBed: any;
    newRoomId: string;
    isPublic: boolean;
  }) {
    const { contract, registration, registrationModel, room, newBed, newRoomId, isPublic } = args;
    const oldRoomId = contract.room_id;
    const oldBedId = contract.bed_id;
    let updatedContract: any;
    try {
      updatedContract = await this.contractModel.findOneAndUpdate(
        { _id: contract._id, status: DORMITORY_ENUMS.contractStatus[0], bed_id: oldBedId, room_id: oldRoomId },
        { $set: { room_id: newRoomId, bed_id: newBed._id } },
        { new: true },
      );
      if (!updatedContract) throw new ConflictException('Hợp đồng đã thay đổi đồng thời');
      const updatedRegistration = registration
        ? await registrationModel.findOneAndUpdate(
            { _id: registration._id },
            { $set: { room_id: room._id, bed_id: newBed._id } },
            { new: true },
          )
        : null;
      if (registration && !updatedRegistration) throw new ConflictException('Đơn đăng ký đã thay đổi đồng thời');
      const released = await this.bedModel.findOneAndUpdate(
        { _id: oldBedId, status: DORMITORY_ENUMS.bedStatus[1] },
        { $set: { status: DORMITORY_ENUMS.bedStatus[0] } },
      );
      if (!released) throw new ConflictException('Giường cũ không thể được giải phóng');
      await this.syncRooms(oldRoomId, newRoomId);
      return {
        registration: updatedRegistration,
        contract: updatedContract,
        room,
        bed: newBed,
        active_contract_id: updatedContract._id,
        message: 'Chuyển phòng thành công',
      };
    } catch (error) {
      await this.releaseBed(newBed._id);
      try {
        await this.contractModel.findOneAndUpdate({ _id: contract._id, bed_id: newBed._id }, { $set: { room_id: oldRoomId, bed_id: oldBedId } }, { new: true });
        if (registration) await registrationModel.findOneAndUpdate({ _id: registration._id, bed_id: newBed._id }, { $set: { room_id: oldRoomId, bed_id: oldBedId } }, { new: true });
        await this.bedModel.findOneAndUpdate({ _id: oldBedId, status: DORMITORY_ENUMS.bedStatus[0] }, { $set: { status: DORMITORY_ENUMS.bedStatus[1] } });
        await this.syncRooms(oldRoomId, newRoomId);
      } catch { /* preserve the complete old assignment as far as the datastore permits */ }
      throw error;
    }
  }

  async suggestRooms(registrationId: string) {
    const reg = await this.registrationModel.findById(registrationId);
    const publicRegistration = reg ? null : await this.publicRegistrationModel.findById(registrationId);
    if (!reg && !publicRegistration) throw new NotFoundException('Không tìm thấy đơn đăng ký');

    const activeContract = reg && typeof (this.contractModel as any).findOne === 'function'
      ? await this.contractModel.findOne({ registration_id: registrationId, status: DORMITORY_ENUMS.contractStatus[0] })
      : null;
    const currentRoomId = this.id(activeContract?.room_id || reg?.room_id || publicRegistration?.room_id);

    const filter: any = { status: { $nin: [DORMITORY_ENUMS.roomStatus[2], DORMITORY_ENUMS.roomStatus[3]] } };
    if (reg?.preference?.room_type || publicRegistration?.room_type) filter.room_type = reg?.preference?.room_type || publicRegistration?.room_type;
    if (reg?.preference?.building_id) filter.building_id = reg.preference.building_id;

    const roomQuery = currentRoomId ? { $or: [{ _id: currentRoomId }, filter] } : filter;
    const rooms = await this.roomModel.find(roomQuery).populate('building_id', 'building_code name').lean().exec();
    const roomsWithAvailability = await Promise.all(rooms.map(async (room: any) => {
      const [maxStudents, currentStudents, availableBedCount] = await Promise.all([
        this.bedModel.countDocuments({ room_id: room._id }),
        this.bedModel.countDocuments({ room_id: room._id, status: DORMITORY_ENUMS.bedStatus[1] }),
        this.bedModel.countDocuments({ room_id: room._id, status: DORMITORY_ENUMS.bedStatus[0] }),
      ]);
      return {
        ...room,
        room_name: room.room_name || room.room_code,
        max_students: maxStudents,
        current_students: currentStudents,
        available_bed_count: availableBedCount,
        status: availableBedCount > 0 ? DORMITORY_ENUMS.roomStatus[0] : DORMITORY_ENUMS.roomStatus[1],
      };
    }));

    const sortedRooms = roomsWithAvailability
      .filter((room) => room.available_bed_count > 0 || this.id(room._id) === currentRoomId)
      .sort((left, right) => right.available_bed_count - left.available_bed_count)
    const suggestedRooms = sortedRooms.slice(0, 10);
    if (currentRoomId && !suggestedRooms.some((room) => this.id(room._id) === currentRoomId)) {
      const currentRoom = sortedRooms.find((room) => this.id(room._id) === currentRoomId);
      if (currentRoom) suggestedRooms[suggestedRooms.length - 1] = currentRoom;
    }
    return suggestedRooms;
  }

  async transferRoom(dto: TransferRoomDto, user: any) {
    const contract = await this.contractModel.findById(dto.contract_id);
    if (!contract) throw new NotFoundException('Contract not found');
    if (contract.status !== DORMITORY_ENUMS.contractStatus[0]) throw new BadRequestException('Contract is not active');
    const room = await this.roomModel.findById(dto.new_room_id);
    if (!room) throw new NotFoundException('Không tìm thấy phòng');
    const newBed = await this.reserveBed(dto.new_room_id, dto.new_bed_id);
    if (!newBed) throw new BadRequestException('Giường không hợp lệ hoặc đã được sử dụng');
    const registration = contract.registration_id && typeof (this.registrationModel as any).findById === 'function'
      ? await this.registrationModel.findById(contract.registration_id)
      : null;
    return this.reassignActiveContract({ contract, registration, registrationModel: this.registrationModel, room, newBed, newRoomId: dto.new_room_id, isPublic: false });
  }
}
