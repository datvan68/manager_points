import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { PDFDocument } from 'pdf-lib';
import { DormitoryRosterEntry, DormitoryRosterEntryDocument } from '../schemas/dormitory-roster-entry.schema';
import { ApplicantProfile } from '../schemas/applicant-profile.schema';
import { Student, StudentDocument } from '../../students/schemas/student.schema';
import { Semester, SemesterDocument } from '../../semesters/schemas/semester.schema';
import { Contract, ContractDocument } from '../schemas/contract.schema';
import { Invoice, InvoiceDocument } from '../schemas/invoice.schema';
import { CreateRosterEntryDto } from '../dto/create-roster-entry.dto';
import { UpdateRosterEntryDto } from '../dto/update-roster-entry.dto';
import { DORMITORY_ENUMS } from '../dormitory-enums';
import { ApplicantProfileDto } from '../dto/applicant-profile.dto';
import { PdfTemplateService } from '../pdf-template/pdf-template.service';
import { PdfTemplateRendererService } from '../pdf-template/pdf-template-renderer.service';
import { resolveRosterPdfValues } from '../pdf-template/field-catalog';
import { validateAndNormalizeLayout } from '../pdf-template/layout.validation';

type RosterUser = { userId?: string; _id?: string; roleCode?: string; permissions?: string[] };
const ACTIVE_CONTRACT_STATUS = 'Hiệu lực';
const PHONE_PATTERN = /^[0-9+().\s-]{8,20}$/;

