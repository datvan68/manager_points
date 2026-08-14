import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
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
import { v4 as uuidv4 } from 'uuid';
import { PublicRegistration, PublicRegistrationDocument } from '../schemas/public-registration.schema';
import { CreateTemporaryRegistrationDto } from '../dto/create-temporary-registration.dto';
import { UpdateRegistrationDto } from '../dto/update-registration.dto';
import { SemestersService } from '../../semesters/semesters.service';
import { Student, StudentDocument } from '../../students/schemas/student.schema';

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
    @InjectModel(Student.name)
    private readonly studentModel?: Model<StudentDocument>,
  ) {}

  private async studentForUser(userId: string) {
    if (!this.studentModel) throw new ForbiddenException('Không tìm thấy hồ sơ sinh viên liên kết');
    const student = await this.studentModel.findOne({ user_id: userId }).exec();
    if (!student) throw new ForbiddenException('Không tìm thấy hồ sơ sinh viên liên kết');
    return student;
  }

  private isRejectedOrCancelled(status?: string) {
    const value = String(status || '').toLocaleLowerCase();
    return value.includes('từ chối') || value.includes('tá»« chá»‘i') || value.includes('cancel') || value.includes('huỷ') || value.includes('hủy');
  }

  private toPlain(value: any) {
    return value?.toObject ? value.toObject() : value;
  }

  /** The current record is contract-backed first, then the latest non-final application. */
  async findMine(userId: string) {
    const student = await this.studentForUser(userId);
    const registrations = await this.registrationModel.find({ student_id: student._id })
      .populate('room_id', 'room_name room_code')
      .populate('bed_id', 'bed_code')
      .sort({ createdAt: -1 }).exec();
    if (!registrations.length) return { has_dormitory_registration: false, registration: null, history: [] };

    const activeContracts = await this.contractModel.find({ student_id: student._id, status: 'Hiệu lực' })
      .populate('room_id', 'room_name room_code').populate('bed_id', 'bed_code').exec();
    const byId = new Map(registrations.map((registration: any) => [String(registration._id), registration]));
    const activeContract = activeContracts.find((contract: any) => byId.has(String(contract.registration_id)));
    const selected: any = activeContract
      ? byId.get(String((activeContract as any).registration_id))
      : registrations.find((registration: any) => !this.isRejectedOrCancelled(registration.status)) || registrations[0];
    const isActive = !!activeContract;
    const isHistorical = selected !== registrations[0] || this.isRejectedOrCancelled(selected?.status);
    const editable = !isActive && !isHistorical && !selected?.room_id && !selected?.bed_id;
    const registration = this.toPlain(selected);
    return {
      has_dormitory_registration: true,
      registration: {
        ...registration,
        active_contract: activeContract ? this.toPlain(activeContract) : null,
        editable_fields: editable ? ['phone_number', 'preference', 'priority_group', 'applicant_profile'] : [],
      },
      history: registrations.map((item: any) => ({
        _id: item._id, registration_code: item.registration_code, status: item.status,
        semester: item.semester, academic_year: item.academic_year, createdAt: item.createdAt,
      })),
    };
  }

  async updateMine(userId: string, dto: Record<string, unknown>) {
    const own = await this.findMine(userId);
    const registration: any = own.registration;
    if (!registration) throw new NotFoundException('Chưa có đơn đăng ký ký túc xá');
    const allowed = new Set(registration.editable_fields || []);
    const keys = Object.keys(dto || {});
    const invalid = keys.filter((key) => !allowed.has(key));
    if (!keys.length || invalid.length) throw new BadRequestException('Chỉ có thể cập nhật các trường thông tin đơn do sinh viên cung cấp');
    const record = await this.registrationModel.findById(registration._id).exec();
    if (!record) throw new NotFoundException('Không tìm thấy đơn đăng ký');
    for (const key of keys) (record as any)[key] = dto[key];
    if (typeof dto.phone_number === 'string') (record as any).phone_number = dto.phone_number.trim();
    return record.save();
  }

  private escapeHtml(value: unknown) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character] as string));
  }

  private legacyApplicationHtml(data: any) {
    const value = (key: string) => this.escapeHtml(data[key]);
    const applicant = data.applicant_profile || {};
    const applicantValue = (key: string) => this.escapeHtml(applicant[key]);
    const parent = (name: string, key: string) => this.escapeHtml(applicant?.[name]?.[key]);
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
      @page { size: A4 portrait; margin: 20mm 20mm 20mm 30mm; } body { font-family: "Arial", "Noto Sans", sans-serif; font-size: 12pt; line-height: 1.35; } .center{text-align:center}.header{display:flex;justify-content:space-between}.header div{width:45%}.title{font-size:15pt;font-weight:bold;margin:18px 0 12px}.row{margin:5px 0}.signatures{display:flex;justify-content:space-between;margin-top:28px;text-align:center}.signatures div{width:42%}.blank{min-height:55px}</style></head><body>
      <div class="header"><div class="center"><b>BỘ GIÁO DỤC VÀ ĐÀO TẠO</b><br><b>TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN</b></div><div class="center"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập - Tự do - Hạnh phúc</b></div></div>
      <div class="center title">ĐƠN XIN VÀO KÝ TÚC XÁ</div><p>Kính gửi: Ban Quản lý Ký túc xá</p>
      <div class="row">Họ và tên: <b>${value('full_name')}</b> &nbsp; Ngày sinh: ${value('date_of_birth')} &nbsp; Giới tính: ${value('gender')}</div>
      <div class="row">Mã số sinh viên: ${value('student_code')} &nbsp; Lớp: ${value('class_name')} &nbsp; Khoa: ${value('department_name')}</div>
      <div class="row">Dân tộc: ${applicantValue('ethnicity')} &nbsp; Tôn giáo: ${applicantValue('religion')} &nbsp; Điện thoại: ${value('phone_number')}</div>
      <div class="row">CCCD/CMND: ${applicantValue('citizen_id_number')} &nbsp; Ngày cấp: ${applicantValue('citizen_id_issue_date')} &nbsp; Nơi cấp: ${applicantValue('citizen_id_issue_place')}</div>
      <div class="row">Địa chỉ thường trú: ${applicantValue('permanent_address')}</div>
      <div class="row"><b>Cha:</b> ${parent('father','full_name')} &nbsp; Tuổi: ${parent('father','age')} &nbsp; Nghề nghiệp: ${parent('father','occupation')} &nbsp; Điện thoại: ${parent('father','phone_number')}</div>
      <div class="row">Địa chỉ thường trú: ${parent('father','permanent_address')} &nbsp; Địa chỉ liên lạc: ${parent('father','contact_address')}</div>
      <div class="row"><b>Mẹ:</b> ${parent('mother','full_name')} &nbsp; Tuổi: ${parent('mother','age')} &nbsp; Nghề nghiệp: ${parent('mother','occupation')} &nbsp; Điện thoại: ${parent('mother','phone_number')}</div>
      <div class="row">Địa chỉ thường trú: ${parent('mother','permanent_address')} &nbsp; Địa chỉ liên lạc: ${parent('mother','contact_address')}</div>
      <div class="row">Diện ưu tiên: ${value('priority_group')} &nbsp; Giấy tờ minh chứng: ${applicantValue('priority_certificate_details')}</div>
      <p>Tôi cam đoan những nội dung khai trên là đúng sự thật, chấp hành đầy đủ nội quy ký túc xá và chịu trách nhiệm về đơn đăng ký này.</p>
      <div class="signatures">${data.is_under_18 ? '<div><b>PHỤ HUYNH/NGƯỜI GIÁM HỘ</b><div class="blank"></div><i>(Ký và ghi rõ họ tên)</i></div>' : '<div></div>'}<div><i>..., ngày ... tháng ... năm ...</i><br><b>NGƯỜI LÀM ĐƠN</b><div class="blank"></div><i>(Ký và ghi rõ họ tên)</i></div></div>
    </body></html>`;
  }

  private async legacyGenerateApplicationPdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    this.validateId(id);
    const registration: any = await this.registrationModel.findById(id).populate({ path: 'student_id', populate: { path: 'class_id', populate: { path: 'dept_id' } } }).exec();
    if (!registration) throw new NotFoundException('Không tìm thấy đơn đăng ký');
    const student: any = registration.student_id || {};
    const birthDate = registration.date_of_birth || student.date_bir;
    const date = birthDate ? new Date(birthDate) : null;
    const age = date ? new Date().getFullYear() - date.getFullYear() - ((new Date().getMonth() < date.getMonth() || (new Date().getMonth() === date.getMonth() && new Date().getDate() < date.getDate())) ? 1 : 0) : null;
    const html = this.applicationHtml({ ...this.toPlain(registration), full_name: student.full_name, student_code: student.student_code, class_name: student.class_id?.class_name, department_name: student.class_id?.dept_id?.name, date_of_birth: date ? date.toLocaleDateString('vi-VN') : '', gender: registration.gender || student.sex, is_under_18: age !== null && age < 18 });
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--no-zygote'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const buffer = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '30mm' } });
      return { buffer, filename: `don-ky-tuc-xa-${String(registration.registration_code || id).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` };
    } finally { await browser.close(); }
  }

  private clean(value: unknown): string {
    if (value === null || value === undefined) return '';
    const text = String(value).trim();
    return ['undefined', 'null', 'N/A', '—', 'Chưa có', 'Không tìm thấy'].includes(text) ? '' : text;
  }

  private displayDate(value: unknown): string {
    if (!value) return '';
    const date = new Date(value as any);
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  private displayGender(value: unknown): string {
    return ({ Male: 'Nam', Female: 'Nữ', Other: 'Khác' } as Record<string, string>)[this.clean(value)] || '';
  }

  private applicationViewModel(record: any, source: 'FORMAL' | 'PUBLIC' | 'ADMIN_TEMPORARY') {
    const plain = this.toPlain(record) || {};
    const student = source === 'FORMAL' ? this.toPlain(plain.student_id) || {} : {};
    const classRecord = this.toPlain(student.class_id) || {};
    const department = this.toPlain(classRecord.dept_id) || {};
    const applicant = this.toPlain(plain.applicant_profile) || {};
    const parent = (key: 'father' | 'mother') => this.toPlain(applicant[key]) || {};
    const birth = plain.date_of_birth || student.date_bir;
    const date = birth ? new Date(birth) : null;
    const age = date && !Number.isNaN(date.getTime())
      ? new Date().getFullYear() - date.getFullYear() - (new Date().setHours(0, 0, 0, 0) < new Date(new Date().getFullYear(), date.getMonth(), date.getDate()).getTime() ? 1 : 0)
      : null;
    const fullName = source === 'FORMAL' ? plain.full_name || student.full_name : plain.full_name;
    const studentCode = source === 'FORMAL' ? plain.student_code || student.student_code : plain.student_code;
    return {
      full_name: this.clean(fullName), date_of_birth: this.displayDate(birth), gender: this.displayGender(plain.gender || student.sex),
      student_code: this.clean(studentCode), class_name: this.clean(plain.class_name || classRecord.class_name), department_name: this.clean(plain.department_name || department.name),
      ethnicity: this.clean(applicant.ethnicity), religion: this.clean(applicant.religion), phone_number: this.clean(plain.phone_number),
      citizen_id_number: this.clean(applicant.citizen_id_number), citizen_id_issue_date: this.displayDate(applicant.citizen_id_issue_date), citizen_id_issue_place: this.clean(applicant.citizen_id_issue_place),
      permanent_address: this.clean(applicant.permanent_address), priority_group: this.clean(plain.priority_group), priority_certificate_details: this.clean(applicant.priority_certificate_details),
      father: parent('father'), mother: parent('mother'), is_under_18: age !== null && age < 18,
      registration_code: this.clean(plain.registration_code || plain.public_registration_code),
    };
  }

  private applicationHtml(data: any) {
    const v = (value: unknown) => this.escapeHtml(this.clean(value));
    const parent = (key: 'father' | 'mother', field: string) => v(data[key]?.[field]);
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
      @page{size:A4 portrait;margin:20mm 20mm 20mm 30mm}*{box-sizing:border-box}body{font-family:Arial,"Noto Sans",sans-serif;font-size:11pt;line-height:1.32;color:#000}.center{text-align:center}.header{display:grid;grid-template-columns:1fr 1fr;gap:18px;font-size:10pt}.title{font-size:15pt;font-weight:700;text-align:center;margin:18px 0 12px}.line{display:inline-block;border-bottom:1px solid #000;min-width:100px;vertical-align:bottom}.row{margin:5px 0}.section{margin-top:9px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin-top:30px;text-align:center}.signature{min-height:100px}.small{font-size:10pt}
    </style></head><body>
      <div class="header"><div class="center"><b>BỘ GIÁO DỤC VÀ ĐÀO TẠO</b><br><b>TRƯỜNG CAO ĐẲNG BÁCH KHOA NAM SÀI GÒN</b></div><div class="center"><b>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</b><br><b>Độc lập - Tự do - Hạnh phúc</b></div></div>
      <div class="title">ĐƠN XIN VÀO KÝ TÚC XÁ</div><p>Kính gửi: Ban Quản lý Ký túc xá</p>
      <div class="row">Họ và tên: <b>${v(data.full_name)}</b> &nbsp; Ngày sinh: ${v(data.date_of_birth)} &nbsp; Giới tính: ${v(data.gender)}</div>
      <div class="row">Mã số sinh viên: ${v(data.student_code)} &nbsp; Lớp: ${v(data.class_name)} &nbsp; Khoa: ${v(data.department_name)}</div>
      <div class="row">Dân tộc: ${v(data.ethnicity)} &nbsp; Tôn giáo: ${v(data.religion)} &nbsp; Điện thoại: ${v(data.phone_number)}</div>
      <div class="row">CCCD/CMND: ${v(data.citizen_id_number)} &nbsp; Ngày cấp: ${v(data.citizen_id_issue_date)} &nbsp; Nơi cấp: ${v(data.citizen_id_issue_place)}</div>
      <div class="row">Địa chỉ thường trú: ${v(data.permanent_address)}</div>
      <div class="section"><b>Thông tin cha:</b> Họ và tên: ${parent('father','full_name')} &nbsp; Tuổi: ${parent('father','age')} &nbsp; Nghề nghiệp: ${parent('father','occupation')} &nbsp; Điện thoại: ${parent('father','phone_number')}<br>Địa chỉ thường trú: ${parent('father','permanent_address')} &nbsp; Địa chỉ liên lạc: ${parent('father','contact_address')}</div>
      <div class="section"><b>Thông tin mẹ:</b> Họ và tên: ${parent('mother','full_name')} &nbsp; Tuổi: ${parent('mother','age')} &nbsp; Nghề nghiệp: ${parent('mother','occupation')} &nbsp; Điện thoại: ${parent('mother','phone_number')}<br>Địa chỉ thường trú: ${parent('mother','permanent_address')} &nbsp; Địa chỉ liên lạc: ${parent('mother','contact_address')}</div>
      <div class="section">Diện ưu tiên: ${v(data.priority_group)} &nbsp; Giấy tờ minh chứng: ${v(data.priority_certificate_details)}</div>
      <p class="section">Tôi cam đoan những nội dung khai trên là đúng sự thật, chấp hành đầy đủ nội quy ký túc xá và chịu trách nhiệm về đơn đăng ký này.</p>
      <div class="signatures">${data.is_under_18 ? '<div><b>PHỤ HUYNH/NGƯỜI GIÁM HỘ</b><div class="signature"></div><i>(Ký và ghi rõ họ tên)</i></div>' : '<div></div>'}<div><i>..., ngày ... tháng ... năm ...</i><br><b>NGƯỜI LÀM ĐƠN</b><div class="signature"></div><i>(Ký và ghi rõ họ tên)</i></div></div>
    </body></html>`;
  }

  async generateApplicationPdf(id: string, source: string): Promise<{ buffer: Buffer; filename: string }> {
    this.validateId(id);
    const normalizedSource = this.validateSource(source);
    let record: any;
    if (normalizedSource === 'FORMAL') {
      record = await this.registrationModel.findById(id)
        .populate({ path: 'student_id', populate: { path: 'class_id', populate: { path: 'dept_id' } } }).exec();
    } else {
      record = await this.publicRegModel.findOne({ _id: id, ...(normalizedSource === 'ADMIN_TEMPORARY' ? { source: 'ADMIN_ENTRY' } : { source: { $ne: 'ADMIN_ENTRY' } }) }).exec();
    }
    if (!record) throw new NotFoundException('Không tìm thấy đơn đăng ký');
    const viewModel = this.applicationViewModel(record, normalizedSource);
    const html = this.applicationHtml(viewModel);
    const puppeteer = require('puppeteer');
    const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--single-process', '--no-zygote'] });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const buffer = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '30mm' } });
      const code = viewModel.registration_code || id;
      return { buffer, filename: `don-ky-tuc-xa-${code.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` };
    } finally { await browser.close(); }
  }

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
      }).populate('room_id', 'room_name room_code').sort({ createdAt: -1 }).lean(),
    ]);

    const formalIds = formalData.map((item: any) => item._id).filter(Boolean);
    const activeContracts = formalIds.length && typeof (this.contractModel as any).find === 'function'
      ? await (this.contractModel as any).find({ registration_id: { $in: formalIds }, status: 'Hiệu lực' }).populate('room_id', 'room_name room_code').populate('bed_id', 'bed_code').lean()
      : [];
    const contractByRegistration = new Map<string, any>((activeContracts || []).map((contract: any) => [String(contract.registration_id), contract]));

    const normalizedSearch = search?.toLocaleLowerCase();
    const matches = (values: unknown[]) => !normalizedSearch || values.some(value => String(value ?? '').toLocaleLowerCase().includes(normalizedSearch));
    const formalRows = (query.source && query.source !== 'FORMAL' ? [] : formalData).filter((item: any) => matches([item.registration_code, item.student_id?.full_name, item.student_id?.student_code])).map((item: any) => {
      const activeContract = contractByRegistration.get(String(item._id));
      const effectiveRoom = activeContract?.room_id || item.room_id;
      const effectiveBed = activeContract?.bed_id || item.bed_id;
      return {
        ...item.toObject(), source: 'FORMAL', classification_status: item.student_id?.class_id ? 'CLASSIFIED' : 'MISSING_CLASS',
        student_code: item.student_id?.student_code ?? null, full_name: item.student_id?.full_name ?? null, class_id: item.student_id?.class_id ?? null,
        room_id: effectiveRoom || null,
        bed_id: effectiveBed || null,
        active_contract_id: activeContract?._id || null,
        assigned_room_name: effectiveRoom?.room_name || effectiveRoom?.room_code || '',
      };
    });
    const publicRows = (query.source === 'FORMAL' ? [] : publicData).filter((item: any) => !item.linked_student_id && !item.linked_registration_id && (query.source !== 'PUBLIC' || item.source !== 'ADMIN_ENTRY') && matches([item.public_registration_code, item.full_name, item.student_code, item.phone_number, item.email])).map((item: any) => ({
      ...item, _id: String(item._id), registration_code: item.public_registration_code, student_id: null, student_code: item.student_code || null, full_name: item.full_name, class_id: null,
      source: item.source === 'ADMIN_ENTRY' ? 'ADMIN_TEMPORARY' : 'PUBLIC', classification_status: item.student_code ? 'MISSING_CLASS' : 'UNCLASSIFIED',
      assigned_room_name: item.room_id?.room_name || item.room_name || item.room_code || '',
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
    const payload = { ...(dto as Record<string, unknown>) };
    const formalFields = ['semester', 'academic_year', 'date_of_birth', 'gender', 'phone_number', 'preference', 'priority_group'];
    const publicFields = ['full_name', 'student_code', 'semester', 'academic_year', 'date_of_birth', 'gender', 'phone_number', 'room_type', 'priority_group', 'notes'];
    if (source !== 'FORMAL' && Object.prototype.hasOwnProperty.call(payload, 'preference')) {
      const preference = payload.preference;
      if (preference && typeof preference === 'object' && !Array.isArray(preference)) {
        const values = preference as Record<string, unknown>;
        if (payload.room_type === undefined && values.room_type !== undefined) payload.room_type = values.room_type;
        if (payload.notes === undefined && values.notes !== undefined) payload.notes = values.notes;
      }
      delete payload.preference;
    }
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

}
