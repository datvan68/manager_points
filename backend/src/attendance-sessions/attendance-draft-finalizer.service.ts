import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Model, Types } from 'mongoose';
import { ActivityAttendance, ActivityAttendanceDocument } from '../activity-attendance/schemas/activity-attendance.schema';
import { ActivitySchedule, ActivityScheduleDocument } from '../activity-schedules/schemas/activity-schedule.schema';
import { ActivityAttendanceSyncService } from '../activity-attendance/activity-attendance-sync.service';

@Injectable()
export class AttendanceDraftFinalizerService {
  private readonly logger = new Logger(AttendanceDraftFinalizerService.name);
  private running = false;

  constructor(
    @InjectModel(ActivityAttendance.name) private readonly attendanceModel: Model<ActivityAttendanceDocument>,
    @InjectModel(ActivitySchedule.name) private readonly scheduleModel: Model<ActivityScheduleDocument>,
    private readonly syncService: ActivityAttendanceSyncService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, { name: 'finalize-manual-attendance-drafts', timeZone: 'Asia/Ho_Chi_Minh', waitForCompletion: true })
  async finalizeEndedDrafts(): Promise<number> {
    if (this.running) return 0;
    this.running = true;
    let finalized = 0;
    try {
      const schedules = await this.scheduleModel.find({ status: { $ne: 'cancelled' }, end_time: { $lte: new Date() } }).select('_id').limit(200).lean().exec();
      for (const schedule of schedules) {
        while (true) {
          const record = await this.attendanceModel.findOneAndUpdate(
            { schedule_id: schedule._id, attendance_method: 'manual_class', approval_status: 'pending', status: { $in: ['present', 'late'] } },
            [{ $set: { approval_status: 'approved', approved_by: '$recorded_by', approved_at: '$$NOW' } }],
            { sort: { recorded_at: 1 }, returnDocument: 'after' },
          ).lean().exec();
          if (!record) break;
          finalized += 1;
          // The original recorder is the audit actor; sync is retried by the existing catch-up job.
          this.syncService.enqueueAttendanceSync(record._id.toString());
        }
      }
    } catch (error: any) {
      this.logger.error(`Attendance draft finalization failed: ${error.message}`);
    } finally {
      this.running = false;
    }
    return finalized;
  }
}