@Injectable()
export class DormitoryRosterService {
  constructor(
    @InjectModel(DormitoryRosterEntry.name) private readonly rosterModel: Model<DormitoryRosterEntryDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Semester.name) private readonly semesterModel: Model<SemesterDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Invoice.name) private readonly invoiceModel: Model<InvoiceDocument>,
    @Optional() private readonly pdfTemplateService?: PdfTemplateService,
    @Optional() private readonly pdfTemplateRenderer?: PdfTemplateRendererService,
  ) {}

  private id(value: unknown) {
    return String((value as any)?._id ?? value ?? '');
  }

  private plain(value: any) {
    return value?.toObject ? value.toObject() : value;
  }

  private normalizeName(value: unknown) {
    return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  private normalizeCode(value: unknown) {
    return String(value || '').trim().normalize('NFKC').toLocaleUpperCase();
  }

  private parseSemester(semester: SemesterDocument) {
    const parts = String(semester.semester_name || '').split(/\s*-\s*/);
    return { semester: parts[0] || '', academic_year: parts.slice(1).join('-').replace(/\s/g, '') };
  }

  private async resolveActiveSemester() {
    const active = await this.semesterModel.find({ status: 'active' }).exec();
    if (active.length !== 1) {
      throw new BadRequestException(active.length ? 'Có nhiều học kỳ active. Vui lòng kiểm tra cấu hình học kỳ.' : 'Chưa có học kỳ active. Vui lòng cấu hình học kỳ trước khi đăng ký.');
    }
    return active[0];
  }

  private validateManualIdentity(input: { full_name?: unknown; date_of_birth?: unknown; gender?: unknown }) {
    const fullName = String(input.full_name || '').trim().replace(/\s+/g, ' ');
    const dob = input.date_of_birth ? new Date(String(input.date_of_birth)) : null;
    const gender = input.gender;
    if (!fullName || fullName.length < 2) throw new BadRequestException('Họ tên không hợp lệ.');
    if (!dob || Number.isNaN(dob.getTime()) || dob >= new Date()) throw new BadRequestException('Ngày sinh không hợp lệ.');
    if (!['Male', 'Female', 'Other'].includes(String(gender))) throw new BadRequestException('Giới tính không hợp lệ.');
    return { full_name: fullName, date_of_birth: dob, gender: gender as 'Male' | 'Female' | 'Other' };
  }

  private validateCommon(input: { phone_number?: unknown; room_type?: unknown; notes?: unknown }) {
    const phone = String(input.phone_number || '').trim();
    if (!PHONE_PATTERN.test(phone)) throw new BadRequestException('Số điện thoại không hợp lệ.');
    if (!DORMITORY_ENUMS.roomType.includes(input.room_type as any)) throw new BadRequestException('Loại phòng không hợp lệ.');
    return { phone_number: phone, notes: input.notes == null ? undefined : String(input.notes).trim() };
  }

  private async authoritativeIdentity(studentId: string) {
    if (!Types.ObjectId.isValid(studentId)) throw new BadRequestException('student_id không hợp lệ.');
    const student: any = await this.studentModel.findById(studentId).exec();
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên.');
    if (!student.full_name || !student.date_bir || !student.sex) throw new BadRequestException('Hồ sơ sinh viên chưa đủ dữ liệu định danh.');
    const identity = this.validateManualIdentity({ full_name: student.full_name, date_of_birth: student.date_bir, gender: student.sex });
    return { student, identity };
  }

  private async resolveStudentCode(code: unknown) {
    const normalized = this.normalizeCode(code);
    if (!normalized) return { normalized: '', student: null };
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const candidates = await this.studentModel.find({ student_code: { $regex: `^${escaped}$`, $options: 'i' } }).limit(2).exec();
    return { normalized, student: candidates.length === 1 ? candidates[0] : null, ambiguous: candidates.length > 1 };
  }

  private async ensureNoDuplicate(studentId: unknown, semesterId: unknown, currentId?: unknown) {
    if (!studentId) return;
    const existing: any = await (this.rosterModel as any).findOne({ student_id: studentId, semester_id: semesterId }).exec();
    if (existing && this.id(existing) !== this.id(currentId)) throw new ConflictException('Sinh viên đã có mục Danh sách KTX trong học kỳ này.');
  }

  private toResponse(record: any) {
    const plain = this.plain(record) || {};
    const student = this.plain(plain.student_id);
    const studentId = student?._id || plain.student_id;
    return {
      ...plain,
      student_id: studentId || null,
      full_name: student?.full_name || plain.full_name,
      date_of_birth: student?.date_bir || plain.date_of_birth,
      gender: student?.sex || plain.gender,
      student_code: student?.student_code || plain.student_code || null,
      identity_state: plain.identity_state,
    };
  }

  private async buildEntry(dto: CreateRosterEntryDto, publicSubmission = false) {
    const semester = await this.resolveActiveSemester();
    const common = this.validateCommon(dto);
    let student: any = null;
    let identity: { full_name: string; date_of_birth: Date; gender: 'Male' | 'Female' | 'Other' };
    let identityState: 'LINKED' | 'UNLINKED' = 'UNLINKED';
    let normalizedCode = this.normalizeCode(dto.student_code);

    if (dto.student_id) {
      const resolved = await this.authoritativeIdentity(dto.student_id);
      student = resolved.student;
      identity = resolved.identity;
      normalizedCode = this.normalizeCode(student.student_code);
      identityState = 'LINKED';
    } else {
      const codeMatch = await this.resolveStudentCode(dto.student_code);
      if (codeMatch.ambiguous) normalizedCode = this.normalizeCode(dto.student_code);
      if (codeMatch.student && publicSubmission) {
        student = codeMatch.student;
        identity = this.validateManualIdentity({ full_name: student.full_name, date_of_birth: student.date_bir, gender: student.sex });
        normalizedCode = this.normalizeCode(student.student_code);
        identityState = 'LINKED';
      } else {
        identity = this.validateManualIdentity(dto);
      }
    }

    await this.ensureNoDuplicate(student?._id, semester._id);
    const semesterSnapshot = this.parseSemester(semester);
    const payload: any = {
      roster_entry_code: `DK-${randomUUID().substring(0, 8).toUpperCase()}`,
      student_id: student?._id,
      full_name: identity.full_name,
      full_name_normalized: this.normalizeName(identity.full_name),
      date_of_birth: identity.date_of_birth,
      gender: identity.gender,
      phone_number: common.phone_number,
      student_code: student?.student_code || dto.student_code?.trim() || undefined,
      student_code_normalized: normalizedCode || undefined,
      semester_id: semester._id,
      ...semesterSnapshot,
      room_type: dto.room_type,
      notes: common.notes,
      applicant_profile: dto.applicant_profile as ApplicantProfile | undefined,
      identity_state: identityState,
    };
    return payload;
  }

  async create(dto: CreateRosterEntryDto, _user?: RosterUser) {
    if (dto.student_id) {
      const overdue = await this.invoiceModel.countDocuments({ student_id: dto.student_id, status: 'Quá hạn' }).exec();
      if (overdue > 0) throw new BadRequestException('Sinh viên có hóa đơn quá hạn chưa thanh toán.');
      const activeContract = await this.contractModel.findOne({ student_id: dto.student_id, status: ACTIVE_CONTRACT_STATUS }).exec();
      if (activeContract) throw new ConflictException('Sinh viên đang có hợp đồng KTX hiệu lực.');
    }
    const entry = new this.rosterModel(await this.buildEntry(dto));
    return this.toResponse(await entry.save());
  }

  async createPublic(dto: CreateRosterEntryDto, room?: any) {
    const payload: any = await this.buildEntry(dto, true);
    if (room?._id) payload.room_id = room._id;
    const entry = new this.rosterModel(payload);
    return this.toResponse(await entry.save());
  }

  async findAll(query: { semester?: string; academic_year?: string; search?: string; page?: number; limit?: number }) {
    const filter: any = {};
    if (query.semester) filter.semester = query.semester;
    if (query.academic_year) filter.academic_year = query.academic_year;
    const search = query.search?.trim();
    if (search) {
      filter.$or = ['roster_entry_code', 'full_name', 'student_code', 'phone_number'].map((field) => ({ [field]: { $regex: search, $options: 'i' } }));
    }
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(100, Math.max(1, query.limit || 50));
    const [rows, total] = await Promise.all([
      this.rosterModel.find(filter).populate('student_id', 'student_code full_name date_bir sex class_id').populate('room_id', 'room_name room_code').populate('bed_id', 'bed_code').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.rosterModel.countDocuments(filter).exec(),
    ]);
    const ids = rows.map((row: any) => row._id);
    const contracts = ids.length ? await this.contractModel.find({ roster_entry_id: { $in: ids }, status: ACTIVE_CONTRACT_STATUS }).lean().exec() : [];
    const contractByEntry = new Map(contracts.map((contract: any) => [this.id(contract.roster_entry_id), contract]));
    const data = rows.map((row: any) => {
      const contract = contractByEntry.get(this.id(row._id));
      return this.toResponse({ ...row, active_contract_id: contract?._id || null, room_id: contract?.room_id || row.room_id, bed_id: contract?.bed_id || row.bed_id });
    });
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string) {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestException('Mã mục Danh sách không hợp lệ.');
    const entry: any = await this.rosterModel.findById(id).populate('student_id').populate('room_id').populate('bed_id').exec();
    if (!entry) throw new NotFoundException(`Không tìm thấy mục Danh sách KTX: ${id}`);
    return this.toResponse(entry);
  }

  async update(id: string, dto: UpdateRosterEntryDto) {
    const entry: any = await this.rosterModel.findById(id).exec();
    if (!entry) throw new NotFoundException('Không tìm thấy mục Danh sách KTX.');
    const merged: any = { ...this.plain(entry), ...dto, student_id: dto.student_id ?? entry.student_id };
    if (merged.student_id) {
      const resolved = await this.authoritativeIdentity(String(merged.student_id));
      merged.full_name = resolved.identity.full_name;
      merged.full_name_normalized = this.normalizeName(resolved.identity.full_name);
      merged.date_of_birth = resolved.identity.date_of_birth;
      merged.gender = resolved.identity.gender;
      merged.student_code = resolved.student.student_code;
      merged.student_code_normalized = this.normalizeCode(resolved.student.student_code);
      merged.identity_state = 'LINKED';
    } else {
      const manual = this.validateManualIdentity(merged);
      merged.full_name = manual.full_name;
      merged.full_name_normalized = this.normalizeName(manual.full_name);
      merged.date_of_birth = manual.date_of_birth;
      merged.gender = manual.gender;
      merged.identity_state = entry.identity_state === 'CONFLICT' ? 'CONFLICT' : 'UNLINKED';
    }
    const common = this.validateCommon(merged);
    await this.ensureNoDuplicate(merged.student_id, entry.semester_id, id);
    Object.assign(entry, { ...merged, ...common });
    return this.toResponse(await entry.save());
  }

  async remove(id: string) {
    const protectedReference = await this.contractModel.findOne({ roster_entry_id: id }).exec();
    if (protectedReference) throw new ConflictException('Không thể xóa mục Danh sách KTX đang được hợp đồng tham chiếu.');
    const result = await this.rosterModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException('Không tìm thấy mục Danh sách KTX.');
    return { success: true, id };
  }

  async findByStudentId(studentId: string, requester?: RosterUser) {
    if (!Types.ObjectId.isValid(studentId)) return { has_dormitory_roster: false, roster_entry: null, history: [] };
    const student: any = await this.studentModel.findById(studentId).exec();
    if (!student) return { has_dormitory_roster: false, roster_entry: null, history: [] };
    await this.authorizeStudentView(student, requester);
    const entries: any[] = await this.rosterModel.find({ student_id: student._id }).populate('room_id', 'room_name room_code room_price room_type building_id').populate('bed_id', 'bed_code position status').sort({ createdAt: -1 }).exec();
    if (!entries.length) return { has_dormitory_roster: false, roster_entry: null, history: [] };
    const contracts: any[] = await this.contractModel.find({ student_id: student._id, status: ACTIVE_CONTRACT_STATUS }).populate('room_id').populate('bed_id').exec();
    const byId = new Map(entries.map((entry) => [this.id(entry), entry]));
    const activeContract = contracts.find((contract) => byId.has(this.id(contract.roster_entry_id)));
    const selected: any = activeContract ? byId.get(this.id(activeContract.roster_entry_id)) : entries[0];
    return {
      has_dormitory_roster: true,
      roster_entry: { ...this.toResponse({ ...this.plain(selected), student_id: student }), room_id: activeContract?.room_id || selected.room_id || null, bed_id: activeContract?.bed_id || selected.bed_id || null, active_contract: activeContract ? this.plain(activeContract) : null, editable_fields: activeContract ? [] : ['phone_number', 'notes', 'applicant_profile'] },
      history: entries.map((entry: any) => ({ _id: entry._id, roster_entry_code: entry.roster_entry_code, semester: entry.semester, academic_year: entry.academic_year, createdAt: entry.createdAt })),
    };
  }

  async findMine(userId: string) {
    const student: any = await this.studentModel.findOne({ user_id: userId }).exec();
    if (!student) throw new ForbiddenException('Không tìm thấy hồ sơ sinh viên liên kết');
    return this.findByStudentId(String(student._id), { userId, roleCode: 'STUDENT' });
  }

  async updateMine(userId: string, dto: Record<string, unknown>) {
    const own: any = await this.findMine(userId);
    if (!own.roster_entry) throw new NotFoundException('Chưa có mục Danh sách KTX.');
    const allowed = new Set(['phone_number', 'notes', 'applicant_profile']);
    if (Object.keys(dto).some((key) => !allowed.has(key)) || !Object.keys(dto).length) throw new BadRequestException('Chỉ có thể cập nhật các trường do sinh viên cung cấp.');
    return this.update(String(own.roster_entry._id), dto as UpdateRosterEntryDto);
  }

  async assignRoom(id: string, roomId: string, bedId: string) {
    const entry = await this.rosterModel.findOneAndUpdate({ _id: id }, { $set: { room_id: roomId, bed_id: bedId } }, { new: true }).exec();
    if (!entry) throw new NotFoundException('Không tìm thấy mục Danh sách KTX.');
    return this.toResponse(entry);
  }

  async unassignRoom(id: string) {
    const entry = await this.rosterModel.findOneAndUpdate({ _id: id }, { $unset: { room_id: '', bed_id: '' } }, { new: true }).exec();
    if (!entry) throw new NotFoundException('Không tìm thấy mục Danh sách KTX.');
    return this.toResponse(entry);
  }

  async generateApplicationPdf(id: string) {
    const entry: any = await this.rosterModel.findById(id).populate({ path: 'student_id', populate: { path: 'class_id', populate: { path: 'dept_id' } } }).populate('room_id').populate('bed_id').exec();
    if (!entry) throw new NotFoundException('Không tìm thấy mục Danh sách KTX.');
    const value = this.toResponse(entry);
    const linkedStudent = this.plain(entry.student_id);
    const activeRevision = this.pdfTemplateService && this.pdfTemplateRenderer
      ? await this.pdfTemplateService.getActiveRevision('DORMITORY_APPLICATION')
      : null;
    const renderer = this.pdfTemplateRenderer;
    if (activeRevision && renderer) {
      const rendered = await renderer.render(
        Buffer.from(activeRevision.source_pdf),
        validateAndNormalizeLayout(activeRevision.layout),
        resolveRosterPdfValues(value, linkedStudent),
      );
      return { buffer: rendered.buffer, filename: `don-xin-vao-ktx-${this.safeFilename(value.roster_entry_code)}.pdf` };
    }
    const pdfValues = this.applicationPdfValues(value, this.plain(entry.student_id));
    let browser: any;
    try {
      const puppeteer = require('puppeteer');
      browser = await puppeteer.default.launch({ headless: true, args: ['--no-sandbox'] });
      const page = await browser.newPage();
      await page.setContent(this.applicationPdfOverlayHtml(pdfValues), { waitUntil: 'load' });
      const overlay = await page.pdf({ format: 'A4', printBackground: true, pageRanges: '1' });
      const templatePath = join(__dirname, '../templates/dormitory-roster-application.pdf');
      const template = await PDFDocument.load(await readFile(templatePath));
      const overlayDocument = await PDFDocument.load(overlay);
      const [overlayPage] = await template.embedPages([overlayDocument.getPages()[0]]);
      template.getPages()[0].drawPage(overlayPage, { x: 0, y: 0, width: 595.32, height: 842.04 });
      const buffer = await template.save({ useObjectStreams: false });
      return { buffer: Buffer.from(buffer), filename: `don-xin-vao-ktx-${this.safeFilename(value.roster_entry_code)}.pdf` };
    } catch (error) {
      throw new ServiceUnavailableException('Không thể tạo PDF mục Danh sách lúc này.');
    } finally {
      if (browser) await browser.close().catch(() => undefined);
    }
  }

  private escape(value: unknown) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' } as Record<string, string>)[character]);
  }

  private safeFilename(value: unknown) {
    return String(value || 'don-ktx').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'don-ktx';
  }

  private formatPdfDate(value: unknown) {
    const date = new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) return '';
    return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
  }

  private applicationPdfValues(roster: any, student: any) {
    const linkedStudent = roster.identity_state === 'LINKED' && student ? student : null;
    const profile = roster.applicant_profile || {};
    const parent = (key: 'father' | 'mother') => profile[key] || {};
    return {
      name: linkedStudent?.full_name || roster.full_name,
      dob: this.formatPdfDate(linkedStudent?.date_bir || roster.date_of_birth),
      gender: ({ Male: 'Nam', Female: 'Nữ', Other: 'Khác' } as Record<string, string>)[linkedStudent?.sex || roster.gender] || '',
      className: linkedStudent?.class_id?.class_name || '',
      faculty: linkedStudent?.class_id?.dept_id?.name || '',
      ethnicity: profile.ethnicity,
      religion: profile.religion,
      phone: roster.phone_number,
      citizenId: profile.citizen_id_number,
      citizenIssueDate: this.formatPdfDate(profile.citizen_id_issue_date),
      citizenIssuePlace: profile.citizen_id_issue_place,
      permanentAddress: profile.permanent_address,
      fatherName: parent('father').full_name,
      fatherAge: parent('father').age,
      fatherAddress: parent('father').permanent_address,
      fatherContactAddress: parent('father').contact_address,
      fatherOccupation: parent('father').occupation,
      fatherPhone: parent('father').phone_number,
      motherName: parent('mother').full_name,
      motherAge: parent('mother').age,
      motherAddress: parent('mother').permanent_address,
      motherContactAddress: parent('mother').contact_address,
      motherOccupation: parent('mother').occupation,
      motherPhone: parent('mother').phone_number,
      priority: profile.priority_certificate_details,
    };
  }

  private applicationPdfOverlayHtml(values: Record<string, unknown>) {
    const fields: Array<[string, number, number, number, number?]> = [
      ['name', 296, 191, 240], ['dob', 323.5, 215, 77], ['gender', 459, 215, 77],
      ['className', 218, 239, 142], ['faculty', 396.8, 239, 139],
      ['ethnicity', 241, 263, 56], ['religion', 354.5, 263, 49], ['phone', 466.4, 263, 69.6],
      ['citizenId', 235.2, 287, 70], ['citizenIssueDate', 362.5, 287, 63], ['citizenIssuePlace', 480.7, 287, 55],
      ['permanentAddress', 203, 311, 332], ['fatherName', 152.4, 335, 239.6], ['fatherAge', 396.8, 335, 139.2],
      ['fatherAddress', 203, 359, 332], ['fatherContactAddress', 194.9, 383, 341.1], ['fatherOccupation', 194.9, 407, 114.9], ['fatherPhone', 375.9, 407, 160.1],
      ['motherName', 152.4, 431, 196], ['motherAge', 386.4, 431, 149.6], ['motherAddress', 203, 455, 332], ['motherContactAddress', 194.9, 479, 341.1], ['motherOccupation', 194.9, 503, 114.9], ['motherPhone', 375.9, 503, 160.1], ['priority', 302.8, 527, 233.3],
    ];
    const field = (name: string, left: number, top: number, width: number, height = 18) => {
      const value = String(values[name] ?? '');
      const fontSize = value ? Math.max(7.5, Math.min(12, (width * 1.75) / Math.max(value.length, 1))) : 12;
      const estimatedWidth = value.length * fontSize * 0.52;
      const scaleX = value && estimatedWidth > width ? width / estimatedWidth : 1;
      return `<span class="field" style="left:${left}pt;top:${top}pt;width:${width}pt;height:${height}pt;font-size:${fontSize.toFixed(2)}pt;transform:scaleX(${scaleX.toFixed(3)})">${this.escape(value)}</span>`;
    };
    return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:595.32pt 842.04pt;margin:0}*{box-sizing:border-box}html,body{margin:0;width:595.32pt;height:842.04pt;background:transparent}body{font-family:"Times New Roman","DejaVu Serif",serif;color:#000}.field{position:absolute;display:block;padding:1pt 0;background:#fff;line-height:16pt;white-space:nowrap;overflow:visible;transform-origin:left center}</style></head><body>
      ${fields.map(([name, left, top, width, height]) => field(name, left, top, width, height)).join('')}
    </body></html>`;
  }

  private async authorizeStudentView(student: any, requester?: RosterUser) {
    if (!requester) return;
    const role = String(requester.roleCode || '').toUpperCase();
    if (role.includes('STUDENT') && this.id(student.user_id) !== String(requester.userId || '')) throw new ForbiddenException('Bạn không có quyền truy cập thông tin KTX của sinh viên khác');
  }
}
