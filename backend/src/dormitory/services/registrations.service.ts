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
import { PublicRegistration, PublicRegistrationDocument } from '../schemas/public-registration.schema';
import { CreateTemporaryRegistrationDto } from '../dto/create-temporary-registration.dto';
import { SemestersService } from '../../semesters/semesters.service';

@Injectable()
export class RegistrationsService {
  constructor(
    @InjectModel(Registration.name)
    private registrationModel: Model<RegistrationDocument>,
    @InjectModel(Invoice.name)
    private invoiceModel: Model<InvoiceDocument>,
    @InjectModel(Contract.name)
    private contractModel: Model<ContractDocument>,
    @InjectModel(PublicRegistration.name)
    private publicRegModel: Model<PublicRegistrationDocument>,
    private readonly semestersService: SemestersService,
  ) {}

  async createTemporary(dto: CreateTemporaryRegistrationDto) {
    const active = (await this.semestersService.findAll()).filter((item) => item.status === 'active');
    if (active.length !== 1) {
      throw new BadRequestException(active.length ? 'Có nhiều học kỳ active. Vui lòng kiểm tra cấu hình học kỳ.' : 'Chưa có học kỳ active. Vui lòng cấu hình học kỳ trước khi đăng ký.');
    }
    const existing = await this.publicRegModel.findOne({ phone_number: dto.phone_number, status: 'Chờ xác nhận' });
    if (existing) {
      throw new ConflictException('Số điện thoại này đã có đơn đăng ký tạm đang chờ xử lý.');
    }
    const parts = active[0].semester_name.split(/\s*-\s*/);
    const registration = new this.publicRegModel({
      public_registration_code: `PUB-${uuidv4().substring(0, 8).toUpperCase()}`,
      full_name: dto.full_name.trim(), phone_number: dto.phone_number.trim(),
      student_code: '', date_of_birth: dto.date_of_birth, gender: dto.gender,
      room_type: dto.gender === 'Female' ? (dto.room_type || 'Thường') : 'Thường',
      semester: parts[0] || '', academic_year: parts.slice(1).join('-').replace(/\s/g, ''),
      notes: dto.notes || '', status: 'Chờ xác nhận', source: 'ADMIN_ENTRY',
    });
    return registration.save();
  }

  async create(dto: CreateRegistrationDto, user: any): Promise<Registration> {
    // BR3: Check overdue invoices > 1 kỳ
    const overdueCount = await this.invoiceModel.countDocuments({
      student_id: dto.student_id,
      status: 'Quá hạn',
    });
    if (overdueCount > 0) {
      throw new BadRequestException(
        'Sinh viên có hóa đơn quá hạn chưa thanh toán. Vui lòng thanh toán trước khi đăng ký.',
      );
    }

    // Check existing pending registration
    const existing = await this.registrationModel.findOne({
      student_id: dto.student_id,
      status: 'Chờ duyệt',
    });
    if (existing) {
      throw new ConflictException(
        'Sinh viên đã có đơn đăng ký đang chờ duyệt',
      );
    }

    // BR1: Check existing active contract
    const activeContract = await this.contractModel.findOne({
      student_id: dto.student_id,
      status: 'Hiệu lực',
    });
    if (activeContract) {
      throw new ConflictException(
        'Sinh viên đang có hợp đồng KTX hiệu lực',
      );
    }

    const registration = new this.registrationModel({
      ...dto,
      registration_code: `DK-${uuidv4().substring(0, 8).toUpperCase()}`,
      status: 'Chờ duyệt',
    });

    return registration.save();
  }

