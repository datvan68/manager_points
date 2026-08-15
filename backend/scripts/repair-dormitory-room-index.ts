import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';
import { Collection, Db, IndexDescription } from 'mongodb';

dotenv.config({ path: path.join(__dirname, '../.env') });

export const LEGACY_FIELD = 'ma_phong';
export const LEGACY_INDEX = 'ma_phong_1';
export const CANONICAL_FIELD = 'room_code';
export const CANONICAL_INDEX = 'room_code_1';
const CANONICAL_KEY = { [CANONICAL_FIELD]: 1 };

export type RoomCodeSummary = {
  documents: number;
  missingRoomCode: number;
  duplicateRoomCodes: number;
  duplicateValues: string[];
};

export type RoomIndexPlan = {
  mode: 'dry-run' | 'execute';
  before: IndexDescription[];
  data: RoomCodeSummary;
  legacyIndexes: IndexDescription[];
  canonicalIndexes: IndexDescription[];
  canonicalConflicts: IndexDescription[];
  unsafeFindings: string[];
  plannedChanges: {
    dropLegacyIndexes: string[];
    createCanonicalIndex: boolean;
  };
  readyToExecute: boolean;
  result?: 'completed' | 'no-op';
  after?: IndexDescription[];
};

type RoomCodeDocument = { room_code?: unknown };

export const isProductionConnection = (
  uri: string,
  nodeEnv = process.env.NODE_ENV || 'development',
) => nodeEnv === 'production' || /(?:prod|production|atlas|cluster)/i.test(uri);

const sameKey = (index: IndexDescription, key: Record<string, number>) =>
  JSON.stringify(index.key) === JSON.stringify(key);

const hasField = (index: IndexDescription, field: string) =>
  Boolean(index.key && Object.prototype.hasOwnProperty.call(index.key, field));

