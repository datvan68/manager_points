import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubAttendanceConfigService } from './club-attendance-config.service';
import { ClubAttendanceConfigController } from './club-attendance-config.controller';
import {
  ClubAttendanceConfig,
  ClubAttendanceConfigSchema,
} from './schemas/club-attendance-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClubAttendanceConfig.name, schema: ClubAttendanceConfigSchema },
    ]),
  ],
  controllers: [ClubAttendanceConfigController],
  providers: [ClubAttendanceConfigService],
  exports: [ClubAttendanceConfigService, MongooseModule],
})
export class ClubAttendanceConfigModule {}
