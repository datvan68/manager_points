import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';
import { Db } from 'mongodb';

dotenv.config({ path: path.join(__dirname, '../.env') });

export const LEGACY_FIELD = 'ma_hoa_don';
export const LEGACY_INDEX = 'ma_hoa_don_1';
export const LEGACY_KEY = { ma_hoa_don: 1 };

export const CANONICAL_FIELD = 'invoice_code';
export const CANONICAL_INDEX = 'invoice_code_1';
export const INVOICE_CODE_INDEX = CANONICAL_INDEX;
export const CANONICAL_KEY = { invoice_code: 1 };

export const ROOM_MONTH_KEY = { room_id: 1, billing_month: 1 };
export const ROOM_MONTH_INDEX = 'room_id_1_billing_month_1';

export type InvoiceIndexSnapshot = {
  name: string;
  key: Record<string, any>;
  unique: boolean;
  sparse: boolean;
};

export type InvoiceReadinessStats = {
  missingOrNull: number;
  duplicateGroups: Array<{ invoice_code: any; count: number }>;
};

export type InvoiceReadiness = {
  canonicalUnique: boolean;
  roomMonthUniqueSparse: boolean;
  duplicateNonNullInvoiceCodes: Array<{ invoice_code: any; count: number }>;
  missingOrNullInvoiceCodes: number;
  ready: boolean;
};

export type InvoiceRepairPlan = {
  mode: 'dry-run' | 'execute';
  indexesBefore: InvoiceIndexSnapshot[];
  legacyIndex: InvoiceIndexSnapshot | null;
  canonicalIndex: InvoiceIndexSnapshot | null;
  roomMonthIndex: InvoiceIndexSnapshot | null;
  readiness: InvoiceReadiness;
  operation: string | null;
  rollback: string | null;
  refusal: string | null;
  readyToExecute: boolean;
  writes: number;
  after?: InvoiceIndexSnapshot[];
  result?: 'completed' | 'no-op';
};

export const isProductionConnection = (
  uri: string,
  nodeEnv = process.env.NODE_ENV || 'development',
) => nodeEnv === 'production' || /(?:prod|production|atlas|cluster)/i.test(uri);

export const sameKey = (a: any, b: any) =>
  JSON.stringify(a) === JSON.stringify(b);

export const publicIndex = (i: any): InvoiceIndexSnapshot => ({
  name: i.name || '',
  key: i.key || {},
  unique: i.unique === true,
  sparse: i.sparse === true,
});

export function findLegacyIndex(indexes: any[]): any {
  return indexes.find(
    (i) => i.name === LEGACY_INDEX && sameKey(i.key, LEGACY_KEY),
  );
}

export function assessInvoiceReadiness(
  indexes: any[],
  stats: InvoiceReadinessStats,
): InvoiceReadiness {
  const canonical = indexes.find((i) => i.name === CANONICAL_INDEX);
  const roomMonth = indexes.find(
    (i) => sameKey(i.key, ROOM_MONTH_KEY) && i.unique === true && i.sparse === true,
  );
  const canonicalUnique =
    !!canonical &&
    sameKey(canonical.key, CANONICAL_KEY) &&
    canonical.unique === true;
  const roomMonthUniqueSparse = !!roomMonth;
  const ready =
    stats.missingOrNull === 0 &&
    stats.duplicateGroups.length === 0 &&
    canonicalUnique &&
    roomMonthUniqueSparse;

  return {
    canonicalUnique,
    roomMonthUniqueSparse,
    duplicateNonNullInvoiceCodes: stats.duplicateGroups,
    missingOrNullInvoiceCodes: stats.missingOrNull,
    ready,
  };
}

export async function inspectInvoiceIndexes(db: any) {
  const indexes = await db.collection('invoices').indexes();
  const rows = await db
    .collection('invoices')
    .aggregate([
      { $group: { _id: '$invoice_code', count: { $sum: 1 } } },
      {
        $facet: {
          missingOrNull: [
            { $match: { _id: null } },
            { $count: 'count' },
          ],
          duplicateGroups: [
            { $match: { _id: { $ne: null }, count: { $gt: 1 } } },
          ],
        },
      },
    ])
    .toArray();

  const aggregate = rows[0] || {};
  const stats: InvoiceReadinessStats = {
    missingOrNull: aggregate.missingOrNull?.[0]?.count || 0,
    duplicateGroups: (aggregate.duplicateGroups || []).map((g: any) => ({
      invoice_code: g._id,
      count: g.count,
    })),
  };

  const rawLegacy = findLegacyIndex(indexes);
  return {
    indexes: indexes.map(publicIndex),
    legacyIndex: rawLegacy ? publicIndex(rawLegacy) : null,
    readiness: assessInvoiceReadiness(indexes, stats),
  };
}

