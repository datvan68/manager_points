import { Injectable } from '@nestjs/common';
import { SchoolTimetableAdapter } from './school-timetable.adapter';
import { QueryTimetableDto } from './dto/query-timetable.dto';

@Injectable()
export class TimetableService {
  constructor(private readonly adapter: SchoolTimetableAdapter) {}
  getOptions(requester: any, filters: Partial<QueryTimetableDto> = {}) { return this.adapter.getOptions(String(requester.userId), filters); }
  getTimetable(requester: any, query: QueryTimetableDto) { return this.adapter.getTimetable(String(requester.userId), { ...query }); }
}
