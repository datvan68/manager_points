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
import { DormitoryRosterEntry, DormitoryRosterEntryDocument } from '../schemas/dormitory-roster-entry.schema';
import { CreateContractDto, CancelContractDto } from '../dto/create-contract.dto';
import { RoomsService } from './rooms.service';
import { v4 as uuidv4 } from 'uuid';
import { emitDormitoryOverviewInvalidated } from '../dormitory-overview-event-emitter';

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name)
    private contractModel: Model<ContractDocument>,
    @InjectModel(Bed.name) private bedModel: Model<BedDocument>,
    @InjectModel(DormitoryRosterEntry.name)
    private rosterModel: Model<DormitoryRosterEntryDocument>,
    private roomsService: RoomsService,
  ) {}

  async create(dto: CreateContractDto, user: any): Promise<Contract> {
    // BR1: Check max 1 active contract per student
    const activeContract = await this.contractModel.findOne({
      student_id: dto.student_id,
      status: 'Hiệu lực',
    });
    if (activeContract) {
      throw new ConflictException(
        'Sinh viên đã có hợp đồng KTX đang hiệu lực',
      );
    }

    if (dto.roster_entry_id) {
      const entry = await this.rosterModel.findById(dto.roster_entry_id);
      if (!entry || String(entry.student_id) !== String(dto.student_id)) {
        throw new BadRequestException('Mục Danh sách KTX không tồn tại hoặc không thuộc sinh viên.');
      }
      if (String(entry.room_id) !== String(dto.room_id) || String(entry.bed_id) !== String(dto.bed_id)) {
        throw new BadRequestException('Phòng và giường phải trùng với mục Danh sách KTX.');
      }
    }

    // Validate bed is assigned
    const bed = await this.bedModel.findById(dto.bed_id);
    if (!bed) {
      throw new NotFoundException('Không tìm thấy giường');
    }

    const contract = new this.contractModel({
      ...dto,
      contract_code: `HD-${uuidv4().substring(0, 8).toUpperCase()}`,
      status: 'Hiệu lực',
      created_by_id: user._id || user.userId,
    });

    const saved = await contract.save();
    emitDormitoryOverviewInvalidated('contracts');
    return saved;
  }

  async findAll(query: {
    student_id?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.student_id) filter.student_id = query.student_id;
    if (query.status) filter.status = query.status;
    if (query.search) {
      filter.$or = [
        { contract_code: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.contractModel
        .find(filter)
        .populate('student_id', 'student_code full_name')
        .populate('room_id', 'room_code')
        .populate('bed_id', 'bed_code position')
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
      .populate('roster_entry_id')
      .exec();
    if (!contract) {
      throw new NotFoundException(`Không tìm thấy hợp đồng: ${id}`);
    }
    return ((contract as any).toObject?.() || contract) as Contract;
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
    if (contract.status !== 'Hiệu lực') {
      throw new BadRequestException('Hợp đồng không còn hiệu lực');
    }

    // Free the bed
    await this.bedModel.findByIdAndUpdate(contract.bed_id, {
      $set: { status: 'Trống' },
    });

    contract.status = 'Đã hủy';
    contract.cancellation_reason = dto.cancellation_reason;
    const saved = await contract.save();

    // Sync room availability
    await this.roomsService.syncRoomAvailability(contract.room_id.toString());
    emitDormitoryOverviewInvalidated('contracts');

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
    if (contract.status !== 'Hiệu lực') {
      throw new BadRequestException('Chỉ gia hạn hợp đồng đang hiệu lực');
    }

    contract.end_date = new Date(newEndDate);
    const saved = await contract.save();
    emitDormitoryOverviewInvalidated('contracts');
    return saved;
  }
}
