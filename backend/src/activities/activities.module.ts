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
    ]),
  ],
  controllers: [ActivitiesController],
  providers: [ActivitiesService, ActivitiesRealtimeService],
  exports: [ActivitiesService, MongooseModule],
})
export class ActivitiesModule {}
