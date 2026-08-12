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
    const [maxStudents, currentStudents, availableBedCount] = await Promise.all([
      this.bedModel.countDocuments({ room_id: roomId }),
      this.bedModel.countDocuments({ room_id: roomId, status: DORMITORY_ENUMS.bedStatus[1] }),
      this.bedModel.countDocuments({ room_id: roomId, status: DORMITORY_ENUMS.bedStatus[0] }),
    ]);
    const item = room.toObject ? room.toObject() : { ...room };
    const protectedStatuses: string[] = [DORMITORY_ENUMS.roomStatus[2], DORMITORY_ENUMS.roomStatus[3]];
    return {
      ...item,
      room_name: item.room_name || item.room_code,
      max_students: maxStudents,
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

    const savedRoom = await room.save();
    await this.ensureRoomBeds(savedRoom._id.toString(), dto.bed_count);
    return savedRoom;
  }

  /** Provisioning is explicit and idempotent; read paths never call this method. */
  async ensureRoomBeds(roomId: string, bedCount: number): Promise<void> {
    const existingBeds = await this.bedModel
      .find({ room_id: roomId })
      .select('bed_code')
      .lean()
      .exec();
    const missingCount = Math.max(0, bedCount - existingBeds.length);

    if (missingCount > 0) {
      const existingCodes = new Set(existingBeds.map((bed: any) => bed.bed_code));
      const bedCodes: string[] = [];
      let sequence = 1;
      while (bedCodes.length < missingCount) {
        const bedCode = `G${sequence.toString().padStart(2, '0')}`;
        if (!existingCodes.has(bedCode)) bedCodes.push(bedCode);
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
                  position: `Vị trí ${existingBeds.length + index + 1}`,
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
      const existingBedCount = await this.bedModel.countDocuments({ room_id: id });
      if (dto.bed_count < existingBedCount) {
        throw new ConflictException(`Room capacity cannot be reduced below the ${existingBedCount} persisted beds`);
      }
    }

    const room = await this.roomModel.findByIdAndUpdate(id, { $set: dto }, { returnDocument: 'after' }).exec();
    if (!room) throw new NotFoundException(`Không tìm thấy phòng: ${id}`);
    if (dto.bed_count !== undefined) {
      await this.ensureRoomBeds(id, dto.bed_count);
      return this.roomModel.findById(id).exec() as Promise<Room>;
    }
    return room;
  }

  async remove(id: string, user: any): Promise<Room> {
    const bedsInUse = await this.bedModel.countDocuments({ room_id: id, status: DORMITORY_ENUMS.bedStatus[1] });
    if (bedsInUse > 0) throw new ConflictException(`Phòng còn ${bedsInUse} giường đang sử dụng, không thể xóa`);
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
