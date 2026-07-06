import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ClubSchedulesService } from './club-schedules.service';
import { ClubSchedulesController } from './club-schedules.controller';
import {
  ClubSchedule,
  ClubScheduleSchema,
} from './schemas/club-schedule.schema';
import {
  ScheduleRegistration,
  ScheduleRegistrationSchema,
} from './schemas/schedule-registration.schema';

import { Semester, SemesterSchema } from '../semesters/schemas/semester.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ClubSchedule.name, schema: ClubScheduleSchema },
      { name: ScheduleRegistration.name, schema: ScheduleRegistrationSchema },
      { name: Semester.name, schema: SemesterSchema },
    ]),
  ],
  controllers: [ClubSchedulesController],
  providers: [ClubSchedulesService],
  exports: [ClubSchedulesService, MongooseModule],
})
export class ClubSchedulesModule {}
