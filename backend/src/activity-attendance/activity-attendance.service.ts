import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
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

  private requesterId(requester?: any): string | undefined {
    return typeof requester === 'string'
      ? requester
      : requester?.userId || requester?._id || requester?.id;
  }

  private async resolveStudentId(requester: any): Promise<string> {
    if (requester?.studentId && Types.ObjectId.isValid(requester.studentId)) {
      return requester.studentId;
    }
    const userId = this.requesterId(requester);
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('Tài khoản chưa có hồ sơ sinh viên');
    }
    const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(userId) }).exec();
    if (!student) throw new ForbiddenException('Tài khoản chưa có hồ sơ sinh viên');
    return student._id.toString();
  }

  private async ensureActivityAccess(activityId: string, requester?: any): Promise<void> {
    const activity = await this.activityModel.findById(activityId).select('advisor_id president_id').lean().exec();
    if (!activity) throw new NotFoundException('Không tìm thấy Hoạt động');
    if (requester?.roleCode === 'ADMIN' || requester?.permissions?.includes('ADMIN_FULL')) return;

    const userId = this.requesterId(requester);
    if (userId && activity.advisor_id?.toString() === userId.toString()) return;
    if (userId && Types.ObjectId.isValid(userId)) {
      const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(userId) }).select('_id').lean().exec();
      if (student && activity.president_id?.toString() === student._id.toString()) return;
    }
    throw new ForbiddenException('Bạn không có quyền truy cập điểm danh của Hoạt động này');
  }

  private async ensureAttendanceContext(
    activityId: string,
    scheduleId: string,
    semesterId: string,
    studentId: string,
    requester?: any,
  ): Promise<void> {
    if (requester) await this.ensureActivityAccess(activityId, requester);
    const schedule = await this.scheduleModel
      .findById(scheduleId)
      .select('activity_id semester_id')
      .lean()
      .exec();
    if (
      !schedule ||
      schedule.activity_id?.toString() !== activityId.toString() ||
      schedule.semester_id?.toString() !== semesterId.toString()
    ) {
      throw new BadRequestException('Buổi điểm danh không thuộc hoạt động hoặc học kỳ đã chọn.');
    }
    const student = await this.studentModel.findById(studentId).select('_id').lean().exec();
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên điểm danh.');
  }

  async create(
    dto: CreateAttendanceDto,
    userId: string,
    userRole: string,
    requester?: any,
  ): Promise<ActivityAttendanceDocument> {
    await this.ensureAttendanceContext(
      dto.activity_id,
      dto.schedule_id,
      dto.semester_id,
      dto.student_id,
      requester,
    );
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
    requester?: any,
  ): Promise<{ created: number; skipped: number; errors: string[] }> {
    if (requester) await this.ensureActivityAccess(dto.activity_id, requester);
    const schedule = await this.scheduleModel
      .findById(dto.schedule_id)
      .select('activity_id semester_id')
      .lean()
      .exec();
    if (
      !schedule ||
      schedule.activity_id?.toString() !== dto.activity_id.toString() ||
      schedule.semester_id?.toString() !== dto.semester_id.toString()
    ) {
      throw new BadRequestException('Buổi điểm danh không thuộc hoạt động hoặc học kỳ đã chọn.');
    }
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const entry of dto.entries) {
      try {
        const student = await this.studentModel.findById(entry.student_id).select('_id').lean().exec();
        if (!student) throw new NotFoundException('Không tìm thấy sinh viên điểm danh.');
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

  async findAll(query: QueryAttendanceDto, requester?: any): Promise<{
    items: ActivityAttendanceDocument[];
    total: number;
    page: number;
    limit: number;
  }> {
    const filter: any = {};

    if (!requester) {
      // Controller routes always pass the authenticated requester; preserve the
      // service's existing direct-call behavior for internal sync jobs/tests.
    } else if (query.activity_id) {
      await this.ensureActivityAccess(query.activity_id, requester);
    } else if (!(requester?.roleCode === 'ADMIN' || requester?.permissions?.includes('ADMIN_FULL'))) {
      const userId = this.requesterId(requester);
      const student = userId && Types.ObjectId.isValid(userId)
        ? await this.studentModel.findOne({ user_id: new Types.ObjectId(userId) }).select('_id').lean().exec()
        : null;
      const activityQuery: any = { $or: [] };
      if (userId && Types.ObjectId.isValid(userId)) activityQuery.$or.push({ advisor_id: new Types.ObjectId(userId) });
      if (student) activityQuery.$or.push({ president_id: student._id });
      const activities = activityQuery.$or.length
        ? await this.activityModel.find(activityQuery).select('_id').lean().exec()
        : [];
      filter.activity_id = { $in: activities.map((activity: any) => activity._id) };
    }

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
    requester: any,
    semesterId?: string,
    activityId?: string,
  ): Promise<ActivityAttendanceDocument[]> {
    const studentId = await this.resolveStudentId(requester);
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

  async findOne(id: string, requester?: any): Promise<ActivityAttendanceDocument> {
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
    if (requester) {
      const activityId = attendance.activity_id?._id || attendance.activity_id;
      await this.ensureActivityAccess(activityId.toString(), requester);
    }
    return attendance;
  }

  async update(id: string, updates: any, requester?: any): Promise<ActivityAttendanceDocument> {
    const immutableFields = ['activity_id', 'schedule_id', 'student_id', 'semester_id'];
    const workflowFields = ['approval_status', 'approved_by', 'approved_at', 'rejection_reason', 'synced_to_academic_record', 'academic_record_id'];
    if ([...immutableFields, ...workflowFields].some((field) => Object.prototype.hasOwnProperty.call(updates || {}, field))) {
      throw new BadRequestException('Không được thay đổi định danh hoặc trạng thái workflow của bản ghi điểm danh.');
    }
    const existing = await this.attendanceModel.findById(id).select('activity_id').lean().exec();
    if (!existing) throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
    if (requester) await this.ensureActivityAccess(existing.activity_id.toString(), requester);
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

  async remove(id: string, requester?: any): Promise<{ message: string }> {
    const existing = await this.attendanceModel.findById(id).select('activity_id').lean().exec();
    if (!existing) throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
    if (requester) await this.ensureActivityAccess(existing.activity_id.toString(), requester);
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
    requester?: any,
  ): Promise<ActivityAttendanceDocument> {
    const attendance = await this.attendanceModel.findById(id);
    if (!attendance) {
      throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
    }
    if (requester) await this.ensureActivityAccess(attendance.activity_id.toString(), requester);
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
    requester?: any,
  ): Promise<ActivityAttendanceDocument> {
    return this.approve(id, { ...dto, status: 'rejected' }, userId, requester);
  }

  async batchApprove(
    ids: string[],
    userId: string,
    requester?: any,
  ): Promise<{ approved: number; errors: string[] }> {
    let approved = 0;
    const errors: string[] = [];

    for (const id of ids) {
      try {
        await this.approve(id, { status: 'approved' }, userId, requester);
        approved++;
      } catch (err: any) {
        errors.push(`ID ${id}: ${err.message}`);
      }
    }

    return { approved, errors };
  }

  async getSummary(activityId: string, semesterId: string, requester?: any): Promise<any> {
    if (requester) await this.ensureActivityAccess(activityId, requester);
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

  async getPendingCount(activityId?: string, requester?: any): Promise<{ count: number }> {
    const filter: any = { approval_status: 'pending' };
    if (activityId) {
      if (requester) await this.ensureActivityAccess(activityId, requester);
      filter.activity_id = new Types.ObjectId(activityId);
    } else if (requester && !(requester?.roleCode === 'ADMIN' || requester?.permissions?.includes('ADMIN_FULL'))) {
      throw new BadRequestException('Cần chọn hoạt động để xem số điểm danh chờ duyệt.');
    }

    const count = await this.attendanceModel.countDocuments(filter);
    return { count };
  }
}
