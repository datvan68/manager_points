import { ConflictException } from '@nestjs/common';
import { TimetableSyncService } from './timetable-sync.service';

const chain = (value: any) => ({ lean: () => ({ exec: async () => value }), exec: async () => value });
describe('TimetableSyncService', () => {
  const state = { settings: { enabled: false, intervalMinutes: 60, coverage: [] }, job: null, catalog: null };
  it('rejects non-admin mutations before adapter or model work', async () => {
    const adapter = { getOptions: jest.fn(), getTimetable: jest.fn() };
    const states = { findOneAndUpdate: jest.fn(() => chain(state)), updateOne: jest.fn() };
    const service = new TimetableSyncService(adapter as any, {} as any, states as any);
    await expect(service.start({ roleCode: 'TEACHER' }, { coverage: [{ year: '2025', semester: '1', week: '1' }] })).rejects.toBeInstanceOf(ConflictException);
    expect(adapter.getOptions).not.toHaveBeenCalled(); expect(states.updateOne).not.toHaveBeenCalled();
  });
  it('returns a job id promptly and disables scheduling by default', async () => {
    const adapter = { getOptions: jest.fn(), getTimetable: jest.fn().mockRejectedValue(new Error('offline')) };
    const updates: any[] = []; const states = { findOneAndUpdate: jest.fn(() => chain(state)), updateOne: jest.fn((...args: any[]) => { updates.push(args); return chain({}); }), findOne: jest.fn(() => chain(null)) };
    const service = new TimetableSyncService(adapter as any, {} as any, states as any);
    await expect(service.start({ roleCode: 'ADMIN', userId: 'admin-1' }, { coverage: [{ year: '2025', semester: '1', week: '1' }] })).resolves.toMatchObject({ status: 'running', total: 1 });
    expect(updates[0][1].$set.job.operatorId).toBe('admin-1');
  });
});
