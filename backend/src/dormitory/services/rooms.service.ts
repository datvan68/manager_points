import {
  Injectable,
  NotFoundException,
  ConflictException,
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

  async create(dto: CreateRoomDto, user: any): Promise<Room> {
    const building = await this.buildingModel.findById(dto.building_id);
    if (!building) throw new NotFoundException(`Không tìm thấy tòa nhà: ${dto.building_id}`);

    const existing = await this.roomModel.findOne({ room_code: dto.room_code });
    if (existing) throw new ConflictException(`Phòng với mã "${dto.room_code}" đã tồn tại`);

    const qrId = uuidv4();
    const room = new this.roomModel({
      ...dto,
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
        await this.bedModel.deleteMany({ room_id: savedRoom._id });
        await this.roomModel.deleteOne({ _id: savedRoom._id });
      }
      throw error;
    }
  }

  /** Provisioning is explicit and idempotent; read paths never call this method. */
  async ensureRoomBeds(roomId: string, bedCount: number): Promise<void> {
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
      .select('bed_code status')
      .lean()
      .exec();
    const activeBeds = existingBeds.filter((bed: any) => bed.status !== DORMITORY_ENUMS.bedStatus[3]);
    const missingCount = Math.max(0, bedCount - activeBeds.length);

    if (missingCount > 0) {
      const existingCodes = new Set(existingBeds.map((bed: any) => bed.bed_code));
      const usedSuffixes = new Set<number>();
      const prefix = `${roomCode}-G`;
      for (const bed of existingBeds as any[]) {
        const value = String(bed.bed_code || '');
        if (value.toUpperCase().startsWith(prefix)) {
          const suffix = Number(value.slice(prefix.length));
          if (Number.isInteger(suffix) && suffix > 0) usedSuffixes.add(suffix);
        }
      }
      const bedCodes: string[] = [];
      let sequence = 1;
      while (bedCodes.length < missingCount) {
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
      }
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
    const currentRoom = await this.roomModel.findById(id).exec();
    if (!currentRoom) throw new NotFoundException(`Không tìm thấy phòng: ${id}`);

    if (dto.bed_count !== undefined) {
      const existingBedCount = await this.bedModel.countDocuments({ room_id: id, status: { $ne: DORMITORY_ENUMS.bedStatus[3] } });
      if (dto.bed_count < existingBedCount) {
        const retireCount = existingBedCount - dto.bed_count;
        const eligible = await this.bedModel.find({ room_id: id, status: DORMITORY_ENUMS.bedStatus[0], has_history: { $ne: true } }).sort({ bed_code: -1 }).limit(retireCount).exec();
        if (eligible.length < retireCount) throw new ConflictException('Không đủ giường trống chưa có lịch sử để giảm sức chứa');
        await this.bedModel.updateMany({ _id: { $in: eligible.map((bed: any) => bed._id) } }, { $set: { status: DORMITORY_ENUMS.bedStatus[3] } });
      }
    }

    const previousRoomCode = String((currentRoom as any).room_code || '').trim().toUpperCase();
    const nextRoomCode = dto.room_code ? String(dto.room_code).trim().toUpperCase() : previousRoomCode;
    const roomCodeChanged = nextRoomCode !== previousRoomCode;
    const updateDto = { ...dto, ...(dto.room_code ? { room_code: nextRoomCode } : {}) };
    if (roomCodeChanged) {
      const beds = await this.bedModel.find({ room_id: id }).select('_id bed_code').lean().exec();
      const targetCodes = (beds as any[]).map((bed) => {
        const suffix = String(bed.bed_code || '').match(/-G(\d+)$/i)?.[1];
        return suffix ? `${nextRoomCode}-G${suffix}` : null;
      }).filter(Boolean);
      if (targetCodes.length !== beds.length || new Set(targetCodes).size !== targetCodes.length) {
        throw new ConflictException('Không thể đổi mã phòng vì mã giường hiện tại không hợp lệ');
      }
      const collision = await this.bedModel.findOne({ room_id: id, bed_code: { $in: targetCodes } }).select('_id').lean().exec();
      if (collision) throw new ConflictException('Mã giường sau khi đổi phòng bị trùng');
    }
    const room = await this.roomModel.findByIdAndUpdate(id, { $set: updateDto }, { returnDocument: 'after' }).exec();
    if (!room) throw new NotFoundException(`Không tìm thấy phòng: ${id}`);
    if (dto.bed_count !== undefined) {
      await this.ensureRoomBeds(id, dto.bed_count);
      await this.roomModel.findByIdAndUpdate(id, { $set: { bed_count: dto.bed_count } });
      if (roomCodeChanged) {
        const beds = await this.bedModel.find({ room_id: id }).select('_id bed_code').lean().exec();
        for (const bed of beds as any[]) {
          const suffix = String(bed.bed_code).match(/-G(\d+)$/i)?.[1];
          if (suffix) await this.bedModel.updateOne({ _id: bed._id }, { $set: { bed_code: `${nextRoomCode}-G${suffix}` } });
        }
      }
      return typeof (this.roomModel as any).findById === 'function'
        ? this.findOne(id) as Promise<Room>
        : room as Room;
    }
    if (roomCodeChanged) {
      const beds = await this.bedModel.find({ room_id: id }).select('_id bed_code').lean().exec();
      for (const bed of beds as any[]) {
        const suffix = String(bed.bed_code).match(/-G(\d+)$/i)?.[1];
        if (suffix) await this.bedModel.updateOne({ _id: bed._id }, { $set: { bed_code: `${nextRoomCode}-G${suffix}` } });
      }
    }
    return room;
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
