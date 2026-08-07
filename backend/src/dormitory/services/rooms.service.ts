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

@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    @InjectModel(Bed.name) private bedModel: Model<BedDocument>,
    @InjectModel(Building.name) private buildingModel: Model<BuildingDocument>,
    @InjectModel(Contract.name) private contractModel: Model<ContractDocument>,
  ) {}

  async create(dto: CreateRoomDto, user: any): Promise<Room> {
    // Validate building exists
    const building = await this.buildingModel.findById(dto.building_id);
    if (!building) {
      throw new NotFoundException(`Không tìm thấy tòa nhà: ${dto.building_id}`);
    }

    const existing = await this.roomModel.findOne({ room_code: dto.room_code });
    if (existing) {
      throw new ConflictException(`Phòng với mã "${dto.room_code}" đã tồn tại`);
    }

    // Auto-generate QR code and URL (FR16)
    const qrId = uuidv4();
    const room = new this.roomModel({
      ...dto,
      available_bed_count: dto.bed_count, // initially all beds are empty
      qr_code: qrId,
      public_url: `/public/room/${qrId}`,
    });

    const savedRoom = await room.save();
    await this.ensureRoomBeds(savedRoom._id.toString(), dto.bed_count);
    return savedRoom;
  }

  /**
   * Ensure a room has one persisted bed record for each configured bed.
   * Existing custom bed codes are preserved and only missing beds are added.
   */
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

      await this.bedModel.bulkWrite(
        bedCodes.map((bedCode, index) => ({
          updateOne: {
            filter: { room_id: roomId, bed_code: bedCode },
            update: {
              $setOnInsert: {
                room_id: roomId as unknown as Bed['room_id'],
                bed_code: bedCode,
                position: `Vị trí ${existingBeds.length + index + 1}`,
                status: 'Trống',
              },
            },
            upsert: true,
          },
        })),
        { ordered: false },
      );
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
      this.roomModel
        .find(filter)
        .populate('building_id', 'building_code name')
        .sort({ room_code: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.roomModel.countDocuments(filter),
    ]);

    const rows = await Promise.all(data.map(async (room: any) => {
      const item = room.toObject ? room.toObject() : room;
      const total_students = await this.contractModel.countDocuments({ room_id: room._id, status: 'Hiệu lực' });
      return { ...item, room_name: item.room_name || item.room_code, total_students };
    }));

    return {
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Room> {
    const room = await this.roomModel
      .findById(id)
      .populate('building_id', 'building_code name address')
      .exec();
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng: ${id}`);
    }
    return room;
  }

  async findByQrId(qrId: string): Promise<Room> {
    const room = await this.roomModel
      .findOne({ qr_code: qrId })
      .populate('building_id', 'building_code name address')
      .exec();
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng với mã QR: ${qrId}`);
    }
    return room;
  }

  async update(id: string, dto: UpdateRoomDto, user: any): Promise<Room> {
    const room = await this.roomModel
      .findByIdAndUpdate(id, { $set: dto }, { returnDocument: 'after' })
      .exec();
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng: ${id}`);
    }
    return room;
  }

  async remove(id: string, user: any): Promise<Room> {
    // Check if room has beds in use
    const bedsInUse = await this.bedModel.countDocuments({
      room_id: id,
      status: 'Đang sử dụng',
    });
    if (bedsInUse > 0) {
      throw new ConflictException(
        `Phòng còn ${bedsInUse} giường đang sử dụng, không thể xóa`,
      );
    }

    const room = await this.roomModel.findByIdAndDelete(id).exec();
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng: ${id}`);
    }
    // Also remove all beds in this room
    await this.bedModel.deleteMany({ room_id: id });
    return room;
  }

  /**
   * Recalculate available beds count for a room
   */
  async syncRoomAvailability(roomId: string): Promise<void> {
    const totalBeds = await this.bedModel.countDocuments({ room_id: roomId });
    const usedBeds = await this.bedModel.countDocuments({
      room_id: roomId,
      status: 'Đang sử dụng',
    });
    const availableBeds = totalBeds - usedBeds;

    let status: string;
    if (availableBeds <= 0) {
      status = 'Đầy';
    } else if (availableBeds === totalBeds) {
      status = 'Trống';
    } else {
      status = 'Trống'; // Partially occupied still shown as available
    }

    // Don't override 'Khóa' or 'Bảo trì' status
    const room = await this.roomModel.findById(roomId);
    if (room && !['Khóa', 'Bảo trì'].includes(room.status)) {
      await this.roomModel.findByIdAndUpdate(roomId, {
        $set: { available_bed_count: availableBeds, status },
      });
    } else if (room) {
      await this.roomModel.findByIdAndUpdate(roomId, {
        $set: { available_bed_count: availableBeds },
      });
    }
  }
}
