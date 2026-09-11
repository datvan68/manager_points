import { NotFoundException } from '@nestjs/common';
import { TimetableService } from './timetable.service';

const chain = (value: any) => ({ lean: () => ({ exec: async () => value }) });
describe('TimetableService', () => {
  it('reads options and results only from local models', async () => {
    const catalog = { years: [{ value: '2025', label: '2025' }], semesters: [], weeks: [], faculties: [], courses: [], classes: [] };
    const result = { filters: { year: '2025', semester: '1', week: '1' }, periods: [], lessons: [], isEmpty: true };
    const states = { findOne: jest.fn(() => chain({ catalog })) };
    const snapshots = { findOne: jest.fn(() => chain({ result, syncedAt: new Date(), coverageKey: 'x' })) };
    const service = new TimetableService(snapshots as any, states as any);
    await expect(service.getOptions({ userId: 'reader' })).resolves.toEqual(catalog);
    await expect(service.getTimetable({ userId: 'reader' }, { year: '2025', semester: '1', week: '1' })).resolves.toMatchObject({ isEmpty: true });
    expect(states.findOne).toHaveBeenCalled(); expect(snapshots.findOne).toHaveBeenCalled();
  });
  it('reports an explicit not-synchronized state when catalog is absent', async () => {
    const service = new TimetableService({ findOne: jest.fn(() => chain(null)) } as any, { findOne: jest.fn(() => chain(null)) } as any);
    await expect(service.getOptions({ userId: 'reader' })).rejects.toBeInstanceOf(NotFoundException);
  });
});
