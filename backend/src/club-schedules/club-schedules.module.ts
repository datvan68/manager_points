import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubSchedulesService } from './club-schedules.service';
import { ClubSchedulesController } from './club-schedules.controller';
import {
  ClubSchedule,
  ClubScheduleSchema,
} from './schemas/club-schedule.schema';
import {
  ScheduleRegistration,
  ScheduleRegistrationSchema,
} from './schemas/schedule-registration.schema';

import { Semester, SemesterSchema } from '../semesters/schemas/semester.schema';
import {
  ClubAttendance,
  ClubAttendanceSchema,
} from '../club-attendance/schemas/club-attendance.schema';
import { ClubMember, ClubMemberSchema } from '../clubs/schemas/club-member.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { ClubScheduleActiveNotificationService } from './club-schedule-active-notification.service';

import { Club, ClubSchema } from '../clubs/schemas/club.schema';

@Module({
  imports: [
    NotificationsModule,
    MongooseModule.forFeature([
      { name: ClubSchedule.name, schema: ClubScheduleSchema },
      { name: ScheduleRegistration.name, schema: ScheduleRegistrationSchema },
      { name: Semester.name, schema: SemesterSchema },
      { name: ClubAttendance.name, schema: ClubAttendanceSchema },
      { name: ClubMember.name, schema: ClubMemberSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Club.name, schema: ClubSchema },
    ]),
  ],
  controllers: [ClubSchedulesController],
  providers: [ClubSchedulesService, ClubScheduleActiveNotificationService],
  exports: [ClubSchedulesService, MongooseModule],
})
export class ClubSchedulesModule {}
