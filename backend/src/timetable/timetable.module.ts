import { Module } from '@nestjs/common';
import { TimetableController } from './timetable.controller';
import { TimetableService } from './timetable.service';
import { SchoolTimetableAdapter } from './school-timetable.adapter';

@Module({ controllers: [TimetableController], providers: [TimetableService, SchoolTimetableAdapter] })
export class TimetableModule {}
