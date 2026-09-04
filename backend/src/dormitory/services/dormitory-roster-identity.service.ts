import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DormitoryRosterEntry, DormitoryRosterEntryDocument } from '../schemas/dormitory-roster-entry.schema';
import { Student, StudentDocument } from '../../students/schemas/student.schema';

import { emitDormitoryOverviewInvalidated } from '../dormitory-overview-event-emitter';

export type RosterIdentityOutcome = 'LINKED' | 'UNLINKED' | 'CONFLICT';
export type RosterIdentityMatch = { student?: any; state: RosterIdentityOutcome; reason?: string };

@Injectable()
export class DormitoryRosterIdentityService {
  private readonly logger = new Logger(DormitoryRosterIdentityService.name);

  constructor(
    @InjectModel(DormitoryRosterEntry.name) private readonly rosterModel: Model<DormitoryRosterEntryDocument>,
    @InjectModel(Student.name) private readonly studentModel: Model<StudentDocument>,
  ) {}

  normalizeName(value: unknown) {
    return String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
  }

  sameDate(left: unknown, right: unknown) {
    const a = new Date(String(left));
    const b = new Date(String(right));
    return !Number.isNaN(a.getTime()) && !Number.isNaN(b.getTime()) && a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  identityKey(name: unknown, dob: unknown) {
    const date = new Date(String(dob));
    return `${this.normalizeName(name)}|${Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)}`;
  }

  async resolveBatch(entries: Array<{ full_name: string; date_of_birth: unknown; student_id?: unknown; semester_id: unknown }>): Promise<RosterIdentityMatch[]> {
    const keys = Array.from(new Set(entries.map((entry) => this.identityKey(entry.full_name, entry.date_of_birth))));
    const students: any[] = keys.length ? await (this.studentModel as any).find({ $or: entries.map((entry) => ({ full_name: { $regex: this.normalizeName(entry.full_name).split(' ').join('\\s+'), $options: 'i' }, date_bir: entry.date_of_birth })) }).exec() : [];
    const byKey = new Map<string, any[]>();
    for (const student of students) {
      const key = this.identityKey(student.full_name, student.date_bir);
      if (keys.includes(key)) byKey.set(key, [...(byKey.get(key) || []), student]);
    }
    const rosterEntries: any[] = entries.length ? await (this.rosterModel as any).find({ semester_id: { $in: entries.map((entry) => entry.semester_id) } }).exec() : [];
    return entries.map((entry) => {
      if (entry.student_id) return { student: undefined, state: 'LINKED' };
      const matches = byKey.get(this.identityKey(entry.full_name, entry.date_of_birth)) || [];
      if (matches.length !== 1) return { student: undefined, state: matches.length ? 'CONFLICT' : 'UNLINKED', reason: matches.length ? 'Có nhiều sinh viên trùng họ tên và ngày sinh.' : undefined };
      const competing = rosterEntries.some((other) => String(other.semester_id) === String(entry.semester_id) && String(other._id) !== String((entry as any)._id || '') && other.identity_state !== 'LINKED' && this.identityKey(other.full_name, other.date_of_birth) === this.identityKey(entry.full_name, entry.date_of_birth));
      return competing ? { state: 'CONFLICT', reason: 'Có nhiều mục KTX cạnh tranh cùng định danh.' } : { student: matches[0], state: 'LINKED' };
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
    const result: any = await (this.rosterModel as any).updateOne(
      { _id: entryId, identity_state: { $in: ['UNLINKED', 'CONFLICT'] }, $or: [{ student_id: null }, { student_id: { $exists: false } }] },
      { $set: { ...fields, student_id: studentId, identity_state: 'LINKED' } },
    ).exec();
    if (!result?.matchedCount && !result?.n) return false;
    emitDormitoryOverviewInvalidated('roster');
    return true;
  }

  async reconcileSemester(semesterId: string, afterId?: string, limit = 100) {
    const filter: any = { semester_id: semesterId, identity_state: { $in: ['UNLINKED', 'CONFLICT'] } };
    if (afterId) filter._id = { $gt: afterId };
    const entries: any[] = await (this.rosterModel as any).find(filter).sort({ _id: 1 }).limit(limit).exec();
    const outcomes: any[] = [];
    let linked = 0; let unlinked = 0; let conflicts = 0; let failed = 0;
    for (const entry of entries) {
      try {
        const [match] = await this.resolveBatch([{ ...entry, date_of_birth: entry.date_of_birth, semester_id: semesterId }]);
        if (match.state === 'LINKED' && match.student) {
          const ok = await this.linkIfUnchanged(String(entry._id), String(match.student._id), { student_code: match.student.student_code, student_code_normalized: match.student.student_code && String(match.student.student_code).trim().toUpperCase() });
          if (ok) linked += 1; else conflicts += 1;
          outcomes.push({ id: String(entry._id), outcome: ok ? 'LINKED' : 'CONFLICT', reason: ok ? undefined : 'Mục đã được thay đổi.' });
        } else { (match.state === 'CONFLICT' ? conflicts += 1 : unlinked += 1); outcomes.push({ id: String(entry._id), outcome: match.state, reason: match.reason }); }
      } catch { failed += 1; outcomes.push({ id: String(entry._id), outcome: 'FAILED', reason: 'Không thể đối chiếu mục này.' }); }
    }
    return { scanned: entries.length, linked, unlinked, conflicts, failed, results: outcomes, next_cursor: entries.length ? String(entries[entries.length - 1]._id) : undefined, has_more: entries.length === limit };
  }

  async reconcileStudent(studentId: string) {
    const student: any = await this.studentModel.findById(studentId).exec();
    if (!student?.full_name || !student?.date_bir) return { linked: 0, conflicts: 0, skipped: 0 };
    const candidates: any[] = await this.rosterModel.find({ identity_state: { $in: ['UNLINKED', 'CONFLICT'] }, full_name_normalized: this.normalizeName(student.full_name) }).exec();
    let linked = 0;
    let conflicts = 0;
    let skipped = 0;
    for (const entry of candidates) {
      if (!this.sameDate(entry.date_of_birth, student.date_bir)) {
        skipped += 1;
        continue;
      }
      const duplicate: any = await this.rosterModel.findOne({ student_id: student._id, semester_id: entry.semester_id, _id: { $ne: entry._id } }).exec();
      if (duplicate) {
        entry.identity_state = 'CONFLICT';
        await entry.save();
        conflicts += 1;
        continue;
      }
      const competing: any[] = await this.rosterModel.find({ identity_state: 'UNLINKED', full_name_normalized: entry.full_name_normalized, date_of_birth: entry.date_of_birth, semester_id: entry.semester_id, _id: { $ne: entry._id } }).limit(2).exec();
      if (competing.length > 0) {
        entry.identity_state = 'CONFLICT';
        for (const item of competing) {
          item.identity_state = 'CONFLICT';
          await item.save();
        }
        await entry.save();
        conflicts += 1;
        continue;
      }
      let ok = false;
      if (!(this.rosterModel as any).updateOne) {
        entry.student_id = student._id;
        entry.student_code = student.student_code || entry.student_code;
        entry.student_code_normalized = student.student_code ? String(student.student_code).trim().toUpperCase() : entry.student_code_normalized;
        entry.identity_state = 'LINKED';
        await entry.save();
        ok = true;
      } else {
        ok = await this.linkIfUnchanged(String(entry._id), String(student._id), { student_code: student.student_code || entry.student_code, student_code_normalized: student.student_code ? String(student.student_code).trim().toUpperCase() : entry.student_code_normalized });
      }
      if (ok) linked += 1; else skipped += 1;
    }
    if (linked > 0 || conflicts > 0) {
      emitDormitoryOverviewInvalidated('roster');
    }
    this.logger.log(`Roster reconciliation completed for student ${studentId}: linked=${linked}, conflicts=${conflicts}, skipped=${skipped}`);
    return { linked, conflicts, skipped };
  }
}
