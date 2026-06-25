import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { SystemRequest, SystemRequestSchema } from './schemas/system-request.schema';
import { DatabaseBackupJob, DatabaseBackupJobSchema } from './schemas/database-backup-job.schema';
import { DatabaseRestoreJob, DatabaseRestoreJobSchema } from './schemas/database-restore-job.schema';
import { SystemPerformanceMetric, SystemPerformanceMetricSchema } from './schemas/system-performance-metric.schema';
import { LoginLog, LoginLogSchema } from '../auth/schemas/login-log.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { ThrottlerModule } from '@nestjs/throttler';
import { SystemSetting, SystemSettingSchema } from './schemas/system-setting.schema';
import { RestoreTypeRegistry } from './restore-type-registry';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemRequest.name, schema: SystemRequestSchema },
      { name: DatabaseBackupJob.name, schema: DatabaseBackupJobSchema },
      { name: DatabaseRestoreJob.name, schema: DatabaseRestoreJobSchema },
      { name: LoginLog.name, schema: LoginLogSchema },
      { name: User.name, schema: UserSchema },
      { name: SystemPerformanceMetric.name, schema: SystemPerformanceMetricSchema },
      { name: SystemSetting.name, schema: SystemSettingSchema },
    ]),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 30, // limit each IP to 30 requests per minute
    }]),
  ],
  controllers: [SystemController],
  providers: [SystemService, RestoreTypeRegistry],
  exports: [SystemService],
})
export class SystemModule {}
