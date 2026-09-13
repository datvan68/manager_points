import { ConflictException } from '@nestjs/common';
import mongoose from 'mongoose';
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
    findOne: jest.fn(() => chain(state)),
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
    const [filter, update] = states.findOneAndUpdate.mock.calls.find((call: any[]) => call[0]?.['job.status']) as unknown as [any, any];
    expect(filter['job.status']).toEqual({ $ne: 'running' });
    expect(update.$set.job.operatorId).toBe('admin-1');
    expect(update.$set.lease.owner).toContain(update.$set.job.id);
    states.findOneAndUpdate.mockReturnValueOnce(chain({} as any)).mockReturnValueOnce(chain({} as any)).mockReturnValueOnce(chain(null));
    await expect(service.start(admin, { coverage: [selection] })).rejects.toBeInstanceOf(ConflictException);
    expect((service as any).run).toHaveBeenCalledTimes(1);
  });

  it('records a source failure but continues to publish other coverage transactionally', async () => {
    const { service, adapter, snapshots, states, session } = setup();
    adapter.getTimetable.mockImplementation((_context: string, item: any) => item.week === '1'
      ? Promise.reject(new TimetableSourceError('SOURCE_TIMEOUT', 'timeout'))
      : Promise.resolve({ isEmpty: true, lessons: [], filters: item }));
    await (service as any).run('job', 'owner', [selection, { ...selection, week: '2' }]);
    expect(snapshots.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(adapter.getTimetable).toHaveBeenCalledTimes(4);
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
    }), expect.arrayContaining([expect.objectContaining({ $set: expect.objectContaining({ 'job.error': 'SYNC_INTERRUPTED', 'job.status': 'failed' }) })]), { updatePipeline: true });
    expect(states.updateOne.mock.calls[0][2]).toEqual({ updatePipeline: true });
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

  it('accepts selected classes and validated rolling mappings without fetching schedules', async () => {
    const { service, adapter, states } = setup();
    await service.updateSettings(admin, { enabled: true, intervalMinutes: 60, coverage: [], selectedClasses: [{ year: '2026', semester: '1', className: 'A' }], rolling: { enabled: true, weekDates: [{ year: '2026', semester: '1', week: '1', startDate: '2026-09-07', endDate: '2026-09-13' }] } });
    expect(states.updateOne.mock.calls[0][1].$set.settings).toMatchObject({ selectedClasses: [{ className: 'A' }], rolling: { enabled: true } });
    expect(adapter.getTimetable).not.toHaveBeenCalled();
    expect(states.updateOne).toHaveBeenCalledWith({ name: 'default' }, expect.objectContaining({ $set: expect.objectContaining({ settings: expect.any(Object) }) }), expect.objectContaining({ upsert: true }));
  });

  it('coalesces a demand request and rejects an unselected scope before source work', async () => {
    const { service, adapter, states } = setup();
    states.findOneAndUpdate.mockReturnValue(chain({ settings: { selectedClasses: [{ year: '2026', semester: '1', className: 'A' }] }, catalog: { weeks: [{ value: '10', parent: { year: '2026', semester: '1' } }] }, queue: [], statuses: [] }));
    await expect(service.enqueueDemand({ roleCode: 'STUDENT' }, { year: '2026', semester: '1', week: '10', className: 'A' })).resolves.toMatchObject({ status: 'pending' });
    await expect(service.enqueueDemand({ roleCode: 'STUDENT' }, { year: '2026', semester: '1', week: '10', className: 'B' })).rejects.toMatchObject({ response: { reasonCode: 'TIMETABLE_SCOPE_NOT_ALLOWED' } });
    expect(adapter.getTimetable).not.toHaveBeenCalled();
  });

  it('requeues an expired demand owner and starts the shared worker', async () => {
    const { service } = setup();
    const drain = jest.spyOn(service as any, 'drainQueue').mockResolvedValue(undefined);
    await (service as any).recoverInterrupted();
    expect(drain).toHaveBeenCalledTimes(1);
  });

  it('enables Mongoose pipeline updates for lease recovery and enqueue', async () => {
    const { service, states } = setup();
    await (service as any).requeueLeaseLost({ key: 'k', selection, kind: 'demand', requestedAt: 'now' }, 'job', 'owner');
    expect(states.updateOne.mock.calls.at(-1)?.[2]).toEqual({ updatePipeline: true });
    states.findOneAndUpdate.mockReturnValue(chain({ settings: {}, queue: [], statuses: [] }));
    await (service as any).enqueue([selection], 'demand', false);
    expect(states.updateOne.mock.calls.at(-1)?.[2]).toEqual({ updatePipeline: true });
  });

  it('passes the installed Mongoose query boundary for update pipelines', () => {
    const connection = mongoose.createConnection();
    try {
      const model = connection.model('TimetablePipelineBoundary', new mongoose.Schema({ name: String }));
      const query = model.updateOne({}, [{ $set: { name: 'verified' } }], { updatePipeline: true });
      expect((query as any)._mongooseOptions.updatePipeline).toBe(true);
      expect(() => (query as any)._mergeUpdate(query.getUpdate())).not.toThrow();
    } finally {
      void connection.close();
    }
  });

  it('requires year and semester context when authorizing a catalog week', async () => {
    const { service, states } = setup();
    states.findOneAndUpdate.mockReturnValue(chain({ settings: { selectedClasses: [{ year: '2026', semester: '1', className: 'A' }] }, catalog: { weeks: [{ value: '10' }] }, queue: [], statuses: [] }));
    await expect(service.enqueueDemand({ roleCode: 'STUDENT' }, { year: '2026', semester: '1', week: '10', className: 'A' })).rejects.toMatchObject({ response: { reasonCode: 'TIMETABLE_SCOPE_NOT_ALLOWED' } });
  });

  it('reads a selected saved-class week without enqueueing and keeps empty snapshots synchronized', async () => {
    const { service, states, snapshots } = setup();
    const savedState = { settings: { selectedClasses: [{ year: '2026', semester: '1', faculty: 'f', course: 'c', className: 'A' }] }, catalog: { weeks: [{ value: 'past', label: 'Tuần đã qua', parent: { year: '2026', semester: '1', faculty: 'f', course: 'c' } }] }, queue: [], statuses: [] };
    states.findOne.mockReturnValueOnce(chain(savedState));
    snapshots.findOne.mockReturnValueOnce(chain({ key: 'key', syncedAt: '2026-09-01T00:00:00.000Z', result: { isEmpty: true } }));
    await expect(service.getSavedClassWeekStatus(admin, { ...savedState.settings.selectedClasses[0], week: 'past' })).resolves.toMatchObject({ status: 'valid', snapshotExists: true, isEmpty: true });
    expect(states.updateOne).not.toHaveBeenCalled();
  });

  it('rejects a foreign week and routes a valid update through force enqueue', async () => {
    const { service, states } = setup();
    const savedState = { settings: { selectedClasses: [{ year: '2026', semester: '1', className: 'A' }] }, catalog: { weeks: [{ value: 'one', parent: { year: '2026', semester: '1' } }, { value: 'other', parent: { year: '2027', semester: '1' } }] }, queue: [], statuses: [] };
    states.findOneAndUpdate.mockReturnValueOnce(chain(savedState));
    await expect(service.startSavedClassWeek(admin, { ...savedState.settings.selectedClasses[0], week: 'other', intent: 'update' })).rejects.toMatchObject({ response: { reasonCode: 'TIMETABLE_WEEK_NOT_ALLOWED' } });
    const enqueue = jest.spyOn(service as any, 'enqueue').mockResolvedValue({ status: 'pending' });
    states.findOneAndUpdate.mockReturnValueOnce(chain(savedState));
    await service.startSavedClassWeek(admin, { ...savedState.settings.selectedClasses[0], week: 'one', intent: 'update' });
    expect(enqueue).toHaveBeenCalledWith([expect.objectContaining({ week: 'one' })], 'demand', true, savedState);
  });
});
