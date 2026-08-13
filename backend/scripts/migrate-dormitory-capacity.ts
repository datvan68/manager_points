import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import mongoose from 'mongoose';
import { Db } from 'mongodb';

dotenv.config({ path: path.join(__dirname, '../.env') });

export const isProductionConnection = (uri: string, nodeEnv = process.env.NODE_ENV || 'development') =>
  nodeEnv === 'production' || /(?:prod|production|atlas|cluster)/i.test(uri);

export const maskMongoUri = (uri: string) => {
  if (!uri) return '(not configured)';
  try {
    const parsed = new URL(uri);
    if (parsed.username) parsed.username = '***';
    if (parsed.password) parsed.password = '***';
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return '(masked invalid URI)';
  }
};

export type DormitoryCapacityReport = {
  room_code: string;
  building_code: string;
  has_floor_count: boolean;
  declared_beds: number;
  persisted_total: number;
  persisted_free: number;
  persisted_used: number;
  registration_assignments: number;
  active_contracts: number;
  status: string;
  cached_available: number | null;
  has_floor: boolean;
  has_floor_value?: unknown;
  planned_bed_codes?: string[];
  mismatch_categories?: string[];
  missing_expected_codes?: string[];
  protected_beds?: string[];
};

const roomStatus = { empty: 'Trống', full: 'Đầy', locked: 'Khóa', maintenance: 'Bảo trì' };
const bedStatus = { free: 'Trống', used: 'Đang sử dụng' };

const expectedBedCodes = (roomCode: string, count: number) => Array.from({ length: count }, (_, i) => `${roomCode}-G${i + 1}`);

export async function collectCapacityReport(db: Db): Promise<DormitoryCapacityReport[]> {
  const buildings = await db.collection('buildings').find({}, { projection: { building_code: 1, floor_count: 1 } }).toArray();
  const buildingCodes = new Map(buildings.map((building: any) => [String(building._id), { code: building.building_code || '(unknown)', has_floor_count: Object.prototype.hasOwnProperty.call(building, 'floor_count') }]));
  const rooms = await db.collection('rooms').find({}).sort({ room_code: 1 }).toArray();
  const reports: DormitoryCapacityReport[] = [];

  for (const room of rooms as any[]) {
    const beds = await db.collection('beds').find({ room_id: room._id }, { projection: { bed_code: 1, status: 1, has_history: 1 } }).toArray();
    const activeBeds = beds.filter((bed: any) => bed.status !== 'Đã nghỉ');
    const expectedCodes = expectedBedCodes(String(room.room_code || '').trim().toUpperCase(), Number(room.bed_count || 0));
    const activeCodes = new Set(activeBeds.map((bed: any) => String(bed.bed_code || '').toUpperCase()));
    const missingExpectedCodes = expectedCodes.filter((code) => !activeCodes.has(code));
    const registrations = await db.collection('registrations').countDocuments({ room_id: room._id, bed_id: { $exists: true, $ne: null } });
    const contracts = await db.collection('contracts').countDocuments({ room_id: room._id, status: 'Hiệu lực' });
    const mismatch_categories: string[] = [];
    if (Number(room.bed_count || 0) !== activeBeds.length) mismatch_categories.push(activeBeds.length < Number(room.bed_count || 0) ? 'missing_beds' : 'surplus_beds');
    if (missingExpectedCodes.length) mismatch_categories.push('missing_expected_codes');
    if (typeof room.available_bed_count === 'number' && room.available_bed_count !== activeBeds.filter((bed: any) => bed.status === bedStatus.free).length) mismatch_categories.push('cached_available_mismatch');
    if (new Set(activeBeds.map((bed: any) => bed.bed_code)).size !== activeBeds.length) mismatch_categories.push('duplicate_bed_codes');
    if (registrations > activeBeds.filter((bed: any) => bed.status === bedStatus.used).length || contracts > activeBeds.filter((bed: any) => bed.status === bedStatus.used).length) mismatch_categories.push('occupancy_mismatch');
    const protectedBeds = beds.filter((bed: any) => bed.status === bedStatus.used || bed.has_history).map((bed: any) => bed.bed_code);
    if (protectedBeds.length) mismatch_categories.push('protected_occupied_or_history');
    reports.push({
      room_code: room.room_code || '(unknown)',
      building_code: buildingCodes.get(String(room.building_id))?.code || '(unknown)',
      has_floor_count: buildingCodes.get(String(room.building_id))?.has_floor_count || false,
      declared_beds: Number(room.bed_count || 0),
      persisted_total: activeBeds.length,
      persisted_free: activeBeds.filter((bed: any) => bed.status === bedStatus.free).length,
      persisted_used: activeBeds.filter((bed: any) => bed.status === bedStatus.used).length,
      registration_assignments: registrations,
      active_contracts: contracts,
      status: room.status || roomStatus.empty,
      cached_available: typeof room.available_bed_count === 'number' ? room.available_bed_count : null,
      has_floor: Object.prototype.hasOwnProperty.call(room, 'floor'),
      has_floor_value: room.floor,
      planned_bed_codes: missingExpectedCodes,
      mismatch_categories,
      missing_expected_codes: missingExpectedCodes,
      protected_beds: protectedBeds,
    });
  }
  return reports;
}

