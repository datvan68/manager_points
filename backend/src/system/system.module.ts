import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';
import { SystemRequest, SystemRequestSchema } from './schemas/system-request.schema';
import { DatabaseBackupJob, DatabaseBackupJobSchema } from './schemas/database-backup-job.schema';
import { LoginLog, LoginLogSchema } from '../auth/schemas/login-log.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SystemRequest.name, schema: SystemRequestSchema },
      { name: DatabaseBackupJob.name, schema: DatabaseBackupJobSchema },
      { name: LoginLog.name, schema: LoginLogSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [SystemController],
  providers: [SystemService],
  exports: [SystemService],
})
export class SystemModule {}
