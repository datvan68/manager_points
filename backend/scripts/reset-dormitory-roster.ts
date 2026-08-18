import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import mongoose from 'mongoose';
import { DormitoryRosterEntrySchema } from '../src/dormitory/schemas/dormitory-roster-entry.schema';

export const RESET_CONFIRMATION = 'RESET-DORMITORY-ROSTER-DEVELOPMENT';

const legacyCollections = ['registrations', 'publicregistrations'];
const rosterCollection = 'dormitory_roster_entries';

export function assertDevelopmentTarget(env: NodeJS.ProcessEnv = process.env) {
  const uri = env.MONGO_URI || '';
  const nodeEnv = env.NODE_ENV || '';
  const marker = env.DORMITORY_RESET_ENV || '';
  const confirmation = env.DORMITORY_RESET_CONFIRMATION || '';
  if (nodeEnv !== 'development' || marker !== 'development') {
    throw new Error('Reset is blocked: NODE_ENV and DORMITORY_RESET_ENV must both be development.');
  }
  if (!uri || /prod|production|staging/i.test(uri)) {
    throw new Error('Reset is blocked: MONGO_URI is missing or identifies a production/staging target.');
  }
  const parsed = new URL(uri);
  const database = parsed.pathname.replace(/^\//, '');
  if (!database || !/(dev|development|test|local)/i.test(database)) {
    throw new Error('Reset is blocked: database name is not positively identified as development/test/local.');
  }
  if (confirmation !== RESET_CONFIRMATION) {
    throw new Error(`Reset is blocked: set DORMITORY_RESET_CONFIRMATION=${RESET_CONFIRMATION}.`);
  }
  return { host: parsed.hostname, database };
}

function countSummary(value: Record<string, number>) {
  return Object.entries(value).map(([name, count]) => `${name}=${count}`).join(' ');
}

async function writeResetSnapshot(snapshot: {
  target: { host: string; database: string };
  legacy_collections: string[];
  roster_entry_ids: string[];
  legacy_entry_ids: string[];
  contract_ids: string[];
  invoice_ids: string[];
  bed_ids: string[];
  room_ids: string[];
}) {
  const snapshotPath = process.env.DORMITORY_RESET_SNAPSHOT_PATH
    ? resolve(process.env.DORMITORY_RESET_SNAPSHOT_PATH)
    : resolve(__dirname, '../output/dormitory-roster-reset-snapshot.json');
  await mkdir(dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, `${JSON.stringify({ created_at: new Date().toISOString(), ...snapshot }, null, 2)}\n`, 'utf8');
  return snapshotPath;
}

async function main() {
  const target = assertDevelopmentTarget();
  const uri = process.env.MONGO_URI!;
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database handle is unavailable.');
    const collections = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((item) => item.name));
    const existingLegacy = legacyCollections.filter((name) => collections.has(name));
    const roster = collections.has(rosterCollection) ? db.collection(rosterCollection) : null;
    const contracts = db.collection('contracts');
    const invoices = db.collection('invoices');
    const beds = db.collection('beds');
    const rooms = db.collection('rooms');

    const rosterIds = roster ? (await roster.find({}, { projection: { _id: 1 } }).toArray()).map((row) => row._id) : [];
    const legacyIds = (await Promise.all(existingLegacy.map((name) => db.collection(name).find({}, { projection: { _id: 1 } }).toArray()))).flat().map((row) => row._id);
    const disposableIds = [...rosterIds, ...legacyIds];
    const dependentContracts = disposableIds.length
      ? await contracts.find({ $or: [{ roster_entry_id: { $in: disposableIds } }, { registration_id: { $in: disposableIds } }] }).toArray()
      : [];
    const contractIds = dependentContracts.map((contract) => contract._id);
    const dependentInvoices = contractIds.length ? await invoices.find({ contract_id: { $in: contractIds } }, { projection: { _id: 1 } }).toArray() : [];
    const affectedBedIds = dependentContracts.map((contract) => contract.bed_id).filter(Boolean);
    const affectedRoomIds = dependentContracts.map((contract) => contract.room_id).filter(Boolean);
    const snapshotPath = await writeResetSnapshot({
      target,
      legacy_collections: existingLegacy,
      roster_entry_ids: rosterIds.map(String),
      legacy_entry_ids: legacyIds.map(String),
      contract_ids: contractIds.map(String),
      invoice_ids: dependentInvoices.map((row) => String(row._id)),
      bed_ids: affectedBedIds.map(String),
      room_ids: affectedRoomIds.map(String),
    });
    console.log(`target host=${target.host} database=${target.database}`);
    console.log(`preflight ${countSummary({ roster_entries: rosterIds.length, legacy_entries: legacyIds.length, contracts: dependentContracts.length, invoices: dependentInvoices.length, beds: affectedBedIds.length })}`);
    console.log(`snapshot=${snapshotPath}`);

    if (affectedBedIds.length) await beds.updateMany({ _id: { $in: affectedBedIds }, status: 'Đang sử dụng' }, { $set: { status: 'Trống' } });
    if (dependentInvoices.length) await invoices.deleteMany({ _id: { $in: dependentInvoices.map((row) => row._id) } });
    if (contractIds.length) await contracts.deleteMany({ _id: { $in: contractIds } });
    for (const name of existingLegacy) await db.collection(name).drop();
    if (roster) await roster.drop();
    await db.createCollection(rosterCollection);
    const canonical = db.collection(rosterCollection);
    for (const [keys, options] of DormitoryRosterEntrySchema.indexes()) {
      await canonical.createIndex(keys, options);
    }
    const recreatedIndexes = await canonical.listIndexes().toArray();
    const uniqueRooms = [...new Set(affectedRoomIds.map(String))];
    for (const roomId of uniqueRooms) {
      const freeBeds = await beds.countDocuments({ room_id: roomId, status: 'Trống' });
      await rooms.updateOne({ _id: new mongoose.Types.ObjectId(roomId) }, { $set: { available_bed_count: freeBeds } });
    }
    console.log(`reset ${countSummary({ deleted_invoices: dependentInvoices.length, deleted_contracts: dependentContracts.length, dropped_legacy_collections: existingLegacy.length, dropped_roster_entries: rosterIds.length })}`);
    console.log(`indexes=${recreatedIndexes.map((index) => index.name).join(',')}`);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) void main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
