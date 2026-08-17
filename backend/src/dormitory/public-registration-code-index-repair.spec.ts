import {
  CANONICAL_INDEX,
  CANONICAL_FIELD,
  LEGACY_FIELD,
  buildRepairPlan,
  indexSignature,
  restoreIndexCommands,
  runMigration,
  summarizeRegistrationCodes,
  validateLegacyIndexTargets,
} from '../../scripts/repair-public-registration-code-index';

const legacy = { name: 'renamed-legacy-index', key: { [LEGACY_FIELD]: 1 }, unique: true } as any;
const canonical = { name: 'custom-canonical-index', key: { [CANONICAL_FIELD]: 1 }, unique: true } as any;

const makeCollection = (indexSnapshots: any[], documents: any[] = [], dataSnapshots?: any[][]) => {
  const snapshots = Array.isArray(indexSnapshots[0]) ? [...indexSnapshots] : [indexSnapshots];
  const lastSnapshot = snapshots.at(-1) || [];
  const documentSnapshots = dataSnapshots ? [...dataSnapshots] : [documents];
  const lastDocuments = documentSnapshots.at(-1) || documents;
  const collection = {
    indexes: jest.fn().mockImplementation(async () => snapshots.shift() || lastSnapshot),
    find: jest.fn().mockReturnValue({
      toArray: jest.fn().mockImplementation(async () => documentSnapshots.shift() || lastDocuments),
    }),
    createIndex: jest.fn().mockResolvedValue(CANONICAL_INDEX),
    dropIndex: jest.fn().mockResolvedValue('dropped'),
  };
  return collection;
};

