import mongoose from 'mongoose';
import { Collection, Db, IndexDescription } from 'mongodb';

export const COLLECTION_NAME = 'publicregistrations';
export const LEGACY_FIELD = 'ma_dk_public';
export const CANONICAL_FIELD = 'public_registration_code';
export const CANONICAL_INDEX = 'public_registration_code_1';

const LEGACY_KEY = { [LEGACY_FIELD]: 1 };
const CANONICAL_KEY = { [CANONICAL_FIELD]: 1 };
const INDEX_METADATA_FIELDS = new Set(['v', 'ns', 'key', 'name']);
const UNSAFE_INDEX_OPTION_FIELDS = [
  'sparse',
  'partialFilterExpression',
  'collation',
  'expireAfterSeconds',
  'hidden',
  'wildcardProjection',
  'weights',
  'default_language',
  'language_override',
  'textIndexVersion',
  '2dsphereIndexVersion',
  'bits',
  'min',
  'max',
  'bucketSize',
];

export type RegistrationCodeSummary = {
  totalDocuments: number;
  legacyOnly: number;
  canonicalOnly: number;
  bothFields: number;
  missingOrBlankCanonical: number;
  duplicateCanonicalGroups: number;
};

export type RegistrationCodeDocument = {
  [LEGACY_FIELD]?: unknown;
  [CANONICAL_FIELD]?: unknown;
};

export type PublicRegistrationIndexPlan = {
  mode: 'dry-run' | 'execute';
  before: IndexDescription[];
  data: RegistrationCodeSummary;
  legacyIndexes: IndexDescription[];
  legacyConflicts: IndexDescription[];
  canonicalIndexes: IndexDescription[];
  canonicalConflicts: IndexDescription[];
  unsafeFindings: string[];
  plannedChanges: {
    dropLegacyIndexes: string[];
    createCanonicalIndex: boolean;
  };
  restoreCommands: string[];
  readyToExecute: boolean;
  result?: 'completed' | 'no-op';
  after?: IndexDescription[];
};

export const isProductionConnection = (
  uri: string,
  nodeEnv = process.env.NODE_ENV || 'development',
) => nodeEnv === 'production' || /(?:prod|production|atlas|cluster)/i.test(uri);

const hasOwnField = (document: RegistrationCodeDocument, field: string) =>
  Object.prototype.hasOwnProperty.call(document, field);

const isNonBlankCanonicalCode = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const sameKey = (index: IndexDescription, key: Record<string, number>) => {
  const entries = index.key ? Object.entries(index.key) : [];
  const expectedEntries = Object.entries(key);
  return entries.length === expectedEntries.length && entries.every(
    ([field, direction], position) =>
      field === expectedEntries[position][0] && direction === expectedEntries[position][1],
  );
};

const hasKeyField = (index: IndexDescription, field: string) =>
  Boolean(index.key && Object.prototype.hasOwnProperty.call(index.key, field));

const hasUnsafeOptions = (index: IndexDescription) => {
  const values = index as unknown as Record<string, unknown>;
  const hasUnknownOption = Object.entries(values).some(([field, value]) =>
    !INDEX_METADATA_FIELDS.has(field) &&
    field !== 'unique' &&
    !UNSAFE_INDEX_OPTION_FIELDS.includes(field) &&
    value !== undefined,
  );
  return hasUnknownOption || UNSAFE_INDEX_OPTION_FIELDS.some((field) => {
    const value = values[field];
    return value !== undefined && value !== false;
  });
};

const isSafeSingleFieldIndex = (index: IndexDescription) =>
  index.unique === true && !hasUnsafeOptions(index);

const indexCreationOptions = (index: IndexDescription) => {
  const values = index as unknown as Record<string, unknown>;
  const options: Record<string, unknown> = {};
  for (const field of [
    'name',
    'unique',
    ...UNSAFE_INDEX_OPTION_FIELDS,
  ]) {
    if (values[field] !== undefined) options[field] = values[field];
  }
  for (const [field, value] of Object.entries(values)) {
    if (!INDEX_METADATA_FIELDS.has(field) && value !== undefined) options[field] ??= value;
  }
  return options;
};

export function restoreIndexCommands(indexes: IndexDescription[]): string[] {
  return indexes
    .filter((index) => index.name && index.name !== '_id_')
    .map((index) => `db.${COLLECTION_NAME}.createIndex(${JSON.stringify(index.key)}, ${JSON.stringify(indexCreationOptions(index))})`);
}

