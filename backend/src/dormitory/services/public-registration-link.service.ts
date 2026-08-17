import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PublicRegistration, PublicRegistrationDocument } from '../schemas/public-registration.schema';
import { Registration, RegistrationDocument } from '../schemas/registration.schema';
import { Student, StudentDocument } from '../../students/schemas/student.schema';
import { v4 as uuidv4 } from 'uuid';
import { mapPublicRegistrationToFormal } from '../public-registration.mapper';
import { CANONICAL_LINK_OWNER, normalizeStudentCode } from '../registration-edit-policy';

const ACTIVE_REGISTRATION_STATUSES = ['Chờ duyệt', 'Đã duyệt'];
const PENDING_PUBLIC_STATUS = 'Chờ xác nhận';
const LINKED_PUBLIC_STATUS = 'Đã xác nhận';
const LINK_BATCH_SIZE = 100;

@Injectable()
export class PublicRegistrationLinkService {
  private readonly logger = { log: (..._args: unknown[]) => undefined };

  constructor(
    @InjectModel(PublicRegistration.name) private publicRegModel: Model<PublicRegistrationDocument>,
    @InjectModel(Registration.name) private registrationModel: Model<RegistrationDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
  ) {}

  private async resolve<T>(value: any): Promise<T> {
    if (value && typeof value.exec === 'function') return value.exec();
    if (value && typeof value.then === 'function') return value;
    return value;
  }

  private async save(document: any, session?: any) {
    return session ? document.save({ session }) : document.save();
  }

  private async queryWithSession(query: any, session?: any) {
    if (session && typeof query?.session === 'function') query = query.session(session);
    return this.resolve(query);
  }

