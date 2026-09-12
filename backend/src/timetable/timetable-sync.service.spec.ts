import { ConflictException } from '@nestjs/common';
import { TimetableSyncService } from './timetable-sync.service';
import { TimetableSourceError } from './timetable.types';

const chain = (value: any) => ({ lean: () => ({ exec: async () => value }), exec: async () => value });
const selection = { year: '2026', semester: '1', week: '1' };
const admin = { roleCode: 'ADMIN', userId: 'admin-1' };
function setup() {
  const state = { settings: { enabled: false, intervalMinutes: 60, coverage: [] }, job: null };
  const session = { withTransaction: jest.fn(async (work: () => Promise<void>) => work()), endSession: jest.fn() };
  const snapshots = {
    db: { startSession: jest.fn(async () => session) },
    findOneAndUpdate: jest.fn(() => chain({})),
    findOne: jest.fn(() => ({ sort: () => chain(null) })),
  };
  const states = {
    findOneAndUpdate: jest.fn(() => chain(state)),
    updateOne: jest.fn(() => chain({ matchedCount: 1 })),
  };
  const adapter = { getOptions: jest.fn(), getTimetable: jest.fn(async () => ({ isEmpty: true, lessons: [], filters: selection })) };
  const service = new TimetableSyncService(adapter as any, snapshots as any, states as any);
  return { service, adapter, snapshots, states, state, session };
}

describe('TimetableSyncService', () => {
  afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

  it('rejects non-admin mutations before adapter or model work', async () => {
    const { service, adapter, states } = setup();
    await expect(service.start({ roleCode: 'TEACHER' }, { coverage: [selection] })).rejects.toBeInstanceOf(ConflictException);
    expect(adapter.getTimetable).not.toHaveBeenCalled(); expect(states.updateOne).not.toHaveBeenCalled();
  });

  it('claims the job and lease together and deduplicates identical coverage', async () => {
    const { service, states } = setup();
    jest.spyOn(service as any, 'run').mockResolvedValue(undefined);
    await expect(service.start(admin, { coverage: [selection, { ...selection, className: '' }] })).resolves.toMatchObject({ status: 'running', total: 1 });
    const [filter, update] = states.findOneAndUpdate.mock.calls[1] as unknown as [any, any];
    expect(filter['job.status']).toEqual({ $ne: 'running' });
    expect(update.$set.job.operatorId).toBe('admin-1');
    expect(update.$set.lease.owner).toContain(update.$set.job.id);
    states.findOneAndUpdate.mockReturnValueOnce(chain({} as any)).mockReturnValueOnce(chain(null));
    await expect(service.start(admin, { coverage: [selection] })).rejects.toBeInstanceOf(ConflictException);
    expect((service as any).run).toHaveBeenCalledTimes(1);
  });

  it('records a source failure but continues to publish other coverage transactionally', async () => {
    const { service, adapter, snapshots, states, session } = setup();
    adapter.getTimetable.mockRejectedValueOnce(new TimetableSourceError('SOURCE_TIMEOUT', 'timeout'));
    await (service as any).run('job', 'owner', [selection, { ...selection, week: '2' }]);
    expect(snapshots.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(session.withTransaction).toHaveBeenCalledTimes(1);
    expect(session.endSession).toHaveBeenCalledTimes(1);
    expect(snapshots.findOneAndUpdate).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ session }));
    expect(states.updateOne).toHaveBeenLastCalledWith(expect.objectContaining({ 'job.id': 'job', 'lease.owner': 'owner' }), expect.objectContaining({
      $set: expect.objectContaining({ 'job.status': 'failed', 'job.completed': 1, 'job.failures': [{ coverage: selection, reason: 'SOURCE_TIMEOUT' }] }),
    }));
  });

  it('cannot publish or finish when another worker owns the job', async () => {
    const { service, snapshots, states } = setup();
    states.updateOne.mockReturnValue(chain({ matchedCount: 0 }));
    await (service as any).run('stale', 'old-owner', [selection]);
    expect(snapshots.findOneAndUpdate).not.toHaveBeenCalled();
    expect(states.updateOne).toHaveBeenCalledTimes(1);
  });

  it('renews ownership while waiting for a slow source and stops after renewal is lost', async () => {
    jest.useFakeTimers();
    const { service, adapter, states, snapshots } = setup();
    let resolve!: (value: any) => void;
    adapter.getTimetable.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    const pending = (service as any).run('job', 'owner', [selection]);
    await jest.advanceTimersByTimeAsync(20000);
    expect(states.updateOne).toHaveBeenCalledWith(expect.objectContaining({ 'lease.owner': 'owner' }), expect.objectContaining({ $set: { 'lease.expiresAt': expect.any(Date) } }));
    states.updateOne.mockReturnValue(chain({ matchedCount: 0 }));
    await jest.advanceTimersByTimeAsync(20000);
    resolve({ lessons: [], isEmpty: true });
    await pending;
    expect(snapshots.findOneAndUpdate).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('recovers only expired or abandoned jobs before reading status', async () => {
    const { service, states } = setup();
    await service.getStatus(admin);
    expect(states.updateOne).toHaveBeenCalledWith(expect.objectContaining({
      'job.status': 'running',
      $or: expect.arrayContaining([expect.objectContaining({ 'lease.expiresAt': { $lte: expect.any(Date) } })]),
    }), expect.objectContaining({ $set: expect.objectContaining({ 'job.error': 'SYNC_INTERRUPTED', 'job.status': 'failed' }) }));
  });

  it('keeps scheduling disabled until explicitly enabled', async () => {
    const { service, adapter } = setup();
    await service.scheduled();
    expect(adapter.getTimetable).not.toHaveBeenCalled();
  });

  it('loads contextual source catalogs without losing previously stored labels', async () => {
    const { service, adapter, states } = setup();
    adapter.getOptions.mockResolvedValue({ years: [], semesters: [], weeks: [], faculties: [], courses: [], classes: [{ value: 'c', label: 'Class C' }] });
    await service.loadCatalog(admin, { year: '2026', semester: '2' });
    expect(adapter.getOptions).toHaveBeenCalledWith('sync-catalog:admin-1', { year: '2026', semester: '2' });
    expect(states.updateOne).toHaveBeenCalledWith({ name: 'default' }, [expect.objectContaining({ $set: expect.objectContaining({ catalog: expect.objectContaining({ classes: { $setUnion: [{ $ifNull: ['$catalog.classes', []] }, { $literal: [{ value: 'c', label: 'Class C' }] }] } }) }) })], { updatePipeline: true });
  });
});
