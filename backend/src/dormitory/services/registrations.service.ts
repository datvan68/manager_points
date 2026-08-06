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
    const existing = await this.publicRegModel.findOne({ so_dien_thoai: dto.so_dien_thoai, trang_thai: 'Chờ xác nhận' });
    if (existing) {
      throw new ConflictException('Số điện thoại này đã có đơn đăng ký tạm đang chờ xử lý.');
    }
    const parts = active[0].semester_name.split(/\s*-\s*/);
    const registration = new this.publicRegModel({
      ma_dk_public: `PUB-${uuidv4().substring(0, 8).toUpperCase()}`,
      ho_ten: dto.ho_ten.trim(), so_dien_thoai: dto.so_dien_thoai.trim(),
      ma_sinh_vien: '', ngay_sinh: dto.ngay_sinh, gioi_tinh: dto.gioi_tinh,
      loai_phong: dto.gioi_tinh === 'Female' ? (dto.loai_phong || 'Thường') : 'Thường',
      ky_hoc: parts[0] || '', nam_hoc: parts.slice(1).join('-').replace(/\s/g, ''),
      ghi_chu: dto.ghi_chu || '', trang_thai: 'Chờ xác nhận', nguon: 'ADMIN_ENTRY',
    });
    return registration.save();
  }

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
    source?: string;
    page?: number;
    limit?: number;
  }) {
    const search = query.search?.trim();
    const filter: any = {};
    if (query.trang_thai) filter.trang_thai = query.trang_thai;
    if (query.ky_hoc) filter.ky_hoc = query.ky_hoc;
    if (query.nam_hoc) filter.nam_hoc = query.nam_hoc;

    const page = query.page || 1;
    const limit = query.limit || 50;
    const skip = (page - 1) * limit;

    const [formalData, publicData] = await Promise.all([
      this.registrationModel
        .find(filter)
        .populate('student_id', 'student_code full_name class_id')
        .populate('nguoi_duyet_id', 'user_name')
        .sort({ createdAt: -1 })
        .exec(),
      this.publicRegModel.find({
        ...(query.source === 'ADMIN_TEMPORARY' ? { nguon: 'ADMIN_ENTRY' } : {}),
        ...(query.trang_thai ? { trang_thai: query.trang_thai } : {}),
        ...(search ? { $or: ['ma_dk_public', 'ho_ten', 'ma_sinh_vien', 'so_dien_thoai', 'email'].map(field => ({ [field]: { $regex: search, $options: 'i' } })) } : {}),
      }).sort({ createdAt: -1 }).lean(),
    ]);

    const normalizedSearch = search?.toLocaleLowerCase();
    const matches = (values: unknown[]) => !normalizedSearch || values.some(value => String(value ?? '').toLocaleLowerCase().includes(normalizedSearch));
    const formalRows = (query.source && query.source !== 'FORMAL' ? [] : formalData).filter((item: any) => matches([item.ma_dk, item.student_id?.full_name, item.student_id?.student_code])).map((item: any) => ({
      ...item.toObject(), source: 'FORMAL', classification_status: item.student_id?.class_id ? 'CLASSIFIED' : 'MISSING_CLASS',
      student_code: item.student_id?.student_code ?? null, full_name: item.student_id?.full_name ?? null, class_id: item.student_id?.class_id ?? null,
    }));
    const publicRows = (query.source === 'FORMAL' ? [] : publicData).filter((item: any) => !item.linked_student_id && !item.linked_registration_id && (query.source !== 'PUBLIC' || item.nguon !== 'ADMIN_ENTRY') && matches([item.ma_dk_public, item.ho_ten, item.ma_sinh_vien, item.so_dien_thoai, item.email])).map((item: any) => ({
      ...item, _id: String(item._id), ma_dk: item.ma_dk_public, student_id: null, student_code: item.ma_sinh_vien || null, full_name: item.ho_ten, class_id: null,
      source: item.nguon === 'ADMIN_ENTRY' ? 'ADMIN_TEMPORARY' : 'PUBLIC', classification_status: item.ma_sinh_vien ? 'MISSING_CLASS' : 'UNCLASSIFIED',
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
      ma_sinh_vien: { $in: ['', null] },
      linked_student_id: { $exists: false },
      linked_registration_id: { $exists: false },
    };
    const search = query.search?.trim();
    if (search) filter.$or = ['ma_dk_public', 'ho_ten', 'so_dien_thoai', 'email'].map(field => ({ [field]: { $regex: search, $options: 'i' } }));
    const [data, total] = await Promise.all([
      this.publicRegModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      this.publicRegModel.countDocuments(filter),
    ]);
    return {
      data: data.map((item: any) => ({ ...item, source: item.nguon === 'ADMIN_ENTRY' ? 'ADMIN_TEMPORARY' : 'PUBLIC', classification_status: 'UNCLASSIFIED', student_id: null, class_id: null })),
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
