import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ActivityAttendanceConfigService } from './activity-attendance-config.service';
import { ActivityAttendanceConfigController } from './activity-attendance-config.controller';
import {
  ActivityAttendanceConfig,
  ActivityAttendanceConfigSchema,
} from './schemas/activity-attendance-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ActivityAttendanceConfig.name, schema: ActivityAttendanceConfigSchema },
    ]),
  ],
  controllers: [ActivityAttendanceConfigController],
  providers: [ActivityAttendanceConfigService],
  exports: [ActivityAttendanceConfigService, MongooseModule],
})
export class ActivityAttendanceConfigModule {}
