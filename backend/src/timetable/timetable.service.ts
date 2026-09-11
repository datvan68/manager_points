import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueryTimetableDto } from './dto/query-timetable.dto';
import { TimetableSnapshot, TimetableSnapshotDocument } from './timetable-snapshot.schema';
import { TimetableSyncState, TimetableSyncStateDocument } from './timetable-sync-state.schema';
import { TimetableOptions } from './timetable.types';

@Injectable()
export class TimetableService {
  constructor(@InjectModel(TimetableSnapshot.name) private readonly snapshots: Model<TimetableSnapshotDocument>, @InjectModel(TimetableSyncState.name) private readonly states: Model<TimetableSyncStateDocument>) {}
  async getOptions(_requester: any, _filters: Partial<QueryTimetableDto> = {}): Promise<TimetableOptions> { const state = await this.states.findOne({ name: 'default' }).lean().exec(); if (!state?.catalog) throw new NotFoundException({ reasonCode: 'TIMETABLE_NOT_SYNCED', message: 'Thời khóa biểu chưa được đồng bộ.' }); return state.catalog as TimetableOptions; }
  async getTimetable(_requester: any, query: QueryTimetableDto) { const key = JSON.stringify(['year', 'semester', 'week', 'faculty', 'course', 'className'].map((field) => [field, (query as any)[field] || ''])); const snapshot = await this.snapshots.findOne({ key }).lean().exec(); if (!snapshot) throw new NotFoundException({ reasonCode: 'TIMETABLE_NOT_SYNCED', message: 'Dữ liệu thời khóa biểu cho bộ lọc này chưa được đồng bộ.' }); return { ...snapshot.result, syncedAt: snapshot.syncedAt, coverageKey: snapshot.coverageKey }; }
}
