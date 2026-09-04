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
import { DormitoryRosterEntry, DormitoryRosterEntryDocument } from '../schemas/dormitory-roster-entry.schema';
import { AssignRoomDto } from '../dto/assign-room.dto';
import { TransferRoomDto } from '../dto/transfer-room.dto';
import { Contract, ContractDocument } from '../schemas/contract.schema';
import { RoomsService } from './rooms.service';
import { DORMITORY_ENUMS } from '../dormitory-enums';
import { emitDormitoryOverviewInvalidated } from '../dormitory-overview-event-emitter';

@Injectable()
export class RoomAssignmentService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Bed.name) private bedModel: Model<BedDocument>,
    @InjectModel(DormitoryRosterEntry.name) private rosterModel: Model<DormitoryRosterEntryDocument>,
    @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
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

  private async restoreRosterEntry(
    rosterEntryId: string,
    newBedId: any,
    oldRoomId: any,
    oldBedId: any,
  ): Promise<void> {
    const update: any = oldBedId
      ? { $set: { room_id: oldRoomId, bed_id: oldBedId } }
      : { $unset: { room_id: '', bed_id: '' } };
    await this.rosterModel.findOneAndUpdate({ _id: rosterEntryId, bed_id: newBedId }, update, { new: true });
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
    const rosterEntryId = dto.roster_entry_id;
    const rosterEntry: any = await this.rosterModel.findById(rosterEntryId);
    if (!rosterEntry) throw new NotFoundException('Không tìm thấy mục Danh sách KTX');
    const activeContract = await this.contractModel.findOne({ roster_entry_id: rosterEntryId, status: DORMITORY_ENUMS.contractStatus[0] });
    const currentRoomId = activeContract?.room_id || rosterEntry.room_id;
    const currentBedId = activeContract?.bed_id || rosterEntry.bed_id;
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
        rosterEntry,
        room,
        newBed,
        newRoomId: dto.room_id,
      });
    }

    const assignmentFilter: any = { _id: rosterEntryId };
    if (currentBedId) assignmentFilter.bed_id = currentBedId;
    else assignmentFilter.$or = [{ bed_id: { $exists: false } }, { bed_id: null }];
    const assignment: any = {
      $set: {
        room_id: room._id,
        bed_id: newBed._id,
      },
    };

    let assignedRosterEntry: any;
    try {
      assignedRosterEntry = await this.rosterModel.findOneAndUpdate(assignmentFilter, assignment, { new: true });
    } catch (error) {
      await this.releaseBed(newBed._id);
      throw error;
    }
    if (!assignedRosterEntry) {
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
      await this.restoreRosterEntry(rosterEntryId, newBed._id, currentRoomId, currentBedId);
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

    emitDormitoryOverviewInvalidated('roster');
    return {
      roster_entry: assignedRosterEntry,
      room,
      bed: newBed,
      active_contract_id: undefined,
      message: currentBedId ? 'Chuyển phòng thành công' : 'Phân phòng thành công',
    };
  }

  async assignFirstAvailableBed(rosterEntryId: string, roomCode: string, user: any) {
    const normalizedCode = String(roomCode || '').trim().normalize('NFKC').toUpperCase();
    if (!normalizedCode) throw new BadRequestException('Mã phòng không hợp lệ');
    const escapedCode = normalizedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const room = await this.roomModel.findOne({ room_code: { $regex: `^${escapedCode}$`, $options: 'i' } }).exec();
    if (!room) throw new NotFoundException(`Không tìm thấy phòng: ${normalizedCode}`);
    if ([DORMITORY_ENUMS.roomStatus[2], DORMITORY_ENUMS.roomStatus[3]].includes(room.status as any)) {
      throw new BadRequestException(`Phòng ${normalizedCode} hiện không thể phân giường`);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const bed = await this.bedModel.findOne({ room_id: room._id, status: DORMITORY_ENUMS.bedStatus[0] }).sort({ bed_code: 1 }).exec();
      if (!bed) break;
      try {
        return await this.assignRoom({ roster_entry_id: rosterEntryId, room_id: String(room._id), bed_id: String(bed._id) }, user);
      } catch (error) {
        if (!(error instanceof BadRequestException) || !String(error.message).includes('Giường')) throw error;
      }
    }
    throw new BadRequestException(`Phòng ${normalizedCode} không còn giường trống`);
  }

  async validateImportCapacity(roomCode: string, requestedCount: number) {
    const normalizedCode = String(roomCode || '').trim().normalize('NFKC').toUpperCase();
    if (!normalizedCode || !Number.isInteger(requestedCount) || requestedCount < 1) {
      throw new BadRequestException('Dữ liệu mã phòng import không hợp lệ');
    }
    const escapedCode = normalizedCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const room = await this.roomModel.findOne({ room_code: { $regex: `^${escapedCode}$`, $options: 'i' } }).exec();
    if (!room) throw new NotFoundException(`Không tìm thấy phòng: ${normalizedCode}`);
    if ([DORMITORY_ENUMS.roomStatus[2], DORMITORY_ENUMS.roomStatus[3]].includes(room.status as any)) {
      throw new BadRequestException(`Phòng ${normalizedCode} hiện không thể phân giường`);
    }
    const availableBeds = await this.bedModel.countDocuments({ room_id: room._id, status: DORMITORY_ENUMS.bedStatus[0] }).exec();
    if (availableBeds < requestedCount) {
      throw new BadRequestException(`Phòng ${normalizedCode} chỉ còn ${availableBeds} giường trống, không thể xếp ${requestedCount} sinh viên`);
    }
  }

  async unassignRoom(rosterEntryId: string, user: any) {
    void user;
    const rosterEntry: any = await this.rosterModel.findById(rosterEntryId);
    if (!rosterEntry) throw new NotFoundException('Không tìm thấy mục Danh sách KTX');

    const activeContract = await this.contractModel.findOne({ roster_entry_id: rosterEntryId, status: DORMITORY_ENUMS.contractStatus[0] });
    if (activeContract) throw new ConflictException('Không thể bỏ chọn phòng khi hợp đồng đang hiệu lực');

    const currentRoomId = rosterEntry.room_id;
    const currentBedId = rosterEntry.bed_id;
    if (!currentBedId) return { roster_entry: rosterEntry, room: null, bed: null, message: 'Mục Danh sách KTX chưa được phân phòng' };

    const filter: any = { _id: rosterEntryId, bed_id: currentBedId };
    const unset: any = { room_id: '', bed_id: '' };
    const cleared = await this.rosterModel.findOneAndUpdate(filter, { $unset: unset }, { new: true });
    if (!cleared) throw new ConflictException('Mục Danh sách KTX đã thay đổi, vui lòng tải lại');

    try {
      const released = await this.bedModel.findOneAndUpdate(
        { _id: currentBedId, status: DORMITORY_ENUMS.bedStatus[1] },
        { $set: { status: DORMITORY_ENUMS.bedStatus[0] } },
      );
      if (!released) throw new ConflictException('Giường hiện tại không thể được giải phóng');
      await this.syncRooms(currentRoomId, null);
      emitDormitoryOverviewInvalidated('roster');
      return { roster_entry: cleared, room: null, bed: released, message: 'Đã bỏ chọn phòng' };
    } catch (error) {
      const restore: any = { $set: { room_id: currentRoomId, bed_id: currentBedId } };
      await this.rosterModel.findOneAndUpdate({ _id: rosterEntryId, bed_id: { $exists: false } }, restore, { new: true });
      throw error;
    }
  }

  private async reassignActiveContract(args: {
    contract: any;
    rosterEntry: any;
    room: any;
    newBed: any;
    newRoomId: string;
  }) {
    const { contract, rosterEntry, room, newBed, newRoomId } = args;
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
      const updatedRosterEntry = rosterEntry
        ? await this.rosterModel.findOneAndUpdate(
            { _id: rosterEntry._id },
            { $set: { room_id: room._id, bed_id: newBed._id } },
            { new: true },
          )
        : null;
      if (rosterEntry && !updatedRosterEntry) throw new ConflictException('Mục Danh sách KTX đã thay đổi đồng thời');
      const released = await this.bedModel.findOneAndUpdate(
        { _id: oldBedId, status: DORMITORY_ENUMS.bedStatus[1] },
        { $set: { status: DORMITORY_ENUMS.bedStatus[0] } },
      );
      if (!released) throw new ConflictException('Giường cũ không thể được giải phóng');
      await this.syncRooms(oldRoomId, newRoomId);
      emitDormitoryOverviewInvalidated('roster');
      return {
        roster_entry: updatedRosterEntry,
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
        if (rosterEntry) await this.rosterModel.findOneAndUpdate({ _id: rosterEntry._id, bed_id: newBed._id }, { $set: { room_id: oldRoomId, bed_id: oldBedId } }, { new: true });
        await this.bedModel.findOneAndUpdate({ _id: oldBedId, status: DORMITORY_ENUMS.bedStatus[0] }, { $set: { status: DORMITORY_ENUMS.bedStatus[1] } });
        await this.syncRooms(oldRoomId, newRoomId);
      } catch { /* preserve the complete old assignment as far as the datastore permits */ }
      throw error;
    }
  }

  async suggestRooms(rosterEntryId: string) {
    const rosterEntry: any = await this.rosterModel.findById(rosterEntryId);
    if (!rosterEntry) throw new NotFoundException('Không tìm thấy mục Danh sách KTX');

    const activeContract = await this.contractModel.findOne({ roster_entry_id: rosterEntryId, status: DORMITORY_ENUMS.contractStatus[0] });
    const currentRoomId = this.id(activeContract?.room_id || rosterEntry.room_id);

    const filter: any = { status: { $nin: [DORMITORY_ENUMS.roomStatus[2], DORMITORY_ENUMS.roomStatus[3]] } };
    if (rosterEntry?.room_type) filter.room_type = rosterEntry.room_type;

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
        status: [DORMITORY_ENUMS.roomStatus[2], DORMITORY_ENUMS.roomStatus[3]].includes(room.status)
          ? room.status
          : availableBedCount > 0 ? DORMITORY_ENUMS.roomStatus[0] : DORMITORY_ENUMS.roomStatus[1],
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
    const rosterEntry = contract.roster_entry_id
      ? await this.rosterModel.findById(contract.roster_entry_id)
      : null;
    return this.reassignActiveContract({ contract, rosterEntry, room, newBed, newRoomId: dto.new_room_id });
  }
}
