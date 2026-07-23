import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

const COLLECTION = 'attendance_sessions';
const OLD_INDEX_NAME = 'context_id_1_schedule_id_1_class_id_1';
const NEW_INDEX_NAME = 'manual_active_session_per_owner';
const OLD_KEY = { context_id: 1, schedule_id: 1, class_id: 1 };
const NEW_KEY = {
  context_id: 1,
  schedule_id: 1,
  class_id: 1,
  opened_by: 1,
};
const MANUAL_ACTIVE_FILTER = {
  status: 'active',
  method: 'manual_class',
};

function printHelp(): void {
  console.log([
    'Usage: ts-node scripts/migrate-attendance-session-owner-index.ts --environment <label> [--execute]',
    '',
    'Default: dry-run. Connects read-only to report indexes and conflicting active records.',
    '--execute: create the owner-scoped unique index, then remove the legacy manual index.',
    '--environment <label>: required non-secret target label (or MIGRATION_ENVIRONMENT).',
    'MONGO_URI is required for dry-run and execute but is never printed.',
    '--help does not load .env or connect.',
  ].join('\n'));
}

type IndexLike = {
  name?: string;
  key: Record<string, unknown>;
  unique?: boolean;
  partialFilterExpression?: Record<string, unknown>;
  collation?: unknown;
  sparse?: boolean;
  hidden?: boolean;
  expireAfterSeconds?: number;
};

