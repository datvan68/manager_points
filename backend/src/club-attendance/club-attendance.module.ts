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

import {
  ActivityCompletionRule,
  ActivityCompletionRuleSchema,
} from './schemas/activity-completion-rule.schema';
import {
  ActivityCompletionAward,
  ActivityCompletionAwardSchema,
} from './schemas/activity-completion-award.schema';
import { ActivityCompletionService } from './activity-completion.service';
import { ActivityCompletionController } from './activity-completion.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClubAttendance.name, schema: ClubAttendanceSchema },
      { name: ClubAttendanceConfig.name, schema: ClubAttendanceConfigSchema },
      { name: AcademicRecord.name, schema: AcademicRecordSchema },
      { name: Club.name, schema: ClubSchema },
      { name: ClubSchedule.name, schema: ClubScheduleSchema },
      { name: ActivityCompletionRule.name, schema: ActivityCompletionRuleSchema },
      { name: ActivityCompletionAward.name, schema: ActivityCompletionAwardSchema },
    ]),
  ],
  controllers: [ClubAttendanceController, ActivityCompletionController],
  providers: [
    ClubAttendanceService,
    ClubAttendanceSyncService,
    ActivityCompletionService,
  ],
  exports: [
    ClubAttendanceService,
    ClubAttendanceSyncService,
    ActivityCompletionService,
    MongooseModule,
  ],
})
export class ClubAttendanceModule {}
