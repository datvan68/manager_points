import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../.env') });
type Candidate = { room_id: unknown; billing_month: string; electricity?: any; water?: any };

export async function inspectMeterBackfill(db: mongoose.mongo.Db) {
  const invoices = await db.collection<Candidate>('invoices').find({ room_id: { $exists: true, $ne: null }, billing_month: { $type: 'string' }, electricity: { $exists: true }, water: { $exists: true } }, { projection: { room_id: 1, billing_month: 1, electricity: 1, water: 1 } }).toArray();
  const groups = new Map<string, Candidate[]>();
  for (const invoice of invoices) { const key = `${String(invoice.room_id)}:${invoice.billing_month}`; groups.set(key, [...(groups.get(key) || []), invoice]); }
  let created = 0; let skipped = 0; let conflicts = 0; const conflictKeys: string[] = [];
  for (const [key, list] of groups) {
    const readings = new Set(list.map((x) => `${Number(x.electricity?.current_reading ?? 0)}:${Number(x.water?.current_reading ?? 0)}`));
    if (readings.size > 1) { conflicts++; conflictKeys.push(key); continue; }
    const existing = await db.collection('meterreadings').findOne({ room_id: list[0].room_id, billing_month: list[0].billing_month });
    if (existing) skipped++; else created++;
  }
  return { sourceInvoices: invoices.length, candidateGroups: groups.size, created, skipped, conflicts, conflictKeys };
}

async function main() {
  const uri = process.env.MONGO_URI || '';
  if (!uri) { console.log('[DRY RUN] No MONGO_URI supplied; no database reads or writes performed.'); return; }
  if (/prod|production|atlas|cluster/i.test(uri) || process.env.NODE_ENV === 'production') throw new Error('Production connection detected; migration is blocked.');
  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db; if (!db) throw new Error('MongoDB database handle unavailable');
    console.log(`DORMITORY_METER_BACKFILL ${JSON.stringify(await inspectMeterBackfill(db))}`);
    if (process.argv.includes('--execute')) { if (process.env.DORMITORY_METER_BACKFILL_APPROVED !== 'YES') throw new Error('Explicit approval required.'); throw new Error('Execution disabled until reviewed write/rollback procedure is approved.'); }
    console.log('[DRY RUN] No writes performed.');
  } finally { await mongoose.disconnect(); }
}
if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
