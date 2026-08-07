import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
import { UpdateRegistrationDto } from '../dto/update-registration.dto';
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

    // Prevent duplicate active registrations while new records are auto-approved.
    const existing = await this.registrationModel.findOne({
      student_id: dto.student_id,
      status: { $in: ['Chờ duyệt', 'Đã duyệt'] },
    });
    if (existing) {
      throw new ConflictException(
        'Sinh viên đã có đơn đăng ký đang hoạt động',
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
      status: 'Đã duyệt',
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
        .populate('room_id', 'room_name room_code')
        .populate('bed_id', 'bed_code')
        .populate('reviewed_by_id', 'user_name')
        .sort({ createdAt: -1 })
        .exec(),
      this.publicRegModel.find({
        ...(query.source === 'ADMIN_TEMPORARY' ? { source: 'ADMIN_ENTRY' } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(search ? { $or: ['public_registration_code', 'full_name', 'student_code', 'phone_number', 'email'].map(field => ({ [field]: { $regex: search, $options: 'i' } })) } : {}),
      }).sort({ createdAt: -1 }).lean(),
    ]);

    const formalIds = formalData.map((item: any) => item._id).filter(Boolean);
    const activeContracts = formalIds.length && typeof (this.contractModel as any).find === 'function'
      ? await (this.contractModel as any).find({ registration_id: { $in: formalIds }, status: 'Hiệu lực' }).populate('room_id', 'room_name room_code').lean()
      : [];
    const roomByRegistration = new Map((activeContracts || []).map((contract: any) => [String(contract.registration_id), contract.room_id?.room_name || contract.room_id?.room_code || '']));

    const normalizedSearch = search?.toLocaleLowerCase();
    const matches = (values: unknown[]) => !normalizedSearch || values.some(value => String(value ?? '').toLocaleLowerCase().includes(normalizedSearch));
    const formalRows = (query.source && query.source !== 'FORMAL' ? [] : formalData).filter((item: any) => matches([item.registration_code, item.student_id?.full_name, item.student_id?.student_code])).map((item: any) => ({
      ...item.toObject(), source: 'FORMAL', classification_status: item.student_id?.class_id ? 'CLASSIFIED' : 'MISSING_CLASS',
      student_code: item.student_id?.student_code ?? null, full_name: item.student_id?.full_name ?? null, class_id: item.student_id?.class_id ?? null,
      assigned_room_name: item.room_id?.room_name || item.room_id?.room_code || roomByRegistration.get(String(item._id)) || '',
    }));
    const publicRows = (query.source === 'FORMAL' ? [] : publicData).filter((item: any) => !item.linked_student_id && !item.linked_registration_id && (query.source !== 'PUBLIC' || item.source !== 'ADMIN_ENTRY') && matches([item.public_registration_code, item.full_name, item.student_code, item.phone_number, item.email])).map((item: any) => ({
      ...item, _id: String(item._id), registration_code: item.public_registration_code, student_id: null, student_code: item.student_code || null, full_name: item.full_name, class_id: null,
      source: item.source === 'ADMIN_ENTRY' ? 'ADMIN_TEMPORARY' : 'PUBLIC', classification_status: item.student_code ? 'MISSING_CLASS' : 'UNCLASSIFIED',
      assigned_room_name: item.room_name || item.room_code || '',
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

  private validateSource(source: string): 'FORMAL' | 'PUBLIC' | 'ADMIN_TEMPORARY' {
    if (source !== 'FORMAL' && source !== 'PUBLIC' && source !== 'ADMIN_TEMPORARY') {
      throw new BadRequestException('Nguồn đăng ký không hợp lệ');
    }
    return source;
  }

  private validateId(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('Mã đăng ký không hợp lệ');
    }
  }

  async update(id: string, sourceValue: string, dto: UpdateRegistrationDto) {
    this.validateId(id);
    const source = this.validateSource(sourceValue);
    const payload = dto as Record<string, unknown>;
    const formalFields = ['semester', 'academic_year', 'date_of_birth', 'gender', 'phone_number', 'preference', 'priority_group'];
    const publicFields = ['full_name', 'student_code', 'semester', 'academic_year', 'date_of_birth', 'gender', 'phone_number', 'room_type', 'priority_group', 'notes'];
    const allowedFields = source === 'FORMAL' ? formalFields : publicFields;
    const invalidFields = Object.keys(payload).filter((field) => !allowedFields.includes(field));
    if (invalidFields.length) {
      throw new BadRequestException(`Không thể cập nhật trường: ${invalidFields.join(', ')}`);
    }
    if (!Object.keys(payload).length) {
      throw new BadRequestException('Không có dữ liệu cần cập nhật');
    }

    if (source === 'FORMAL') {
      const registration = await this.registrationModel.findById(id);
      if (!registration) throw new NotFoundException(`Không tìm thấy đơn đăng ký: ${id}`);
      Object.assign(registration, payload);
      if (typeof payload.phone_number === 'string') registration.phone_number = payload.phone_number.trim();
      return registration.save();
    }

    const registration = await this.publicRegModel.findById(id);
    if (!registration) throw new NotFoundException(`Không tìm thấy đơn đăng ký: ${id}`);
    if (source === 'ADMIN_TEMPORARY' && registration.source !== 'ADMIN_ENTRY') {
      throw new BadRequestException('Nguồn đăng ký tạm không hợp lệ');
    }
    if (source === 'PUBLIC' && registration.source === 'ADMIN_ENTRY') {
      throw new BadRequestException('Nguồn đăng ký QR không hợp lệ');
    }
    const publicPayload: Record<string, unknown> = { ...payload };
    if (typeof publicPayload.full_name === 'string') publicPayload.full_name = publicPayload.full_name.trim();
    if (typeof publicPayload.phone_number === 'string') publicPayload.phone_number = publicPayload.phone_number.trim();
    Object.assign(registration, publicPayload);
    return registration.save();
  }

  async remove(id: string, sourceValue: string) {
    this.validateId(id);
    const source = this.validateSource(sourceValue);
    if (source === 'FORMAL') {
      const registration = await this.registrationModel.findById(id);
      if (!registration) throw new NotFoundException(`Không tìm thấy đơn đăng ký: ${id}`);
      const contract = await this.contractModel.findOne({ registration_id: id });
      if (contract) throw new ConflictException('Không thể xóa đơn đăng ký đã liên kết với hợp đồng KTX');
      await this.registrationModel.findByIdAndDelete(id);
      return { success: true, id, source };
    }

    const registration = await this.publicRegModel.findById(id);
    if (!registration) throw new NotFoundException(`Không tìm thấy đơn đăng ký: ${id}`);
    if (registration.linked_student_id || registration.linked_registration_id) {
      throw new ConflictException('Không thể xóa đơn đăng ký đã được liên kết');
    }
    if ((source === 'ADMIN_TEMPORARY') !== (registration.source === 'ADMIN_ENTRY')) {
      throw new BadRequestException('Nguồn đăng ký không khớp với bản ghi');
    }
    await this.publicRegModel.findByIdAndDelete(id);
    return { success: true, id, source };
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
