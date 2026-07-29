import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceSessionsService } from './attendance-sessions.service';
import { AttendanceSessionsController } from './attendance-sessions.controller';
import { AttendanceRealtimeService } from './attendance-realtime.service';
import {
  AttendanceSession,
  AttendanceSessionSchema,
} from './schemas/attendance-session.schema';
import {
  AttendanceCheckin,
  AttendanceCheckinSchema,
} from './schemas/attendance-checkin.schema';
import {
  ActivityAttendance,
  ActivityAttendanceSchema,
} from '../activity-attendance/schemas/activity-attendance.schema';
import {
  ActivityMember,
  ActivityMemberSchema,
} from '../activities/schemas/activity-member.schema';
import {
  ActivitySchedule,
  ActivityScheduleSchema,
} from '../activity-schedules/schemas/activity-schedule.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { ActivityAttendanceModule } from '../activity-attendance/activity-attendance.module';
import { Activity, ActivitySchema } from '../activities/schemas/activity.schema';
import { ActivitiesModule } from '../activities/activities.module';
import { AttendanceDraftFinalizerService } from './attendance-draft-finalizer.service';

@Module({
  imports: [
    ActivityAttendanceModule,
    ActivitiesModule,
    MongooseModule.forFeature([
      { name: AttendanceSession.name, schema: AttendanceSessionSchema },
      { name: AttendanceCheckin.name, schema: AttendanceCheckinSchema },
      { name: ActivityAttendance.name, schema: ActivityAttendanceSchema },
      { name: ActivityMember.name, schema: ActivityMemberSchema },
      { name: ActivitySchedule.name, schema: ActivityScheduleSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Activity.name, schema: ActivitySchema },
    ]),
  ],
  controllers: [AttendanceSessionsController],
  providers: [AttendanceSessionsService, AttendanceRealtimeService, AttendanceDraftFinalizerService],
  exports: [AttendanceSessionsService],
})
export class AttendanceSessionsModule {}