export function summarizeRoomCodes(documents: RoomCodeDocument[]): RoomCodeSummary {
  const counts = new Map<string, number>();
  let missingRoomCode = 0;

  for (const document of documents) {
    const value = document.room_code;
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
      missingRoomCode += 1;
      continue;
    }
    const key = typeof value === 'string' ? value : JSON.stringify(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  const duplicateValues = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort();

  return {
    documents: documents.length,
    missingRoomCode,
    duplicateRoomCodes: duplicateValues.length,
    duplicateValues,
  };
}

export function buildRepairPlan(
  indexes: IndexDescription[],
  data: RoomCodeSummary,
  mode: 'dry-run' | 'execute' = 'dry-run',
): RoomIndexPlan {
  const legacyIndexes = indexes.filter((index) => hasField(index, LEGACY_FIELD));
  const canonicalIndexes = indexes.filter((index) => sameKey(index, CANONICAL_KEY));
  const canonicalConflicts = indexes.filter(
    (index) => hasField(index, CANONICAL_FIELD) && !sameKey(index, CANONICAL_KEY),
  );
  const unsafeFindings: string[] = [];

  if (canonicalIndexes.length > 1) {
    unsafeFindings.push(`Multiple exact ${CANONICAL_FIELD} indexes found.`);
  }
  if (canonicalIndexes.length === 1 && canonicalIndexes[0].unique !== true) {
    unsafeFindings.push(`${CANONICAL_INDEX} exists but is not unique.`);
  }
  if (canonicalIndexes.some((index) => index.sparse === true || index.partialFilterExpression !== undefined)) {
    unsafeFindings.push(`${CANONICAL_INDEX} has unsupported index options.`);
  }
  if (canonicalConflicts.length > 0) {
    unsafeFindings.push(`Unexpected ${CANONICAL_FIELD} index definition found.`);
  }
  if (legacyIndexes.some((index) => !index.name)) {
    unsafeFindings.push('A legacy room index is missing its name.');
  }
  if (data.missingRoomCode > 0) {
    unsafeFindings.push(`${data.missingRoomCode} room document(s) have a missing room_code.`);
  }
  if (data.duplicateRoomCodes > 0) {
    unsafeFindings.push(`${data.duplicateRoomCodes} duplicate room_code value(s) found.`);
  }

  const createCanonicalIndex = canonicalIndexes.length === 0;
  const readyToExecute = unsafeFindings.length === 0;

  return {
    mode,
    before: indexes,
    data,
    legacyIndexes,
    canonicalIndexes,
    canonicalConflicts,
    unsafeFindings,
    plannedChanges: {
      dropLegacyIndexes: legacyIndexes.flatMap((index) => index.name ? [index.name] : []),
      createCanonicalIndex,
    },
    readyToExecute,
  };
}

const indexSnapshot = (indexes: IndexDescription[]) =>
  indexes.map((index) => ({
    name: index.name,
    key: index.key,
    unique: index.unique === true,
    sparse: index.sparse === true,
  }));

export async function readRoomCodeSummary(collection: Collection): Promise<RoomCodeSummary> {
  const documents = await collection
    .find({}, { projection: { room_code: 1 } })
    .toArray() as RoomCodeDocument[];
  return summarizeRoomCodes(documents);
}

export async function runMigration(collection: Collection, execute = false): Promise<RoomIndexPlan> {
  const before = await collection.indexes();
  const data = await readRoomCodeSummary(collection);
  const plan = buildRepairPlan(before, data, execute ? 'execute' : 'dry-run');

  console.log(JSON.stringify({
    mode: plan.mode,
    data: plan.data,
    indexesBefore: indexSnapshot(plan.before),
    unsafeFindings: plan.unsafeFindings,
    plannedChanges: plan.plannedChanges,
  }, null, 2));

  if (!execute) return plan;
  if (!plan.readyToExecute) {
    throw new Error(`Refusing room index repair: ${plan.unsafeFindings.join(' ')}`);
  }

  for (const index of plan.legacyIndexes) {
    if (!index.name) throw new Error('Refusing to drop an unnamed legacy room index.');
    await collection.dropIndex(index.name);
  }
  if (plan.plannedChanges.createCanonicalIndex) {
    await collection.createIndex(CANONICAL_KEY, { name: CANONICAL_INDEX, unique: true });
  }

  const after = await collection.indexes();
  const afterPlan = buildRepairPlan(after, data, 'execute');
  if (
    !afterPlan.readyToExecute ||
    afterPlan.legacyIndexes.length > 0 ||
    afterPlan.canonicalIndexes.length !== 1 ||
    afterPlan.canonicalIndexes[0].unique !== true
  ) {
    throw new Error('Post-repair verification failed. Restore the captured index definitions if required.');
  }

  console.log(JSON.stringify({
    mode: 'execute',
    indexesAfter: indexSnapshot(after),
    result: plan.legacyIndexes.length === 0 && !plan.plannedChanges.createCanonicalIndex ? 'no-op' : 'completed',
  }, null, 2));

  return {
    ...plan,
    after,
    result: plan.legacyIndexes.length === 0 && !plan.plannedChanges.createCanonicalIndex ? 'no-op' : 'completed',
  };
}

export async function runAgainstDatabase(db: Db, execute = false): Promise<RoomIndexPlan> {
  return runMigration(db.collection('rooms'), execute);
}

async function main() {
  const execute = process.argv.includes('--execute');
  const uri = process.env.MONGO_URI || '';
  if (!uri) {
    if (execute) throw new Error('Execute is blocked without a non-production MONGO_URI.');
    console.log('[DRY RUN] No MONGO_URI supplied; no database reads or writes performed.');
    return;
  }
  if (isProductionConnection(uri)) throw new Error('Production connection detected; migration is blocked.');
  if (execute && process.env.DORMITORY_MIGRATION_APPROVED !== 'YES') {
    throw new Error('Explicit approval required: set DORMITORY_MIGRATION_APPROVED=YES.');
  }

  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database handle unavailable.');
    await runAgainstDatabase(db, execute);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
