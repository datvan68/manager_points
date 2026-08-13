import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';
import { Db, IndexDescription } from 'mongodb';

dotenv.config({ path: path.join(__dirname, '../.env') });

export const LEGACY_INDEX = 'ma_giuong_1_room_id_1';
export const CANONICAL_INDEX = 'bed_code_1_room_id_1';
const LEGACY_KEY = { ma_giuong: 1, room_id: 1 };
const CANONICAL_KEY = { bed_code: 1, room_id: 1 };

export async function inspectBedIndexes(db: Db) {
  const indexes = await db.collection('beds').indexes();
  const legacy = indexes.find((index) => index.name === LEGACY_INDEX);
  const canonical = indexes.find((index) => index.name === CANONICAL_INDEX);
  return { indexes, legacy, canonical };
}

function sameKey(actual: IndexDescription | undefined, expected: Record<string, number>) {
  return JSON.stringify(actual?.key) === JSON.stringify(expected);
}

export async function removeVerifiedLegacyIndex(db: Db) {
  const state = await inspectBedIndexes(db);
  if (state.legacy && !sameKey(state.legacy, LEGACY_KEY)) {
    throw new Error(`Refusing migration: ${LEGACY_INDEX} has an unexpected key definition.`);
  }
  if (!state.canonical || !sameKey(state.canonical, CANONICAL_KEY) || state.canonical.unique !== true) {
    throw new Error(`Refusing migration: ${CANONICAL_INDEX} is not the reviewed unique canonical index.`);
  }
  if (!state.legacy) return { before: state, after: state, dropped: false };
  await db.collection('beds').dropIndex(LEGACY_INDEX);
  const after = await inspectBedIndexes(db);
  return { before: state, after, dropped: true };
}

export function rollbackCommand(index: IndexDescription) {
  return `db.beds.createIndex(${JSON.stringify(index.key)}, ${JSON.stringify({ name: index.name, unique: index.unique })})`;
}

async function main() {
  const uri = process.env.MONGO_URI || '';
  if (!uri) { console.log('[DRY RUN] No MONGO_URI supplied; no database reads or writes performed.'); return; }
  if (/prod|production|atlas|cluster/i.test(uri) || process.env.NODE_ENV === 'production') throw new Error('Production connection detected; migration is blocked.');
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database handle unavailable');
    const before = await inspectBedIndexes(db);
    console.log(`INDEX BEFORE ${JSON.stringify({ legacy: before.legacy, canonical: before.canonical })}`);
    if (!process.argv.includes('--execute')) { console.log('[DRY RUN] No writes performed.'); return; }
    if (process.env.DORMITORY_MIGRATION_APPROVED !== 'YES') throw new Error('Explicit approval required: set DORMITORY_MIGRATION_APPROVED=YES.');
    const result = await removeVerifiedLegacyIndex(db);
    console.log(`INDEX AFTER ${JSON.stringify({ legacy: result.after.legacy, canonical: result.after.canonical })}`);
    console.log(`ROLLBACK ${rollbackCommand(result.before.legacy || { name: LEGACY_INDEX, key: LEGACY_KEY, unique: true })}`);
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
