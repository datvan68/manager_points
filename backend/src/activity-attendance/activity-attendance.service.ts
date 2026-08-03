import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActivityAttendance,
  ActivityAttendanceDocument,
} from './schemas/activity-attendance.schema';
import {
  CreateAttendanceDto,
  BatchAttendanceDto,
  ApproveAttendanceDto,
  QueryAttendanceDto,
} from './dto/attendance.dto';
import { ActivityAttendanceSyncService } from './activity-attendance-sync.service';
import { Activity } from '../activities/schemas/activity.schema';
import { ActivitySchedule } from '../activity-schedules/schemas/activity-schedule.schema';
import { Class } from '../classes/schemas/class.schema';
import { Student } from '../students/schemas/student.schema';

@Injectable()
export class ActivityAttendanceService {
  private readonly logger = new Logger(ActivityAttendanceService.name);

  constructor(
    @InjectModel(ActivityAttendance.name)
    private attendanceModel: Model<ActivityAttendanceDocument>,
    @InjectModel(Activity.name) private activityModel: Model<any>,
    @InjectModel(ActivitySchedule.name) private scheduleModel: Model<any>,
    @InjectModel(Student.name) private studentModel: Model<any>,
    @InjectModel(Class.name) private classModel: Model<any>,
    @Inject(forwardRef(() => ActivityAttendanceSyncService))
    private syncService: ActivityAttendanceSyncService,
  ) {}

  async create(
    dto: CreateAttendanceDto,
    userId: string,
    userRole: string,
  ): Promise<ActivityAttendanceDocument> {
    // Check duplicate
    const existing = await this.attendanceModel.findOne({
      schedule_id: new Types.ObjectId(dto.schedule_id),
      student_id: new Types.ObjectId(dto.student_id),
    });
    if (existing) {
      throw new BadRequestException(
        'Sinh viên đã được điểm danh cho buổi sinh hoạt này',
      );
    }

    const attendance = new this.attendanceModel({
      activity_id: new Types.ObjectId(dto.activity_id),
      schedule_id: new Types.ObjectId(dto.schedule_id),
      student_id: new Types.ObjectId(dto.student_id),
      semester_id: new Types.ObjectId(dto.semester_id),
      status: dto.status,
      check_in_time: dto.check_in_time,
      note: dto.note,
      recorded_by: new Types.ObjectId(userId),
      recorded_by_role: userRole,
      recorded_at: new Date(),
    });

    return attendance.save();
  }

  async batchCreate(
    dto: BatchAttendanceDto,
    userId: string,
    userRole: string,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const entry of dto.entries) {
      try {
        const existing = await this.attendanceModel.findOne({
          schedule_id: new Types.ObjectId(dto.schedule_id),
          student_id: new Types.ObjectId(entry.student_id),
        });

        if (existing) {
          // Update existing record
          existing.status = entry.status;
          existing.note = entry.note || existing.note;
          existing.recorded_by = new Types.ObjectId(userId);
          existing.recorded_by_role = userRole;
          existing.recorded_at = new Date();
          await existing.save();
          created++;
          continue;
        }

        const attendance = new this.attendanceModel({
          activity_id: new Types.ObjectId(dto.activity_id),
          schedule_id: new Types.ObjectId(dto.schedule_id),
          student_id: new Types.ObjectId(entry.student_id),
          semester_id: new Types.ObjectId(dto.semester_id),
          status: entry.status,
          note: entry.note,
          recorded_by: new Types.ObjectId(userId),
          recorded_by_role: userRole,
          recorded_at: new Date(),
        });

        await attendance.save();
        created++;
      } catch (err: any) {
        skipped++;
        errors.push(`Student ${entry.student_id}: ${err.message}`);
      }
    }