  async findAll(query: {
    status?: string;
    semester?: string;
    academic_year?: string;
    search?: string;
    source?: string;
    page?: number;
    limit?: number;
  }) {
    const search = query.search?.trim();
    const filter: any = {};
    if (query.status) filter.status = query.status;
    if (query.semester) filter.semester = query.semester;
    if (query.academic_year) filter.academic_year = query.academic_year;

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [formalData, publicData] = await Promise.all([
      this.registrationModel
        .find(filter)
        .populate('student_id', 'student_code full_name class_id')
        .populate('reviewed_by_id', 'user_name')
        .sort({ createdAt: -1 })
        .exec(),
      this.publicRegModel.find({
        ...(query.source === 'ADMIN_TEMPORARY' ? { source: 'ADMIN_ENTRY' } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(search ? { $or: ['public_registration_code', 'full_name', 'student_code', 'phone_number', 'email'].map(field => ({ [field]: { $regex: search, $options: 'i' } })) } : {}),
      }).sort({ createdAt: -1 }).lean(),
    ]);

    const normalizedSearch = search?.toLocaleLowerCase();
    const matches = (values: unknown[]) => !normalizedSearch || values.some(value => String(value ?? '').toLocaleLowerCase().includes(normalizedSearch));
    const formalRows = (query.source && query.source !== 'FORMAL' ? [] : formalData).filter((item: any) => matches([item.registration_code, item.student_id?.full_name, item.student_id?.student_code])).map((item: any) => ({
      ...item.toObject(), source: 'FORMAL', classification_status: item.student_id?.class_id ? 'CLASSIFIED' : 'MISSING_CLASS',
      student_code: item.student_id?.student_code ?? null, full_name: item.student_id?.full_name ?? null, class_id: item.student_id?.class_id ?? null,
    }));
    const publicRows = (query.source === 'FORMAL' ? [] : publicData).filter((item: any) => !item.linked_student_id && !item.linked_registration_id && (query.source !== 'PUBLIC' || item.source !== 'ADMIN_ENTRY') && matches([item.public_registration_code, item.full_name, item.student_code, item.phone_number, item.email])).map((item: any) => ({
      ...item, _id: String(item._id), registration_code: item.public_registration_code, student_id: null, student_code: item.student_code || null, full_name: item.full_name, class_id: null,
      source: item.source === 'ADMIN_ENTRY' ? 'ADMIN_TEMPORARY' : 'PUBLIC', classification_status: item.student_code ? 'MISSING_CLASS' : 'UNCLASSIFIED',
    }));
    const data = [...formalRows, ...publicRows]
      .sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    const total = data.length;

    return {
      data: data.slice(skip, skip + limit),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findUnclassified(query: { page?: number; limit?: number; search?: string }) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const filter: any = {
      student_code: { $in: ['', null] },
      linked_student_id: { $exists: false },
      linked_registration_id: { $exists: false },
    };
    const search = query.search?.trim();
    if (search) filter.$or = ['public_registration_code', 'full_name', 'phone_number', 'email'].map(field => ({ [field]: { $regex: search, $options: 'i' } }));
    const [data, total] = await Promise.all([
      this.publicRegModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.publicRegModel.countDocuments(filter),
    ]);
    return {
      data: data.map((item: any) => ({ ...item, source: item.source === 'ADMIN_ENTRY' ? 'ADMIN_TEMPORARY' : 'PUBLIC', classification_status: 'UNCLASSIFIED', student_id: null, class_id: null })),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<Registration> {
    const reg = await this.registrationModel
      .findById(id)
      .populate('student_id')
      .populate('reviewed_by_id', 'user_name')
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
    if (reg.status !== 'Chờ duyệt') {
      throw new BadRequestException('Đơn đăng ký không ở trạng thái chờ duyệt');
    }

    if (dto.status === 'Từ chối' && !dto.rejection_reason) {
      throw new BadRequestException('Vui lòng nhập lý do từ chối');
    }

    reg.status = dto.status;
    reg.rejection_reason = dto.rejection_reason || '';
    reg.reviewed_by_id = user._id || user.userId;
    reg.reviewed_at = new Date();

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
          { status: dto.status, rejection_reason: dto.rejection_reason },
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
