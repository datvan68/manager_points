import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types, ClientSession } from 'mongoose';
import {
  ActivityCompletionRule,
  ActivityCompletionRuleDocument,
} from './schemas/activity-completion-rule.schema';
import {
  ActivityCompletionAward,
  ActivityCompletionAwardDocument,
} from './schemas/activity-completion-award.schema';
import { ActivityAttendance, ActivityAttendanceDocument } from './schemas/activity-attendance.schema';
import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';
import { AcademicRecord, AcademicRecordDocument } from '../academic-record/schemas/academic-record.schema';
import { CreateActivityCompletionRuleDto, UpdateActivityCompletionRuleDto } from './dto/activity-completion-rule.dto';
import { ActivityMember, ActivityMemberDocument } from '../activities/schemas/activity-member.schema';

@Injectable()
export class ActivityCompletionService {
  constructor(
    @InjectModel(ActivityCompletionRule.name)
    private ruleModel: Model<ActivityCompletionRuleDocument>,
    @InjectModel(ActivityCompletionAward.name)
    private awardModel: Model<ActivityCompletionAwardDocument>,
    @InjectModel(ActivityAttendance.name)
    private attendanceModel: Model<ActivityAttendanceDocument>,
    @InjectModel(Activity.name)
    private clubModel: Model<ActivityDocument>,
    @InjectModel(AcademicRecord.name)
    private academicRecordModel: Model<AcademicRecordDocument>,
    @InjectModel(ActivityMember.name)
    private memberModel: Model<ActivityMemberDocument>,
  ) {}

  // ─── RULE CRUD ───

  async createRule(dto: CreateActivityCompletionRuleDto): Promise<ActivityCompletionRuleDocument> {
    const existing = await this.ruleModel.findOne({
      activity_id: new Types.ObjectId(dto.activity_id),
      semester_id: new Types.ObjectId(dto.semester_id),
    }).exec();

    if (existing) {
      throw new BadRequestException('Quy tắc hoàn thành cho hoạt động này trong học kỳ đã tồn tại.');
    }

    const rule = new this.ruleModel({
      activity_id: new Types.ObjectId(dto.activity_id),
      semester_id: new Types.ObjectId(dto.semester_id),
      minimum_attendance: dto.minimum_attendance,
      criterion_ids: dto.criterion_ids.map(id => new Types.ObjectId(id)),
      status: dto.status || 'active',
    });

    return rule.save();
  }

