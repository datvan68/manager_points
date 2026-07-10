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
import { ClubAttendance, ClubAttendanceDocument } from './schemas/club-attendance.schema';
import { Club, ClubDocument } from '../clubs/schemas/club.schema';
import { AcademicRecord, AcademicRecordDocument } from '../academic-record/schemas/academic-record.schema';
import { CreateActivityCompletionRuleDto, UpdateActivityCompletionRuleDto } from './dto/activity-completion-rule.dto';

@Injectable()
export class ActivityCompletionService {
  constructor(
    @InjectModel(ActivityCompletionRule.name)
    private ruleModel: Model<ActivityCompletionRuleDocument>,
    @InjectModel(ActivityCompletionAward.name)
    private awardModel: Model<ActivityCompletionAwardDocument>,
    @InjectModel(ClubAttendance.name)
    private attendanceModel: Model<ClubAttendanceDocument>,
    @InjectModel(Club.name)
    private clubModel: Model<ClubDocument>,
    @InjectModel(AcademicRecord.name)
    private academicRecordModel: Model<AcademicRecordDocument>,
  ) {}

  // ─── RULE CRUD ───

  async createRule(dto: CreateActivityCompletionRuleDto): Promise<ActivityCompletionRuleDocument> {
    const existing = await this.ruleModel.findOne({
      club_id: new Types.ObjectId(dto.club_id),
      semester_id: new Types.ObjectId(dto.semester_id),
    }).exec();

    if (existing) {
      throw new BadRequestException('Quy tắc hoàn thành cho hoạt động này trong học kỳ đã tồn tại.');
    }

    const rule = new this.ruleModel({
      club_id: new Types.ObjectId(dto.club_id),
      semester_id: new Types.ObjectId(dto.semester_id),
      minimum_attendance: dto.minimum_attendance,
      criterion_ids: dto.criterion_ids.map(id => new Types.ObjectId(id)),
      status: dto.status || 'active',
    });

    return rule.save();
  }

  async findAllRules(): Promise<ActivityCompletionRuleDocument[]> {
    return this.ruleModel.find()
      .populate('club_id', 'name code')
      .populate('semester_id', 'name')
      .populate('criterion_ids', 'name')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOneRule(id: string): Promise<ActivityCompletionRuleDocument> {
    const rule = await this.ruleModel.findById(id)
      .populate('club_id', 'name code')
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

    if (dto.club_id || dto.semester_id) {
      const clubId = dto.club_id || rule.club_id.toString();
      const semesterId = dto.semester_id || rule.semester_id.toString();
      const existing = await this.ruleModel.findOne({
        _id: { $ne: rule._id },
        club_id: new Types.ObjectId(clubId),
        semester_id: new Types.ObjectId(semesterId),
      }).exec();

      if (existing) {
        throw new BadRequestException('Quy tắc hoàn thành cho hoạt động này trong học kỳ đã tồn tại.');
      }
    }

    if (dto.club_id) rule.club_id = new Types.ObjectId(dto.club_id);
    if (dto.semester_id) rule.semester_id = new Types.ObjectId(dto.semester_id);
    if (dto.minimum_attendance !== undefined) rule.minimum_attendance = dto.minimum_attendance;
    if (dto.criterion_ids) rule.criterion_ids = dto.criterion_ids.map(id => new Types.ObjectId(id));
    if (dto.status) rule.status = dto.status;

    return rule.save();
  }

  async removeRule(id: string): Promise<{ message: string }> {
    const result = await this.ruleModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`Không tìm thấy quy tắc hoàn thành với ID: ${id}`);
    }
    return { message: 'Xóa quy tắc hoàn thành thành công' };
  }

  async hasActiveRule(
    clubId: string | Types.ObjectId,
    semesterId: string | Types.ObjectId,
  ): Promise<boolean> {
    const count = await this.ruleModel.countDocuments({
      club_id: new Types.ObjectId(clubId),
      semester_id: new Types.ObjectId(semesterId),
      status: 'active',
    }).exec();
    return count > 0;
  }

  // ─── AWARD SYSTEM ───

  async checkAndAwardCompletion(
    studentId: string,
    clubId: string,
    semesterId: string,
    session?: ClientSession,
  ): Promise<void> {
    const rule = await this.ruleModel.findOne({
      club_id: new Types.ObjectId(clubId),
      semester_id: new Types.ObjectId(semesterId),
      status: 'active',
    }).session(session || null).exec();

    if (!rule) return;

    // Count approved attendances where status is present or late
    const attendanceCount = await this.attendanceModel.countDocuments({
      club_id: new Types.ObjectId(clubId),
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
      approval_status: 'approved',
      status: { $in: ['present', 'late'] },
    }).session(session || null).exec();

    if (attendanceCount >= rule.minimum_attendance) {
      const club = await this.clubModel.findById(clubId).session(session || null).exec();
      if (!club) {
        throw new NotFoundException(`Không tìm thấy hoạt động với ID: ${clubId}`);
      }

      for (const criterionId of rule.criterion_ids) {
        const existingAward = await this.awardModel.findOne({
          club_id: new Types.ObjectId(clubId),
          student_id: new Types.ObjectId(studentId),
          criterion_id: criterionId,
        }).session(session || null).exec();

        if (!existingAward) {
          let academicRecord;
          const idempotencyKey = `activity-completion:${clubId}:${studentId}:${criterionId}`;

          try {
            academicRecord = new this.academicRecordModel({
              student_id: new Types.ObjectId(studentId),
              criterion_id: criterionId,
              semester_id: new Types.ObjectId(semesterId),
              idempotency_key: idempotencyKey,
              record_title: `Hoàn thành hoạt động: ${club.name}`,
              description: `Đạt tối thiểu ${rule.minimum_attendance} buổi điểm danh tại hoạt động ${club.name}`,
              source_type: 'activity_completion',
              source_id: clubId,
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
              club_id: new Types.ObjectId(clubId),
              student_id: new Types.ObjectId(studentId),
              criterion_id: criterionId,
              semester_id: new Types.ObjectId(semesterId),
              academic_record_id: academicRecord._id,
              awarded_at: new Date(),
            });
            await newAward.save({ session });
          }
        }
      }
    }
  }
}
