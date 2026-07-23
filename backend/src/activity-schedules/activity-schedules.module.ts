import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivitySchedulesService } from './activity-schedules.service';
import { ActivitySchedulesController } from './activity-schedules.controller';
import {
  ActivitySchedule,
  ActivityScheduleSchema,
} from './schemas/activity-schedule.schema';
import {
  ScheduleRegistration,
  ScheduleRegistrationSchema,
} from './schemas/schedule-registration.schema';

import { Semester, SemesterSchema } from '../semesters/schemas/semester.schema';
import {
  ActivityAttendance,
  ActivityAttendanceSchema,
} from '../activity-attendance/schemas/activity-attendance.schema';
import { ActivityMember, ActivityMemberSchema } from '../activities/schemas/activity-member.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityScheduleActiveNotificationService } from './activity-schedule-active-notification.service';

import { Activity, ActivitySchema } from '../activities/schemas/activity.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: ActivitySchedule.name, schema: ActivityScheduleSchema },
      { name: ScheduleRegistration.name, schema: ScheduleRegistrationSchema },
      { name: Semester.name, schema: SemesterSchema },
      { name: ActivityAttendance.name, schema: ActivityAttendanceSchema },
      { name: ActivityMember.name, schema: ActivityMemberSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: Class.name, schema: ClassSchema },
    ]),
  ],
  controllers: [ActivitySchedulesController],
  providers: [ActivitySchedulesService, ActivityScheduleActiveNotificationService],
  exports: [ActivitySchedulesService, MongooseModule],
})
export class ActivitySchedulesModule {}
