import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  ServiceUnavailableException,
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
      .populate('room_id', 'room_name room_code room_price room_type building_id')
      .populate('bed_id', 'bed_code position status')
      .sort({ createdAt: -1 }).exec();
    if (!registrations.length) return { has_dormitory_registration: false, registration: null, history: [] };

    const activeContracts = await this.contractModel.find({ student_id: student._id, status: 'Hiệu lực' })
      .populate('room_id', 'room_name room_code room_price room_type building_id')
      .populate('bed_id', 'bed_code position status').exec();
    const byId = new Map(registrations.map((registration: any) => [String(registration._id), registration]));
    const activeContract = activeContracts.find((contract: any) => byId.has(String(contract.registration_id)));
    const selected: any = activeContract
      ? byId.get(String((activeContract as any).registration_id))
      : registrations.find((registration: any) => !this.isRejectedOrCancelled(registration.status)) || registrations[0];
    const isActive = !!activeContract;
    const isHistorical = selected !== registrations[0] || this.isRejectedOrCancelled(selected?.status);
    const effectiveRoom = (activeContract as any)?.room_id || selected?.room_id;
    const effectiveBed = (activeContract as any)?.bed_id || selected?.bed_id;
    const editable = !isActive && !isHistorical && !selected?.room_id && !selected?.bed_id;
    const registration = this.toPlain(selected);
    return {
      has_dormitory_registration: true,
      registration: {
        ...registration,
        room_id: effectiveRoom ? this.toPlain(effectiveRoom) : null,
        bed_id: effectiveBed ? this.toPlain(effectiveBed) : null,
        active_contract: activeContract ? this.toPlain(activeContract) : null,
        editable_fields: editable ? ['phone_number', 'preference', 'priority_group', 'applicant_profile'] : [],
      },
      history: registrations.map((item: any) => ({
        _id: item._id, registration_code: item.registration_code, status: item.status,
        semester: item.semester, academic_year: item.academic_year, createdAt: item.createdAt,
      })),
    };
  }

  async findByStudentId(studentId: string, requester?: any) {
    if (!Types.ObjectId.isValid(studentId)) {
      return { has_dormitory_registration: false, registration: null, history: [] };
    }

    let student: any;
    if (this.studentModel) {
      student = await this.studentModel.findById(studentId).exec();
    } else {
      const studentModel = this.registrationModel.db.model('Student');
      student = await studentModel.findById(studentId).exec();
    }

    if (!student) {
      return { has_dormitory_registration: false, registration: null, history: [] };
    }

    if (requester) {
      const roleCode = String(requester.roleCode || requester.roleName || requester.role || '').toUpperCase();
      const isStudentRole = roleCode.includes('STUDENT') || roleCode.includes('HOC SINH') || roleCode.includes('SINH VIEN');
      const isTeacherRole = roleCode.includes('TEACHER') || roleCode.includes('GIANG VIEN') || roleCode.includes('ADVISOR');

      if (isStudentRole) {
        const studentUserId = student.user_id?._id || student.user_id;
        if (studentUserId?.toString() !== requester.userId?.toString()) {
          throw new ForbiddenException('Bạn không có quyền truy cập thông tin KTX của sinh viên khác');
        }
      } else if (isTeacherRole) {
        let classModel: any;
        try {
          classModel = this.registrationModel.db.model('Class');
        } catch {
          // ignore if class model not registered
        }
        if (classModel) {
          const classes = await classModel.find({ advisor_id: requester.userId }).select('_id').exec();
          const classIds = classes.map((c: any) => c._id.toString());
          const studentClassId = student.class_id?._id || student.class_id;
          if (!studentClassId || !classIds.includes(studentClassId.toString())) {
            throw new ForbiddenException('Bạn không có quyền truy cập sinh viên ngoài lớp phụ trách');
          }
        }
      }
    }

    const registrations = await this.registrationModel.find({ student_id: student._id })
      .populate('room_id', 'room_name room_code room_price room_type building_id')
      .populate('bed_id', 'bed_code position status')
      .sort({ createdAt: -1 }).exec();

    if (!registrations.length) {
      return { has_dormitory_registration: false, registration: null, history: [] };
    }

    const activeContracts = await this.contractModel.find({ student_id: student._id, status: 'Hiệu lực' })
      .populate('room_id', 'room_name room_code room_price room_type building_id')
      .populate('bed_id', 'bed_code position status').exec();

    const byId = new Map(registrations.map((registration: any) => [String(registration._id), registration]));
    const activeContract = activeContracts.find((contract: any) => byId.has(String(contract.registration_id)));
    const selected: any = activeContract
      ? byId.get(String((activeContract as any).registration_id))
      : registrations.find((registration: any) => !this.isRejectedOrCancelled(registration.status)) || registrations[0];

    const isActive = !!activeContract;
    const isHistorical = selected !== registrations[0] || this.isRejectedOrCancelled(selected?.status);
    const effectiveRoom = (activeContract as any)?.room_id || selected?.room_id;
    const effectiveBed = (activeContract as any)?.bed_id || selected?.bed_id;

    const roleCode = String(requester?.roleCode || requester?.roleName || requester?.role || '').toUpperCase();
    const permissions: string[] = requester?.permissions || [];
    const isAuthorizedStaff = roleCode.includes('ADMIN') || roleCode.includes('SUPERVISOR') || permissions.includes('DORM_REG_UPDATE');

    let editableFields: string[] = [];
    if (isAuthorizedStaff) {
      editableFields = ['semester', 'academic_year', 'date_of_birth', 'gender', 'phone_number', 'preference', 'priority_group', 'applicant_profile'];
    } else {
      const studentUserId = student.user_id?._id || student.user_id;
      const isStudentSelf = requester && studentUserId?.toString() === requester.userId?.toString();
      const editable = isStudentSelf && !isActive && !isHistorical && !selected?.room_id && !selected?.bed_id;
      if (editable) {
        editableFields = ['phone_number', 'preference', 'priority_group', 'applicant_profile'];
      }
    }

    const registration = this.toPlain(selected);
    return {
      has_dormitory_registration: true,
      registration: {
        ...registration,
        room_id: effectiveRoom ? this.toPlain(effectiveRoom) : null,
        bed_id: effectiveBed ? this.toPlain(effectiveBed) : null,
        active_contract: activeContract ? this.toPlain(activeContract) : null,
        editable_fields: editableFields,
      },
      history: registrations.map((item: any) => ({
        _id: item._id,
        registration_code: item.registration_code,
        status: item.status,
        semester: item.semester,
        academic_year: item.academic_year,
        createdAt: item.createdAt,
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
    const parent = (key: 'father' | 'mother') => {
      const value = this.toPlain(applicant[key]) || {};
      return {
        full_name: this.clean(value.full_name),
        age: this.clean(value.age),
        permanent_address: this.clean(value.permanent_address),
        contact_address: this.clean(value.contact_address),
        occupation: this.clean(value.occupation),
        phone_number: this.clean(value.phone_number),
      };
    };
    const birth = plain.date_of_birth || student.date_bir;
    const fullName = source === 'FORMAL' ? plain.full_name || student.full_name : plain.full_name;
    return {
      full_name: this.clean(fullName), date_of_birth: this.displayDate(birth), gender: this.displayGender(plain.gender || student.sex),
      class_name: this.clean(plain.class_name || classRecord.class_name), department_name: this.clean(plain.department_name || department.name),
      ethnicity: this.clean(applicant.ethnicity), religion: this.clean(applicant.religion), phone_number: this.clean(plain.phone_number),
      citizen_id_number: this.clean(applicant.citizen_id_number), citizen_id_issue_date: this.displayDate(applicant.citizen_id_issue_date), citizen_id_issue_place: this.clean(applicant.citizen_id_issue_place),
      permanent_address: this.clean(applicant.permanent_address), priority_group: this.clean(plain.priority_group), priority_certificate_details: this.clean(applicant.priority_certificate_details),
      father: parent('father'), mother: parent('mother'),
      registration_code: this.clean(plain.registration_code || plain.public_registration_code),
    };
  }

  private applicationHtml(data: any) {
    const v = (value: unknown) => this.escapeHtml(this.clean(value));
    const field = (value: unknown, className: string) => `<span class="field ${className}">${v(value)}</span>`;
    const parent = (key: 'father' | 'mother', field: string) => this.clean(data[key]?.[field]);
    return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
      @page { size: A4 portrait; margin: 20mm 20mm 20mm 30mm; }
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body { color: #000; font-family: "Times New Roman", Times, serif; font-size: 15pt; line-height: 1.75; letter-spacing: 0.25pt; }
      .document { width: 100%; }
      .national-heading { text-align: center; font-size: 15.5pt; font-weight: 700; line-height: 1.15; }
      .national-motto { display: inline-block; border-bottom: 1px solid #000; padding-bottom: 4pt; }
      .document-title { margin: 28pt 0 15pt; text-align: center; font-size: 17pt; font-weight: 700; line-height: 1.15; }
      .recipient { margin: 0 0 13pt 28.5mm; text-align: left; }
      .details { line-height: 1.75; }
      .detail-row { height: 1.75em; line-height: 1.75; white-space: nowrap; }
      .class-faculty-row { display: flex; align-items: baseline; gap: 6mm; min-width: 0; white-space: normal; }
      .class-faculty-group { display: flex; align-items: baseline; min-width: 0; }
      .class-faculty-group.faculty { flex: 1 1 auto; font-size: 14pt; letter-spacing: 0; white-space: nowrap; }
      .student-layout { display: grid; grid-template-columns: 39mm minmax(0, 1fr); column-gap: 3mm; margin-bottom: 10pt; }
      .photo-frame { width: 35.7mm; height: 41.8mm; margin-top: 11.5pt; margin-left: 2.3mm; border: 1px solid #000; }
      .student-details { min-width: 0; position: relative; top: 5.5pt; }
      .student-details .field-name { width: 100mm; }
      .student-details .field-ethnicity, .student-details .field-religion { width: 18mm; }
      .student-details .field-phone { width: 25mm; }
      .student-details .field-citizen { width: 20mm; }
      .student-details .field-issue-date { width: 18mm; }
      .student-details .field-citizen, .student-details .field-issue-date, .student-details .field-issue-place { font-size: 9pt; letter-spacing: 0; }
      .field { display: inline-block; padding: 0; border: 0; vertical-align: baseline; overflow: visible; white-space: nowrap; }
      .field-name { width: 81mm; }
      .field-date { width: 37mm; }
      .field-gender { width: 17mm; }
      .field-class { width: 39mm; flex: 0 0 39mm; }
      .field-faculty { width: auto; flex: 1 1 auto; min-width: 0; margin-left: 1mm; white-space: nowrap; overflow-wrap: normal; }
      .field-ethnicity { width: 28mm; }
      .field-religion { width: 28mm; }
      .field-phone { width: 29mm; }
      .field-citizen { width: 32mm; }
      .field-issue-date { width: 28mm; }
      .field-issue-place { width: 38mm; }
      .field-address { width: 130mm; }
      .field-parent-name { width: 82mm; }
      .field-parent-age { width: 44mm; }
      .field-parent-address { width: 130mm; }
      .field-parent-contact { width: 130mm; }
      .field-parent-occupation { width: 60mm; }
      .field-parent-phone { width: 44mm; }
      .priority-line { margin-top: 2pt; line-height: 1.5; white-space: nowrap; }
      .field-priority { width: 105mm; }
      .commitment { margin: 7pt 0 0; line-height: 1.5; text-align: justify; }
      .signature-table { width: 100%; margin-top: 24pt; border-collapse: collapse; table-layout: fixed; font-size: 14pt; line-height: 1.15; }
      .signature-cell { width: 50%; padding: 0; text-align: center; vertical-align: top; }
      .signature-space { height: 0; }
      .signature-label, .signature-note { margin: 0; }
      .signature-label { font-weight: 400; }
      .signature-note { font-style: normal; }
      .applicant-signature .signature-label { font-weight: 700; }
      .applicant-signature .signature-note { font-style: italic; }
    </style></head><body><main class="document">
      <div class="national-heading">CỘNG HOÀ XÃ HỘI CHỦ NGHĨA VIỆT NAM<br><span class="national-motto">Độc lập - Tự do - Hạnh phúc</span></div>
      <h1 class="document-title">ĐƠN XIN VÀO KÝ TÚC XÁ</h1>
      <p class="recipient">Kính gửi: Phòng Học sinh sinh viên.</p>
      <div class="student-layout">
        <div class="photo-frame" aria-label="Khung ảnh"></div>
        <section class="details student-details">
          <div class="detail-row">Họ và tên HSSV: ${field(data.full_name, 'field-name')}</div>
          <div class="detail-row">Ngày, tháng, năm sinh: ${field(data.date_of_birth, 'field-date')} Nam(nữ): ${field(data.gender, 'field-gender')}</div>
          <div class="detail-row class-faculty-row"><span class="class-faculty-group">Lớp: ${field(data.class_name, 'field-class')}</span><span class="class-faculty-group faculty">Khoa: ${field(data.department_name, 'field-faculty')}</span></div>
          <div class="detail-row">Dân tộc: ${field(data.ethnicity, 'field-ethnicity')} Tôn giáo: ${field(data.religion, 'field-religion')} Điện thoại ${field(data.phone_number, 'field-phone')}</div>
          <div class="detail-row">CCCD: ${field(data.citizen_id_number, 'field-citizen')} Ngày cấp: ${field(data.citizen_id_issue_date, 'field-issue-date')} Nơi cấp: ${field(data.citizen_id_issue_place, 'field-issue-place')}</div>
        </section>
      </div>
      <div class="detail-row">Hộ khẩu thường trú: ${field(data.permanent_address, 'field-address')}</div>
      <section class="details parent-details">
        <div class="detail-row">Họ tên Cha: ${field(parent('father', 'full_name'), 'field-parent-name')}Tuổi: ${field(parent('father', 'age'), 'field-parent-age')}</div>
        <div class="detail-row">Hộ khẩu thường trú: ${field(parent('father', 'permanent_address'), 'field-parent-address')}</div>
        <div class="detail-row">Địa chỉ liên lạc: ${field(parent('father', 'contact_address'), 'field-parent-contact')}</div>
        <div class="detail-row">Nghề nghiệp: ${field(parent('father', 'occupation'), 'field-parent-occupation')} Điện thoại: ${field(parent('father', 'phone_number'), 'field-parent-phone')}</div>
        <div class="detail-row">Họ tên Mẹ: ${field(parent('mother', 'full_name'), 'field-parent-name')} Tuổi: ${field(parent('mother', 'age'), 'field-parent-age')}</div>
        <div class="detail-row">Hộ khẩu thường trú: ${field(parent('mother', 'permanent_address'), 'field-parent-address')}</div>
        <div class="detail-row">Địa chỉ liên lạc: ${field(parent('mother', 'contact_address'), 'field-parent-contact')}</div>
        <div class="detail-row">Nghề nghiệp: ${field(parent('mother', 'occupation'), 'field-parent-occupation')} Điện thoại: ${field(parent('mother', 'phone_number'), 'field-parent-phone')}</div>
      </section>
      <div class="priority-line">Các giấy chứng nhận ưu tiên (nếu có): ${field(data.priority_certificate_details, 'field-priority')}</div>
      <p class="commitment">Nay tôi làm đơn này kính đề nghị Phòng Học sinh sinh viên xem xét cho tôi được vào ở Ký túc xá. Nếu được giải quyết, tôi cam kết thực hiện Nội quy Ký túc xá của Nhà trường./.</p>
      <table class="signature-table" aria-label="Khu vực ký tên"><tbody><tr>
        <td class="signature-cell parent-signature"><p class="signature-label">PHHS ký và ghi rõ họ tên</p><div class="signature-space"></div><p class="signature-note">(Dành cho HSSV dưới 18 tuổi)</p></td>
        <td class="signature-cell applicant-signature"><p class="signature-label">NGƯỜI LÀM ĐƠN</p><div class="signature-space"></div><p class="signature-note">(Ký tên, ghi rõ họ, tên)</p></td>
      </tr></tbody></table>
    </main></body></html>`;
  }

  private isTargetClosureError(error: unknown): boolean {
    const candidate = error as { name?: string; message?: string } | null;
    const name = String(candidate?.name || '').toLowerCase();
    const message = String(candidate?.message || '').toLowerCase();
    return name === 'targetcloseerror'
      || name === 'applicationpdftargetclosureerror'
      || message.includes('target closed')
      || message.includes('browser has disconnected')
      || message.includes('connection closed');
  }

  private async renderApplicationPdf(html: string): Promise<Buffer> {
    const puppeteer = require('puppeteer');
    let browser: any;
    let page: any;
    let operation: 'launch' | 'newPage' | 'setContent' | 'waitForFonts' | 'printToPDF' = 'launch';
    try {
      browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
      operation = 'newPage';
      page = await browser.newPage();
      operation = 'setContent';
      await page.setContent(html, { waitUntil: 'load' });
      operation = 'waitForFonts';
      if (typeof page.evaluate === 'function') {
        await page.evaluate(async () => {
          if (document.fonts?.ready) await document.fonts.ready;
        });
      }
      operation = 'printToPDF';
      return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '30mm' } });
    } catch (error) {
      if ((operation === 'setContent' || operation === 'waitForFonts' || operation === 'printToPDF') && this.isTargetClosureError(error)) {
        throw Object.assign(new Error('Application PDF render target closed'), { name: 'ApplicationPdfTargetClosureError' });
      }
      throw error;
    } finally {
      try {
        if (page && !(typeof page.isClosed === 'function' && page.isClosed())) await page.close();
      } catch { /* cleanup must not replace the render result */ }
      try { await browser?.close(); } catch { /* cleanup must not replace the render result */ }
    }
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
    let targetClosure = false;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const buffer = await this.renderApplicationPdf(html);
        const code = viewModel.registration_code || id;
        return { buffer, filename: `don-ky-tuc-xa-${code.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf` };
      } catch (error) {
        lastError = error;
        targetClosure = this.isTargetClosureError(error);
        if (!targetClosure || attempt === 1) break;
      }
    }
    if (targetClosure) throw new ServiceUnavailableException('Không thể tạo PDF đơn đăng ký lúc này');
    throw lastError;
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
