import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Registration,
  RegistrationDocument,
} from '../schemas/registration.schema';
import { Invoice, InvoiceDocument } from '../schemas/invoice.schema';
import { Contract, ContractDocument } from '../schemas/contract.schema';
import { CreateRegistrationDto } from '../dto/create-registration.dto';
import {
  ApproveRegistrationDto,
  BulkApproveRegistrationDto,
} from '../dto/approve-registration.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectModel(Registration.name)
    private registrationModel: Model<RegistrationDocument>,
    @InjectModel(Invoice.name)
    private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Contract.name)
    private contractModel: Model<ContractDocument>,
  ) {}

  async create(dto: CreateRegistrationDto, user: any): Promise<Registration> {
    // BR3: Check overdue invoices > 1 kỳ
    const overdueCount = await this.invoiceModel.countDocuments({
      student_id: dto.student_id,
      trang_thai: 'Quá hạn',
    });
    if (overdueCount > 0) {
      throw new BadRequestException(
        'Sinh viên có hóa đơn quá hạn chưa thanh toán. Vui lòng thanh toán trước khi đăng ký.',
      );
    }

    // Check existing pending registration
    const existing = await this.registrationModel.findOne({
      student_id: dto.student_id,
      trang_thai: 'Chờ duyệt',
    });
    if (existing) {
      throw new ConflictException(
        'Sinh viên đã có đơn đăng ký đang chờ duyệt',
      );
    }

    // BR1: Check existing active contract
    const activeContract = await this.contractModel.findOne({
      student_id: dto.student_id,
      trang_thai: 'Hiệu lực',
    });
    if (activeContract) {
      throw new ConflictException(
        'Sinh viên đang có hợp đồng KTX hiệu lực',
      );
    }

    const registration = new this.registrationModel({
      ...dto,
      ma_dk: `DK-${uuidv4().substring(0, 8).toUpperCase()}`,
      trang_thai: 'Chờ duyệt',
    });

    return registration.save();
  }

  async findAll(query: {
    trang_thai?: string;
    ky_hoc?: string;
    nam_hoc?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) {
    const filter: any = {};
    if (query.trang_thai) filter.trang_thai = query.trang_thai;
    if (query.ky_hoc) filter.ky_hoc = query.ky_hoc;
    if (query.nam_hoc) filter.nam_hoc = query.nam_hoc;
    if (query.search) {
      filter.$or = [
        { ma_dk: { $regex: query.search, $options: 'i' } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.registrationModel
        .find(filter)
        .populate('student_id', 'student_code full_name')
        .populate('nguoi_duyet_id', 'user_name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.registrationModel.countDocuments(filter),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Registration> {
    const reg = await this.registrationModel
      .findById(id)
      .populate('student_id')
      .populate('nguoi_duyet_id', 'user_name')
      .exec();
    if (!reg) {
      throw new NotFoundException(`Không tìm thấy đơn đăng ký: ${id}`);
    }
    return reg;
  }

  async approve(
    id: string,
    dto: ApproveRegistrationDto,
    user: any,
  ): Promise<Registration> {
    const reg = await this.registrationModel.findById(id);
    if (!reg) {
      throw new NotFoundException(`Không tìm thấy đơn đăng ký: ${id}`);
    }
    if (reg.trang_thai !== 'Chờ duyệt') {
      throw new BadRequestException('Đơn đăng ký không ở trạng thái chờ duyệt');
    }

    if (dto.trang_thai === 'Từ chối' && !dto.ly_do_tu_choi) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }

    reg.trang_thai = dto.trang_thai;
    reg.ly_do_tu_choi = dto.ly_do_tu_choi || '';
    reg.nguoi_duyet_id = user._id || user.userId;
    reg.ngay_duyet = new Date();

    return reg.save();
  }

  async bulkApprove(
    dto: BulkApproveRegistrationDto,
    user: any,
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const regId of dto.registration_ids) {
      try {
        await this.approve(
          regId,
          { trang_thai: dto.trang_thai, ly_do_tu_choi: dto.ly_do_tu_choi },
          user,
        );
        success++;
      } catch {
        failed++;
      }
    }

    return { success, failed };
  }
}
