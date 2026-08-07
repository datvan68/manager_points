import {
  Injectable,
  NotFoundException,
  BadRequestException,
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
    // Validate registration
    const reg = await this.registrationModel.findById(dto.registration_id);
    if (!reg) {
      const publicRegistration = await this.publicRegistrationModel.findById(dto.registration_id);
      if (!publicRegistration) throw new NotFoundException('Không tìm thấy đơn đăng ký');
      const room = await this.roomModel.findById(dto.room_id);
      if (!room) throw new NotFoundException('Không tìm thấy phòng');
      if (room.available_bed_count <= 0) throw new BadRequestException('Phòng đã hết chỗ trống');
      const bed = await this.bedModel.findById(dto.bed_id);
      if (!bed || bed.status !== 'Trống' || bed.room_id.toString() !== dto.room_id) throw new BadRequestException('Giường không hợp lệ hoặc đã được sử dụng');
      bed.status = 'Đang sử dụng';
      await bed.save();
      await this.roomsService.syncRoomAvailability(dto.room_id);
      publicRegistration.room_id = room._id as any;
      publicRegistration.room_code = room.room_code;
      await publicRegistration.save();
      return { registration: publicRegistration, room, bed, message: 'Phân phòng thành công' };
    }
    if (!reg) {
      throw new NotFoundException('Không tìm thấy đơn đăng ký');
    }
    if (reg.status !== 'Đã duyệt') {
      throw new BadRequestException('Đơn đăng ký chưa được duyệt');
    }

    // Validate room
    const room = await this.roomModel.findById(dto.room_id);
    if (!room) {
      throw new NotFoundException('Không tìm thấy phòng');
    }
    // BR2: Check room capacity
    if (room.available_bed_count <= 0) {
      throw new BadRequestException('Phòng đã hết chỗ trống');
    }

    // Validate bed
    const bed = await this.bedModel.findById(dto.bed_id);
    if (!bed) {
      throw new NotFoundException('Không tìm thấy giường');
    }
    if (bed.status !== 'Trống') {
      throw new BadRequestException('Giường đã được sử dụng');
    }
    if (bed.room_id.toString() !== dto.room_id) {
      throw new BadRequestException('Giường không thuộc phòng đã chọn');
    }

    // Update bed status
    bed.status = 'Đang sử dụng';
    await bed.save();

    // Sync room availability
    await this.roomsService.syncRoomAvailability(dto.room_id);

    return {
      registration: reg,
      room,
      bed,
      message: 'Phân phòng thành công',
    };
  }

  /**
   * Suggest available rooms based on registration preferences
   */
  async suggestRooms(registrationId: string) {
    const reg = await this.registrationModel.findById(registrationId);
    const publicRegistration = reg ? null : await this.publicRegistrationModel.findById(registrationId);
    if (!reg && !publicRegistration) throw new NotFoundException('Không tìm thấy đơn đăng ký');

    const filter: any = {
      available_bed_count: { $gt: 0 },
      status: { $in: ['Trống'] },
    };

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
      .sort({ available_bed_count: -1 })
      .limit(10)
      .exec();

    return rooms;
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