  private normalizeName(value: unknown) {
    return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  private sameDate(a: unknown, b: unknown) {
    return new Date(String(a)).toISOString().slice(0, 10) === new Date(String(b)).toISOString().slice(0, 10);
  }

  async resolveCandidates(publicRegistrationId: string) {
    const source: any = await this.resolve(this.publicRegModel.findById(publicRegistrationId));
    if (!source) throw new NotFoundException('Không tìm thấy đăng ký công khai');
    if (source.linked_student_id || source.linked_registration_id) return { state: 'LINKED', candidates: [] };
    const students: any[] = await this.resolve((this.studentModel as any).find({ status: 'Studying' }).populate('class_id', 'class_name').lean()) || [];
    const name = this.normalizeName(source.full_name);
    const candidates = students.filter(student => this.normalizeName(student.full_name) === name && this.sameDate(student.date_bir, source.date_of_birth));
    return {
      state: candidates.length === 1 ? 'ONE_MATCH' : candidates.length > 1 ? 'AMBIGUOUS' : 'NO_MATCH',
      source: { _id: source._id, full_name: source.full_name, date_of_birth: source.date_of_birth, email: source.email || null, gender: source.gender || null, student_code: source.student_code || null, updatedAt: source.updatedAt },
      candidates: candidates.map(student => ({ _id: student._id, full_name: student.full_name, date_of_birth: student.date_bir, student_code: student.student_code, class: student.class_id, status: student.status, email: student.email || null, gender: student.sex || null, updatedAt: student.updatedAt, match_evidence: { full_name: true, date_of_birth: true, email: !!source.email && String(source.email).trim().toLowerCase() === String(student.email || '').trim().toLowerCase(), gender: source.gender === student.sex } })),
    };
  }

  async confirmLink(publicRegistrationId: string, dto: any, confirmer: any) {
    const source: any = await this.resolve(this.publicRegModel.findById(publicRegistrationId));
    const student: any = await this.resolve(this.studentModel.findById(dto.student_id).populate('class_id', 'class_name'));
    if (!source || !student) throw new NotFoundException('Không tìm thấy bản ghi liên kết');
    if (source.linked_student_id) {
      if (String(source.linked_student_id) !== String(student._id)) throw new ConflictException('Đăng ký đã liên kết với sinh viên khác');
      return this.resolve(this.registrationModel.findById(source.linked_registration_id));
    }
    if (new Date(source.updatedAt).toISOString() !== new Date(dto.expected_public_updated_at).toISOString() || new Date(student.updatedAt).toISOString() !== new Date(dto.expected_student_updated_at).toISOString()) throw new ConflictException('Dữ liệu đã thay đổi, vui lòng tải lại');
    if (student.status !== 'Studying' || !String(student.student_code || '').trim() || !student.class_id || !this.normalizeName(source.full_name) || this.normalizeName(source.full_name) !== this.normalizeName(student.full_name) || !this.sameDate(source.date_of_birth, student.date_bir)) throw new BadRequestException('Không đủ bằng chứng định danh để liên kết');
    const before = { email: student.email || null, gender: student.sex || null };
    if (dto.sync_email && source.email) student.email = String(source.email).trim();
    if (dto.sync_gender && source.gender) student.sex = source.gender;
    const formal = await this.withTransaction(async session => {
      if (dto.sync_email || dto.sync_gender) await this.save(student, session);
      const linked = await this.linkDocuments(source, student, session);
      source.link_audit = { confirmed_by: confirmer?.userId || confirmer?._id || null, confirmed_at: new Date(), match_method: 'NORMALIZED_NAME_AND_DATE_OF_BIRTH', selected_student_id: student._id, before, after: { email: student.email || null, gender: student.sex || null }, sync_email: !!dto.sync_email, sync_gender: !!dto.sync_gender };
      await this.save(source, session);
      return linked;
    });
    return formal;
  }

  private async withTransaction<T>(work: (session?: any) => Promise<T>): Promise<T> {
    const db = (this.registrationModel as any).db;
    if (typeof db?.startSession !== 'function') return work();
    const session = await db.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => { result = await work(session); });
      return result;
    } finally {
      await session.endSession();
    }
  }

  private async findExistingRegistration(studentId: any, session?: any) {
    return this.queryWithSession(this.registrationModel.findOne({ student_id: studentId, status: { $in: ACTIVE_REGISTRATION_STATUSES } }), session);
  }

  private async markPublicLinked(publicRegistration: any, studentId: any, registrationId: any, session?: any) {
    publicRegistration.status = LINKED_PUBLIC_STATUS;
    publicRegistration.linked_student_id = studentId;
    publicRegistration.linked_registration_id = registrationId;
    publicRegistration.linked_canonical_owner = CANONICAL_LINK_OWNER;
    return this.save(publicRegistration, session);
  }

  private newFormalRegistration(publicRegistration: any, student: any) {
    const formalRegistration = new this.registrationModel({
      registration_code: `DK-${uuidv4().substring(0, 8).toUpperCase()}`,
      student_id: student._id,
      semester: publicRegistration.semester,
      academic_year: publicRegistration.academic_year,
      date_of_birth: publicRegistration.date_of_birth,
      gender: publicRegistration.gender,
      phone_number: publicRegistration.phone_number,
      room_id: publicRegistration.room_id,
      bed_id: publicRegistration.bed_id,
      preference: { room_type: publicRegistration.room_type, notes: publicRegistration.notes },
      priority_group: publicRegistration.priority_group,
      status: 'Đã duyệt',
    });
    Object.assign(formalRegistration, mapPublicRegistrationToFormal(publicRegistration, student._id, formalRegistration.status));
    return formalRegistration;
  }

  private async linkDocuments(publicRegistration: any, student: any, session?: any) {
    if (publicRegistration.linked_student_id || publicRegistration.linked_registration_id) {
      if (String(publicRegistration.linked_student_id) !== String(student._id)) {
        throw new Error('Public registration is already linked to another student');
      }
      const linked = publicRegistration.linked_registration_id
        ? await this.queryWithSession(this.registrationModel.findById(publicRegistration.linked_registration_id), session)
        : null;
      if (linked) return linked;
    }

    const existing: any = await this.findExistingRegistration(student._id, session);
    if (existing) {
      await this.markPublicLinked(publicRegistration, student._id, existing._id, session);
      return existing;
    }

    const formalRegistration = this.newFormalRegistration(publicRegistration, student);
    await this.save(formalRegistration, session);
    try {
      await this.markPublicLinked(publicRegistration, student._id, formalRegistration._id, session);
    } catch (error) {
      if (!session && typeof (this.registrationModel as any).deleteOne === 'function') {
        await (this.registrationModel as any).deleteOne({ _id: formalRegistration._id });
      }
      throw error;
    }
    return formalRegistration;
  }

  async autoLinkPendingRegistrations(): Promise<{
    matched: number;
    converted: number;
    linked: number;
    skipped: number;
    not_found: number;
    conflicts: number;
    failures: number;
    details: { public_registration_code: string; student_code: string; full_name: string }[];
  }> {
    const result = { matched: 0, converted: 0, linked: 0, skipped: 0, not_found: 0, conflicts: 0, failures: 0, details: [] as { public_registration_code: string; student_code: string; full_name: string }[] };
    let lastId: any;
    for (let batchNumber = 0; batchNumber < 10000; batchNumber += 1) {
      const filter: any = { status: PENDING_PUBLIC_STATUS, linked_student_id: { $exists: false }, linked_registration_id: { $exists: false } };
      if (lastId) filter._id = { $gt: lastId };
      let query: any = this.publicRegModel.find(filter);
      if (typeof query.sort === 'function') query = query.sort({ _id: 1 });
      if (typeof query.limit === 'function') query = query.limit(LINK_BATCH_SIZE);
      const pendingRegs = await this.resolve<any[]>(query) || [];
      if (!pendingRegs.length) break;
      lastId = pendingRegs[pendingRegs.length - 1]?._id;

      const codes = pendingRegs.map((item: any) => normalizeStudentCode(item.student_code)).filter(Boolean);
      const emails = pendingRegs.map((item: any) => String(item.email || '').trim().toLowerCase()).filter(Boolean);
      const studentQuery = (this.studentModel as any).find({
        status: 'Studying',
        $or: [...(codes.length ? [{ student_code: { $in: codes } }] : []), ...(emails.length ? [{ email: { $in: emails } }] : [])],
      });
      const students = (codes.length || emails.length) && studentQuery ? await this.resolve<any[]>(studentQuery) || [] : [];
      const byCode = new Map<string, any[]>();
      const byEmail = new Map<string, any[]>();
      for (const student of students) {
        const code = normalizeStudentCode(student.student_code);
        const email = String(student.email || '').trim().toLowerCase();
        if (code) byCode.set(code, [...(byCode.get(code) || []), student]);
        if (email) byEmail.set(email, [...(byEmail.get(email) || []), student]);
      }

      for (const publicRegistration of pendingRegs) {
        const code = normalizeStudentCode(publicRegistration.student_code);
        const email = String(publicRegistration.email || '').trim().toLowerCase();
        const codeCandidates = code ? byCode.get(code) || [] : [];
        const emailCandidates = email ? byEmail.get(email) || [] : [];
        const candidates = codeCandidates.length ? codeCandidates : emailCandidates;
        if (!candidates.length) { result.not_found += 1; continue; }
        if (candidates.length > 1) { result.conflicts += 1; continue; }
        const student = candidates[0];
        if (!student.class_id) { result.skipped += 1; continue; }
        result.matched += 1;
        try {
          const linked = await this.linkRegistrationToStudent(String(publicRegistration._id), String(student._id));
          result.converted += 1;
          result.details.push({ public_registration_code: publicRegistration.public_registration_code, student_code: student.student_code, full_name: student.full_name });
          if (linked) result.linked += 1;
        } catch (error) {
          result.failures += 1;
          this.logger.log(error instanceof Error ? error.message : String(error));
        }
      }
      if (pendingRegs.length < LINK_BATCH_SIZE) break;
    }
    return result;
  }

  async checkStudentLink(studentId: string): Promise<boolean> {
    const student = await this.studentModel.findById(studentId);
    if (!student || !student.class_id || student.status !== 'Studying') return false;
    const conditions: any[] = [];
    const code = normalizeStudentCode(student.student_code);
    if (code) conditions.push({ student_code: code });
    if (student.email) conditions.push({ email: String(student.email).trim().toLowerCase() });
    if (!conditions.length) return false;
    const pubReg = await this.publicRegModel.findOne({ status: PENDING_PUBLIC_STATUS, $or: conditions });
    if (!pubReg) return false;
    await this.linkRegistrationToStudent(String(pubReg._id), String(student._id));
    return true;
  }

  async linkRegistrationToStudent(publicRegistrationId: string, studentId: string) {
    const publicRegistration = await this.publicRegModel.findOne({ _id: publicRegistrationId });
    if (!publicRegistration) throw new Error('Unclassified registration is missing');
    const student = await this.studentModel.findById(studentId);
    if (!student) throw new Error('Student not found');
    return this.withTransaction((session) => this.linkDocuments(publicRegistration, student, session));
  }

  async getAllPublicRegistrations(query: { status?: string; page?: number; limit?: number }) {
    const filter: any = {};
    if (query.status) filter.status = query.status;
    const page = query.page || 1;
    const limit = query.limit || 20;
    const [data, total] = await Promise.all([
      this.publicRegModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('room_id', 'room_code').lean(),
      this.publicRegModel.countDocuments(filter),
    ]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
