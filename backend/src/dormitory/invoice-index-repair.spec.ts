import {
  assessInvoiceReadiness,
  buildRepairPlan,
  findLegacyIndex,
  repairInvoiceIndex,
  isProductionConnection,
  LEGACY_INDEX,
  CANONICAL_INDEX,
  ROOM_MONTH_INDEX,
} from '../../scripts/repair-dormitory-invoice-code-index';

const validIndexes = (includeLegacy = true) => [
  { name: '_id_', key: { _id: 1 } },
  ...(includeLegacy
    ? [{ name: LEGACY_INDEX, key: { ma_hoa_don: 1 }, unique: true, sparse: false }]
    : []),
  { name: CANONICAL_INDEX, key: { invoice_code: 1 }, unique: true, sparse: false },
  { name: 'room_id_1', key: { room_id: 1 }, unique: false, sparse: false },
  { name: 'billing_month_1', key: { billing_month: 1 }, unique: false, sparse: false },
  {
    name: ROOM_MONTH_INDEX,
    key: { room_id: 1, billing_month: 1 },
    unique: true,
    sparse: true,
  },
];

const dbFor = (
  indexes: any[],
  options: {
    dropIndex?: jest.Mock;
    missingOrNull?: number;
    duplicateGroups?: Array<{ _id: string; count: number }>;
    afterIndexes?: any[];
  } = {},
) => {
  let callCount = 0;
  const dropIndex = options.dropIndex || jest.fn().mockResolvedValue('dropped');
  const missingOrNullCount = options.missingOrNull ?? 0;
  const duplicateGroups = options.duplicateGroups ?? [];

  return {
    collection: (name: string) => {
      if (name !== 'invoices') throw new Error(`Unexpected collection: ${name}`);
      return {
        indexes: jest.fn().mockImplementation(async () => {
          callCount++;
          if (callCount > 1 && options.afterIndexes) {
            return options.afterIndexes;
          }
          return indexes;
        }),
        aggregate: jest.fn().mockReturnValue({
          toArray: async () => [
            {
              missingOrNull:
                missingOrNullCount > 0 ? [{ count: missingOrNullCount }] : [],
              duplicateGroups: duplicateGroups.map((g) => ({
                _id: g._id,
                count: g.count,
              })),
            },
          ],
        }),
        dropIndex,
      };
    },
  };
};

