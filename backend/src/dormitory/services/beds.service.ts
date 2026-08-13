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
import { DORMITORY_ENUMS } from '../dormitory-enums';

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

    const roomCode = String((room as any).room_code || '').trim().toUpperCase();
    if (!roomCode) throw new ConflictException('Phòng chưa có mã hợp lệ để tạo giường');
    const existingBeds = await this.bedModel.find({ room_id: dto.room_id }).select('bed_code').lean().exec();
    const prefix = `${roomCode}-G`;
    const used = new Set<number>();
    for (const item of existingBeds as any[]) {
      const value = String(item.bed_code || '');
      if (value.toUpperCase().startsWith(prefix)) {
        const suffix = Number(value.slice(prefix.length));
        if (Number.isInteger(suffix) && suffix > 0) used.add(suffix);
      }
    }
    let suffix = 1;
    while (used.has(suffix)) suffix += 1;
    const bedCode = `${prefix}${suffix}`;

    const bed = new this.bedModel({ ...dto, bed_code: bedCode });
    const saved = await bed.save();
    if (saved.status !== DORMITORY_ENUMS.bedStatus[3]) {
      await this.roomModel.findByIdAndUpdate(dto.room_id, { $inc: { bed_count: 1 } });
    }

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
    if (!(DORMITORY_ENUMS.bedStatus as readonly string[]).includes(status)) {
      throw new ConflictException('Trạng thái giường không hợp lệ');
    }
    const current = await this.bedModel.findById(id);
    if (!current) throw new NotFoundException(`Không tìm thấy giường: ${id}`);
    if (current.status === DORMITORY_ENUMS.bedStatus[1] && status === DORMITORY_ENUMS.bedStatus[3]) {
      throw new ConflictException('Không thể ngừng sử dụng giường đang có sinh viên');
    }
    const bed = await this.bedModel
      .findByIdAndUpdate(id, { $set: { status } }, { returnDocument: 'after' })
      .exec();
    if (!bed) {
      throw new NotFoundException(`Không tìm thấy giường: ${id}`);
    }

    const wasRetired = current.status === DORMITORY_ENUMS.bedStatus[3];
    const isRetired = status === DORMITORY_ENUMS.bedStatus[3];
    if (wasRetired !== isRetired) {
      await this.roomModel.findByIdAndUpdate(current.room_id, { $inc: { bed_count: isRetired ? -1 : 1 } });
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
    if (bed.status !== DORMITORY_ENUMS.bedStatus[3]) {
      await this.roomModel.findByIdAndUpdate(roomId, { $inc: { bed_count: -1 } });
    }

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
    await this.roomsService.ensureRoomBeds(roomId, soGiuong);
    return this.findByRoom(roomId);
    /* Legacy implementation intentionally removed; historical body retained below.
        position: `Vị trí ${i}`,
        status: 'Trống',
    */
  }
}
