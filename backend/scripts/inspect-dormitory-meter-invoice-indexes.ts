import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';
import {
  assessInvoiceReadiness,
  buildRepairPlan,
  findLegacyIndex,
  inspectInvoiceIndexes,
  isProductionConnection,
  publicIndex,
  repairInvoiceIndex,
  sameKey,
  INVOICE_CODE_INDEX,
  LEGACY_FIELD,
  LEGACY_INDEX,
  LEGACY_KEY,
  ROOM_MONTH_INDEX,
  ROOM_MONTH_KEY,
} from './repair-dormitory-invoice-code-index';

export {
  assessInvoiceReadiness,
  buildRepairPlan,
  findLegacyIndex,
  inspectInvoiceIndexes,
  isProductionConnection,
  publicIndex,
  repairInvoiceIndex,
  sameKey,
  INVOICE_CODE_INDEX,
  LEGACY_FIELD,
  LEGACY_INDEX,
  LEGACY_KEY,
  ROOM_MONTH_INDEX,
  ROOM_MONTH_KEY,
};

dotenv.config({ path: path.join(__dirname, '../.env') });

export async function inspectDormitoryIndexes(db: any) {
  const report: any[] = [];
  for (const collection of [
    { name: 'meterreadings', sparse: false },
    { name: 'invoices', sparse: true },
  ]) {
    const indexes = await db.collection(collection.name).indexes();
    report.push({
      collection: collection.name,
      expected: {
        key: ROOM_MONTH_KEY,
        unique: true,
        sparse: collection.sparse,
      },
      indexes: indexes.map(publicIndex),
      canonicalMatches: indexes.filter(
        (i: any) =>
          sameKey(i.key, ROOM_MONTH_KEY) &&
          i.unique === true &&
          (i.sparse === true) === collection.sparse,
      ).length,
    });
  }
  return report;
}

async function main() {
  const uri = process.env.MONGO_URI || '';
  if (!uri) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          writes: 0,
          message: 'No MONGO_URI supplied; no database reads performed.',
        },
        null,
        2,
      ),
    );
    return;
  }

  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database handle unavailable.');

    const invoiceReport = await inspectInvoiceIndexes(db);
    const plan = buildRepairPlan(invoiceReport, 'dry-run');
    const dormitoryIndexes = await inspectDormitoryIndexes(db);

    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          report: invoiceReport,
          plan,
          writes: 0,
          dormitoryIndexes,
        },
        null,
        2,
      ),
    );
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