export function summarizeRegistrationCodes(
  documents: RegistrationCodeDocument[],
): RegistrationCodeSummary {
  const counts = new Map<string, number>();
  let legacyOnly = 0;
  let canonicalOnly = 0;
  let bothFields = 0;
  let missingOrBlankCanonical = 0;

  for (const document of documents) {
    const hasLegacy = hasOwnField(document, LEGACY_FIELD);
    const hasCanonical = hasOwnField(document, CANONICAL_FIELD);

    if (hasLegacy && hasCanonical) bothFields += 1;
    else if (hasLegacy) legacyOnly += 1;
    else if (hasCanonical) canonicalOnly += 1;

    const code = document[CANONICAL_FIELD];
    if (!isNonBlankCanonicalCode(code)) {
      missingOrBlankCanonical += 1;
      continue;
    }
    counts.set(code, (counts.get(code) || 0) + 1);
  }

  const duplicateCanonicalGroups = [...counts.values()].filter((count) => count > 1).length;

  return {
    totalDocuments: documents.length,
    legacyOnly,
    canonicalOnly,
    bothFields,
    missingOrBlankCanonical,
    duplicateCanonicalGroups,
  };
}

export function buildRepairPlan(
  indexes: IndexDescription[],
  data: RegistrationCodeSummary,
  mode: 'dry-run' | 'execute' = 'dry-run',
): PublicRegistrationIndexPlan {
  const legacyIndexes = indexes.filter((index) => sameKey(index, LEGACY_KEY));
  const legacyConflicts = indexes.filter(
    (index) => hasKeyField(index, LEGACY_FIELD) && !sameKey(index, LEGACY_KEY),
  );
  const canonicalIndexes = indexes.filter((index) => sameKey(index, CANONICAL_KEY));
  const canonicalConflicts = indexes.filter(
    (index) => hasKeyField(index, CANONICAL_FIELD) && !sameKey(index, CANONICAL_KEY),
  );
  const unsafeFindings: string[] = [];

  if (legacyConflicts.length > 0) {
    unsafeFindings.push('Unexpected compound or non-ascending legacy index definition found.');
  }
  for (const index of legacyIndexes) {
    if (!index.name) unsafeFindings.push('A legacy index is missing its name.');
    if (!isSafeSingleFieldIndex(index)) {
      unsafeFindings.push('A legacy index has unexpected options or is not unique.');
    }
  }

  if (canonicalIndexes.length > 1) {
    unsafeFindings.push('Multiple exact canonical indexes found.');
  }
  if (canonicalIndexes.length === 1 && !isSafeSingleFieldIndex(canonicalIndexes[0])) {
    unsafeFindings.push('The exact canonical index is not a plain unique index.');
  }
  if (canonicalConflicts.length > 0) {
    unsafeFindings.push('Unexpected compound or non-ascending canonical index definition found.');
  }

  if (data.legacyOnly > 0) {
    unsafeFindings.push(`${data.legacyOnly} document(s) still contain only the legacy registration field.`);
  }
  if (data.bothFields > 0) {
    unsafeFindings.push(`${data.bothFields} document(s) contain both registration fields.`);
  }
  if (data.missingOrBlankCanonical > 0) {
    unsafeFindings.push(`${data.missingOrBlankCanonical} document(s) have a missing or blank canonical registration code.`);
  }
  if (data.duplicateCanonicalGroups > 0) {
    unsafeFindings.push(`${data.duplicateCanonicalGroups} duplicate canonical registration-code group(s) found.`);
  }

  const createCanonicalIndex = canonicalIndexes.length === 0;
  const readyToExecute = unsafeFindings.length === 0;

  return {
    mode,
    before: indexes,
    data,
    legacyIndexes,
    legacyConflicts,
    canonicalIndexes,
    canonicalConflicts,
    unsafeFindings,
    plannedChanges: {
      dropLegacyIndexes: legacyIndexes.flatMap((index) => index.name ? [index.name] : []),
      createCanonicalIndex,
    },
    restoreCommands: restoreIndexCommands(legacyIndexes),
    readyToExecute,
  };
}

const indexSnapshot = (indexes: IndexDescription[]) => indexes.map((index) => ({
  name: index.name,
  key: index.key,
  unique: index.unique === true,
  sparse: index.sparse === true,
  hasPartialFilter: index.partialFilterExpression !== undefined,
}));

const logPlan = (plan: PublicRegistrationIndexPlan) => {
  console.log(JSON.stringify({
    mode: plan.mode,
    data: plan.data,
    indexesBefore: indexSnapshot(plan.before),
    unsafeFindings: plan.unsafeFindings,
    plannedChanges: plan.plannedChanges,
    restoreCommands: plan.restoreCommands,
  }, null, 2));
};