  async findAllRules(): Promise<ActivityCompletionRuleDocument[]> {
    return this.ruleModel.find()
      .populate('activity_id', 'name code')
      .populate('semester_id', 'name')
      .populate('criterion_ids', 'name')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOneRule(id: string): Promise<ActivityCompletionRuleDocument> {
    const rule = await this.ruleModel.findById(id)
      .populate('activity_id', 'name code')
      .populate('semester_id', 'name')
      .populate('criterion_ids', 'name')
      .exec();

    if (!rule) {
      throw new NotFoundException(`Không tìm thấy quy tắc hoàn thành với ID: ${id}`);
    }
    return rule;
  }

  async updateRule(id: string, dto: UpdateActivityCompletionRuleDto): Promise<ActivityCompletionRuleDocument> {
    const rule = await this.ruleModel.findById(id).exec();
    if (!rule) {
      throw new NotFoundException(`Không tìm thấy quy tắc hoàn thành với ID: ${id}`);
    }

    if (dto.activity_id || dto.semester_id) {
      const activityId = dto.activity_id || rule.activity_id.toString();
      const semesterId = dto.semester_id || rule.semester_id.toString();
      const existing = await this.ruleModel.findOne({
        _id: { $ne: rule._id },
        activity_id: new Types.ObjectId(activityId),
        semester_id: new Types.ObjectId(semesterId),
      }).exec();

      if (existing) {
        throw new BadRequestException('Quy tắc hoàn thành cho hoạt động này trong học kỳ đã tồn tại.');
      }
    }

    if (dto.activity_id) rule.activity_id = new Types.ObjectId(dto.activity_id);
    if (dto.semester_id) rule.semester_id = new Types.ObjectId(dto.semester_id);
    if (dto.minimum_attendance !== undefined) rule.minimum_attendance = dto.minimum_attendance;
    if (dto.criterion_ids) rule.criterion_ids = dto.criterion_ids.map(id => new Types.ObjectId(id));
    if (dto.status) rule.status = dto.status;

    const saved = await rule.save();
    const members = await this.memberModel.find({ activity_id: saved.activity_id, semester_id: saved.semester_id, status: 'active' }).select('student_id').lean().exec();
    for (const member of members) if (member.student_id) await this.checkAndAwardCompletion(member.student_id.toString(), saved.activity_id.toString(), saved.semester_id.toString());
    return saved;
  }

  async getMemberProgress(activityId: string, semesterId: string) {
    const members = await this.memberModel.find({ activity_id: new Types.ObjectId(activityId), semester_id: new Types.ObjectId(semesterId), status: 'active' }).lean().exec();
    return members.map((member: any) => ({ member_id: member._id.toString(), participation_count: Math.max(0, 3 - (member.self_service_leave_count ?? 0)) }));
  }

  async resetMemberProgress(activityId: string, semesterId: string, memberId: string) {
    const member = await this.memberModel.findOneAndUpdate({ _id: new Types.ObjectId(memberId), activity_id: new Types.ObjectId(activityId), semester_id: new Types.ObjectId(semesterId) }, { $set: { self_service_leave_count: 0 } }, { returnDocument: 'after' }).exec();
    if (!member) throw new NotFoundException('Không tìm thấy thành viên trong hoạt động và học kỳ yêu cầu');
    return { member_id: member._id.toString(), participation_count: 3 };
  }

  private countMemberAttendance(activityId: string, semesterId: string, studentId: any, resetAt?: Date) {
    const attendanceCount = this.attendanceModel.countDocuments({ activity_id: new Types.ObjectId(activityId), semester_id: new Types.ObjectId(semesterId), student_id: studentId, approval_status: 'approved', status: { $in: ['present', 'late'] }, ...(resetAt ? { $or: [{ check_in_time: { $gt: resetAt } }, { recorded_at: { $gt: resetAt } }] } : {}) }).exec();
    return resetAt ? attendanceCount.then((count) => count + 3) : attendanceCount;
  }

  async removeRule(id: string): Promise<{ message: string }> {
    const result = await this.ruleModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Không tìm thấy quy tắc hoàn thành với ID: ${id}`);
    }
    return { message: 'Xóa quy tắc hoàn thành thành công' };
  }

  async hasActiveRule(
    activityId: string | Types.ObjectId,
    semesterId: string | Types.ObjectId,
  ): Promise<boolean> {
    const count = await this.ruleModel.countDocuments({
      activity_id: new Types.ObjectId(activityId),
      semester_id: new Types.ObjectId(semesterId),
      status: 'active',
    }).exec();
    return count > 0;
  }

  // ─── AWARD SYSTEM ───

  async checkAndAwardCompletion(
    studentId: string,
    activityId: string,
    semesterId: string,
    session?: ClientSession,
  ): Promise<void> {
    const rule = await this.ruleModel.findOne({
      activity_id: new Types.ObjectId(activityId),
      semester_id: new Types.ObjectId(semesterId),
      status: 'active',
    }).session(session || null).exec();

    if (!rule) return;

    // Count approved attendances where status is present or late
    const attendances = await this.attendanceModel.find({
      activity_id: new Types.ObjectId(activityId),
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
      approval_status: 'approved',
      status: { $in: ['present', 'late'] },
    }).sort({ check_in_time: 1, recorded_at: 1, _id: 1 }).session(session || null).exec();

    const attendanceCount = attendances.length;

    const earnedUnits = rule.minimum_attendance > 0
      ? Math.floor(attendanceCount / rule.minimum_attendance)
      : 0;

    const club = await this.clubModel.findById(activityId).session(session || null).exec();
    if (!club) {
      throw new NotFoundException(`Không tìm thấy hoạt động với ID: ${activityId}`);
    }

      for (const criterionId of rule.criterion_ids) {
        const existingAward = await this.awardModel.findOne({
          activity_id: new Types.ObjectId(activityId),
          student_id: new Types.ObjectId(studentId),
          criterion_id: criterionId,
        }).session(session || null).exec();

        const baseKey = `activity-completion:${activityId}:${studentId}:${criterionId}`;
        if (!existingAward && earnedUnits > 0) {
          let academicRecord;
          const idempotencyKey = baseKey;

          try {
            academicRecord = new this.academicRecordModel({
              student_id: new Types.ObjectId(studentId),
              criterion_id: criterionId,
              semester_id: new Types.ObjectId(semesterId),
              idempotency_key: idempotencyKey,
              record_title: `Hoàn thành hoạt động: ${club.name}`,
              description: this.buildCompletionDescription(
                rule.minimum_attendance,
                club.name,
                attendances.slice(0, rule.minimum_attendance),
              ),
              source_type: 'activity_completion',
              source_id: activityId,
              record_type: 'activity',
              action_type: 'count',
              quantity: 1,
              recorded_by_role: 'system',
              status: 'active',
            });
            await academicRecord.save({ session });
          } catch (error) {
            if (error.code === 11000) {
              academicRecord = await this.academicRecordModel.findOne({
                idempotency_key: idempotencyKey,
              }).session(session || null).exec();
            } else {
              throw error;
            }
          }

          if (academicRecord) {
            const newAward = new this.awardModel({
              activity_id: new Types.ObjectId(activityId),
              student_id: new Types.ObjectId(studentId),
              criterion_id: criterionId,
              semester_id: new Types.ObjectId(semesterId),
              academic_record_id: academicRecord._id,
              awarded_at: new Date(),
            });
            await newAward.save({ session });
          }
        }

        const activeRecords = await (this.academicRecordModel as any).find({
          student_id: new Types.ObjectId(studentId),
          criterion_id: criterionId,
          semester_id: new Types.ObjectId(semesterId),
          source_type: 'activity_completion',
          source_id: activityId,
          idempotency_key: { $regex: `^${baseKey}` },
          is_deleted: { $ne: true },
          status: 'active',
        }).sort({ createdAt: 1, _id: 1 }).session(session || null).exec();

        for (let sequence = activeRecords.length + 1; sequence <= earnedUnits; sequence++) {
          await (this.academicRecordModel as any).create([{
            student_id: new Types.ObjectId(studentId),
            criterion_id: criterionId,
            semester_id: new Types.ObjectId(semesterId),
            idempotency_key: `${baseKey}:sequence:${sequence}`,
            record_title: `Hoàn thành hoạt động: ${club.name}`,
            description: this.buildCompletionDescription(
              rule.minimum_attendance,
              club.name,
              attendances.slice(
                (sequence - 1) * rule.minimum_attendance,
                sequence * rule.minimum_attendance,
              ),
            ),
            source_type: 'activity_completion', source_id: activityId,
            record_type: 'activity', action_type: 'count', quantity: 1,
            recorded_by_role: 'system', status: 'active', is_deleted: false,
          }], { session });
        }

        if (activeRecords.length > earnedUnits) {
          const surplus: any[] = activeRecords.slice(earnedUnits);
          await this.academicRecordModel.updateMany(
            { _id: { $in: surplus.map(record => record._id) } },
            { $set: { status: 'inactive', is_deleted: true } },
            { session },
          );
        }
      }
  }

  private buildCompletionDescription(
    minimumAttendance: number,
    activityName: string,
    attendances: Array<{ check_in_time?: Date; recorded_at?: Date }>,
  ): string {
    const dates = attendances.map((attendance) => {
      const date = attendance.check_in_time || attendance.recorded_at;
      if (!date) {
        throw new BadRequestException('Attendance record is missing a completion date.');
      }
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date(date));
    });

    return `Hoàn thành ${minimumAttendance} buổi của hoạt động ${activityName}, các ngày ${dates.join(', ')}`;
  }
}
