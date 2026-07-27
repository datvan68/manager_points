import {
  LANES,
  runMigration,
} from '../../scripts/migrate-attendance-session-owner-index';

const makeCollection = (indexes: any[] = [], records: any[] = []) => ({
  indexes: jest.fn().mockResolvedValue(indexes),
  aggregate: jest
    .fn()
    .mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
  find: jest.fn().mockReturnValue({
    project: jest
      .fn()
      .mockReturnValue({ toArray: jest.fn().mockResolvedValue(records) }),
  }),
  createIndex: jest.fn().mockResolvedValue('created'),
  dropIndex: jest.fn().mockResolvedValue('dropped'),
});

describe('attendance owner index migration', () => {
  it('reports both lanes without writes in dry-run', async () => {
    const c = makeCollection();
    const report = await runMigration(c, false);
    expect(report.mode).toBe('dry-run');
    expect(report.lanes.map((x: any) => x.lane)).toEqual(['manual', 'qr_gps']);
    expect(c.createIndex).not.toHaveBeenCalled();
    expect(c.dropIndex).not.toHaveBeenCalled();
  });
  it('creates both owner indexes and drops only exact legacy definitions', async () => {
    const legacy = LANES.map((l) => ({
      name: l.legacyName,
      key: l.legacyKey,
      unique: true,
      partialFilterExpression: l.filter,
    }));
    const owner = LANES.map((l) => ({
      name: l.ownerName,
      key: l.ownerKey,
      unique: true,
      partialFilterExpression: l.filter,
    }));
    const c = makeCollection(legacy);
    c.indexes.mockResolvedValueOnce(legacy).mockResolvedValueOnce(owner);
    const report: any = await runMigration(c, true);
    expect(c.createIndex).toHaveBeenCalledTimes(2);
    expect(c.dropIndex).toHaveBeenCalledTimes(2);
    expect(report.result).toBe('completed');
  });
  it('blocks writes for a lookalike candidate', async () => {
    const c = makeCollection([
      {
        name: LANES[0].legacyName,
        key: LANES[0].legacyKey,
        unique: false,
        partialFilterExpression: LANES[0].filter,
      },
    ]);
    const report = await runMigration(c, true);
    expect(report.readyToExecute).toBe(false);
    expect(c.createIndex).not.toHaveBeenCalled();
  });
});
