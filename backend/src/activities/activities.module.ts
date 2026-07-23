import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivitiesService } from './activities.service';
import { ActivitiesRealtimeService } from './activities-realtime.service';
import { ActivitiesController } from './activities.controller';
import { Activity, ActivitySchema } from './schemas/activity.schema';
import { ActivityMember, ActivityMemberSchema } from './schemas/activity-member.schema';
import {
  ActivityFavorite,
  ActivityFavoriteSchema,
} from './schemas/activity-favorite.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Role, RoleSchema } from '../auth/schemas/role.schema';
import {
  ActivityMembershipTransfer,
  ActivityMembershipTransferSchema,
} from './schemas/activity-membership-transfer.schema';
import {
  ActivitySchedule,
  ActivityScheduleSchema,
} from '../activity-schedules/schemas/activity-schedule.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';
import { ActivityAttendanceGrant, ActivityAttendanceGrantSchema } from './schemas/activity-attendance-grant.schema';
import { ActivityAttendanceGrantsService } from './activity-attendance-grants.service';
import { ActivityAttendanceGrantsController } from './activity-attendance-grants.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      { name: ActivityMember.name, schema: ActivityMemberSchema },
      { name: ActivityFavorite.name, schema: ActivityFavoriteSchema },
      { name: Student.name, schema: StudentSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
      {
        name: ActivityMembershipTransfer.name,
        schema: ActivityMembershipTransferSchema,
      },
      { name: ActivitySchedule.name, schema: ActivityScheduleSchema },
      { name: Class.name, schema: ClassSchema },
      { name: ActivityAttendanceGrant.name, schema: ActivityAttendanceGrantSchema },
    ]),
  ],
  controllers: [ActivitiesController, ActivityAttendanceGrantsController],
  providers: [ActivitiesService, ActivitiesRealtimeService, ActivityAttendanceGrantsService],
  exports: [ActivitiesService, ActivityAttendanceGrantsService, MongooseModule],
})
export class ActivitiesModule {}