export function buildRepairPlan(
  report: {
    indexes: InvoiceIndexSnapshot[];
    legacyIndex: InvoiceIndexSnapshot | null;
    readiness: InvoiceReadiness;
  },
  mode: 'dry-run' | 'execute' = 'dry-run',
): InvoiceRepairPlan {
  const canonical = report.indexes.find((i) => i.name === CANONICAL_INDEX) || null;
  const roomMonth =
    report.indexes.find(
      (i) => sameKey(i.key, ROOM_MONTH_KEY) && i.unique === true && i.sparse === true,
    ) || null;

  const namedWrongKey =
    report.indexes.some((i) => i.name === LEGACY_INDEX) && !report.legacyIndex;

  let refusal: string | null = null;
  if (namedWrongKey) {
    refusal = `Index ${LEGACY_INDEX} exists with an unexpected key definition; refusing to mutate.`;
  } else if (!report.readiness.canonicalUnique) {
    refusal = `Canonical index ${CANONICAL_INDEX} is missing or not unique.`;
  } else if (!report.readiness.roomMonthUniqueSparse) {
    refusal = `Compound index ${ROOM_MONTH_INDEX} is missing or not unique sparse.`;
  } else if (report.readiness.missingOrNullInvoiceCodes > 0) {
    refusal = `${report.readiness.missingOrNullInvoiceCodes} document(s) have missing or null invoice_code.`;
  } else if (report.readiness.duplicateNonNullInvoiceCodes.length > 0) {
    refusal = `${report.readiness.duplicateNonNullInvoiceCodes.length} duplicate non-null invoice_code value(s) found.`;
  }

  const readyToExecute = !refusal;
  const operation =
    report.legacyIndex && readyToExecute ? `dropIndex('${LEGACY_INDEX}')` : null;
  const rollback = report.legacyIndex
    ? `db.invoices.createIndex(${JSON.stringify(report.legacyIndex.key)}, { name: '${LEGACY_INDEX}', unique: true })`
    : null;

  return {
    mode,
    indexesBefore: report.indexes,
    legacyIndex: report.legacyIndex,
    canonicalIndex: canonical,
    roomMonthIndex: roomMonth,
    readiness: report.readiness,
    operation,
    rollback,
    refusal,
    readyToExecute,
    writes: 0,
    result: !report.legacyIndex && readyToExecute ? 'no-op' : undefined,
  };
}

export async function repairInvoiceIndex(
  db: any,
  options: {
    execute?: boolean;
    approved?: boolean;
    productionLike?: boolean;
  } = {},
) {
  const report = await inspectInvoiceIndexes(db);
  const plan = buildRepairPlan(report, options.execute ? 'execute' : 'dry-run');

  if (!options.execute) {
    return {
      mode: 'dry-run' as const,
      report,
      plan,
      writes: 0,
    };
  }

  if (plan.refusal) {
    return {
      mode: 'execute' as const,
      report,
      plan,
      writes: 0,
    };
  }

  if (!report.legacyIndex) {
    return {
      mode: 'execute' as const,
      report,
      plan: { ...plan, result: 'no-op' as const },
      writes: 0,
      result: 'no-op' as const,
    };
  }

  if (!options.approved || options.productionLike) {
    throw new Error(
      'Execute requires explicit environment approval (DORMITORY_INVOICE_INDEX_REPAIR_APPROVED=YES) and a non-production-like connection.',
    );
  }

  await db.collection('invoices').dropIndex(LEGACY_INDEX);

  const after = await inspectInvoiceIndexes(db);
  const afterLegacy = after.legacyIndex;
  if (afterLegacy || !after.readiness.canonicalUnique || !after.readiness.roomMonthUniqueSparse) {
    throw new Error(
      'Post-repair verification failed. Rollback command: ' + (plan.rollback || 'N/A'),
    );
  }

  return {
    mode: 'execute' as const,
    report,
    plan: { ...plan, writes: 1, result: 'completed' as const },
    after,
    writes: 1,
    result: 'completed' as const,
  };
}

export async function runAgainstDatabase(db: Db, execute = false) {
  const isApproved =
    process.env.DORMITORY_INVOICE_INDEX_REPAIR_APPROVED === 'YES' ||
    process.env.DORMITORY_INVOICE_INDEX_REPAIR_APPROVED === 'true' ||
    process.env.DORMITORY_MIGRATION_APPROVED === 'YES';

  return repairInvoiceIndex(db, {
    execute,
    approved: isApproved,
    productionLike:
      process.env.NODE_ENV === 'production' ||
      isProductionConnection(process.env.MONGO_URI || ''),
  });
}

async function main() {
  const execute = process.argv.includes('--execute');
  const uri = process.env.MONGO_URI || '';

  if (!uri) {
    if (execute) {
      throw new Error('Execute is blocked without a non-production MONGO_URI.');
    }
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          writes: 0,
          message: 'No MONGO_URI supplied; no database reads or writes performed.',
        },
        null,
        2,
      ),
    );
    return;
  }

  if (isProductionConnection(uri)) {
    throw new Error('Production connection detected; index repair is blocked.');
  }

  const isApproved =
    process.env.DORMITORY_INVOICE_INDEX_REPAIR_APPROVED === 'YES' ||
    process.env.DORMITORY_INVOICE_INDEX_REPAIR_APPROVED === 'true' ||
    process.env.DORMITORY_MIGRATION_APPROVED === 'YES';

  if (execute && !isApproved) {
    throw new Error(
      'Explicit approval required: set DORMITORY_INVOICE_INDEX_REPAIR_APPROVED=YES.',
    );
  }

  await mongoose.connect(uri);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database handle unavailable.');
    const result = await runAgainstDatabase(db, execute);
    console.log(JSON.stringify(result, null, 2));
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
