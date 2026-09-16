import { NotFoundException } from '@nestjs/common';
import { TimetableService } from './timetable.service';
import { timetableKey } from './timetable-selection';

const chain = (value: any) => ({ lean: () => ({ exec: async () => value }) });
const coverage = [
  { year: 'y', semester: 's', week: 'w1', faculty: '', course: '', className: '' },
  { year: 'y', semester: 's', week: 'w2', faculty: 'f', course: 'c', className: 'a' },
  { year: 'other', semester: 'other-s', week: 'other-w', faculty: '', course: '', className: '' },
];
const catalog = { years: [{ value: 'y', label: '2026' }], semesters: [], weeks: [], faculties: [{ value: 'f', label: 'Khoa A' }], courses: [], classes: [{ value: 'a', label: 'Lớp A' }] };
const setup = (rows = coverage, savedCatalog: any = catalog) => {
  const snapshots = { find: jest.fn(() => chain(rows)), findOne: jest.fn(() => chain(null)), countDocuments: jest.fn(() => ({ exec: async () => rows.length })) };
  const states = { findOne: jest.fn(() => chain({ catalog: savedCatalog })) };
  return { service: new TimetableService(snapshots as any, states as any), snapshots };
};

describe('TimetableService', () => {
  it('loads bulk snapshots with one query, deduplicates keys, and preserves missing selections', async () => {
    const rows = [
      { ...coverage[1], key: timetableKey(coverage[1]), result: { filters: coverage[1], periods: ['1'], lessons: [], isEmpty: false }, syncedAt: 'date', coverageKey: 'key' },
    ];
    const { service, snapshots } = setup(rows as any);
    snapshots.find.mockReturnValueOnce(chain(rows));
    const missing = { ...coverage[1], className: 'missing' };
    const response = await service.getBulkTimetable({}, { selections: [coverage[1], coverage[1], missing] } as any);
    expect(snapshots.find).toHaveBeenCalledTimes(1);
    expect(snapshots.find).toHaveBeenCalledWith({ key: { $in: [timetableKey(coverage[1]), timetableKey(missing)] } });
    expect(response.results).toHaveLength(1);
    expect(response.missing).toEqual([missing]);
  });
  it('offers only synchronized descendants for the selected parents', async () => {
    const { service } = setup();
    const options = await service.getOptions({}, { year: 'y', semester: 's', week: 'w2', faculty: 'f', course: 'c' });
    expect(options.years).toContainEqual({ value: 'y', label: '2026' });
    expect(options.semesters.map((item) => item.value)).toEqual(['s']);
    expect(options.weeks.map((item) => item.value)).toEqual(['w1', 'w2']);
    expect(options.faculties).toEqual([{ value: 'f', label: 'Khoa A' }]);
    expect(options.classes).toEqual([{ value: 'a', label: 'Lớp A' }]);
    expect(options.availableCoverage).toEqual(coverage);
  });

  it('preserves empty all-class coverage without inventing class-specific coverage', async () => {
    const { service } = setup();
    const options = await service.getOptions({}, { year: 'y', semester: 's', week: 'w1' });
    expect(options.classes).toEqual([{ value: '', label: 'Tất cả lớp' }]);
    await expect(service.getLegacyTimetable({}, { year: 'y', semester: 's', week: 'w1', className: 'a' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('keeps existing snapshots discoverable even without a source catalog', async () => {
    const { service } = setup(coverage, null);
    expect((await service.getOptions({})).years).toContainEqual({ value: 'y', label: 'y' });
  });

  it('distinguishes an unsynchronized coverage from a synchronized empty schedule', async () => {
    const { service, snapshots } = setup();
    snapshots.findOne.mockReturnValueOnce(chain({ result: { isEmpty: true, lessons: [] }, syncedAt: 'date', coverageKey: 'key' }));
    await expect(service.getLegacyTimetable({}, coverage[0])).resolves.toMatchObject({ isEmpty: true, syncedAt: 'date' });
    expect(snapshots.findOne).toHaveBeenCalledWith({ key: timetableKey(coverage[0]) });
    await expect(setup([]).service.getOptions({})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('only exposes saved coverage and never queues an uncached lookup', async () => {
    const { service, snapshots } = setup([coverage[1]], { ...catalog, weeks: [{ value: 'future', label: 'Tuần tương lai' }] });
    const options = await service.getOptions({});
    expect(options.weeks).toEqual([{ value: 'w2', label: 'w2' }]);
    await expect(service.getTimetable({ roleCode: 'STUDENT' }, { year: 'y', semester: 's', week: 'future', className: 'a' })).rejects.toMatchObject({ response: expect.objectContaining({ reasonCode: 'TIMETABLE_NOT_SYNCED' }) });
    expect(snapshots.findOne).toHaveBeenCalledTimes(1);
  });

  it('enriches scoped weeks from catalog dates and omits conflicting snapshot ranges', async () => {
    const catalogWithDates = {
      ...catalog,
      weeks: [{ value: 'w2', label: 'Tuần 2 (14/09/2026 - 20/09/2026)', startDate: '2026-09-14', endDate: '2026-09-20', parent: { year: 'y', semester: 's' } }],
    };
    const { service } = setup([
      { ...coverage[1], result: { startDate: '2026-09-14', endDate: '2026-09-20' } },
      { ...coverage[1], faculty: 'other', course: 'other', result: { startDate: '2026-09-21', endDate: '2026-09-27' } },
    ] as any, catalogWithDates);
    const options = await service.getOptions({}, { year: 'y', semester: 's' });
    expect(options.weeks.find((item) => item.value === 'w2')).toMatchObject({ startDate: '2026-09-14', endDate: '2026-09-20' });

    const conflicting = setup([
      { ...coverage[1], result: { startDate: '2026-09-14', endDate: '2026-09-20' } },
      { ...coverage[1], faculty: 'other', course: 'other', result: { startDate: '2026-09-21', endDate: '2026-09-27' } },
    ] as any, { ...catalog, weeks: [] });
    expect((await conflicting.service.getOptions({}, { year: 'y', semester: 's' })).weeks.find((item) => item.value === 'w2')).not.toHaveProperty('startDate');
  });

  it('returns a saved snapshot without refreshing it in the background', async () => {
    const { service, snapshots } = setup();
    snapshots.findOne.mockReturnValueOnce(chain({ result: { isEmpty: false, lessons: [] }, syncedAt: '2026-01-01T00:00:00.000Z', coverageKey: 'key' }));
    await expect(service.getTimetable({}, coverage[1])).resolves.toMatchObject({ status: 'valid', coverageKey: 'key' });
    expect(snapshots.findOne).toHaveBeenCalledTimes(1);
  });

  it('returns optional dates from new snapshots and preserves old snapshot results', async () => {
    const { service, snapshots } = setup();
    snapshots.findOne.mockReturnValueOnce(chain({ result: { isEmpty: false, startDate: '2026-09-14', endDate: '2026-09-20', lessons: [{ day: 1, date: '2026-09-14' }] }, syncedAt: 'date', coverageKey: 'key' }));
    await expect(service.getLegacyTimetable({}, coverage[0])).resolves.toMatchObject({ startDate: '2026-09-14', endDate: '2026-09-20', lessons: [{ date: '2026-09-14' }] });
    snapshots.findOne.mockReturnValueOnce(chain({ result: { isEmpty: true, lessons: [] }, syncedAt: 'date', coverageKey: 'old-key' }));
    await expect(service.getLegacyTimetable({}, coverage[0])).resolves.toMatchObject({ isEmpty: true, lessons: [], coverageKey: 'old-key' });
  });

  it('lists metadata with exact filters, stable pagination, and no result payload', async () => {
    const { service, snapshots } = setup();
    const query = {
      page: 2, limit: 1, year: 'y', semester: 's', week: 'w2', faculty: 'f', course: 'c', className: 'a',
    } as any;
    const data = [{ year: 'y', semester: 's', week: 'w2', faculty: 'f', course: 'c', className: 'a', syncedAt: 'date', coverageKey: 'key', jobId: 'job' }];
    const request = { sort: jest.fn().mockReturnThis(), skip: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), lean: jest.fn(() => ({ exec: async () => data })) };
    snapshots.find.mockReturnValueOnce(request as any);
    snapshots.countDocuments.mockReturnValueOnce({ exec: async () => 2 } as any);
    await expect(service.listSnapshots({}, query)).resolves.toEqual({ data, total: 2, page: 2, limit: 1, totalPages: 2 });
    expect(snapshots.find).toHaveBeenCalledWith({ year: 'y', semester: 's', week: 'w2', faculty: 'f', course: 'c', className: 'a' }, 'year semester week faculty course className coverageKey syncedAt jobId');
    expect(request.sort).toHaveBeenCalledWith({ syncedAt: -1, _id: -1 });
    expect(request.skip).toHaveBeenCalledWith(1); expect(request.limit).toHaveBeenCalledWith(1);
    expect(data[0]).not.toHaveProperty('result');
  });

  it('keeps the refresh status response read-only and reports missing snapshots', async () => {
    const { service, snapshots } = setup();
    await expect(service.refresh({}, coverage[1])).resolves.toMatchObject({ status: 'missing', key: timetableKey(coverage[1]) });
    snapshots.findOne.mockReturnValueOnce(chain({ key: timetableKey(coverage[1]) }));
    await expect(service.refresh({}, coverage[1])).resolves.toMatchObject({ status: 'valid', key: timetableKey(coverage[1]) });
  });

  it('returns only lessons for today from the linked class snapshot', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const { service, snapshots } = setup();
    const states = { findOne: jest.fn(() => chain({ settings: { classLinks: [{ systemClassId: '507f1f77bcf86cd799439012', year: '2026', semester: '1', faculty: 'f', course: 'c', className: 'A' }], rolling: { weekDates: [{ year: '2026', semester: '1', week: 'w1', startDate: today, endDate: today }] } } })) };
    const linkedService = new TimetableService(snapshots as any, states as any);
    snapshots.findOne.mockReturnValueOnce(chain({ result: { startDate: today, endDate: today, lessons: [{ date: today, subject: 'Toán' }, { date: '2099-01-01', subject: 'Sai ngày' }] }, syncedAt: 'date', coverageKey: 'key' }));
    await expect(linkedService.getTodayForClass({}, '507f1f77bcf86cd799439012')).resolves.toMatchObject({ status: 'available', date: today, lessons: [{ subject: 'Toán' }] });
    expect(snapshots.findOne).toHaveBeenCalledWith({ key: timetableKey({ year: '2026', semester: '1', week: 'w1', faculty: 'f', course: 'c', className: 'A' }) });
  });

  it('marks missing links, dates, and snapshots as unavailable', async () => {
    const { service, snapshots } = setup();
    await expect(service.getTodayForClass({}, '507f1f77bcf86cd799439012')).resolves.toMatchObject({ status: 'unavailable', lessons: [] });
    const states = { findOne: jest.fn(() => chain({ settings: { classLinks: [{ systemClassId: '507f1f77bcf86cd799439012', year: '2026', semester: '1', className: 'A' }], rolling: { weekDates: [] } } })) };
    const linkedService = new TimetableService(snapshots as any, states as any);
    snapshots.find.mockReturnValueOnce(chain([{ result: { lessons: [] }, syncedAt: 'date' }]));
    await expect(linkedService.getTodayForClass({}, '507f1f77bcf86cd799439012')).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('returns empty for a mapped week with a valid snapshot and rejects ambiguous day matches', async () => {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const { service, snapshots } = setup();
    const states = { findOne: jest.fn(() => chain({ settings: { classLinks: [{ systemClassId: '507f1f77bcf86cd799439012', year: '2026', semester: '1', className: 'A' }], rolling: { weekDates: [{ year: '2026', semester: '1', week: 'w1', startDate: today, endDate: today }] } } })) };
    const linkedService = new TimetableService(snapshots as any, states as any);
    snapshots.findOne.mockReturnValueOnce(chain({ result: { startDate: today, endDate: today, lessons: [] }, syncedAt: 'date' }));
    await expect(linkedService.getTodayForClass({}, '507f1f77bcf86cd799439012')).resolves.toMatchObject({ status: 'empty', lessons: [] });

    const ambiguous = new TimetableService({ ...snapshots, find: jest.fn(() => chain([
      { result: { startDate: today, endDate: today } },
      { result: { startDate: today, endDate: today } },
    ])) } as any, { findOne: jest.fn(() => chain({ settings: { classLinks: [{ systemClassId: '507f1f77bcf86cd799439012', year: '2026', semester: '1', className: 'A' }], rolling: { weekDates: [] } } })) } as any);
    await expect(ambiguous.getTodayForClass({}, '507f1f77bcf86cd799439012')).resolves.toMatchObject({ status: 'unavailable' });
  });
});
