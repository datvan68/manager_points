import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubAttendanceService } from './club-attendance.service';
import { ClubAttendanceSyncService } from './club-attendance-sync.service';
import { ClubAttendanceController } from './club-attendance.controller';
import {
  ClubAttendance,
  ClubAttendanceSchema,
} from './schemas/club-attendance.schema';
import {
  ClubAttendanceConfig,
  ClubAttendanceConfigSchema,
} from '../club-attendance-config/schemas/club-attendance-config.schema';
import {
  AcademicRecord,
  AcademicRecordSchema,
} from '../academic-record/schemas/academic-record.schema';
import { Club, ClubSchema } from '../clubs/schemas/club.schema';
import {
  ClubSchedule,
  ClubScheduleSchema,
} from '../club-schedules/schemas/club-schedule.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClubAttendance.name, schema: ClubAttendanceSchema },
      { name: ClubAttendanceConfig.name, schema: ClubAttendanceConfigSchema },
      { name: AcademicRecord.name, schema: AcademicRecordSchema },
      { name: Club.name, schema: ClubSchema },
      { name: ClubSchedule.name, schema: ClubScheduleSchema },
    ]),
  ],
  controllers: [ClubAttendanceController],
  providers: [ClubAttendanceService, ClubAttendanceSyncService],
  exports: [ClubAttendanceService, ClubAttendanceSyncService, MongooseModule],
})
export class ClubAttendanceModule {}