    return { created, skipped, errors };
  }

  async findAll(query: QueryAttendanceDto): Promise<{
    items: ActivityAttendanceDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: any = {};

    if (query.activity_id) filter.activity_id = new Types.ObjectId(query.activity_id);
    if (query.schedule_id)
      filter.schedule_id = new Types.ObjectId(query.schedule_id);
    if (query.student_id)
      filter.student_id = new Types.ObjectId(query.student_id);
    if (query.semester_id)
      filter.semester_id = new Types.ObjectId(query.semester_id);
    if (query.approval_status) filter.approval_status = query.approval_status;
    if (query.status) filter.status = query.status;
    if (query.start_date || query.end_date) {
      filter.recorded_at = {};
      if (query.start_date) filter.recorded_at.$gte = new Date(`${query.start_date}T00:00:00.000Z`);
      if (query.end_date) filter.recorded_at.$lte = new Date(`${query.end_date}T23:59:59.999Z`);
    }

    if (query.search?.trim()) {
      const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      const [activities, schedules, students, classes] = await Promise.all([
        this.activityModel.find({ $or: [{ name: regex }, { code: regex }] }).select('_id').lean().exec(),
        this.scheduleModel.find({ title: regex }).select('_id').lean().exec(),
        this.studentModel.find({ $or: [{ full_name: regex }, { student_code: regex }] }).select('_id').lean().exec(),
        this.classModel.find({ class_name: regex }).select('_id').lean().exec(),
      ]);
      filter.$or = [
        { activity_id: { $in: activities.map((item: any) => item._id) } },
        { schedule_id: { $in: schedules.map((item: any) => item._id) } },
        { student_id: { $in: students.map((item: any) => item._id) } },
        { class_id: { $in: classes.map((item: any) => item._id) } },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.attendanceModel
        .find(filter)
        .populate('student_id', 'full_name student_code email')
        .populate('schedule_id', 'title start_time end_time location')
        .populate('activity_id', 'name code')
        .populate('class_id', 'class_name')
        .populate('recorded_by', 'user_name')
        .populate('approved_by', 'user_name')
        .sort({ recorded_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.attendanceModel.countDocuments(filter),
    ]);

    return { items, total, page, limit };
  }

  async findBySchedule(scheduleId: string): Promise<ActivityAttendanceDocument[]> {
    return this.attendanceModel
      .find({ schedule_id: new Types.ObjectId(scheduleId) })
      .populate('student_id', 'full_name student_code email')
      .populate('recorded_by', 'user_name')
      .sort({ 'student_id.full_name': 1 })
      .lean()
      .exec();
  }

  async findMyAttendance(
    studentId: string,
    semesterId?: string,
    activityId?: string,
  ): Promise<ActivityAttendanceDocument[]> {
    const filter: any = { student_id: new Types.ObjectId(studentId) };
    if (semesterId) filter.semester_id = new Types.ObjectId(semesterId);
    if (activityId) filter.activity_id = new Types.ObjectId(activityId);

    return this.attendanceModel
      .find(filter)
      .populate('schedule_id', 'title start_time end_time location')
      .populate('activity_id', 'name code')
      .sort({ recorded_at: -1 })
      .lean()
      .exec();
  }

  async findOne(id: string): Promise<ActivityAttendanceDocument> {
    const attendance = await this.attendanceModel
      .findById(id)
      .populate('student_id', 'full_name student_code email')
      .populate('schedule_id', 'title start_time end_time location')
      .populate('activity_id', 'name code')
      .populate('recorded_by', 'user_name')
      .populate('approved_by', 'user_name')
      .exec();

    if (!attendance) {
      throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
    }
    return attendance;
  }

  async update(id: string, updates: any): Promise<ActivityAttendanceDocument> {
    const attendance = await this.attendanceModel.findByIdAndUpdate(
      id,
      { $set: updates },
      { returnDocument: 'after' },
    );
    if (!attendance) {
      throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
    }
    return attendance;
  }

  async remove(id: string): Promise<{ message: string }> {
    const attendance = await this.attendanceModel.findByIdAndDelete(id);
    if (!attendance) {
      throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
    }
    return { message: 'Đã xóa bản ghi điểm danh' };
  }

  async approve(
    id: string,
    dto: ApproveAttendanceDto,
    userId: string,
  ): Promise<ActivityAttendanceDocument> {
    const attendance = await this.attendanceModel.findById(id);
    if (!attendance) {
      throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
    }
    if (attendance.approval_status !== 'pending') {
      throw new BadRequestException('Bản ghi đã được xử lý trước đó');
    }

    attendance.approval_status = dto.status;
    attendance.approved_by = new Types.ObjectId(userId);
    attendance.approved_at = new Date();

    if (dto.status === 'rejected') {
      attendance.rejection_reason = dto.rejection_reason || '';
    }

    const saved = await attendance.save();

    // Auto-sync to AcademicRecord when approved
    if (dto.status === 'approved') {
      try {
        const syncResult =
          await this.syncService.syncAttendanceToAcademicRecord(
            saved._id.toString(),
          );
        this.logger.log(
          `Sync result for ${saved._id}: ${syncResult.synced ? 'OK' : syncResult.reason}`,
        );
      } catch (err: any) {
        this.logger.error(`Sync failed for ${saved._id}: ${err.message}`);
        // Don't throw — approval succeeded, sync can be retried
      }
    }

    // Revoke AcademicRecord when rejected (if previously synced)
    if (dto.status === 'rejected') {
      try {
        await this.syncService.revokeAcademicRecord(saved._id.toString());
      } catch (err: any) {
        this.logger.error(`Revoke failed for ${saved._id}: ${err.message}`);
      }
    }

    return saved;
  }

  async reject(
    id: string,
    dto: ApproveAttendanceDto,
    userId: string,
  ): Promise<ActivityAttendanceDocument> {
    return this.approve(id, { ...dto, status: 'rejected' }, userId);
  }

  async batchApprove(
    ids: string[],
    userId: string,
  ): Promise<{ approved: number; errors: string[] }> {
    let approved = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await this.approve(id, { status: 'approved' }, userId);
        approved++;
      } catch (err: any) {
        errors.push(`ID ${id}: ${err.message}`);
      }
    }

    return { approved, errors };
  }

  async getSummary(activityId: string, semesterId: string): Promise<any> {
    const pipeline = [
      {
        $match: {
          activity_id: new Types.ObjectId(activityId),
          semester_id: new Types.ObjectId(semesterId),
        },
      },
      {
        $group: {
          _id: '$student_id',
          total_sessions: { $sum: 1 },
          present_count: {
            $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] },
          },
          absent_count: {
            $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] },
          },
          late_count: {
            $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] },
          },
          excused_count: {
            $sum: { $cond: [{ $eq: ['$status', 'excused'] }, 1, 0] },
          },
          approved_count: {
            $sum: { $cond: [{ $eq: ['$approval_status', 'approved'] }, 1, 0] },
          },
          pending_count: {
            $sum: { $cond: [{ $eq: ['$approval_status', 'pending'] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'students',
          localField: '_id',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: '$student' },
      {
        $project: {
          student_id: '$_id',
          student_name: '$student.full_name',
          student_code: '$student.student_code',
          total_sessions: 1,
          present_count: 1,
          absent_count: 1,
          late_count: 1,
          excused_count: 1,
          approved_count: 1,
          pending_count: 1,
          attendance_rate: {
            $cond: [
              { $gt: ['$total_sessions', 0] },
              {
                $multiply: [
                  { $divide: ['$present_count', '$total_sessions'] },
                  100,
                ],
              },
              0,
            ],
          },
        },
      },
      { $sort: { student_name: 1 as 1 | -1 } },
    ];

    return this.attendanceModel.aggregate(pipeline);
  }

  async getPendingCount(activityId?: string): Promise<{ count: number }> {
    const filter: any = { approval_status: 'pending' };
    if (activityId) filter.activity_id = new Types.ObjectId(activityId);

    const count = await this.attendanceModel.countDocuments(filter);
    return { count };
  }
}
