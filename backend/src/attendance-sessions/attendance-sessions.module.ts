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
  ClubAttendance,
  ClubAttendanceSchema,
} from '../club-attendance/schemas/club-attendance.schema';
import {
  ClubMember,
  ClubMemberSchema,
} from '../clubs/schemas/club-member.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AttendanceSession.name, schema: AttendanceSessionSchema },
      { name: AttendanceCheckin.name, schema: AttendanceCheckinSchema },
      { name: ClubAttendance.name, schema: ClubAttendanceSchema },
      { name: ClubMember.name, schema: ClubMemberSchema },
    ]),
  ],
  controllers: [AttendanceSessionsController],
  providers: [AttendanceSessionsService],
  exports: [AttendanceSessionsService],
})
export class AttendanceSessionsModule {}
