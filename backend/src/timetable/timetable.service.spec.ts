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
    await expect(setup([]).service.getOptions({})).rejects.toBeInstanceOf(NotFoundException);
  });

  it('only exposes saved coverage and never queues an uncached lookup', async () => {
    const { service, snapshots } = setup([coverage[1]], { ...catalog, weeks: [{ value: 'future', label: 'Tuần tương lai' }] });
    const options = await service.getOptions({});
    expect(options.weeks).toEqual([{ value: 'w2', label: 'w2' }]);
    await expect(service.getTimetable({ roleCode: 'STUDENT' }, { year: 'y', semester: 's', week: 'future', className: 'a' })).rejects.toMatchObject({ response: expect.objectContaining({ reasonCode: 'TIMETABLE_NOT_SYNCED' }) });
    expect(snapshots.findOne).toHaveBeenCalledTimes(1);
  });

  it('returns a saved snapshot without refreshing it in the background', async () => {
    const { service, snapshots } = setup();
    snapshots.findOne.mockReturnValueOnce(chain({ result: { isEmpty: false, lessons: [] }, syncedAt: '2026-01-01T00:00:00.000Z', coverageKey: 'key' }));
    await expect(service.getTimetable({}, coverage[1])).resolves.toMatchObject({ status: 'valid', coverageKey: 'key' });
    expect(snapshots.findOne).toHaveBeenCalledTimes(1);
  });

  it('keeps the refresh status response read-only and reports missing snapshots', async () => {
    const { service, snapshots } = setup();
    await expect(service.refresh({}, coverage[1])).resolves.toMatchObject({ status: 'missing', key: timetableKey(coverage[1]) });
    snapshots.findOne.mockReturnValueOnce(chain({ key: timetableKey(coverage[1]) }));
    await expect(service.refresh({}, coverage[1])).resolves.toMatchObject({ status: 'valid', key: timetableKey(coverage[1]) });
  });
});
