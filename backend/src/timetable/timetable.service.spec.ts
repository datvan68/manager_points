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
  const snapshots = { find: jest.fn(() => chain(rows)), findOne: jest.fn(() => chain(null)) };
  const states = { findOne: jest.fn(() => chain({ catalog: savedCatalog })) };
  return { service: new TimetableService(snapshots as any, states as any), snapshots };
};

describe('TimetableService', () => {
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
    await expect(setup([]).service.getOptions({})).resolves.toMatchObject({ years: [{ value: 'y' }] });
  });

  it('returns pending for a selected uncached class-week and keeps source work behind the coordinator', async () => {
    const state = { catalog: { weeks: [{ value: 'future', label: 'Tuần tương lai' }] }, settings: { selectedClasses: [{ year: 'y', semester: 's', className: 'a' }] } };
    const snapshots = { find: jest.fn(() => chain([])), findOne: jest.fn(() => chain(null)) };
    const states = { findOne: jest.fn(() => chain(state)) };
    const sync = { ensureDemandScope: jest.fn().mockResolvedValue(state), enqueueDemand: jest.fn().mockResolvedValue({ status: 'pending' }) };
    const service = new TimetableService(snapshots as any, states as any, sync as any);
    await expect(service.getTimetable({ roleCode: 'STUDENT' }, { year: 'y', semester: 's', week: 'future', className: 'a' })).resolves.toMatchObject({ status: 'pending', pending: true });
    expect(sync.enqueueDemand).toHaveBeenCalledWith({ roleCode: 'STUDENT' }, { year: 'y', semester: 's', week: 'future', className: 'a' });
  });
});
