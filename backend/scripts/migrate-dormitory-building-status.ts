import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../.env') });

export const APPROVED_STATUS_VALUES = ['Trống', 'Đầy'] as const;
export const PROPOSED_MAPPING = { Active: 'Trống' } as const;

export function planBuildingStatusMigration(rows: Array<{ _id?: unknown; status?: string }>) {
  const counts: Record<string, number> = {};
  const ids: Record<string, string[]> = {};
  for (const row of rows) {
    const value = String(row.status ?? '<missing>');
    counts[value] = (counts[value] || 0) + 1;
    (ids[value] ||= []).push(String(row._id ?? ''));
  }
  const unapproved = Object.keys(counts).filter((value) => !APPROVED_STATUS_VALUES.includes(value as any) && !(value in PROPOSED_MAPPING));
  return { counts, ids, proposedMapping: PROPOSED_MAPPING, unapproved, canExecute: unapproved.length === 0 };
}

async function main() {
  const uri = process.env.MONGO_URI || '';
  if (!uri) { console.log('[DRY RUN] No MONGO_URI supplied; no database reads or writes performed.'); return; }
  if (/prod|production|atlas|cluster/i.test(uri) || process.env.NODE_ENV === 'production') throw new Error('Production connection detected; migration is blocked.');
  await mongoose.connect(uri);
  try {
    const rows = await mongoose.connection.db!.collection('buildings').find({}, { projection: { _id: 1, status: 1 } }).toArray();
    const plan = planBuildingStatusMigration(rows);
    console.log(`BUILDING STATUS DRY RUN ${JSON.stringify(plan)}`);
    if (plan.unapproved.length) throw new Error(`Unapproved building statuses found: ${plan.unapproved.join(', ')}`);
    if (!process.argv.includes('--execute')) { console.log('[DRY RUN] No writes performed.'); return; }
    if (process.env.DORMITORY_STATUS_MIGRATION_APPROVED !== 'YES') throw new Error('Explicit approval required: set DORMITORY_STATUS_MIGRATION_APPROVED=YES.');
    for (const [from, to] of Object.entries(PROPOSED_MAPPING)) await mongoose.connection.db!.collection('buildings').updateMany({ status: from }, { $set: { status: to } });
    console.log('BUILDING STATUS MIGRATION COMPLETE');
  } finally { await mongoose.disconnect(); }
}

if (require.main === module) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
