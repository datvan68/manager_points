import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { QueryTimetableDto } from './dto/query-timetable.dto';
import { TimetableSnapshot, TimetableSnapshotDocument } from './timetable-snapshot.schema';
import { TimetableSyncState, TimetableSyncStateDocument } from './timetable-sync-state.schema';
import { TimetableFilters, TimetableOptions } from './timetable.types';
import { timetableFields, timetableKey } from './timetable-selection';

const optionFields = ['years', 'semesters', 'weeks', 'faculties', 'courses', 'classes'] as const;
const allLabels: Record<string, string> = { faculty: 'Tất cả khoa', course: 'Tất cả khóa', className: 'Tất cả lớp' };

@Injectable()
export class TimetableService {
  constructor(@InjectModel(TimetableSnapshot.name) private readonly snapshots: Model<TimetableSnapshotDocument>, @InjectModel(TimetableSyncState.name) private readonly states: Model<TimetableSyncStateDocument>) {}
  async getOptions(_requester: any, filters: Partial<QueryTimetableDto> = {}): Promise<TimetableOptions> {
    const [state, snapshots] = await Promise.all([
      this.states.findOne({ name: 'default' }).lean().exec(),
      this.snapshots.find({}, 'year semester week faculty course className').lean().exec(),
    ]);
    if (!snapshots.length) throw new NotFoundException({
      reasonCode: 'TIMETABLE_NOT_SYNCED',
      message: 'Chưa có lịch học được đồng bộ. Vui lòng liên hệ quản trị viên.',
    });
    const availableCoverage = snapshots.map((snapshot) => Object.fromEntries(
      timetableFields.map((field) => [field, snapshot[field] || '']),
    ) as unknown as TimetableFilters);
    const options = {} as TimetableOptions;
    timetableFields.forEach((field, index) => {
      const parents = timetableFields.slice(0, index);
      const values = new Set(availableCoverage.filter((item) => parents.every((parent) =>
        // Empty optional values identify a separately synchronized coverage.
        timetableFields.indexOf(parent) < 3 && !filters[parent]
          ? true : (item[parent] || '') === (filters[parent] || ''),
      )).map((item) => item[field] || ''));
      const catalog = (state?.catalog?.[optionFields[index]] || []) as Array<{ value: string; label: string }>;
      options[optionFields[index]] = [...values].map((value) => ({
        value,
        label: value ? catalog.find((item) => item.value === value)?.label || value : allLabels[field] || 'Tất cả',
      }));
    });
    return { ...options, availableCoverage };
  }

  async getTimetable(_requester: any, query: QueryTimetableDto) {
    const snapshot = await this.snapshots.findOne({ key: timetableKey(query) }).lean().exec();
    if (!snapshot) throw new NotFoundException({
      reasonCode: 'TIMETABLE_NOT_SYNCED',
      message: 'Dữ liệu thời khóa biểu cho bộ lọc này chưa được đồng bộ.',
    });
    return { ...snapshot.result, syncedAt: snapshot.syncedAt, coverageKey: snapshot.coverageKey };
  }
}
