import {
  CANONICAL_INDEX,
  LEGACY_INDEX,
  buildRepairPlan,
  runMigration,
  summarizeRoomCodes,
} from '../../scripts/repair-dormitory-room-index';

const legacy = { name: LEGACY_INDEX, key: { ma_phong: 1 }, unique: true } as any;
const canonical = { name: CANONICAL_INDEX, key: { room_code: 1 }, unique: true } as any;

const makeCollection = (indexes: any[], roomCodes: unknown[] = []) => ({
  indexes: jest.fn().mockResolvedValue(indexes),
  find: jest.fn().mockReturnValue({
    toArray: jest.fn().mockResolvedValue(roomCodes.map((room_code) => ({ room_code }))),
  }),
  dropIndex: jest.fn().mockResolvedValue('dropped'),
  createIndex: jest.fn().mockResolvedValue(CANONICAL_INDEX),
});

describe('dormitory room index repair', () => {
  it('reports a stale legacy index and plans the canonical index without writes', async () => {
    const collection = makeCollection([legacy], ['A101', 'B202']);
    const plan = await runMigration(collection as any, false);

    expect(plan.readyToExecute).toBe(true);
    expect(plan.plannedChanges).toEqual({
      dropLegacyIndexes: [LEGACY_INDEX],
      createCanonicalIndex: true,
    });
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).not.toHaveBeenCalled();
  });

  it('drops only the verified legacy index when the canonical index already exists', async () => {
    const collection = makeCollection([legacy, canonical], ['A101', 'B202']);
    collection.indexes.mockResolvedValueOnce([legacy, canonical]).mockResolvedValueOnce([canonical]);
    const plan = await runMigration(collection as any, true);

    expect(plan.result).toBe('completed');
    expect(collection.dropIndex).toHaveBeenCalledWith(LEGACY_INDEX);
    expect(collection.createIndex).not.toHaveBeenCalled();
  });

  it('aborts before writes when room codes collide', async () => {
    const collection = makeCollection([legacy], ['A101', 'A101']);

    await expect(runMigration(collection as any, true)).rejects.toThrow('duplicate room_code');
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).not.toHaveBeenCalled();
  });

  it('reports a canonical-only no-op plan', () => {
    const plan = buildRepairPlan([canonical], summarizeRoomCodes([{ room_code: 'A101' }]));

    expect(plan.readyToExecute).toBe(true);
    expect(plan.plannedChanges).toEqual({ dropLegacyIndexes: [], createCanonicalIndex: false });
  });

  it('reports missing room codes without allowing execution', () => {
    const plan = buildRepairPlan([legacy], summarizeRoomCodes([{ room_code: null }, { room_code: ' ' }]));

    expect(plan.data.missingRoomCode).toBe(2);
    expect(plan.readyToExecute).toBe(false);
    expect(plan.unsafeFindings).toContain('2 room document(s) have a missing room_code.');
  });

  it('rejects a canonical index with unsupported options before writes', async () => {
    const sparseCanonical = { ...canonical, sparse: true };
    const collection = makeCollection([sparseCanonical, legacy], ['A101']);

    await expect(runMigration(collection as any, true)).rejects.toThrow('unsupported index options');
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).not.toHaveBeenCalled();
  });

  it('is idempotent on a repeated run', async () => {
    const collection = makeCollection([canonical], ['A101', 'B202']);
    const plan = await runMigration(collection as any, true);

    expect(plan.result).toBe('no-op');
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).not.toHaveBeenCalled();
  });
});