function sameKey(
  actual: Record<string, unknown>,
  expected: Record<string, number>,
): boolean {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function actualIndex(index: IndexLike) {
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

function hasApprovedOptions(index: IndexLike): boolean {
  return index.unique === true
    && canonicalJson(index.partialFilterExpression) === canonicalJson(MANUAL_ACTIVE_FILTER)
    && index.collation == null
    && index.sparse !== true
    && index.hidden !== true
    && index.expireAfterSeconds == null;
}

function isApprovedLegacyIndex(index: IndexLike): boolean {
  return index.name === OLD_INDEX_NAME
    && sameKey(index.key, OLD_KEY)
    && hasApprovedOptions(index);
}

function isApprovedNewIndex(index: IndexLike): boolean {
  return index.name === NEW_INDEX_NAME
    && sameKey(index.key, NEW_KEY)
    && hasApprovedOptions(index);
}

function parseEnvironmentLabel(args: string[]): string | undefined {
  const equalsArg = args.find((arg) => arg.startsWith('--environment='));
  if (equalsArg) return equalsArg.slice('--environment='.length).trim();
  const position = args.indexOf('--environment');
  if (position >= 0) return args[position + 1]?.trim();
  return process.env.MIGRATION_ENVIRONMENT?.trim();
}

function sanitizedServerHosts(uri: string): string[] {
  const schemeMatch = uri.match(/^mongodb(?:\+srv)?:\/\//i);
  if (!schemeMatch) throw new Error('MONGO_URI must use mongodb:// or mongodb+srv://.');
  const afterScheme = uri.slice(schemeMatch[0].length);
  const authority = afterScheme.split(/[/?]/, 1)[0] ?? '';
  const withoutCredentials = authority.slice(authority.lastIndexOf('@') + 1);
  const hosts = withoutCredentials.split(',').map((hostWithPort) => {
    const host = hostWithPort.trim();
    if (host.startsWith('[')) {
      const closingBracket = host.indexOf(']');
      return closingBracket >= 0 ? host.slice(1, closingBracket) : host;
    }
    return host.split(':', 1)[0];
  }).filter(Boolean);
  if (hosts.length === 0) throw new Error('MONGO_URI does not contain a server hostname.');
  return [...new Set(hosts)];
}

async function main(): Promise<void> {
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  dotenv.config({ quiet: true });
  const execute = process.argv.includes('--execute');
  const environment = parseEnvironmentLabel(process.argv.slice(2));
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required (no database connection was attempted).');
  if (!environment) {
    throw new Error(
      '--environment or MIGRATION_ENVIRONMENT is required (no database connection was attempted).',
    );
  }
  const serverHosts = sanitizedServerHosts(uri);

  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();
    const collection = db.collection(COLLECTION);
    const indexes = await collection.indexes() as IndexLike[];
    const oldCandidates = indexes.filter((index) => sameKey(index.key, OLD_KEY));
    const newCandidates = indexes.filter(
      (index) => sameKey(index.key, NEW_KEY) || index.name === NEW_INDEX_NAME,
    );
    const invalidOldCandidates = oldCandidates.filter(
      (index) => !isApprovedLegacyIndex(index),
    );
    const invalidNewCandidates = newCandidates.filter(
      (index) => !isApprovedNewIndex(index),
    );
    const approvedOldIndex = oldCandidates.find(isApprovedLegacyIndex);
    const approvedNewIndex = newCandidates.find(isApprovedNewIndex);
    const conflictingGroups = await collection.aggregate<{
      _id: {
        context_id: unknown;
        schedule_id: unknown;
        class_id: unknown;
        opened_by: unknown;
      };
      count: number;
      recordIds: unknown[];
    }>([
      { $match: MANUAL_ACTIVE_FILTER },
      {
        $group: {
          _id: {
            context_id: '$context_id',
            schedule_id: '$schedule_id',
            class_id: '$class_id',
            opened_by: '$opened_by',
          },
          count: { $sum: 1 },
          recordIds: { $push: '$_id' },
        },
      },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
    ]).toArray();
    const activeRecordsMissingOwner = await collection
      .find({
        ...MANUAL_ACTIVE_FILTER,
        $or: [
          { opened_by: { $exists: false } },
          { opened_by: null },
        ],
      })
      .project({ _id: 1, context_id: 1, schedule_id: 1, class_id: 1 })
      .toArray();

    const report = {
      mode: execute ? 'execute' : 'dry-run',
      target: {
        environment,
        databaseName: db.databaseName,
        serverHosts,
      },
      collection: COLLECTION,
      existingIndexes: indexes.map(actualIndex),
      indexCandidates: {
        legacyKey: oldCandidates.map(actualIndex),
        newKeyOrReservedName: newCandidates.map(actualIndex),
      },
      conflictingActiveRecords: {
        duplicateOwnerScopedGroups: conflictingGroups,
        missingOpenedBy: activeRecordsMissingOwner,
      },
      plan: {
        old: {
          name: OLD_INDEX_NAME,
          key: OLD_KEY,
          unique: true,
          partialFilterExpression: MANUAL_ACTIVE_FILTER,
          collation: null,
          sparse: false,
          hidden: false,
          expireAfterSeconds: null,
        },
        new: {
          name: NEW_INDEX_NAME,
          key: NEW_KEY,
          unique: true,
          partialFilterExpression: MANUAL_ACTIVE_FILTER,
          collation: null,
          sparse: false,
          hidden: false,
          expireAfterSeconds: null,
        },
        readyToExecute:
          invalidOldCandidates.length === 0
          && invalidNewCandidates.length === 0
          && oldCandidates.length <= 1
          && newCandidates.length <= 1
          && conflictingGroups.length === 0
          && activeRecordsMissingOwner.length === 0,
        operations: [
          approvedNewIndex
            ? `retain exact approved ${NEW_INDEX_NAME}`
            : `create exact approved ${NEW_INDEX_NAME}`,
          approvedOldIndex
            ? `drop exact approved ${OLD_INDEX_NAME}`
            : 'no approved legacy index to drop',
        ],
      },
    };
    console.log(JSON.stringify(report, null, 2));

    if (conflictingGroups.length > 0 || activeRecordsMissingOwner.length > 0) {
      throw new Error(
        'Conflicting or ownerless active manual sessions require data-owner review; no index changes were made.',
      );
    }
    if (
      invalidOldCandidates.length > 0
      || invalidNewCandidates.length > 0
      || oldCandidates.length > 1
      || newCandidates.length > 1
    ) {
      throw new Error(
        'Unexpected legacy/new index candidate definition or duplicate candidate set; no changes were made.',
      );
    }
    if (!execute) return;

    if (!approvedNewIndex) {
      await collection.createIndex(NEW_KEY, {
        name: NEW_INDEX_NAME,
        unique: true,
        partialFilterExpression: MANUAL_ACTIVE_FILTER,
      });
    }

    if (approvedOldIndex?.name) {
      await collection.dropIndex(approvedOldIndex.name);
    }

    const postIndexes = await collection.indexes() as IndexLike[];
    const installedNewIndex = postIndexes.find(
      (index) => index.name === NEW_INDEX_NAME,
    );
    const remainingOldIndexes = postIndexes.filter(
      (index) => sameKey(index.key, OLD_KEY),
    );
    if (!installedNewIndex || remainingOldIndexes.length > 0) {
      throw new Error('Post-migration index verification failed.');
    }
    console.log(JSON.stringify({
      result: 'completed',
      installedIndex: installedNewIndex.name,
      removedLegacyIndexes: approvedOldIndex ? [approvedOldIndex.name] : [],
    }, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
