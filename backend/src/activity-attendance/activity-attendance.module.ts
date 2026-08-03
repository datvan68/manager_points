import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityAttendanceService } from './activity-attendance.service';
import { ActivityAttendanceSyncService } from './activity-attendance-sync.service';
import { ActivityAttendanceController } from './activity-attendance.controller';
import {
  ActivityAttendance,
  ActivityAttendanceSchema,
} from './schemas/activity-attendance.schema';
import {
  ActivityAttendanceConfig,
  ActivityAttendanceConfigSchema,
} from '../activity-attendance-config/schemas/activity-attendance-config.schema';
import {
  AcademicRecord,
  AcademicRecordSchema,
} from '../academic-record/schemas/academic-record.schema';
import { Activity, ActivitySchema } from '../activities/schemas/activity.schema';
import {
  ActivitySchedule,
  ActivityScheduleSchema,
} from '../activity-schedules/schemas/activity-schedule.schema';

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
import { ActivityMember, ActivityMemberSchema } from '../activities/schemas/activity-member.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityAttendance.name, schema: ActivityAttendanceSchema },
      { name: ActivityAttendanceConfig.name, schema: ActivityAttendanceConfigSchema },
      { name: AcademicRecord.name, schema: AcademicRecordSchema },
      { name: Activity.name, schema: ActivitySchema },
      { name: ActivitySchedule.name, schema: ActivityScheduleSchema },
      { name: ActivityCompletionRule.name, schema: ActivityCompletionRuleSchema },
      { name: ActivityCompletionAward.name, schema: ActivityCompletionAwardSchema },
      { name: ActivityMember.name, schema: ActivityMemberSchema },
      { name: Class.name, schema: ClassSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [ActivityAttendanceController, ActivityCompletionController],
  providers: [
    ActivityAttendanceService,
    ActivityAttendanceSyncService,
    ActivityCompletionService,
  ],
  exports: [
    ActivityAttendanceService,
    ActivityAttendanceSyncService,
    ActivityCompletionService,
    MongooseModule,
  ],
})
export class ActivityAttendanceModule {}