export async function readRegistrationCodeSummary(
  collection: Collection,
): Promise<RegistrationCodeSummary> {
  const documents = await collection.find(
    {},
    { projection: { _id: 0, [LEGACY_FIELD]: 1, [CANONICAL_FIELD]: 1 } },
  ).toArray() as RegistrationCodeDocument[];
  return summarizeRegistrationCodes(documents);
}

const assertCanonicalIndex = (indexes: IndexDescription[]) => {
  const plan = buildRepairPlan(indexes, {
    totalDocuments: 0,
    legacyOnly: 0,
    canonicalOnly: 0,
    bothFields: 0,
    missingOrBlankCanonical: 0,
    duplicateCanonicalGroups: 0,
  }, 'execute');
  if (
    plan.canonicalIndexes.length !== 1 ||
    !isSafeSingleFieldIndex(plan.canonicalIndexes[0]) ||
    plan.canonicalConflicts.length > 0
  ) {
    throw new Error('Canonical unique index validation failed; the legacy index was not dropped.');
  }
};

export async function runMigration(
  collection: Collection,
  execute = false,
): Promise<PublicRegistrationIndexPlan> {
  if (execute) assertExecutionEnvironment();
  const before = await collection.indexes();
  const data = await readRegistrationCodeSummary(collection);
  const plan = buildRepairPlan(before, data, execute ? 'execute' : 'dry-run');
  logPlan(plan);

  if (!execute) return plan;
  if (!plan.readyToExecute) {
    throw new Error(`Refusing public registration index repair: ${plan.unsafeFindings.join(' ')}`);
  }

  if (plan.legacyIndexes.length === 0 && !plan.plannedChanges.createCanonicalIndex) {
    return { ...plan, result: 'no-op', after: before };
  }

  if (plan.plannedChanges.createCanonicalIndex) {
    await collection.createIndex(CANONICAL_KEY, { name: CANONICAL_INDEX, unique: true });
  }

  // Re-read after creation (or before dropping an existing canonical index) so a
  // failed/altered canonical definition can never permit the legacy drop.
  const canonicalCheck = await collection.indexes();
  assertCanonicalIndex(canonicalCheck);

  // Re-read the code-field projection immediately before dropping any legacy
  // index so a concurrent document change fails closed instead of weakening
  // the canonical uniqueness repair.
  const latestData = await readRegistrationCodeSummary(collection);
  const latestPlan = buildRepairPlan(canonicalCheck, latestData, 'execute');
  if (!latestPlan.readyToExecute) {
    throw new Error(`Refusing public registration index repair after re-check: ${latestPlan.unsafeFindings.join(' ')}`);
  }

  for (const index of plan.legacyIndexes) {
    if (!index.name) throw new Error('Refusing to drop an unnamed legacy index.');
    await collection.dropIndex(index.name);
  }

  const after = await collection.indexes();
  const afterPlan = buildRepairPlan(after, data, 'execute');
  const remainingLegacyKey = after.some((index) => hasKeyField(index, LEGACY_FIELD));
  if (
    !afterPlan.readyToExecute ||
    remainingLegacyKey ||
    afterPlan.canonicalIndexes.length !== 1 ||
    !isSafeSingleFieldIndex(afterPlan.canonicalIndexes[0])
  ) {
    throw new Error('Post-repair verification failed. Restore the captured legacy index definitions if required.');
  }

  console.log(JSON.stringify({
    mode: 'execute',
    indexesAfter: indexSnapshot(after),
    result: 'completed',
  }, null, 2));
  return { ...plan, after, result: 'completed' };
}

export async function runAgainstDatabase(
  db: Db,
  execute = false,
): Promise<PublicRegistrationIndexPlan> {
  return runMigration(db.collection(COLLECTION_NAME), execute);
}

export function assertExecutionEnvironment() {
  const uri = process.env.MONGO_URI || '';
  if (!uri) throw new Error('Execute is blocked without a non-production MONGO_URI.');
  if (isProductionConnection(uri)) throw new Error('Production connection detected; migration is blocked.');
  if (process.env.DORMITORY_MIGRATION_APPROVED !== 'YES') {
    throw new Error('Explicit approval required: set DORMITORY_MIGRATION_APPROVED=YES.');
  }
}

async function main() {
  const execute = process.argv.includes('--execute');
  const uri = process.env.MONGO_URI || '';

  if (!uri) {
    if (execute) assertExecutionEnvironment();
    console.log('[DRY RUN] No MONGO_URI supplied; no database reads or writes performed.');
    return;
  }
  if (!execute && isProductionConnection(uri)) throw new Error('Production connection detected; migration is blocked.');
  if (execute) assertExecutionEnvironment();

  try {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database handle unavailable.');
    await runAgainstDatabase(db, execute);
  } finally {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
