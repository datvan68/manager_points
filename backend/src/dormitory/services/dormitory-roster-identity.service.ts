import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DormitoryRosterEntry, DormitoryRosterEntryDocument } from '../schemas/dormitory-roster-entry.schema';
import { Student, StudentDocument } from '../../students/schemas/student.schema';

import { emitDormitoryOverviewInvalidated } from '../dormitory-overview-event-emitter';

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
      entry.student_id = student._id;
      entry.student_code = student.student_code || entry.student_code;
      entry.student_code_normalized = student.student_code ? String(student.student_code).trim().toUpperCase() : entry.student_code_normalized;
      entry.identity_state = 'LINKED';
      await entry.save();
      linked += 1;
    }
    if (linked > 0 || conflicts > 0) {
      emitDormitoryOverviewInvalidated('roster');
    }
    this.logger.log(`Roster reconciliation completed for student ${studentId}: linked=${linked}, conflicts=${conflicts}, skipped=${skipped}`);
    return { linked, conflicts, skipped };
  }
}
