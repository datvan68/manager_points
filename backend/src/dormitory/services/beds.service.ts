import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bed, BedDocument } from '../schemas/bed.schema';
import { Room, RoomDocument } from '../schemas/room.schema';
import { CreateBedDto } from '../dto/create-bed.dto';
import { RoomsService } from './rooms.service';

@Injectable()
export class BedsService {
  constructor(
    @InjectModel(Bed.name) private bedModel: Model<BedDocument>,
    @InjectModel(Room.name) private roomModel: Model<RoomDocument>,
    private roomsService: RoomsService,
  ) {}

  async create(dto: CreateBedDto, user: any): Promise<Bed> {
    // Validate room exists
    const room = await this.roomModel.findById(dto.room_id);
    if (!room) {
      throw new NotFoundException(`Không tìm thấy phòng: ${dto.room_id}`);
    }

    // Check duplicate bed code within room
    const existing = await this.bedModel.findOne({
      bed_code: dto.bed_code,
      room_id: dto.room_id,
    });
    if (existing) {
      throw new ConflictException(
        `Giường "${dto.bed_code}" đã tồn tại trong phòng`,
      );
    }

    const bed = new this.bedModel(dto);
    const saved = await bed.save();

    // Sync room availability
    await this.roomsService.syncRoomAvailability(dto.room_id);

    return saved;
  }

  async findByRoom(roomId: string): Promise<Bed[]> {
    return this.bedModel.find({ room_id: roomId }).sort({ bed_code: 1 }).exec();
  }

  async findOne(id: string): Promise<Bed> {
    const bed = await this.bedModel
      .findById(id)
      .populate('room_id', 'room_code')
      .exec();
    if (!bed) {
      throw new NotFoundException(`Không tìm thấy giường: ${id}`);
    }
    return bed;
  }

  async updateStatus(
    id: string,
    status: string,
    user: any,
  ): Promise<Bed> {
    const bed = await this.bedModel
      .findByIdAndUpdate(id, { $set: { status } }, { returnDocument: 'after' })
      .exec();
    if (!bed) {
      throw new NotFoundException(`Không tìm thấy giường: ${id}`);
    }

    // Sync room availability after bed status change
    await this.roomsService.syncRoomAvailability(
      (bed.room_id as any)._id?.toString() || bed.room_id.toString(),
    );

    return bed;
  }

  async remove(id: string, user: any): Promise<Bed> {
    const bed = await this.bedModel.findById(id);
    if (!bed) {
      throw new NotFoundException(`Không tìm thấy giường: ${id}`);
    }
    if (bed.status === 'Đang sử dụng') {
      throw new ConflictException('Không thể xóa giường đang sử dụng');
    }

    const roomId = bed.room_id.toString();
    await this.bedModel.findByIdAndDelete(id);

    // Sync room availability
    await this.roomsService.syncRoomAvailability(roomId);

    return bed;
  }

  /**
   * Auto-create beds for a room based on room capacity
   */
  async autoCreateBeds(
    roomId: string,
    soGiuong: number,
    user: any,
  ): Promise<Bed[]> {
    const beds: Bed[] = [];
    for (let i = 1; i <= soGiuong; i++) {
      const bed = new this.bedModel({
        bed_code: `G${i.toString().padStart(2, '0')}`,
        room_id: roomId,
        position: `Vị trí ${i}`,
        status: 'Trống',
      });
      beds.push(await bed.save());
    }
    await this.roomsService.syncRoomAvailability(roomId);
    return beds;
  }
}
