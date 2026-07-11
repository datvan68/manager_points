import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AttendanceSessionsService } from './attendance-sessions.service';
import { AttendanceSessionsController } from './attendance-sessions.controller';
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
} from '../club-attendance/schemas/club-attendance.schema';
import {
  ActivityMember,
  ActivityMemberSchema,
} from '../activities/schemas/activity-member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceSession.name, schema: AttendanceSessionSchema },
      { name: AttendanceCheckin.name, schema: AttendanceCheckinSchema },
      { name: ActivityAttendance.name, schema: ActivityAttendanceSchema },
      { name: ActivityMember.name, schema: ActivityMemberSchema },
    ]),
  ],
  controllers: [AttendanceSessionsController],
  providers: [AttendanceSessionsService],
  exports: [AttendanceSessionsService],
})
export class AttendanceSessionsModule {}
