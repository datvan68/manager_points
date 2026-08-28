import {
  CLASS_DATE_KEY,
  LEGACY_INDEX,
  REPLACEMENT_INDEX,
  buildMigrationPlan,
  runMigration,
} from '../../scripts/migrate-daily-class-report-class-date-index';

const legacy = {
  name: LEGACY_INDEX,
  key: CLASS_DATE_KEY,
  unique: true,
} as any;
const replacement = {
  name: REPLACEMENT_INDEX,
  key: CLASS_DATE_KEY,
  unique: false,
} as any;

const makeCollection = (indexes: any[]) => ({
  indexes: jest.fn().mockResolvedValue(indexes),
  dropIndex: jest.fn().mockResolvedValue('dropped'),
  createIndex: jest.fn().mockResolvedValue(REPLACEMENT_INDEX),
});

describe('daily class report class/date index migration', () => {
  it('reports the exact legacy index in dry-run without writes or document access', async () => {
    const collection = makeCollection([legacy]);
    const report = await runMigration(collection, false);

    expect(report.mode).toBe('dry-run');
    expect(report.readyToExecute).toBe(true);
    expect(report.operations).toEqual([
      `dropIndex('${LEGACY_INDEX}')`,
      `createIndex(${JSON.stringify(CLASS_DATE_KEY)}, { name: '${REPLACEMENT_INDEX}' })`,
    ]);
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).not.toHaveBeenCalled();
  });

  it('replaces only the exact legacy index in execute mode', async () => {
    const collection = makeCollection([legacy]);
    collection.indexes
      .mockResolvedValueOnce([legacy])
      .mockResolvedValueOnce([replacement]);

    const report = await runMigration(collection, true);

    expect(collection.dropIndex).toHaveBeenCalledTimes(1);
    expect(collection.dropIndex).toHaveBeenCalledWith(LEGACY_INDEX);
    expect(collection.createIndex).toHaveBeenCalledWith(CLASS_DATE_KEY, {
      name: REPLACEMENT_INDEX,
    });
    expect(report.result).toBe('completed');
  });

  it('is a no-op on a rerun after the non-unique replacement is deployed', async () => {
    const collection = makeCollection([legacy]);
    collection.indexes
      .mockResolvedValueOnce([legacy])
      .mockResolvedValueOnce([replacement])
      .mockResolvedValueOnce([replacement]);

    const firstReport = await runMigration(collection, true);
    const rerunReport = await runMigration(collection, true);

    expect(firstReport.result).toBe('completed');
    expect(rerunReport.result).toBe('no-op');
    expect(collection.dropIndex).toHaveBeenCalledTimes(1);
    expect(collection.createIndex).toHaveBeenCalledTimes(1);
  });

  it('blocks an incompatible or conflicting class/date index before writes', async () => {
    const wrongLegacy = { ...legacy, unique: false };
    const conflicting = { name: 'class_id_1_report_date_1', key: CLASS_DATE_KEY, unique: false };

    expect(buildMigrationPlan([wrongLegacy] as any).readyToExecute).toBe(false);

    const collection = makeCollection([legacy, conflicting]);
    await expect(runMigration(collection, true)).rejects.toThrow('conflicting class/date index');
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).not.toHaveBeenCalled();
  });
});
