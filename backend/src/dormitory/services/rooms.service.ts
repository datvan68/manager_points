import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Room, RoomDocument } from '../schemas/room.schema';
import { Bed, BedDocument } from '../schemas/bed.schema';
import { Building, BuildingDocument } from '../schemas/building.schema';
import { CreateRoomDto } from '../dto/create-room.dto';
import { UpdateRoomDto } from '../dto/update-room.dto';
import { v4 as uuidv4 } from 'uuid';
import { Contract, ContractDocument } from '../schemas/contract.schema';
import { DORMITORY_ENUMS } from '../dormitory-enums';

function isDuplicateKeyError(error: any): boolean {
  return error?.code === 11000 || error?.writeErrors?.some?.((item: any) => item?.code === 11000) === true;
}

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Bed.name) private bedModel: Model<BedDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
  ) {}

  /** Runtime capacity is always projected from persisted bed records. */
  private async projectRoom(room: any): Promise<any> {
    const roomId = room._id;
    const [counts] = typeof (this.bedModel as any).aggregate === 'function' ? await this.bedModel.aggregate([
      { $match: { room_id: roomId } },
      { $group: { _id: null, physical: { $sum: { $cond: [{ $ne: ['$status', DORMITORY_ENUMS.bedStatus[3]] }, 1, 0] } }, assignable: { $sum: { $cond: [{ $in: ['$status', [DORMITORY_ENUMS.bedStatus[0], DORMITORY_ENUMS.bedStatus[1]]] }, 1, 0] } }, occupied: { $sum: { $cond: [{ $eq: ['$status', DORMITORY_ENUMS.bedStatus[1]] }, 1, 0] } }, available: { $sum: { $cond: [{ $eq: ['$status', DORMITORY_ENUMS.bedStatus[0]] }, 1, 0] } }, maintenance: { $sum: { $cond: [{ $eq: ['$status', DORMITORY_ENUMS.bedStatus[2]] }, 1, 0] } } } },
    ]) : [null];
    const fallback = !counts ? await Promise.all([
      this.bedModel.countDocuments({ room_id: roomId, status: { $ne: DORMITORY_ENUMS.bedStatus[3] } }),
      this.bedModel.countDocuments({ room_id: roomId, status: DORMITORY_ENUMS.bedStatus[1] }),
      this.bedModel.countDocuments({ room_id: roomId, status: DORMITORY_ENUMS.bedStatus[0] }),
      this.bedModel.countDocuments({ room_id: roomId, status: DORMITORY_ENUMS.bedStatus[2] }),
    ]) : null;
    const maxStudents = counts?.physical ?? fallback?.[0] ?? 0;
    const currentStudents = counts?.occupied ?? fallback?.[1] ?? 0;
    const availableBedCount = counts?.available ?? fallback?.[2] ?? 0;
    const item = room.toObject ? room.toObject() : { ...room };
    const protectedStatuses: string[] = [DORMITORY_ENUMS.roomStatus[2], DORMITORY_ENUMS.roomStatus[3]];
    return {
      ...item,
      room_name: item.room_name || item.room_code,
      max_students: maxStudents,
      physical_capacity: maxStudents,
      assignable_capacity: counts?.assignable ?? ((fallback?.[1] || 0) + (fallback?.[2] || 0)),
      occupied_count: currentStudents,
      maintenance_count: counts?.maintenance ?? fallback?.[3] ?? 0,
      current_students: currentStudents,
      available_bed_count: availableBedCount,
      status: protectedStatuses.includes(item.status)
        ? item.status
        : availableBedCount > 0 ? DORMITORY_ENUMS.roomStatus[0] : DORMITORY_ENUMS.roomStatus[1],
    };
  }

  private async resolveQuery<T>(query: any): Promise<T> {
    return query && typeof query.exec === 'function' ? query.exec() : query;
  }

  private async readRoomBeds(roomId: string): Promise<any[]> {
    if (typeof (this.bedModel as any).find !== 'function') return [];
    const query: any = (this.bedModel as any).find({ room_id: roomId });
    if (query && typeof query.lean === 'function') {
      return this.resolveQuery<any[]>(query.lean()) as Promise<any[]>;
    }
    return this.resolveQuery<any[]>(query) as Promise<any[]>;
  }

  private async restoreRoomState(id: string, originalBeds: any[], originalRoomFields: Record<string, any>): Promise<void> {
    try {
      if (typeof (this.bedModel as any).find === 'function') {
        const currentBeds = await this.readRoomBeds(id);
        const originalBedIds = new Set(originalBeds.map((bed) => String(bed._id)));
        const insertedIds = currentBeds
          .filter((bed) => !originalBedIds.has(String(bed._id)) && bed.status !== DORMITORY_ENUMS.bedStatus[1] && bed.has_history !== true)
          .map((bed) => bed._id)
          .filter(Boolean);
        if (insertedIds.length && typeof (this.bedModel as any).deleteMany === 'function') {
          await this.resolveQuery((this.bedModel as any).deleteMany({
            _id: { $in: insertedIds },
            room_id: id,
            status: { $ne: DORMITORY_ENUMS.bedStatus[1] },
            has_history: { $ne: true },
          }));
        }
        if (typeof (this.bedModel as any).updateOne === 'function') {
          for (const bed of originalBeds) {
            if (!bed._id) continue;
            const set: Record<string, any> = { bed_code: bed.bed_code, status: bed.status };
            if (bed.has_history !== undefined) set.has_history = bed.has_history;
            await this.resolveQuery((this.bedModel as any).updateOne(
              { _id: bed._id, room_id: id },
              { $set: set },
            ));
          }
        }
      }
      if (Object.keys(originalRoomFields).length) {
        await this.resolveQuery((this.roomModel as any).findByIdAndUpdate(id, { $set: originalRoomFields }));
      }
    } catch (rollbackError) {
      this.logger.error(`Room update rollback failed for ${id}`, rollbackError instanceof Error ? rollbackError.stack : String(rollbackError));
    }
  }

  async create(dto: CreateRoomDto, user: any): Promise<Room> {
    if (!Number.isInteger(dto.bed_count) || dto.bed_count <= 0) {
      throw new ConflictException('Bed count must be a positive integer');
    }
    const building = await this.buildingModel.findById(dto.building_id);
    if (!building) throw new NotFoundException(`Không tìm thấy tòa nhà: ${dto.building_id}`);

    const roomCode = String(dto.room_code || '').trim().toUpperCase();
    if (!roomCode) throw new ConflictException('Room code must not be empty');
    const existing = await this.roomModel.findOne({ room_code: roomCode });
    if (existing) throw new ConflictException(`Phòng với mã "${roomCode}" đã tồn tại`);

    const qrId = uuidv4();
    const room = new this.roomModel({
      ...dto,
      room_code: roomCode,
      available_bed_count: dto.bed_count,
      qr_code: qrId,
      public_url: `/public/room/${qrId}`,
    });

    let savedRoom: any;
    try {
      savedRoom = await room.save();
      await this.ensureRoomBeds(savedRoom._id.toString(), dto.bed_count);
      return typeof (this.roomModel as any).findById === 'function'
        ? this.findOne(savedRoom._id.toString())
        : savedRoom;
    } catch (error) {
      if (savedRoom?._id) {
        if (typeof (this.bedModel as any).deleteMany === 'function') {
          await this.bedModel.deleteMany({ room_id: savedRoom._id, status: { $ne: DORMITORY_ENUMS.bedStatus[1] }, has_history: { $ne: true } });
        }
        if (typeof (this.roomModel as any).deleteOne === 'function') {
          await this.roomModel.deleteOne({ _id: savedRoom._id });
        }
      }
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(`Room with code "${roomCode}" already exists`);
      }
      throw error;
    }
  }

  /** Provisioning is explicit and idempotent; read paths never call this method. */
  async ensureRoomBeds(roomId: string, bedCount: number): Promise<void> {
    if (!Number.isInteger(bedCount) || bedCount <= 0) {
      throw new ConflictException('Số lượng giường phải là số nguyên dương');
    }
    let room: any = null;
    if (typeof (this.roomModel as any).findById === 'function') {
      const query: any = (this.roomModel as any).findById(roomId);
      if (query && typeof query.select === 'function') {
        const selected = query.select('room_code');
        room = typeof selected?.lean === 'function' ? await selected.lean().exec() : await selected.exec();
      } else if (query && typeof query.exec === 'function') room = await query.exec();
      else if (query?.room_code) room = query;
      else if (typeof query?.then === 'function') room = await query;
    }
    const roomCode = String(room?.room_code || '').trim().toUpperCase();
    if (!roomCode) throw new ConflictException('Không xác định được mã phòng để tạo mã giường');
    const existingBeds = await this.bedModel
      .find({ room_id: roomId })
      .select('_id bed_code status has_history')
      .lean()
      .exec();
    const activeBeds = existingBeds.filter((bed: any) => bed.status !== DORMITORY_ENUMS.bedStatus[3]);
    const missingCount = Math.max(0, bedCount - activeBeds.length);
    const prefix = `${roomCode}-G`;
    const expectedCodes = Array.from({ length: bedCount }, (_, index) => `${prefix}${index + 1}`);

    // A previous capacity reduction retires free canonical beds. Reuse those
    // records before inserting new ones so growth restores ROOM-G1..ROOM-Gn.
    const restorable = existingBeds.filter((bed: any) =>
      bed.status === DORMITORY_ENUMS.bedStatus[3] && bed.has_history !== true && expectedCodes.includes(String(bed.bed_code || '').toUpperCase()),
    );
    const restorableIds = restorable.slice(0, missingCount).map((bed: any) => bed._id).filter(Boolean);
    if (restorableIds.length && typeof (this.bedModel as any).updateMany === 'function') {
      await (this.bedModel as any).updateMany({ _id: { $in: restorableIds }, room_id: roomId, status: DORMITORY_ENUMS.bedStatus[3], has_history: { $ne: true } }, { $set: { status: DORMITORY_ENUMS.bedStatus[0] } });
      for (const bed of restorable) {
        if (restorableIds.some((id: any) => String(id) === String(bed._id))) bed.status = DORMITORY_ENUMS.bedStatus[0];
      }
    }

    const remainingMissingCount = Math.max(0, bedCount - existingBeds.filter((bed: any) => bed.status !== DORMITORY_ENUMS.bedStatus[3]).length);
    if (remainingMissingCount > 0) {
      const existingCodes = new Set(existingBeds.map((bed: any) => bed.bed_code));
      const usedSuffixes = new Set<number>();
      for (const bed of existingBeds as any[]) {
        const value = String(bed.bed_code || '');
        if (value.toUpperCase().startsWith(prefix)) {
          const suffix = Number(value.slice(prefix.length));
          if (Number.isInteger(suffix) && suffix > 0) usedSuffixes.add(suffix);
        }
      }
      const bedCodes: string[] = [];
      let sequence = 1;
      while (bedCodes.length < remainingMissingCount) {
        const bedCode = `${prefix}${sequence}`;
        if (!usedSuffixes.has(sequence) && !existingCodes.has(bedCode)) {
          bedCodes.push(bedCode);
          usedSuffixes.add(sequence);
        }
        sequence += 1;
      }

      try {
        await this.bedModel.bulkWrite(
          bedCodes.map((bedCode, index) => ({
            updateOne: {
              filter: { room_id: roomId, bed_code: bedCode },
              update: {
                $setOnInsert: {
                  room_id: roomId as unknown as Bed['room_id'],
                  bed_code: bedCode,
                  position: `Vị trí ${index + 1}`,
                  status: DORMITORY_ENUMS.bedStatus[0],
                },
              },
              upsert: true,
            },
          })),
          { ordered: false },
        );
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        this.logger.warn(`Bed provisioning index conflict for room ${roomCode}`);
      }
    }

    const finalBeds = await this.bedModel
      .find({ room_id: roomId })
      .select('bed_code status')
      .lean()
      .exec();
    const finalActiveBeds = finalBeds.filter((bed: any) => bed.status !== DORMITORY_ENUMS.bedStatus[3]);
    const expectedCodeSet = new Set(expectedCodes);
    const finalCodes = new Set(finalActiveBeds.map((bed: any) => String(bed.bed_code || '').toUpperCase()));
    const hasExpectedCodes = expectedCodeSet.size === bedCount && [...expectedCodeSet].every((code) => finalCodes.has(code));
    const allCodesCanonical = finalActiveBeds.every((bed: any) => String(bed.bed_code || '').toUpperCase().startsWith(`${roomCode}-G`));
    if (finalActiveBeds.length !== bedCount || !hasExpectedCodes || !allCodesCanonical) {
      throw new ConflictException(`Không thể đảm bảo ${bedCount} giường hoạt động cho phòng ${roomCode}`);
    }

    await this.syncRoomAvailability(roomId);
  }

  async findAll(query: {
    search?: string;
    building_id?: string;
    status?: string;
    room_type?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.search) {
      filter.$or = [
        { room_code: { $regex: query.search, $options: 'i' } },
        { room_name: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.building_id) filter.building_id = query.building_id;
    if (query.status) filter.status = query.status;
    if (query.room_type) filter.room_type = query.room_type;

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.roomModel.find(filter).populate('building_id', 'building_code name').sort({ room_code: 1 }).skip(skip).limit(limit).exec(),
      this.roomModel.countDocuments(filter),
    ]);

    return {
      data: await Promise.all(data.map((room: any) => this.projectRoom(room))),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Room> {
    const room = await this.roomModel.findById(id).populate('building_id', 'building_code name address').exec();
    if (!room) throw new NotFoundException(`Không tìm thấy phòng: ${id}`);
    return this.projectRoom(room) as Promise<Room>;
  }

  async findByQrId(qrId: string): Promise<Room> {
    const room = await this.roomModel.findOne({ qr_code: qrId }).populate('building_id', 'building_code name address').exec();
    if (!room) throw new NotFoundException(`Không tìm thấy phòng với mã QR: ${qrId}`);
    return this.projectRoom(room) as Promise<Room>;
  }

  async update(id: string, dto: UpdateRoomDto, user: any): Promise<Room> {
    const currentRoom = await this.resolveQuery<any>((this.roomModel as any).findById(id));
    if (!currentRoom) throw new NotFoundException(`Room not found: ${id}`);

    const capacityChange = dto.bed_count !== undefined;
    if (capacityChange && (!Number.isInteger(dto.bed_count) || (dto.bed_count as number) <= 0)) {
      throw new ConflictException('Bed count must be a positive integer');
    }
    const hasBuildingId = dto.building_id !== undefined;
    const nextBuildingId = hasBuildingId ? String(dto.building_id).trim() : undefined;
    if (hasBuildingId && !nextBuildingId) throw new ConflictException('Building id must not be empty');
    if (nextBuildingId !== undefined && typeof (this.buildingModel as any).findById === 'function') {
      const building = await this.resolveQuery<any>((this.buildingModel as any).findById(nextBuildingId));
      if (!building) throw new NotFoundException(`Building not found: ${nextBuildingId}`);
    }

    const previousRoomCode = String((currentRoom as any).room_code || '').trim().toUpperCase();
    const hasRoomCode = dto.room_code !== undefined;
    const nextRoomCode = hasRoomCode ? String(dto.room_code).trim().toUpperCase() : previousRoomCode;
    if (hasRoomCode && !nextRoomCode) throw new ConflictException('Room code must not be empty');
    const roomCodeChanged = nextRoomCode !== previousRoomCode;
    const originalBeds = capacityChange || roomCodeChanged ? await this.readRoomBeds(id) : [];

    if (roomCodeChanged && typeof (this.roomModel as any).findOne === 'function') {
      const duplicate = await this.resolveQuery<any>((this.roomModel as any).findOne({
        room_code: nextRoomCode,
        _id: { $ne: id },
      }));
      if (duplicate) throw new ConflictException(`Room with code "${nextRoomCode}" already exists`);
    }

    const updateDto: Record<string, any> = { ...dto };
    if (nextBuildingId !== undefined) updateDto.building_id = nextBuildingId;
    if (hasRoomCode) updateDto.room_code = nextRoomCode;
    else delete updateDto.room_code;
    if (capacityChange) delete updateDto.bed_count;

    const originalRoomFields: Record<string, any> = {};
    for (const key of Object.keys(updateDto)) {
      if ((currentRoom as any)[key] !== undefined) originalRoomFields[key] = (currentRoom as any)[key];
    }
    if (capacityChange) {
      originalRoomFields.bed_count = (currentRoom as any).bed_count;
      for (const key of ['available_bed_count', 'status']) {
        if ((currentRoom as any)[key] !== undefined) originalRoomFields[key] = (currentRoom as any)[key];
      }
    }

    if (roomCodeChanged) {
      const targetCodes = originalBeds.map((bed) => {
        const suffix = String(bed.bed_code || '').match(/-G(\d+)$/i)?.[1];
        return suffix ? `${nextRoomCode}-G${suffix}` : null;
      }).filter(Boolean);
      const originalCodes = originalBeds.map((bed) => String(bed.bed_code || '').toUpperCase());
      const targetCodesAreUnique = new Set(targetCodes).size === targetCodes.length;
      const targetCodeCollidesInRoom = targetCodes.some((code, index) => originalCodes.some((existingCode, existingIndex) =>
        existingIndex !== index && existingCode === String(code).toUpperCase(),
      ));
      if (targetCodes.length !== originalBeds.length || !targetCodesAreUnique || targetCodeCollidesInRoom) {
        throw new ConflictException('Cannot rename room because its existing bed codes are not canonical');
      }
    }

    let room: any = currentRoom;
    let roomUpdated = false;
    let bedsMutated = false;
    let capacitySyncStarted = false;
    try {
      if (capacityChange) {
        const existingBedCount = await this.bedModel.countDocuments({ room_id: id, status: { $ne: DORMITORY_ENUMS.bedStatus[3] } });
        if (dto.bed_count! < existingBedCount) {
          const retireCount = existingBedCount - dto.bed_count!;
          const eligible = typeof (this.bedModel as any).find === 'function'
            ? await (this.bedModel as any).find({ room_id: id, status: DORMITORY_ENUMS.bedStatus[0], has_history: { $ne: true } }).sort({ bed_code: -1 }).limit(retireCount).exec()
            : [];
          if (eligible.length < retireCount) throw new ConflictException('Not enough free beds without history to reduce capacity');
          await this.resolveQuery((this.bedModel as any).updateMany(
            { _id: { $in: eligible.map((bed: any) => bed._id) } },
            { $set: { status: DORMITORY_ENUMS.bedStatus[3] } },
          ));
          bedsMutated = true;
        }
      }

      if (Object.keys(updateDto).length) {
        room = await this.resolveQuery<any>((this.roomModel as any).findByIdAndUpdate(
          id,
          { $set: updateDto },
          { returnDocument: 'after' },
        ));
        if (!room) throw new NotFoundException(`Room not found: ${id}`);
        roomUpdated = true;
      }

      if (roomCodeChanged) {
        for (const bed of originalBeds) {
          const suffix = String(bed.bed_code || '').match(/-G(\d+)$/i)?.[1];
          if (suffix && bed._id && typeof (this.bedModel as any).updateOne === 'function') {
            await this.resolveQuery((this.bedModel as any).updateOne(
              { _id: bed._id, room_id: id },
              { $set: { bed_code: `${nextRoomCode}-G${suffix}` } },
            ));
            bedsMutated = true;
          }
        }
      }

      if (capacityChange) {
        capacitySyncStarted = true;
        await this.ensureRoomBeds(id, dto.bed_count as number);
        room = await this.resolveQuery<any>((this.roomModel as any).findByIdAndUpdate(
          id,
          { $set: { bed_count: dto.bed_count } },
          { returnDocument: 'after' },
        )) || room;
        roomUpdated = true;
      }

      return capacityChange && typeof (this.roomModel as any).findById === 'function'
        ? this.findOne(id) as Promise<Room>
        : room as Room;
    } catch (error) {
      if (capacitySyncStarted || roomUpdated || bedsMutated) await this.restoreRoomState(id, originalBeds, originalRoomFields);
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(`Room with code "${nextRoomCode}" already exists`);
      }
      throw error;
    }
  }

  async remove(id: string, user: any): Promise<Room> {
    const bedsInUse = await this.bedModel.countDocuments({ room_id: id, status: DORMITORY_ENUMS.bedStatus[1] });
    const historicalBeds = await this.bedModel.countDocuments({ room_id: id, has_history: true });
    if (bedsInUse > 0 || historicalBeds > 0) throw new ConflictException('Phòng còn occupancy hoặc lịch sử giường được bảo vệ, không thể xóa');
    const room = await this.roomModel.findByIdAndDelete(id).exec();
    if (!room) throw new NotFoundException(`Không tìm thấy phòng: ${id}`);
    await this.bedModel.deleteMany({ room_id: id });
    return room;
  }

  /** Recalculate the cached value; callers still use persisted-bed projections for display. */
  async syncRoomAvailability(roomId: string): Promise<void> {
    const [usedBeds, availableBeds] = await Promise.all([
      this.bedModel.countDocuments({ room_id: roomId, status: DORMITORY_ENUMS.bedStatus[1] }),
      this.bedModel.countDocuments({ room_id: roomId, status: DORMITORY_ENUMS.bedStatus[0] }),
    ]);
    const status = availableBeds > 0 ? DORMITORY_ENUMS.roomStatus[0] : DORMITORY_ENUMS.roomStatus[1];
    const room = await this.roomModel.findById(roomId);
    if (!room) return;
    const protectedStatuses: string[] = [DORMITORY_ENUMS.roomStatus[2], DORMITORY_ENUMS.roomStatus[3]];
    await this.roomModel.findByIdAndUpdate(roomId, {
      $set: protectedStatuses.includes(room.status) ? { available_bed_count: availableBeds } : { available_bed_count: availableBeds, status },
    });
    void usedBeds;
  }
}
