import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contract, ContractDocument } from '../schemas/contract.schema';
import { Bed, BedDocument } from '../schemas/bed.schema';
import {
  Registration,
  RegistrationDocument,
} from '../schemas/registration.schema';
import { CreateContractDto, CancelContractDto } from '../dto/create-contract.dto';
import { RoomsService } from './rooms.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name)
    private contractModel: Model<ContractDocument>,
    @InjectModel(Bed.name) private bedModel: Model<BedDocument>,
    @InjectModel(Registration.name)
    private registrationModel: Model<RegistrationDocument>,
    private roomsService: RoomsService,
  ) {}

  async create(dto: CreateContractDto, user: any): Promise<Contract> {
    // BR1: Check max 1 active contract per student
    const activeContract = await this.contractModel.findOne({
      student_id: dto.student_id,
      trang_thai: 'Hiệu lực',
    });
    if (activeContract) {
      throw new ConflictException(
        'Sinh viên đã có hợp đồng KTX đang hiệu lực',
      );
    }

    // BR5: Validate registration is approved and room is assigned
    if (dto.registration_id) {
      const reg = await this.registrationModel.findById(dto.registration_id);
      if (!reg || reg.trang_thai !== 'Đã duyệt') {
        throw new BadRequestException(
          'Đăng ký chưa được duyệt hoặc không tồn tại',
        );
      }
    }

    // Validate bed is assigned
    const bed = await this.bedModel.findById(dto.bed_id);
    if (!bed) {
      throw new NotFoundException('Không tìm thấy giường');
    }

    const contract = new this.contractModel({
      ...dto,
      ma_hd: `HD-${uuidv4().substring(0, 8).toUpperCase()}`,
      trang_thai: 'Hiệu lực',
      nguoi_tao_id: user._id || user.userId,
    });

    return contract.save();
  }

  async findAll(query: {
    student_id?: string;
    trang_thai?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.student_id) filter.student_id = query.student_id;
    if (query.trang_thai) filter.trang_thai = query.trang_thai;
    if (query.search) {
      filter.$or = [
        { ma_hd: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.contractModel
        .find(filter)
        .populate('student_id', 'student_code full_name')
        .populate('room_id', 'ma_phong')
        .populate('bed_id', 'ma_giuong vi_tri')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.contractModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Contract> {
    const contract = await this.contractModel
      .findById(id)
      .populate('student_id')
      .populate('room_id')
      .populate('bed_id')
      .populate('registration_id')
      .exec();
    if (!contract) {
      throw new NotFoundException(`Không tìm thấy hợp đồng: ${id}`);
    }
    return contract;
  }

  /**
   * UC06: Cancel contract (checkout) — BR6: requires manager confirmation
   */
  async cancel(
    id: string,
    dto: CancelContractDto,
    user: any,
  ): Promise<Contract> {
    const contract = await this.contractModel.findById(id);
    if (!contract) {
      throw new NotFoundException(`Không tìm thấy hợp đồng: ${id}`);
    }
    if (contract.trang_thai !== 'Hiệu lực') {
      throw new BadRequestException('Hợp đồng không còn hiệu lực');
    }

    // Free the bed
    await this.bedModel.findByIdAndUpdate(contract.bed_id, {
      $set: { trang_thai: 'Trống' },
    });

    contract.trang_thai = 'Đã hủy';
    contract.ly_do_huy = dto.ly_do_huy;
    const saved = await contract.save();

    // Sync room availability
    await this.roomsService.syncRoomAvailability(contract.room_id.toString());

    return saved;
  }

  /**
   * Extend contract end date
   */
  async extend(id: string, newEndDate: string, user: any): Promise<Contract> {
    const contract = await this.contractModel.findById(id);
    if (!contract) {
      throw new NotFoundException(`Không tìm thấy hợp đồng: ${id}`);
    }
    if (contract.trang_thai !== 'Hiệu lực') {
      throw new BadRequestException('Chỉ gia hạn hợp đồng đang hiệu lực');
    }

    contract.ngay_ket_thuc = new Date(newEndDate);
    return contract.save();
  }
}
