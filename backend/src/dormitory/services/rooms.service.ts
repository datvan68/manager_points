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

    const existing = await this.roomModel.findOne({ ma_phong: dto.ma_phong });
    if (existing) {
      throw new ConflictException(`Phòng với mã "${dto.ma_phong}" đã tồn tại`);
    }

    // Auto-generate QR code and URL (FR16)
    const qrId = uuidv4();
    const room = new this.roomModel({
      ...dto,
      so_giuong_trong: dto.so_giuong, // initially all beds are empty
      ma_qr: qrId,
      url_xem_nhanh: `/public/room/${qrId}`,
    });

    return room.save();
  }

  async findAll(query: {
    search?: string;
    building_id?: string;
    trang_thai?: string;
    loai_phong?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.search) {
      filter.$or = [
        { ma_phong: { $regex: query.search, $options: 'i' } },
        { ten_phong: { $regex: query.search, $options: 'i' } },
      ];
    }
    if (query.building_id) filter.building_id = query.building_id;
    if (query.trang_thai) filter.trang_thai = query.trang_thai;
    if (query.loai_phong) filter.loai_phong = query.loai_phong;

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.roomModel
        .find(filter)
        .populate('building_id', 'ma_toa_nha ten')
        .sort({ ma_phong: 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.roomModel.countDocuments(filter),
    ]);

    const rows = await Promise.all(data.map(async (room: any) => {
      const item = room.toObject ? room.toObject() : room;
      const total_students = await this.contractModel.countDocuments({ room_id: room._id, trang_thai: 'Hiệu lực' });
      return { ...item, ten_phong: item.ten_phong || item.ma_phong, total_students };
    }));

    return {
      data: rows,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Room> {
    const room = await this.roomModel
      .findById(id)
      .populate('building_id', 'ma_toa_nha ten dia_chi')
      .exec();
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng: ${id}`);
    }
    return room;
  }

  async findByQrId(qrId: string): Promise<Room> {
    const room = await this.roomModel
      .findOne({ ma_qr: qrId })
      .populate('building_id', 'ma_toa_nha ten dia_chi')
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
      trang_thai: 'Đang sử dụng',
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
      trang_thai: 'Đang sử dụng',
    });
    const availableBeds = totalBeds - usedBeds;

    let trang_thai: string;
    if (availableBeds <= 0) {
      trang_thai = 'Đầy';
    } else if (availableBeds === totalBeds) {
      trang_thai = 'Trống';
    } else {
      trang_thai = 'Trống'; // Partially occupied still shown as available
    }

    // Don't override 'Khóa' or 'Bảo trì' status
    const room = await this.roomModel.findById(roomId);
    if (room && !['Khóa', 'Bảo trì'].includes(room.trang_thai)) {
      await this.roomModel.findByIdAndUpdate(roomId, {
        $set: { so_giuong_trong: availableBeds, trang_thai },
      });
    } else if (room) {
      await this.roomModel.findByIdAndUpdate(roomId, {
        $set: { so_giuong_trong: availableBeds },
      });
    }
  }
}
