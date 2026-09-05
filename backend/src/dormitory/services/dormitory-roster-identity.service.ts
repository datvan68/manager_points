import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { DormitoryRosterEntry, DormitoryRosterEntryDocument } from '../schemas/dormitory-roster-entry.schema';
import { Student, StudentDocument } from '../../students/schemas/student.schema';
import { emitDormitoryOverviewInvalidated } from '../dormitory-overview-event-emitter';

export type RosterIdentityOutcome = 'LINKED' | 'UNLINKED' | 'CONFLICT';
export type RosterIdentityMatch = { student?: any; state: RosterIdentityOutcome; reason?: string };

type IdentityEntry = { _id?: unknown; full_name: string; date_of_birth: unknown; student_id?: unknown; semester_id?: unknown };

@Injectable()
export class DormitoryRosterIdentityService {
  private readonly logger = new Logger(DormitoryRosterIdentityService.name);

  constructor(
    @InjectModel(DormitoryRosterEntry.name) private readonly rosterModel: Model<DormitoryRosterEntryDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  normalizeName(value: unknown) {
    return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi-VN');
  }

  private dateKey(value: unknown) {
    const date = value instanceof Date ? value : new Date(String(value || ''));
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  }

  sameDate(left: unknown, right: unknown) {
    return Boolean(this.dateKey(left) && this.dateKey(left) === this.dateKey(right));
  }

  identityKey(name: unknown, dob: unknown) {
    return `${this.normalizeName(name)}|${this.dateKey(dob)}`;
  }

  private namePattern(value: unknown) {
    return `^${this.normalizeName(value).split(' ').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+')}$`;
  }

  private dateRange(value: unknown) {
    const date = new Date(String(value || ''));
    if (Number.isNaN(date.getTime())) return null;
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    return { start, end };
  }

  private populateClass(query: any) {
    if (typeof query?.populate !== 'function') return { query, populated: false };
    const populatedQuery = query.populate({ path: 'class_id', select: '_id class_name' });
    return { query: populatedQuery || query, populated: true };
  }

  private hasExistingClass(student: any) {
    const classValue = student?.class_id;
    if (!classValue) return false;
    return Boolean(typeof classValue === 'object' ? classValue._id : classValue);
  }

  isCurrentStudent(student: any, allowUnpopulatedClass = false) {
    if (student?.status && student.status !== 'Studying') return false;
    if (this.hasExistingClass(student)) return true;
    return allowUnpopulatedClass && student?.class_id === undefined && !student?.status;
  }

  private async findStudentById(studentId: string) {
    const sourceQuery: any = (this.studentModel as any).findById(studentId);
    const { query, populated } = this.populateClass(sourceQuery);
    const student = await query.exec();
    return { student, current: this.isCurrentStudent(student, !populated) };
  }

  async assertCurrentStudent(studentId: string) {
    if (!Types.ObjectId.isValid(studentId)) throw new BadRequestException('student_id không hợp lệ.');
    const { student, current } = await this.findStudentById(studentId);
    if (!student) throw new BadRequestException('Không tìm thấy sinh viên.');
    if (!current) throw new ConflictException('Chỉ được liên kết sinh viên đang học thuộc một lớp hiện tại.');
    return student;
  }

  async resolveBatch(entries: IdentityEntry[]): Promise<RosterIdentityMatch[]> {
    if (!entries.length) return [];
    const identities = new Map<string, IdentityEntry>();
    for (const entry of entries) {
      const key = this.identityKey(entry.full_name, entry.date_of_birth);
      if (this.dateKey(entry.date_of_birth)) identities.set(key, entry);
    }
    const identityValues = [...identities.values()];
    const studentQuery: any = (this.studentModel as any).find({
      status: 'Studying',
      class_id: { $exists: true, $ne: null },
      $or: identityValues.map(entry => {
        const range = this.dateRange(entry.date_of_birth)!;
        return { full_name: { $regex: this.namePattern(entry.full_name), $options: 'i' }, date_bir: { $gte: range.start, $lt: range.end } };
      }),
    });
    const populatedStudents = this.populateClass(studentQuery);
    const students: any[] = await populatedStudents.query.exec();
    const currentStudents = students.filter(student => this.isCurrentStudent(student, !populatedStudents.populated));
    const studentsByKey = new Map<string, any[]>();
    for (const student of currentStudents) {
      const key = this.identityKey(student.full_name, student.date_bir);
      if (identities.has(key)) studentsByKey.set(key, [...(studentsByKey.get(key) || []), student]);
    }

    const semesterIds = [...new Set(entries.map(entry => entry.semester_id).filter(Boolean).map(value => String(value)))];
    const rosterQuery: any = semesterIds.length ? (this.rosterModel as any).find({ semester_id: { $in: semesterIds } }) : null;
    const rosterEntries: any[] = rosterQuery ? await rosterQuery.exec() : [];
    return entries.map(entry => {
      if (entry.student_id) return { state: 'LINKED' };
      const matches = studentsByKey.get(this.identityKey(entry.full_name, entry.date_of_birth)) || [];
      if (matches.length !== 1) return { state: matches.length ? 'CONFLICT' : 'UNLINKED', reason: matches.length ? 'Có nhiều sinh viên đang học trùng họ tên và ngày sinh.' : undefined };
      const studentId = String(matches[0]._id);
      const competing = rosterEntries.some(other => String(other._id) !== String(entry._id || '') && String(other.semester_id) === String(entry.semester_id) && (
        String(other.student_id?._id || other.student_id || '') === studentId ||
        (!other.student_id && this.identityKey(other.full_name, other.date_of_birth) === this.identityKey(entry.full_name, entry.date_of_birth))
      ));
      return competing ? { state: 'CONFLICT', reason: 'Có mục KTX khác đã giữ hoặc cạnh tranh cùng định danh trong học kỳ.' } : { student: matches[0], state: 'LINKED' };
    });
  }

  async linkIfUnchanged(entryId: string, studentId: string, fields: Record<string, unknown>) {
    if (!(this.rosterModel as any).updateOne) {
      const entry: any = await (this.rosterModel as any).findById(entryId).exec();
      if (!entry || !['UNLINKED', 'CONFLICT'].includes(entry.identity_state) || entry.student_id) return false;
      Object.assign(entry, fields, { student_id: studentId, identity_state: 'LINKED' });
      await entry.save();
      emitDormitoryOverviewInvalidated('roster');
      return true;
    }
    try {
      const result: any = await (this.rosterModel as any).updateOne(
        { _id: entryId, identity_state: { $in: ['UNLINKED', 'CONFLICT'] }, $or: [{ student_id: null }, { student_id: { $exists: false } }] },
        { $set: { ...fields, student_id: studentId, identity_state: 'LINKED' } },
      ).exec();
      if (!result?.matchedCount && !result?.n) return false;
      emitDormitoryOverviewInvalidated('roster');
      return true;
    } catch (error: any) {
      if (error?.code === 11000) return false;
      throw error;
    }
  }

  async reconcileUnlinked(afterId?: string, limit = 100) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BadRequestException('limit phải trong khoảng 1 đến 100.');
    const filter: any = { identity_state: { $in: ['UNLINKED', 'CONFLICT'] } };
    if (afterId) {
      if (!Types.ObjectId.isValid(afterId)) throw new BadRequestException('after_id không hợp lệ.');
      filter._id = { $gt: new Types.ObjectId(afterId) };
    }
    const sourceQuery: any = (this.rosterModel as any).find(filter);
    const sortedQuery = typeof sourceQuery.sort === 'function' ? sourceQuery.sort({ _id: 1 }) : sourceQuery;
    const entries: any[] = await sortedQuery.limit(limit).exec();
    const matches = await this.resolveBatch(entries.map(entry => ({ ...entry, _id: entry._id, full_name: entry.full_name, date_of_birth: entry.date_of_birth, semester_id: entry.semester_id })));
    const outcomes: any[] = [];
    let linked = 0; let unlinked = 0; let conflicts = 0; let failed = 0;
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const match = matches[index];
      try {
        if (match.state === 'LINKED' && match.student) {
          const fields = {
            student_code: match.student.student_code,
            student_code_normalized: match.student.student_code ? String(match.student.student_code).trim().toUpperCase() : undefined,
          };
          let linkedNow: boolean;
          if (!(this.rosterModel as any).updateOne) {
            if (entry.student_id || !['UNLINKED', 'CONFLICT'].includes(entry.identity_state)) linkedNow = false;
            else { Object.assign(entry, fields, { student_id: match.student._id, identity_state: 'LINKED' }); await entry.save(); linkedNow = true; }
          } else linkedNow = await this.linkIfUnchanged(String(entry._id), String(match.student._id), fields);
          if (linkedNow) { linked += 1; outcomes.push({ id: String(entry._id), outcome: 'LINKED' }); }
          else { conflicts += 1; outcomes.push({ id: String(entry._id), outcome: 'CONFLICT', reason: 'Mục đã được thay đổi hoặc đã liên kết.' }); }
        } else {
          if (match.state === 'CONFLICT') conflicts += 1; else unlinked += 1;
          outcomes.push({ id: String(entry._id), outcome: match.state, reason: match.reason });
        }
      } catch {
        failed += 1;
        outcomes.push({ id: String(entry._id), outcome: 'FAILED', reason: 'Không thể đối chiếu mục này.' });
      }
    }
    return { scanned: entries.length, linked, unlinked, conflicts, failed, results: outcomes, next_cursor: entries.length ? String(entries[entries.length - 1]._id) : undefined, has_more: entries.length === limit };
  }

  async reconcileSemester(_semesterId: string, afterId?: string, limit = 100) {
    return this.reconcileUnlinked(afterId, limit);
  }

  async reconcileStudent(studentId: string) {
    const { student, current } = await this.findStudentById(studentId);
    if (!student?.full_name || !student?.date_bir || !current) return { linked: 0, conflicts: 0, skipped: 0 };
    const candidates: any[] = await (this.rosterModel as any).find({ identity_state: { $in: ['UNLINKED', 'CONFLICT'] }, full_name_normalized: this.normalizeName(student.full_name) }).exec();
    let linked = 0; let conflicts = 0; let skipped = 0;
    for (const entry of candidates) {
      if (!this.sameDate(entry.date_of_birth, student.date_bir)) { skipped += 1; continue; }
      const duplicate: any = await (this.rosterModel as any).findOne({ student_id: student._id, semester_id: entry.semester_id, _id: { $ne: entry._id } }).exec();
      if (duplicate) { conflicts += 1; continue; }
      const fields = {
        student_code: student.student_code || entry.student_code,
        student_code_normalized: student.student_code ? String(student.student_code).trim().toUpperCase() : entry.student_code_normalized,
      };
      let ok: boolean;
      if (!(this.rosterModel as any).updateOne) {
        if (entry.student_id || !['UNLINKED', 'CONFLICT'].includes(entry.identity_state)) ok = false;
        else { Object.assign(entry, fields, { student_id: student._id, identity_state: 'LINKED' }); await entry.save(); ok = true; }
      } else ok = await this.linkIfUnchanged(String(entry._id), String(student._id), fields);
      if (ok) linked += 1; else skipped += 1;
    }
    if (linked > 0 || conflicts > 0) emitDormitoryOverviewInvalidated('roster');
    this.logger.log(`Roster reconciliation completed for student ${studentId}: linked=${linked}, conflicts=${conflicts}, skipped=${skipped}`);
    return { linked, conflicts, skipped };
  }
}