export const formatReport = (reports: DormitoryCapacityReport[]) => reports.map((report) =>
  `ROOM ${report.room_code} BUILDING ${report.building_code}: declared=${report.declared_beds} persisted=${report.persisted_total} free=${report.persisted_free} used=${report.persisted_used} registrations=${report.registration_assignments} active_contracts=${report.active_contracts} cached_free=${report.cached_available ?? 'null'} floor=${report.has_floor ? 'present' : 'absent'} floor_count=${report.has_floor_count ? 'present' : 'absent'}`,
);

const backupDirectory = () => process.env.DORMITORY_BACKUP_DIR || path.join(process.cwd(), 'output', 'dormitory-capacity-backups');
const backupPath = () => process.env.DORMITORY_BACKUP_MANIFEST || path.join(backupDirectory(), `dormitory-capacity-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

const printReport = (reports: DormitoryCapacityReport[]) => formatReport(reports).forEach((line) => console.log(line));

async function executeForward(db: Db, reports: DormitoryCapacityReport[], uri: string) {
  const manifest = {
    version: 1,
    created_at: new Date().toISOString(),
    database: maskMongoUri(uri),
    rooms: reports,
    buildings: await db.collection('buildings').find({}, { projection: { building_code: 1, floor_count: 1 } }).toArray().then((items: any[]) => items.map((item) => ({ building_code: item.building_code, has_floor_count: Object.prototype.hasOwnProperty.call(item, 'floor_count'), floor_count: item.floor_count }))),
  };
  const manifestText = JSON.stringify(manifest, null, 2);
  fs.mkdirSync(backupDirectory(), { recursive: true });
  fs.writeFileSync(backupPath(), manifestText, 'utf8');
  console.log(`BACKUP manifest=${backupPath()} sha256=${crypto.createHash('sha256').update(manifestText).digest('hex')}`);

  for (const report of reports) {
    const room = await db.collection('rooms').findOne({ room_code: report.room_code });
    if (!room) continue;
    for (const bedCode of report.planned_bed_codes || []) {
      await db.collection('beds').updateOne(
        { room_id: room._id, bed_code: bedCode },
        { $setOnInsert: { room_id: room._id, bed_code: bedCode, position: `Vị trí ${report.persisted_total + (report.planned_bed_codes || []).indexOf(bedCode) + 1}`, status: bedStatus.free } },
        { upsert: true },
      );
    }
    const beds = await db.collection('beds').find({ room_id: room._id }, { projection: { status: 1 } }).toArray();
    const free = beds.filter((bed: any) => bed.status === bedStatus.free).length;
    const protectedStatus = room.status === roomStatus.locked || room.status === roomStatus.maintenance;
    await db.collection('rooms').updateOne(
      { _id: room._id },
      { $set: protectedStatus ? { available_bed_count: free } : { available_bed_count: free, status: free > 0 ? roomStatus.empty : roomStatus.full }, $unset: { floor: '' } },
    );
  }
  await db.collection('buildings').updateMany({}, { $unset: { floor_count: '' } });
}

async function executeRollback(db: Db, manifestFile: string) {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  for (const report of manifest.rooms || []) {
    const room = await db.collection('rooms').findOne({ room_code: report.room_code });
    if (!room) continue;
    if (report.planned_bed_codes?.length) await db.collection('beds').deleteMany({ room_id: room._id, bed_code: { $in: report.planned_bed_codes } });
    const update: any = { $set: { available_bed_count: report.cached_available, status: report.status || room.status } };
    if (report.has_floor) update.$set.floor = report.has_floor_value;
    else update.$unset = { floor: '' };
    await db.collection('rooms').updateOne({ _id: room._id }, update);
  }
  for (const building of manifest.buildings || []) {
    const update: any = building.has_floor_count ? { $set: { floor_count: building.floor_count } } : { $unset: { floor_count: '' } };
    await db.collection('buildings').updateOne({ building_code: building.building_code }, update);
  }
}

export async function runMigration() {
  const execute = process.argv.includes('--execute');
  const rollback = process.argv.includes('--rollback');
  const uri = process.env.MONGO_URI || '';
  console.log(`DATABASE ${maskMongoUri(uri)}`);
  if (isProductionConnection(uri)) throw new Error('Production connection detected; migration is blocked.');
  if (rollback && !execute) throw new Error('Rollback is dry-run only; pass --execute after reviewing the backup manifest.');
  if (execute && !uri) throw new Error('Migration execute is blocked without a non-production MONGO_URI.');
  if (!uri) {
    console.log('[DRY RUN] No MONGO_URI supplied; no database reads or writes performed.');
    return;
  }

  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database handle unavailable');
    if (rollback) {
      const manifestFile = process.env.DORMITORY_BACKUP_MANIFEST;
      if (!manifestFile) throw new Error('DORMITORY_BACKUP_MANIFEST is required for rollback.');
      await executeRollback(db, manifestFile);
      console.log('[EXECUTE] Dormitory capacity rollback completed.');
      return;
    }
    const reports = await collectCapacityReport(db);
    printReport(reports);
    if (!execute) {
      console.log('[DRY RUN] No writes performed. Re-run with --execute only after Gate B approval.');
      return;
    }
    await executeForward(db, reports, uri);
    console.log('[EXECUTE] Dormitory capacity reconciliation completed.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) runMigration().catch((error) => { console.error(error.message); process.exitCode = 1; });
