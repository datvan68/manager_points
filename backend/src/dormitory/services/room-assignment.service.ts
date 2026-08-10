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
import {
  Registration,
  RegistrationDocument,
} from '../schemas/registration.schema';
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
    @InjectModel(Registration.name)
    private registrationModel: Model<RegistrationDocument>,
    @InjectModel(Contract.name)
    private contractModel: Model<ContractDocument>,
    @InjectModel(PublicRegistration.name)
    private publicRegistrationModel: Model<PublicRegistrationDocument>,
    private roomsService: RoomsService,
  ) {}

  /**
   * UC03: Assign a room/bed to a student with an approved registration
   */
  async assignRoom(dto: AssignRoomDto, user: any) {
    const reg = await this.registrationModel.findById(dto.registration_id);
    const publicRegistration = reg
      ? null
      : await this.publicRegistrationModel.findById(dto.registration_id);
    if (!reg && !publicRegistration) {
      throw new NotFoundException('Không tìm thấy đơn đăng ký');
    }
    const activeContract = reg
      ? await this.contractModel.findOne({
          registration_id: dto.registration_id,
          status: 'Hiệu lực',
        })
      : null;
    if (reg?.bed_id || publicRegistration?.bed_id || activeContract) {
      throw new ConflictException('Sinh viên đã được phân một giường');
    }
    if (reg && reg.status !== 'Đã duyệt') {
      throw new BadRequestException('Đơn đăng ký chưa được duyệt');
    }

    const room = await this.roomModel.findById(dto.room_id);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }
    if (['Khóa', 'Bảo trì'].includes(room.status)) {
      throw new BadRequestException('Phòng hiện không thể phân giường');
    }

    const bed = await this.bedModel.findOneAndUpdate(
      { _id: dto.bed_id, room_id: dto.room_id, status: 'Trống' },
      { $set: { status: 'Đang sử dụng' } },
      { new: true },
    );
    if (!bed) {
      throw new BadRequestException('Giường không hợp lệ hoặc đã được sử dụng');
    }

    const assignmentFilter = {
      _id: dto.registration_id,
      $or: [{ bed_id: { $exists: false } }, { bed_id: null }],
    };
    const assignment = {
      $set: {
        room_id: room._id,
        bed_id: bed._id,
        ...(publicRegistration ? { room_code: room.room_code } : {}),
      },
    };
    const assignmentModel: any = reg ? this.registrationModel : this.publicRegistrationModel;
    let assignedRegistration;
    try {
      assignedRegistration = await assignmentModel.findOneAndUpdate(
        assignmentFilter,
        assignment,
        { new: true },
      );
    } catch (error) {
      await this.releaseReservedBed(bed._id);
      throw error;
    }

    if (!assignedRegistration) {
      await this.bedModel.findOneAndUpdate(
        { _id: bed._id, status: 'Đang sử dụng' },
        { $set: { status: 'Trống' } },
      );
      throw new ConflictException('Sinh viên đã được phân một giường');
    }

    try {
      await this.roomsService.syncRoomAvailability(dto.room_id);
    } catch (error) {
      await this.rollbackRegistrationAssignment(
        assignmentModel,
        dto.registration_id,
        bed._id,
        Boolean(publicRegistration),
      );
      await this.releaseReservedBed(bed._id);
      try {
        await this.roomsService.syncRoomAvailability(dto.room_id);
      } catch {
        // The bed and registration rollback above restores the prior state.
      }
      throw error;
    }

    return {
      registration: assignedRegistration,
      room,
      bed,
      message: 'Phân phòng thành công',
    };
  }

  private async releaseReservedBed(bedId: any): Promise<void> {
    await this.bedModel.findOneAndUpdate(
      { _id: bedId, status: DORMITORY_ENUMS.bedStatus[1] },
      { $set: { status: DORMITORY_ENUMS.bedStatus[0] } },
    );
  }

  private async rollbackRegistrationAssignment(
    model: any,
    registrationId: string,
    bedId: any,
    isPublicRegistration: boolean,
  ): Promise<void> {
    const unset: Record<string, string> = { room_id: '', bed_id: '' };
    if (isPublicRegistration) unset.room_code = '';
    await model.findOneAndUpdate(
      { _id: registrationId, bed_id: bedId },
      { $unset: unset },
      { new: true },
    );
  }

  /**
   * Suggest available rooms based on registration preferences
   */
  async suggestRooms(registrationId: string) {
    const reg = await this.registrationModel.findById(registrationId);
    const publicRegistration = reg ? null : await this.publicRegistrationModel.findById(registrationId);
    if (!reg && !publicRegistration) throw new NotFoundException('Không tìm thấy đơn đăng ký');

    const filter: any = { status: { $nin: ['Khóa', 'Bảo trì'] } };

    // Apply preferences
    if (reg?.preference?.room_type || publicRegistration?.room_type) {
      filter.room_type = reg?.preference?.room_type || publicRegistration?.room_type;
    }
    if (reg?.preference?.building_id) {
      filter.building_id = reg.preference.building_id;
    }

    const rooms = await this.roomModel
      .find(filter)
      .populate('building_id', 'building_code name')
      .lean()
      .exec();

    const roomsWithAvailability = await Promise.all(
      rooms.map(async (room: any) => {
        await this.roomsService.ensureRoomBeds(
          room._id.toString(),
          room.bed_count,
        );
        const availableBedCount = await this.bedModel.countDocuments({
          room_id: room._id,
          status: 'Trống',
        });
        return {
          ...room,
          available_bed_count: availableBedCount,
          status: availableBedCount > 0 ? 'Trống' : 'Đầy',
        };
      }),
    );

    return roomsWithAvailability
      .filter((room) => room.available_bed_count > 0)
      .sort((left, right) => right.available_bed_count - left.available_bed_count)
      .slice(0, 10);
  }

  /**
   * UC05: Transfer a student to a different room/bed
   */
  async transferRoom(dto: TransferRoomDto, user: any) {
    const contract = await this.contractModel.findById(dto.contract_id);
    if (!contract) {
      throw new NotFoundException('Không tìm thấy hợp đồng');
    }
    if (contract.status !== 'Hiệu lực') {
      throw new BadRequestException('Hợp đồng không còn hiệu lực');
    }

    // Validate new bed
    const newBed = await this.bedModel.findById(dto.new_bed_id);
    if (!newBed) {
      throw new NotFoundException('Không tìm thấy giường mới');
    }
    if (newBed.status !== 'Trống') {
      throw new BadRequestException('Giường mới đã được sử dụng');
    }

    // Free old bed
    const oldBedId = contract.bed_id.toString();
    await this.bedModel.findByIdAndUpdate(oldBedId, {
      $set: { status: 'Trống' },
    });

    // Assign new bed
    newBed.status = 'Đang sử dụng';
    await newBed.save();

    // Update contract
    const oldRoomId = contract.room_id.toString();
    contract.bed_id = newBed._id as any;
    contract.room_id = dto.new_room_id as any;
    await contract.save();

    // Sync both rooms
    await this.roomsService.syncRoomAvailability(oldRoomId);
    await this.roomsService.syncRoomAvailability(dto.new_room_id);

    return {
      contract,
      message: 'Chuyển phòng thành công',
    };
  }
}
