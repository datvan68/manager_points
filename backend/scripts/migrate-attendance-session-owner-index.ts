import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const COLLECTION = 'attendance_sessions';
export type IndexLike = {
  name?: string;
  key: Record<string, unknown>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
  collation?: unknown;
  sparse?: boolean;
  hidden?: boolean;
  expireAfterSeconds?: number;
};
type Lane = {
  id: string;
  legacyName: string;
  legacyKey: Record<string, number>;
  ownerName: string;
  ownerKey: Record<string, number>;
  filter: Record<string, unknown>;
  duplicateGroup: Record<string, string>;
};
export const LANES: Lane[] = [
  {
    id: 'manual',
    legacyName: 'context_id_1_schedule_id_1_class_id_1',
    legacyKey: { context_id: 1, schedule_id: 1, class_id: 1 },
    ownerName: 'manual_active_session_per_owner',
    ownerKey: { context_id: 1, schedule_id: 1, class_id: 1, opened_by: 1 },
    filter: { status: 'active', method: 'manual_class' },
    duplicateGroup: {
      context_id: '$context_id',
      schedule_id: '$schedule_id',
      class_id: '$class_id',
      opened_by: '$opened_by',
    },
  },
  {
    id: 'qr_gps',
    legacyName: 'context_id_1_schedule_id_1',
    legacyKey: { context_id: 1, schedule_id: 1 },
    ownerName: 'qr_proximity_active_session_per_owner',
    ownerKey: { context_id: 1, schedule_id: 1, opened_by: 1 },
    filter: { status: 'active', method: { $in: ['qr', 'proximity'] } },
    duplicateGroup: {
      context_id: '$context_id',
      schedule_id: '$schedule_id',
      opened_by: '$opened_by',
    },
  },
];

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object')
    return `{${Object.entries(v as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, x]) => `${JSON.stringify(k)}:${canonical(x)}`)
      .join(',')}}`;
  return JSON.stringify(v);
}
function same(a: unknown, b: unknown): boolean {
  return canonical(a) === canonical(b);
}
export function definition(index: IndexLike) {
  return {
    name: index.name,
    key: index.key,
    options: {
      unique: index.unique === true,
      partialFilterExpression: index.partialFilterExpression ?? null,
      collation: index.collation ?? null,
      sparse: index.sparse === true,
      hidden: index.hidden === true,
      expireAfterSeconds: index.expireAfterSeconds ?? null,
    },
  };
}
function exact(
  index: IndexLike | undefined,
  name: string,
  key: Record<string, number>,
  filter: Record<string, unknown>,
): boolean {
  return (
    !!index &&
    index.name === name &&
    same(index.key, key) &&
    index.unique === true &&
    same(index.partialFilterExpression, filter) &&
    index.collation == null &&
    index.sparse !== true &&
    index.hidden !== true &&
    index.expireAfterSeconds == null
  );
}
function help() {
  console.log(
    'Usage: ts-node scripts/migrate-attendance-session-owner-index.ts --environment <label> [--execute]\nDefault: dry-run; plans manual and QR/GPS owner-scoped indexes.\n--help exits without loading .env or connecting.',
  );
}
function env(args: string[]) {
  const i = args.indexOf('--environment');
  return (
    args.find((a) => a.startsWith('--environment='))?.slice(14) ||
    (i >= 0 ? args[i + 1] : undefined) ||
    process.env.MIGRATION_ENVIRONMENT
  )?.trim();
}
export async function runMigration(
  collection: any,
  execute = false,
  target = { environment: 'test', databaseName: 'mock', serverHosts: ['mock'] },
) {
  const indexes = (await collection.indexes()) as IndexLike[];
  const lanes = [] as any[];
  let blocked = false;
  for (const lane of LANES) {
    const legacy = indexes.filter((i) => same(i.key, lane.legacyKey));
    const owner = indexes.filter(
      (i) => same(i.key, lane.ownerKey) || i.name === lane.ownerName,
    );
    const approvedLegacy = legacy.filter((i) =>
      exact(i, lane.legacyName, lane.legacyKey, lane.filter),
    );
    const approvedOwner = owner.find((i) =>
      exact(i, lane.ownerName, lane.ownerKey, lane.filter),
    );
    const conflicts = await collection
      .aggregate([
        { $match: lane.filter },
        {
          $group: {
            _id: lane.duplicateGroup,
            count: { $sum: 1 },
            recordIds: { $push: '$_id' },
          },
        },
        { $match: { count: { $gt: 1 } } },
      ])
      .toArray();
    const missing = await collection
      .find({
        ...lane.filter,
        $or: [{ opened_by: { $exists: false } }, { opened_by: null }],
      })
      .project({ _id: 1 })
      .toArray();
    const invalid = legacy
      .filter((i) => !exact(i, lane.legacyName, lane.legacyKey, lane.filter))
      .concat(
        owner.filter(
          (i) => !exact(i, lane.ownerName, lane.ownerKey, lane.filter),
        ),
      );
    const ready =
      invalid.length === 0 &&
      legacy.length <= 1 &&
      owner.length <= 1 &&
      conflicts.length === 0 &&
      missing.length === 0;
    blocked ||= !ready;
    lanes.push({
      lane: lane.id,
      candidates: {
        legacy: legacy.map(definition),
        owner: owner.map(definition),
      },
      conflicts,
      missingOpenedBy: missing,
      ready,
      blockers: ready ? [] : ['candidate-or-data-conflict'],
      definitions: {
        legacy: {
          name: lane.legacyName,
          key: lane.legacyKey,
          partialFilterExpression: lane.filter,
        },
        owner: {
          name: lane.ownerName,
          key: lane.ownerKey,
          partialFilterExpression: lane.filter,
        },
      },
      operations: [
        approvedOwner ? `retain ${lane.ownerName}` : `create ${lane.ownerName}`,
        approvedLegacy.length ? `drop ${lane.legacyName}` : 'no legacy drop',
      ],
    });
  }
  const report = {
    mode: execute ? 'execute' : 'dry-run',
    target,
    collection: COLLECTION,
    existingIndexes: indexes.map(definition),
    lanes,
    readyToExecute: !blocked,
  };
  if (!execute || blocked) return report;
  for (const lane of LANES) {
    const state = lanes.find((x) => x.lane === lane.id);
    if (state.operations[0].startsWith('create'))
      await collection.createIndex(lane.ownerKey, {
        name: lane.ownerName,
        unique: true,
        partialFilterExpression: lane.filter,
      });
    if (state.operations[1].startsWith('drop'))
      await collection.dropIndex(lane.legacyName);
  }
  const post = (await collection.indexes()) as IndexLike[];
  for (const lane of LANES)
    if (
      !exact(
        post.find((i) => i.name === lane.ownerName),
        lane.ownerName,
        lane.ownerKey,
        lane.filter,
      ) ||
      post.some(
        (i) =>
          i.name === lane.legacyName &&
          exact(i, lane.legacyName, lane.legacyKey, lane.filter),
      )
    )
      throw new Error('Post-migration index verification failed.');
  return {
    ...report,
    result: 'completed',
    installedIndexes: LANES.map((l) => l.ownerName),
    removedLegacyIndexes: LANES.filter((l) =>
      indexes.some((i) => exact(i, l.legacyName, l.legacyKey, l.filter)),
    ).map((l) => l.legacyName),
  };
}

async function main() {
  if (process.argv.includes('--help') || process.argv.includes('-h'))
    return help();
  dotenv.config({ quiet: true });
  const uri = process.env.MONGO_URI;
  const environment = env(process.argv.slice(2));
  if (!uri)
    throw new Error(
      'MONGO_URI is required (no database connection was attempted).',
    );
  if (!environment)
    throw new Error(
      '--environment or MIGRATION_ENVIRONMENT is required (no database connection was attempted).',
    );
  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();
    const report = await runMigration(
      db.collection(COLLECTION),
      process.argv.includes('--execute'),
      { environment, databaseName: db.databaseName, serverHosts: [] },
    );
    console.log(JSON.stringify(report, null, 2));
    if (!report.readyToExecute)
      throw new Error(
        'Migration blocked by conflicts or index mismatch; no index changes were made.',
      );
  } finally {
    await client.close();
  }
}
if (require.main === module)
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  });
