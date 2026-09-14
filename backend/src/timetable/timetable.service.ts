import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { QueryTimetableDto } from './dto/query-timetable.dto';
import { QueryTimetableSnapshotsDto } from './dto/query-timetable-snapshots.dto';
import { TimetableSnapshot, TimetableSnapshotDocument } from './timetable-snapshot.schema';
import { TimetableSyncState, TimetableSyncStateDocument } from './timetable-sync-state.schema';
import { TimetableFilters, TimetableOptions, TimetableResult } from './timetable.types';
import { timetableFields, timetableKey } from './timetable-selection';

const optionFields = ['years', 'semesters', 'weeks', 'faculties', 'courses', 'classes'] as const;
const allLabels: Record<string, string> = { faculty: 'Tất cả khoa', course: 'Tất cả khóa', className: 'Tất cả lớp' };

@Injectable()
export class TimetableService {
  constructor(
    @InjectModel(TimetableSnapshot.name) private readonly snapshots: Model<TimetableSnapshotDocument>,
    @InjectModel(TimetableSyncState.name) private readonly states: Model<TimetableSyncStateDocument>,
  ) {}

  async getOptions(_requester: any, filters: Partial<QueryTimetableDto> = {}): Promise<TimetableOptions> {
    const [state, snapshots] = await Promise.all([
      this.states.findOne({ name: 'default' }).lean().exec(),
      this.snapshots.find({}, 'year semester week faculty course className syncedAt').lean().exec(),
    ]);
    const catalog = state?.catalog as any;
    if (!snapshots.length) throw new NotFoundException({ reasonCode: 'TIMETABLE_NOT_SYNCED', message: 'Chưa có dữ liệu thời khóa biểu được đồng bộ.' });
    const availableCoverage = snapshots.map((snapshot) => Object.fromEntries(timetableFields.map((field) => [field, snapshot[field] || ''])) as unknown as TimetableFilters);
    const uniqueCoverage = [...new Map(availableCoverage.map((item) => [timetableKey(item), item])).values()];
    const options = {} as TimetableOptions;
    timetableFields.forEach((field, index) => {
      const parents = timetableFields.slice(0, index);
      const values = new Set(uniqueCoverage.filter((item) => parents.every((parent) => timetableFields.indexOf(parent) < 3 && !filters[parent] ? true : (item[parent] || '') === (filters[parent] || ''))).map((item) => item[field] || ''));
      const catalogValues = (catalog?.[optionFields[index]] || []) as Array<{ value: string; label: string; parent?: Partial<TimetableFilters> }>;
      options[optionFields[index]] = [...values].map((value) => ({ value, label: value ? catalogValues.find((item) => item.value === value)?.label || value : allLabels[field] || 'Tất cả' }));
    });
    return { ...options, availableCoverage: uniqueCoverage };
  }

  async getTimetable(requester: any, query: QueryTimetableDto): Promise<TimetableResult> {
    return this.getLegacyTimetable(requester, query);
  }

  async getTodayForClass(_requester: any, classId: string) {
    if (!Types.ObjectId.isValid(classId)) {
      throw new BadRequestException({ reasonCode: 'TIMETABLE_CLASS_INVALID', message: 'Lớp không hợp lệ.' });
    }

    const state = await this.states.findOne({ name: 'default' }).lean().exec();
    const link = (state?.settings?.classLinks || []).find(
      (candidate: any) => String(candidate.systemClassId) === classId,
    );
    if (!link?.year || !link?.semester || !link?.week || !link?.className) {
      return { status: 'unavailable', date: this.todayInHoChiMinh(), lessons: [] as any[] };
    }

    const today = this.todayInHoChiMinh();
    const snapshot = await this.snapshots.findOne({ key: timetableKey(link) }).lean().exec();
    const result = snapshot?.result as any;
    if (!snapshot || !result?.startDate || !result?.endDate || today < result.startDate || today > result.endDate) {
      return { status: 'unavailable', date: today, lessons: [] as any[] };
    }

    const lessons = Array.isArray(result.lessons)
      ? result.lessons.filter((lesson: any) => lesson?.date === today)
      : [];
    const syncedAt = snapshot.syncedAt instanceof Date ? snapshot.syncedAt.toISOString() : String(snapshot.syncedAt);
    return {
      status: lessons.length ? 'available' : 'empty',
      date: today,
      lessons,
      syncedAt,
      coverageKey: snapshot.coverageKey,
    };
  }

  async listSnapshots(_requester: any, query: QueryTimetableSnapshotsDto = new QueryTimetableSnapshotsDto()) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const filter = Object.fromEntries(
      timetableFields
        .filter((field) => query[field] !== undefined && query[field] !== '')
        .map((field) => [field, query[field]]),
    );
    const projection = 'year semester week faculty course className coverageKey syncedAt jobId';
    const [data, total] = await Promise.all([
      this.snapshots.find(filter, projection).sort({ syncedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean().exec(),
      this.snapshots.countDocuments(filter).exec(),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getLegacyTimetable(_requester: any, query: QueryTimetableDto): Promise<TimetableResult> {
    const snapshot = await this.snapshots.findOne({ key: timetableKey(query) }).lean().exec();
    if (!snapshot) throw new NotFoundException({ reasonCode: 'TIMETABLE_NOT_SYNCED', message: 'Dữ liệu thời khóa biểu cho bộ lọc này chưa được đồng bộ.' });
    const syncedAt = snapshot.syncedAt instanceof Date ? snapshot.syncedAt.toISOString() : String(snapshot.syncedAt);
    return { ...snapshot.result, status: 'valid', syncedAt, coverageKey: snapshot.coverageKey } as TimetableResult;
  }

  private todayInHoChiMinh() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  async getDemandStatus(_requester: any, query: QueryTimetableDto) {
    const snapshot = await this.snapshots.findOne({ key: timetableKey(query) }).lean().exec();
    return { status: snapshot ? 'valid' : 'missing', key: timetableKey(query), selection: query };
  }
  async refresh(requester: any, query: QueryTimetableDto) { return this.getDemandStatus(requester, query); }
}
