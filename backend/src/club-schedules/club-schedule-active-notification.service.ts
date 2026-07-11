import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ClubSchedule, ClubScheduleDocument } from './schemas/club-schedule.schema';
import { ClubMember, ClubMemberDocument } from '../clubs/schemas/club-member.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ClubScheduleActiveNotificationService {
  private readonly logger = new Logger(ClubScheduleActiveNotificationService.name);

  constructor(
    @InjectModel(ClubSchedule.name)
    private readonly scheduleModel: Model<ClubScheduleDocument>,
    @InjectModel(ClubMember.name)
    private readonly clubMemberModel: Model<ClubMemberDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'club-schedule-active-notifications',
    timeZone: 'Asia/Ho_Chi_Minh',
    waitForCompletion: true,
  })
  async handleCron() {
    const now = new Date();
    this.logger.log(`Checking for active club schedules at ${now.toISOString()}`);

    try {
      // Find active schedules:
      // status is scheduled or ongoing
      // start_time <= now
      // now < end_time
      const query = this.scheduleModel.find({
        status: { $in: ['scheduled', 'ongoing'] },
        start_time: { $lte: now },
        end_time: { $gt: now },
      });
      const activeSchedules = await (typeof query.populate === 'function' ? query.populate('club_id') : query).exec();

      if (activeSchedules.length === 0) {
        return;
      }

      this.logger.log(`Found ${activeSchedules.length} active schedules. Starting notification dispatch.`);

      for (const schedule of activeSchedules) {
        const scheduleIdStr = schedule._id.toString();
        const clubObj = schedule.club_id as any;
        const isClub = clubObj && typeof clubObj === 'object' && clubObj.activity_type !== undefined
          ? clubObj.activity_type === 'club'
          : true;
        const resolvedClubId = clubObj && typeof clubObj === 'object' && clubObj._id
          ? clubObj._id
          : schedule.club_id;
        const clubIdStr = resolvedClubId.toString();

        // Retrieve active members of the club for the corresponding semester
        const members = await this.clubMemberModel
          .find({
            club_id: resolvedClubId,
            semester_id: schedule.semester_id,
            status: 'active',
          })
          .populate({
            path: 'student_id',
            select: 'user_id',
          })
          .exec();

        const recipientUserIds = members
          .map((m) => {
            const student = m.student_id as any;
            if (student && student.user_id) {
              return student.user_id.toString();
            }
            return null;
          })
          .filter(Boolean);

        const uniqueRecipientUserIds = Array.from(new Set(recipientUserIds));

        if (uniqueRecipientUserIds.length === 0) {
          this.logger.log(`Schedule ${scheduleIdStr} has no eligible student members to notify.`);
          continue;
        }

        let sentCount = 0;
        let errorCount = 0;

        for (const recipientUserId of uniqueRecipientUserIds) {
          const deduplicationKey = `club_schedule_active:${scheduleIdStr}:${recipientUserId}`;
          const description = schedule.location
            ? `"${schedule.title}" is happening now at ${schedule.location}.`
            : `"${schedule.title}" is happening now.`;

          const payload = {
            title: isClub ? 'Club session is happening now' : 'Activity session is happening now',
            description,
            type: 'info' as const,
            routeUrl: `/activities/${clubIdStr}?tab=schedule`,
            recipientUserId,
            targetRole: 'student' as const,
            source: 'club_schedule_active',
            metadata: {
              schedule_id: schedule._id.toString(),
              club_id: clubIdStr,
              semester_id: schedule.semester_id.toString(),
              start_time: schedule.start_time.toISOString(),
              end_time: schedule.end_time.toISOString(),
            },
          };

          try {
            await this.notificationsService.createOnce(payload, deduplicationKey);
            sentCount++;
          } catch (error) {
            errorCount++;
            this.logger.error(
              `Failed to create notification for schedule ${scheduleIdStr}. Error: ${error.message}`,
            );
          }
        }

        this.logger.log(
          `Processed notifications for schedule ${scheduleIdStr}: ${sentCount} sent successfully, ${errorCount} errors.`,
        );
      }
    } catch (error) {
      this.logger.error(`Error in club schedule active notification job: ${error.message}`);
    }
  }
}