describe('public registration code index repair', () => {
  let logSpy: jest.SpyInstance;
  let originalMongoUri: string | undefined;
  let originalApproval: string | undefined;

  beforeEach(() => {
    originalMongoUri = process.env.MONGO_URI;
    originalApproval = process.env.DORMITORY_MIGRATION_APPROVED;
    process.env.MONGO_URI = 'mongodb://localhost:27017/manager-points-test';
    process.env.DORMITORY_MIGRATION_APPROVED = 'YES';
    logSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
    if (originalMongoUri === undefined) delete process.env.MONGO_URI;
    else process.env.MONGO_URI = originalMongoUri;
    if (originalApproval === undefined) delete process.env.DORMITORY_MIGRATION_APPROVED;
    else process.env.DORMITORY_MIGRATION_APPROVED = originalApproval;
  });

  it('identifies a stale exact legacy key regardless of its index name and does not write in dry-run', async () => {
    const collection = makeCollection([legacy], [{ [CANONICAL_FIELD]: 'PUB-1' }]);

    const plan = await runMigration(collection as any, false);

    expect(plan.legacyIndexes).toHaveLength(1);
    expect(plan.plannedChanges).toEqual({
      dropLegacyIndexes: [legacy.name],
      createCanonicalIndex: true,
    });
    expect(collection.createIndex).not.toHaveBeenCalled();
    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.find).toHaveBeenCalledWith(
      {},
      { projection: { _id: 0, [LEGACY_FIELD]: 1, [CANONICAL_FIELD]: 1 } },
    );
  });

  it('creates and validates the canonical index before dropping the legacy index', async () => {
    const collection = makeCollection(
      [
        [legacy],
        [legacy, canonical],
        [legacy, canonical],
        [canonical],
      ],
      [{ [CANONICAL_FIELD]: 'PUB-1' }, { [CANONICAL_FIELD]: 'PUB-2' }],
    );
    const events: string[] = [];
    collection.createIndex.mockImplementation(async () => {
      events.push('create');
      return CANONICAL_INDEX;
    });
    collection.dropIndex.mockImplementation(async () => {
      events.push('drop');
      return 'dropped';
    });

    const result = await runMigration(collection as any, true);

    expect(result.result).toBe('completed');
    expect(events).toEqual(['create', 'drop']);
  });

  it.each([
    ['legacy-only documents', [{ [LEGACY_FIELD]: 'legacy' }], 'legacy registration field'],
    ['documents with both fields', [{ [LEGACY_FIELD]: 'legacy', [CANONICAL_FIELD]: 'PUB-1' }], 'both registration fields'],
    ['missing canonical values', [{}], 'missing or blank canonical'],
    ['blank canonical values', [{ [CANONICAL_FIELD]: '  ' }], 'missing or blank canonical'],
    ['duplicate canonical values', [{ [CANONICAL_FIELD]: 'PUB-DUP' }, { [CANONICAL_FIELD]: 'PUB-DUP' }], 'duplicate canonical'],
  ])('blocks writes for unsafe data: %s', async (_label, documents, finding) => {
    const collection = makeCollection([legacy], documents);

    await expect(runMigration(collection as any, true)).rejects.toThrow(finding);
    expect(collection.createIndex).not.toHaveBeenCalled();
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it('reports all data safety counts without exposing registration-code values', () => {
    const summary = summarizeRegistrationCodes([
      { [LEGACY_FIELD]: 'LEGACY-VALUE' },
      { [CANONICAL_FIELD]: 'CANONICAL-VALUE' },
      { [LEGACY_FIELD]: 'LEGACY-2', [CANONICAL_FIELD]: 'CANONICAL-2' },
      { [CANONICAL_FIELD]: 'DUPLICATE-VALUE' },
      { [CANONICAL_FIELD]: 'DUPLICATE-VALUE' },
      { [CANONICAL_FIELD]: ' ' },
    ]);

    expect(summary).toEqual({
      totalDocuments: 6,
      legacyOnly: 1,
      canonicalOnly: 4,
      bothFields: 1,
      missingOrBlankCanonical: 2,
      duplicateCanonicalGroups: 1,
    });
    expect(JSON.stringify(summary)).not.toContain('DUPLICATE-VALUE');
  });

  it.each([
    ['compound legacy index', { name: 'legacy-compound', key: { [LEGACY_FIELD]: 1, extra: 1 }, unique: true }],
    ['unknown legacy index option', { name: 'legacy-unknown-option', key: { [LEGACY_FIELD]: 1 }, unique: true, unknownOption: true }],
    ['non-unique canonical index', { name: 'canonical-non-unique', key: { [CANONICAL_FIELD]: 1 }, unique: false }],
    ['sparse canonical index', { name: 'canonical-sparse', key: { [CANONICAL_FIELD]: 1 }, unique: true, sparse: true }],
    ['compound canonical index', { name: 'canonical-compound', key: { [CANONICAL_FIELD]: 1, extra: 1 }, unique: true }],
  ])('blocks unsafe index definitions: %s', async (_label, unsafeIndex) => {
    const collection = makeCollection([unsafeIndex], [{ [CANONICAL_FIELD]: 'PUB-1' }]);

    await expect(runMigration(collection as any, true)).rejects.toThrow();
    expect(collection.createIndex).not.toHaveBeenCalled();
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it('never drops an unrelated index just because its name matches the legacy name', async () => {
    const sameNameDifferentKey = { name: 'ma_dk_public_1', key: { unrelated: 1 }, unique: true };
    const collection = makeCollection(
      [[sameNameDifferentKey], [sameNameDifferentKey, canonical], [sameNameDifferentKey, canonical]],
      [{ [CANONICAL_FIELD]: 'PUB-1' }],
    );

    await runMigration(collection as any, true);

    expect(collection.dropIndex).not.toHaveBeenCalled();
    expect(collection.createIndex).toHaveBeenCalledWith(
      { [CANONICAL_FIELD]: 1 },
      { name: CANONICAL_INDEX, unique: true },
    );
  });

  it('fails closed when a legacy name is replaced by an unrelated key before the drop', async () => {
    const replacement = { name: legacy.name, key: { unrelated: 1 }, unique: true };
    const collection = makeCollection(
      [[legacy], [replacement, canonical]],
      [{ [CANONICAL_FIELD]: 'PUB-1' }],
    );

    await expect(runMigration(collection as any, true)).rejects.toThrow();
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it.each([
    ['key', { ...legacy, key: { [LEGACY_FIELD]: -1 } }],
    ['options', { ...legacy, sparse: true }],
  ])('fails closed when the planned legacy signature changes before drop: %s', async (_label, changed) => {
    const collection = makeCollection(
      [[legacy], [changed, canonical]],
      [{ [CANONICAL_FIELD]: 'PUB-1' }],
    );

    await expect(runMigration(collection as any, true)).rejects.toThrow();
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it('keeps the legacy index when canonical index creation fails', async () => {
    const collection = makeCollection([legacy], [{ [CANONICAL_FIELD]: 'PUB-1' }]);
    collection.createIndex.mockRejectedValue(new Error('create failed'));

    await expect(runMigration(collection as any, true)).rejects.toThrow('create failed');
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it('keeps the legacy index when canonical validation fails after creation', async () => {
    const collection = makeCollection(
      [
        [legacy],
        [legacy, { name: CANONICAL_INDEX, key: { [CANONICAL_FIELD]: 1 }, unique: false }],
      ],
      [{ [CANONICAL_FIELD]: 'PUB-1' }],
    );

    await expect(runMigration(collection as any, true)).rejects.toThrow('Canonical unique index validation failed');
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it('reuses an existing valid canonical index and verifies the post-repair state', async () => {
    const collection = makeCollection(
      [
        [legacy, canonical],
        [legacy, canonical],
        [legacy, canonical],
        [canonical],
      ],
      [{ [CANONICAL_FIELD]: 'PUB-1' }],
    );

    const result = await runMigration(collection as any, true);

    expect(result.result).toBe('completed');
    expect(collection.createIndex).not.toHaveBeenCalled();
    expect(collection.dropIndex).toHaveBeenCalledWith(legacy.name);
  });

  it('fails post-repair verification if any legacy-key index remains', async () => {
    const collection = makeCollection(
      [[legacy], [legacy, canonical], [legacy, canonical], [legacy, canonical]],
      [{ [CANONICAL_FIELD]: 'PUB-1' }],
    );

    await expect(runMigration(collection as any, true)).rejects.toThrow('Post-repair verification failed');
    expect(collection.dropIndex).toHaveBeenCalledWith(legacy.name);
  });

  it('fails final verification when a new unsafe document appears after the drop', async () => {
    const collection = makeCollection(
      [[legacy], [legacy, canonical], [legacy, canonical], [canonical]],
      [{ [CANONICAL_FIELD]: 'PUB-1' }],
      [
        [{ [CANONICAL_FIELD]: 'PUB-1' }],
        [{ [CANONICAL_FIELD]: 'PUB-1' }],
        [{ [LEGACY_FIELD]: 'LATE-UNSAFE' }],
      ],
    );

    await expect(runMigration(collection as any, true)).rejects.toThrow('Post-repair verification failed');
    expect(collection.dropIndex).toHaveBeenCalledWith(legacy.name);
  });

  it('returns fresh aggregate post-data evidence after a successful repair', async () => {
    const finalDocuments = [{ [CANONICAL_FIELD]: 'PUB-2' }, { [CANONICAL_FIELD]: 'PUB-3' }];
    const collection = makeCollection(
      [[legacy], [legacy, canonical], [legacy, canonical], [canonical]],
      [{ [CANONICAL_FIELD]: 'PUB-1' }],
      [
        [{ [CANONICAL_FIELD]: 'PUB-1' }],
        [{ [CANONICAL_FIELD]: 'PUB-1' }],
        finalDocuments,
      ],
    );

    const result = await runMigration(collection as any, true);

    expect(result.afterData).toEqual(summarizeRegistrationCodes(finalDocuments));
    expect(logSpy.mock.calls.flat().join('\n')).toContain('"dataAfter"');
  });

  it('returns a no-op and performs no writes after a successful repair', async () => {
    const collection = makeCollection([[canonical]], [{ [CANONICAL_FIELD]: 'PUB-1' }]);

    const result = await runMigration(collection as any, true);

    expect(result.result).toBe('no-op');
    expect(collection.createIndex).not.toHaveBeenCalled();
    expect(collection.dropIndex).not.toHaveBeenCalled();
  });

  it('blocks direct execute helpers without a non-production target and approval', async () => {
    delete process.env.MONGO_URI;
    delete process.env.DORMITORY_MIGRATION_APPROVED;
    const collection = makeCollection([legacy], [{ [CANONICAL_FIELD]: 'PUB-1' }]);

    await expect(runMigration(collection as any, true)).rejects.toThrow('non-production MONGO_URI');
    expect(collection.indexes).not.toHaveBeenCalled();
  });

  it('captures executable restore commands for the complete legacy index definitions', () => {
    expect(restoreIndexCommands([legacy])).toEqual([
      `db.publicregistrations.createIndex({"ma_dk_public":1}, {"name":"renamed-legacy-index","unique":true})`,
    ]);
  });

  it('does not log registration-code values', async () => {
    const collection = makeCollection([legacy], [{ [CANONICAL_FIELD]: 'DO-NOT-LOG-ME' }]);

    await runMigration(collection as any, false);

    expect(logSpy.mock.calls.flat().join('\n')).not.toContain('DO-NOT-LOG-ME');
  });

  it('reports an unsafe canonical index through the pure planning helper', () => {
    const plan = buildRepairPlan(
      [{ name: 'canonical', key: { [CANONICAL_FIELD]: 1 }, unique: false }] as any,
      summarizeRegistrationCodes([{ [CANONICAL_FIELD]: 'PUB-1' }]),
    );

    expect(plan.readyToExecute).toBe(false);
    expect(plan.unsafeFindings).toContain('The exact canonical index is not a plain unique index.');
  });

  it('compares the complete reviewed legacy signature', () => {
    expect(indexSignature(legacy)).not.toEqual(indexSignature({ ...legacy, sparse: true }));
    expect(() => validateLegacyIndexTargets([legacy], [{ ...legacy, sparse: true }] as any)).toThrow();
  });
});
