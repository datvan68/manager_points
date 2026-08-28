import { MongoClient } from 'mongodb';

export const COLLECTION = 'dailyclassreports';
export const LEGACY_INDEX = 'uq_class_date';
export const REPLACEMENT_INDEX = 'idx_class_date';
export const CLASS_DATE_KEY = { class_id: 1, report_date: 1 };

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

export type MigrationPlan = {
  mode: 'dry-run' | 'execute';
  collection: string;
  indexesBefore: IndexLike[];
  legacyIndex: IndexLike | null;
  replacementIndex: IndexLike | null;
  classDateIndexes: IndexLike[];
  blockers: string[];
  operations: string[];
  readyToExecute: boolean;
  result?: 'completed' | 'no-op';
  indexesAfter?: IndexLike[];
};

const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
};

const same = (left: unknown, right: unknown) => canonical(left) === canonical(right);

const hasNoUnsupportedOptions = (index: IndexLike) =>
  index.partialFilterExpression == null &&
  index.collation == null &&
  index.sparse !== true &&
  index.hidden !== true &&
  index.expireAfterSeconds == null;

const isExactIndex = (index: IndexLike | undefined, name: string, unique: boolean) =>
  !!index &&
  index.name === name &&
  same(index.key, CLASS_DATE_KEY) &&
  (index.unique === true) === unique &&
  hasNoUnsupportedOptions(index);

const describe = (index: IndexLike): IndexLike => ({
  name: index.name,
  key: index.key,
  unique: index.unique === true,
  ...(index.partialFilterExpression !== undefined
    ? { partialFilterExpression: index.partialFilterExpression }
    : {}),
  ...(index.collation !== undefined ? { collation: index.collation } : {}),
  ...(index.sparse !== undefined ? { sparse: index.sparse } : {}),
  ...(index.hidden !== undefined ? { hidden: index.hidden } : {}),
  ...(index.expireAfterSeconds !== undefined
    ? { expireAfterSeconds: index.expireAfterSeconds }
    : {}),
});

export function buildMigrationPlan(
  indexes: IndexLike[],
  mode: 'dry-run' | 'execute' = 'dry-run',
): MigrationPlan {
  const namedLegacy = indexes.filter((index) => index.name === LEGACY_INDEX);
  const namedReplacement = indexes.filter((index) => index.name === REPLACEMENT_INDEX);
  const classDateIndexes = indexes.filter((index) => same(index.key, CLASS_DATE_KEY));
  const legacyIndex = namedLegacy.length === 1 && isExactIndex(namedLegacy[0], LEGACY_INDEX, true)
    ? namedLegacy[0]
    : null;
  const replacementIndex = namedReplacement.length === 1 && isExactIndex(namedReplacement[0], REPLACEMENT_INDEX, false)
    ? namedReplacement[0]
    : null;
  const blockers: string[] = [];

  if (namedLegacy.length > 1) blockers.push(`Multiple ${LEGACY_INDEX} indexes found.`);
  if (namedLegacy.length === 1 && !legacyIndex) {
    blockers.push(`${LEGACY_INDEX} exists with an unexpected definition.`);
  }
  if (namedReplacement.length > 1) blockers.push(`Multiple ${REPLACEMENT_INDEX} indexes found.`);
  if (namedReplacement.length === 1 && !replacementIndex) {
    blockers.push(`${REPLACEMENT_INDEX} exists with an unexpected definition.`);
  }

  const unrecognizedClassDateIndexes = classDateIndexes.filter(
    (index) => index.name !== LEGACY_INDEX && index.name !== REPLACEMENT_INDEX,
  );
  if (unrecognizedClassDateIndexes.length > 0) {
    blockers.push('A conflicting class/date index exists.');
  }
  if (legacyIndex && replacementIndex) {
    blockers.push(`Both ${LEGACY_INDEX} and ${REPLACEMENT_INDEX} exist.`);
  }
  if (!legacyIndex && !replacementIndex && blockers.length === 0) {
    blockers.push(`Neither ${LEGACY_INDEX} nor ${REPLACEMENT_INDEX} exists.`);
  }

  const operations = replacementIndex
    ? []
    : [`dropIndex('${LEGACY_INDEX}')`, `createIndex(${JSON.stringify(CLASS_DATE_KEY)}, { name: '${REPLACEMENT_INDEX}' })`];

  return {
    mode,
    collection: COLLECTION,
    indexesBefore: indexes,
    legacyIndex: legacyIndex ? describe(legacyIndex) : null,
    replacementIndex: replacementIndex ? describe(replacementIndex) : null,
    classDateIndexes: classDateIndexes.map(describe),
    blockers,
    operations,
    readyToExecute: blockers.length === 0,
  };
}

export async function runMigration(
  collection: any,
  execute = false,
): Promise<MigrationPlan> {
  const indexesBefore = (await collection.indexes()) as IndexLike[];
  const plan = buildMigrationPlan(indexesBefore, execute ? 'execute' : 'dry-run');

  if (!execute) return plan;
  if (!plan.readyToExecute) {
    throw new Error(`Refusing daily class report index migration: ${plan.blockers.join(' ')}`);
  }
  if (plan.replacementIndex) return { ...plan, result: 'no-op' };

  await collection.dropIndex(LEGACY_INDEX);
  await collection.createIndex(CLASS_DATE_KEY, { name: REPLACEMENT_INDEX });

  const indexesAfter = (await collection.indexes()) as IndexLike[];
  const afterPlan = buildMigrationPlan(indexesAfter, 'execute');
  if (!afterPlan.readyToExecute || !afterPlan.replacementIndex || afterPlan.legacyIndex) {
    throw new Error('Post-migration index verification failed.');
  }

  return { ...plan, indexesAfter, result: 'completed' };
}

const isProductionConnection = (uri: string) =>
  /(?:prod|production|atlas|cluster)/i.test(uri);

const environmentFromArgs = (args: string[]) => {
  const index = args.indexOf('--environment');
  return (
    args.find((arg) => arg.startsWith('--environment='))?.slice('--environment='.length) ||
    (index >= 0 ? args[index + 1] : undefined) ||
    process.env.MIGRATION_ENVIRONMENT
  )?.trim();
};

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(
      'Usage: ts-node scripts/migrate-daily-class-report-class-date-index.ts --environment <label> [--execute]\nDefault: dry-run; --execute requires DAILY_CLASS_REPORT_INDEX_MIGRATION_APPROVED=YES.',
    );
    return;
  }

  const uri = process.env.MONGO_URI?.trim();
  const environment = environmentFromArgs(args);
  const execute = args.includes('--execute');
  if (!environment) throw new Error('--environment or MIGRATION_ENVIRONMENT is required.');
  if (!uri) throw new Error('MONGO_URI is required (no database connection was attempted).');
  if (isProductionConnection(uri)) throw new Error('Production connection detected; migration is blocked.');
  if (execute && process.env.DAILY_CLASS_REPORT_INDEX_MIGRATION_APPROVED !== 'YES') {
    throw new Error('Explicit approval required: set DAILY_CLASS_REPORT_INDEX_MIGRATION_APPROVED=YES.');
  }

  const client = await MongoClient.connect(uri);
  try {
    const db = client.db();
    const report = await runMigration(db.collection(COLLECTION), execute);
    console.log(JSON.stringify({ ...report, target: { environment, databaseName: db.databaseName } }, null, 2));
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
