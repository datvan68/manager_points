import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueryTimetableDto } from './dto/query-timetable.dto';
import { TimetableSnapshot, TimetableSnapshotDocument } from './timetable-snapshot.schema';
import { TimetableSyncState, TimetableSyncStateDocument } from './timetable-sync-state.schema';
import { TimetableFilters, TimetableOptions, TimetableResult } from './timetable.types';
import { timetableFields, timetableKey } from './timetable-selection';
import { TimetableSyncService } from './timetable-sync.service';

const optionFields = ['years', 'semesters', 'weeks', 'faculties', 'courses', 'classes'] as const;
const allLabels: Record<string, string> = { faculty: 'Tất cả khoa', course: 'Tất cả khóa', className: 'Tất cả lớp' };

@Injectable()
export class TimetableService {
  constructor(
    @InjectModel(TimetableSnapshot.name) private readonly snapshots: Model<TimetableSnapshotDocument>,
    @InjectModel(TimetableSyncState.name) private readonly states: Model<TimetableSyncStateDocument>,
    @Optional() private readonly syncService?: TimetableSyncService,
  ) {}

  async getOptions(_requester: any, filters: Partial<QueryTimetableDto> = {}): Promise<TimetableOptions> {
    const [state, snapshots] = await Promise.all([
      this.states.findOne({ name: 'default' }).lean().exec(),
      this.snapshots.find({}, 'year semester week faculty course className syncedAt').lean().exec(),
    ]);
    const catalog = state?.catalog as any;
    if (!snapshots.length && !catalog) throw new NotFoundException({ reasonCode: 'TIMETABLE_NOT_SYNCED', message: 'Chưa có lịch học được đồng bộ. Vui lòng liên hệ quản trị viên.' });
    const availableCoverage = snapshots.map((snapshot) => Object.fromEntries(timetableFields.map((field) => [field, snapshot[field] || ''])) as unknown as TimetableFilters);
    const settings = state?.settings || {};
    const selected = (settings.selectedClasses || []) as Array<Record<string, string>>;
    const catalogWeeks = (catalog?.weeks || []) as Array<Record<string, any>>;
    if (selected.length && catalogWeeks.length) {
      selected.forEach((item) => catalogWeeks.filter((week) => week.value && (!week.parent || Object.entries(week.parent).every(([field, value]) => item[field] === value))).forEach((week) => availableCoverage.push({ year: item.year, semester: item.semester, week: week.value, faculty: item.faculty || '', course: item.course || '', className: item.className })));
    }
    const uniqueCoverage = [...new Map(availableCoverage.map((item) => [timetableKey(item), item])).values()];
    const options = {} as TimetableOptions;
    timetableFields.forEach((field, index) => {
      const parents = timetableFields.slice(0, index);
      const values = new Set(uniqueCoverage.filter((item) => parents.every((parent) => timetableFields.indexOf(parent) < 3 && !filters[parent] ? true : (item[parent] || '') === (filters[parent] || ''))).map((item) => item[field] || ''));
      const catalogValues = (catalog?.[optionFields[index]] || []) as Array<{ value: string; label: string; parent?: Partial<TimetableFilters> }>;
      if (!snapshots.length || field !== 'className') catalogValues.filter((item) => item.value && (!item.parent || Object.entries(item.parent).every(([parent, value]) => (filters as any)[parent] === value))).forEach((item) => values.add(item.value));
      const selectedValues = field === 'className' && selected.length ? selected.filter((item) => (!filters.year || item.year === filters.year) && (!filters.semester || item.semester === filters.semester) && (!filters.faculty || item.faculty === filters.faculty) && (!filters.course || item.course === filters.course)).map((item) => item.className) : [];
      selectedValues.forEach((value) => values.add(value));
      options[optionFields[index]] = [...values].map((value) => ({ value, label: value ? catalogValues.find((item) => item.value === value)?.label || value : allLabels[field] || 'Tất cả' }));
    });
    return { ...options, availableCoverage: uniqueCoverage, selectedClasses: settings.selectedClasses || [], rolling: settings.rolling, weekDates: settings.rolling?.weekDates || catalog?.weekDates || [] };
  }

  async getTimetable(requester: any, query: QueryTimetableDto): Promise<TimetableResult> {
    if (!this.syncService) throw new NotFoundException({ reasonCode: 'TIMETABLE_NOT_SYNCED', message: 'Dữ liệu thời khóa biểu cho bộ lọc này chưa được đồng bộ.' });
    await this.syncService.ensureDemandScope(query);
    const snapshot = await this.snapshots.findOne({ key: timetableKey(query) }).lean().exec();
    if (snapshot) {
      const syncedAt = snapshot.syncedAt instanceof Date ? snapshot.syncedAt.toISOString() : String(snapshot.syncedAt);
      const age = Date.now() - new Date(syncedAt).getTime();
      const stale = age >= 30 * 60_000;
      let pending = false;
      if (stale) { const queued = await this.syncService.enqueueDemand(requester, query, false).catch(() => null); pending = Boolean(queued); }
      return { ...snapshot.result, status: 'valid', syncedAt, coverageKey: snapshot.coverageKey, refresh: { pending, stale, lastSuccessfulUpdate: syncedAt } } as TimetableResult;
    }
    const demand = await this.syncService.enqueueDemand(requester, query);
    return { filters: query, periods: [], lessons: [], isEmpty: false, status: demand.status as 'pending', pending: true };
  }

  async getLegacyTimetable(_requester: any, query: QueryTimetableDto): Promise<TimetableResult> {
    const snapshot = await this.snapshots.findOne({ key: timetableKey(query) }).lean().exec();
    if (!snapshot) throw new NotFoundException({ reasonCode: 'TIMETABLE_NOT_SYNCED', message: 'Dữ liệu thời khóa biểu cho bộ lọc này chưa được đồng bộ.' });
    const syncedAt = snapshot.syncedAt instanceof Date ? snapshot.syncedAt.toISOString() : String(snapshot.syncedAt);
    return { ...snapshot.result, status: 'valid', syncedAt, coverageKey: snapshot.coverageKey } as TimetableResult;
  }

  async getDemandStatus(requester: any, query: QueryTimetableDto) { return this.syncService?.getDemandStatus(requester, query) || { status: 'missing', key: timetableKey(query), selection: query }; }
  async refresh(requester: any, query: QueryTimetableDto) { return this.syncService?.refresh(requester, query); }
}