describe('Dormitory invoice index repair', () => {
  describe('findLegacyIndex', () => {
    it('identifies exact legacy index with name and key', () => {
      const match = findLegacyIndex(validIndexes(true));
      expect(match).toBeDefined();
      expect(match.name).toBe(LEGACY_INDEX);
      expect(match.key).toEqual({ ma_hoa_don: 1 });
    });

    it('returns undefined when legacy index is absent', () => {
      expect(findLegacyIndex(validIndexes(false))).toBeUndefined();
    });

    it('returns undefined when index has legacy name but wrong key', () => {
      const wrongKeyIndexes = [
        { name: LEGACY_INDEX, key: { wrong_field: 1 }, unique: true },
      ];
      expect(findLegacyIndex(wrongKeyIndexes)).toBeUndefined();
    });
  });

  describe('assessInvoiceReadiness', () => {
    it('reports ready when canonical unique and compound unique sparse indexes exist with clean data', () => {
      const readiness = assessInvoiceReadiness(validIndexes(true), {
        missingOrNull: 0,
        duplicateGroups: [],
      });
      expect(readiness.ready).toBe(true);
      expect(readiness.canonicalUnique).toBe(true);
      expect(readiness.roomMonthUniqueSparse).toBe(true);
      expect(readiness.missingOrNullInvoiceCodes).toBe(0);
      expect(readiness.duplicateNonNullInvoiceCodes).toEqual([]);
    });

    it('reports not ready when canonical invoice_code index is missing', () => {
      const indexesWithoutCanonical = validIndexes(true).filter(
        (i) => i.name !== CANONICAL_INDEX,
      );
      const readiness = assessInvoiceReadiness(indexesWithoutCanonical, {
        missingOrNull: 0,
        duplicateGroups: [],
      });
      expect(readiness.ready).toBe(false);
      expect(readiness.canonicalUnique).toBe(false);
    });

    it('reports not ready when canonical invoice_code index is not unique', () => {
      const nonUniqueCanonical = validIndexes(true).map((i) =>
        i.name === CANONICAL_INDEX ? { ...i, unique: false } : i,
      );
      const readiness = assessInvoiceReadiness(nonUniqueCanonical, {
        missingOrNull: 0,
        duplicateGroups: [],
      });
      expect(readiness.ready).toBe(false);
      expect(readiness.canonicalUnique).toBe(false);
    });

    it('reports not ready when room/month compound index is not sparse', () => {
      const nonSparseCompound = validIndexes(true).map((i) =>
        i.name === ROOM_MONTH_INDEX ? { ...i, sparse: false } : i,
      );
      const readiness = assessInvoiceReadiness(nonSparseCompound, {
        missingOrNull: 0,
        duplicateGroups: [],
      });
      expect(readiness.ready).toBe(false);
      expect(readiness.roomMonthUniqueSparse).toBe(false);
    });

    it('reports not ready when there are documents with missing or null invoice_code', () => {
      const readiness = assessInvoiceReadiness(validIndexes(true), {
        missingOrNull: 3,
        duplicateGroups: [],
      });
      expect(readiness.ready).toBe(false);
      expect(readiness.missingOrNullInvoiceCodes).toBe(3);
    });

    it('reports not ready when there are duplicate canonical invoice_code documents', () => {
      const readiness = assessInvoiceReadiness(validIndexes(true), {
        missingOrNull: 0,
        duplicateGroups: [{ invoice_code: 'INV-2026-001', count: 2 }],
      });
      expect(readiness.ready).toBe(false);
      expect(readiness.duplicateNonNullInvoiceCodes).toHaveLength(1);
    });
  });

  describe('buildRepairPlan', () => {
    it('builds a valid drop plan with rollback command on dry-run', () => {
      const report = {
        indexes: validIndexes(true).map((i) => ({
          name: i.name,
          key: i.key,
          unique: i.unique === true,
          sparse: i.sparse === true,
        })),
        legacyIndex: {
          name: LEGACY_INDEX,
          key: { ma_hoa_don: 1 },
          unique: true,
          sparse: false,
        },
        readiness: {
          canonicalUnique: true,
          roomMonthUniqueSparse: true,
          duplicateNonNullInvoiceCodes: [],
          missingOrNullInvoiceCodes: 0,
          ready: true,
        },
      };

      const plan = buildRepairPlan(report, 'dry-run');
      expect(plan.readyToExecute).toBe(true);
      expect(plan.operation).toBe(`dropIndex('${LEGACY_INDEX}')`);
      expect(plan.rollback).toContain(`db.invoices.createIndex`);
      expect(plan.rollback).toContain(LEGACY_INDEX);
      expect(plan.refusal).toBeNull();
      expect(plan.writes).toBe(0);
    });

    it('returns a no-op plan when legacy index is already absent', () => {
      const report = {
        indexes: validIndexes(false).map((i) => ({
          name: i.name,
          key: i.key,
          unique: i.unique === true,
          sparse: i.sparse === true,
        })),
        legacyIndex: null,
        readiness: {
          canonicalUnique: true,
          roomMonthUniqueSparse: true,
          duplicateNonNullInvoiceCodes: [],
          missingOrNullInvoiceCodes: 0,
          ready: true,
        },
      };

      const plan = buildRepairPlan(report, 'dry-run');
      expect(plan.readyToExecute).toBe(true);
      expect(plan.operation).toBeNull();
      expect(plan.rollback).toBeNull();
      expect(plan.refusal).toBeNull();
      expect(plan.result).toBe('no-op');
    });

    it('refuses when legacy index exists with wrong key definition', () => {
      const report = {
        indexes: [
          {
            name: LEGACY_INDEX,
            key: { unexpected_field: 1 },
            unique: true,
            sparse: false,
          },
          {
            name: CANONICAL_INDEX,
            key: { invoice_code: 1 },
            unique: true,
            sparse: false,
          },
          {
            name: ROOM_MONTH_INDEX,
            key: { room_id: 1, billing_month: 1 },
            unique: true,
            sparse: true,
          },
        ],
        legacyIndex: null,
        readiness: {
          canonicalUnique: true,
          roomMonthUniqueSparse: true,
          duplicateNonNullInvoiceCodes: [],
          missingOrNullInvoiceCodes: 0,
          ready: true,
        },
      };

      const plan = buildRepairPlan(report, 'dry-run');
      expect(plan.readyToExecute).toBe(false);
      expect(plan.refusal).toContain('unexpected key definition');
    });
  });

  describe('repairInvoiceIndex execution & safety guards', () => {
    it('dry-run performs zero writes and does not call dropIndex', async () => {
      const dropIndex = jest.fn();
      const db = dbFor(validIndexes(true), { dropIndex });

      const result = await repairInvoiceIndex(db, { execute: false });
      expect(result.mode).toBe('dry-run');
      expect(result.writes).toBe(0);
      expect(dropIndex).not.toHaveBeenCalled();
      expect(result.plan.operation).toBe(`dropIndex('${LEGACY_INDEX}')`);
    });

    it('refuses execution when same-name wrong-key index exists without mutating', async () => {
      const dropIndex = jest.fn();
      const wrongKeyIndexes = [
        { name: LEGACY_INDEX, key: { wrong: 1 }, unique: true, sparse: false },
        { name: CANONICAL_INDEX, key: { invoice_code: 1 }, unique: true, sparse: false },
        { name: ROOM_MONTH_INDEX, key: { room_id: 1, billing_month: 1 }, unique: true, sparse: true },
      ];
      const db = dbFor(wrongKeyIndexes, { dropIndex });

      const result = await repairInvoiceIndex(db, {
        execute: true,
        approved: true,
      });
      expect(result.writes).toBe(0);
      expect(result.plan.refusal).toContain('unexpected key definition');
      expect(dropIndex).not.toHaveBeenCalled();
    });

    it('throws error when execute is called without explicit approval', async () => {
      const db = dbFor(validIndexes(true));
      await expect(
        repairInvoiceIndex(db, { execute: true, approved: false }),
      ).rejects.toThrow('explicit environment approval');
    });

    it('throws error when execute is called on a production-like connection', async () => {
      const db = dbFor(validIndexes(true));
      await expect(
        repairInvoiceIndex(db, {
          execute: true,
          approved: true,
          productionLike: true,
        }),
      ).rejects.toThrow('non-production-like connection');
    });

    it('drops only the verified legacy index and verifies postconditions on approved execute', async () => {
      const dropIndex = jest.fn().mockResolvedValue('dropped');
      const db = dbFor(validIndexes(true), {
        dropIndex,
        afterIndexes: validIndexes(false),
      });

      const result = await repairInvoiceIndex(db, {
        execute: true,
        approved: true,
        productionLike: false,
      });

      expect(dropIndex).toHaveBeenCalledTimes(1);
      expect(dropIndex).toHaveBeenCalledWith(LEGACY_INDEX);
      expect(result.writes).toBe(1);
      expect(result.result).toBe('completed');
      expect(result.after?.legacyIndex).toBeNull();
      expect(result.after?.readiness.canonicalUnique).toBe(true);
      expect(result.after?.readiness.roomMonthUniqueSparse).toBe(true);
    });

    it('is idempotent and returns no-op when legacy index is already absent', async () => {
      const dropIndex = jest.fn();
      const db = dbFor(validIndexes(false), { dropIndex });

      const result = await repairInvoiceIndex(db, {
        execute: true,
        approved: true,
      });

      expect(dropIndex).not.toHaveBeenCalled();
      expect(result.writes).toBe(0);
      expect(result.result).toBe('no-op');
    });
  });

  describe('isProductionConnection guard', () => {
    it('detects production URI patterns or NODE_ENV', () => {
      expect(isProductionConnection('mongodb+srv://prod-cluster.mongodb.net/db')).toBe(true);
      expect(isProductionConnection('mongodb://user:pass@production-db:27017/db')).toBe(true);
      expect(isProductionConnection('mongodb://localhost:27017/dev', 'production')).toBe(true);
      expect(isProductionConnection('mongodb://localhost:27017/manager-point', 'development')).toBe(false);
    });
  });
});
