import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';
import { Collection, Db } from 'mongodb';
import { DORMITORY_FIELD_RENAMES, FieldRename, ROOT_COLLECTIONS } from './dormitory-field-map';

dotenv.config({ path: path.join(__dirname, '../.env') });

export const isProductionConnection = (uri: string, nodeEnv = process.env.NODE_ENV || 'development') =>
  nodeEnv === 'production' || /(?:prod|production|atlas|cluster)/i.test(uri);

const execute = process.argv.includes('--execute');
const mongoUri = process.env.MONGO_URI || '';

export const operationPath = (rename: FieldRename, rollback = false) => {
  const prefix = rename.collection.includes('.') ? rename.collection.split('.').slice(1).join('.') + '.' : '';
  return {
    from: rollback ? `${prefix}${rename.canonical}` : `${prefix}${rename.legacy}`,
    to: rollback ? `${prefix}${rename.legacy}` : `${prefix}${rename.canonical}`,
  };
};

const hasPath = (doc: Record<string, unknown>, pathName: string) =>
  pathName.split('.').reduce<unknown>((value, key) => (value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined), doc) !== undefined;

export const collisionForDocument = (doc: Record<string, unknown>, rename: FieldRename, rollback = false) => {
  const operation = operationPath(rename, rollback);
  return hasPath(doc, operation.from) && hasPath(doc, operation.to);
};

export const transformedIndexKey = (collectionName: string, key: Record<string, 1 | -1>, rollback = false) => {
  const renames = DORMITORY_FIELD_RENAMES.filter((item) => item.collection === collectionName || item.collection.startsWith(`${collectionName}.`));
  return Object.fromEntries(Object.entries(key).map(([field, direction]) => {
    const match = renames.find((item) => operationPath(item, rollback).from === field);
    return [match ? operationPath(match, rollback).to : field, direction];
  }));
};

const checksum = async (collection: Collection) => {
  const hash = crypto.createHash('sha256');
  let count = 0;
  for await (const doc of collection.find({}, { projection: { _id: 1 } })) {
    hash.update(String(doc._id));
    count += 1;
  }
  return { count, checksum: hash.digest('hex') };
};

const collectionFor = (db: Db, rename: FieldRename) => db.collection(rename.collection.split('.')[0]);

const report = async (db: Db | null, rollback = false) => {
  const lines: string[] = [];
  let collisions = 0;
  for (const collectionName of ROOT_COLLECTIONS) {
    const collection = db?.collection(collectionName);
    if (!collection) {
      lines.push(`${collectionName}: database not connected`);
      continue;
    }
    const before = await checksum(collection);
    lines.push(`${collectionName}: documents=${before.count} checksum=${before.checksum}`);
    for (const index of await collection.listIndexes().toArray()) {
      const transformed = transformedIndexKey(collectionName, index.key as Record<string, 1 | -1>, rollback);
      if (JSON.stringify(transformed) !== JSON.stringify(index.key)) {
        lines.push(`  index ${index.name}: ${JSON.stringify(index.key)} -> ${JSON.stringify(transformed)}`);
      }
    }
    for (const rename of DORMITORY_FIELD_RENAMES.filter((x) => x.collection === collectionName || x.collection.startsWith(`${collectionName}.`))) {
      const operation = operationPath(rename, rollback);
      const query = { [operation.from]: { $exists: true }, [operation.to]: { $exists: true } };
      const count = await collection.countDocuments(query);
      if (count) {
        collisions += count;
        lines.push(`  COLLISION ${operation.from} + ${operation.to}: ${count}`);
      }
      const pending = await collection.countDocuments({ [operation.from]: { $exists: true }, [operation.to]: { $exists: false } });
      if (pending) lines.push(`  rename ${operation.from} -> ${operation.to}: ${pending}`);
    }
  }
  return { lines, collisions };
};

const applyRenames = async (db: Db, rollback = false) => {
  for (const collectionName of ROOT_COLLECTIONS) {
    const collection = db.collection(collectionName);
    const renames = DORMITORY_FIELD_RENAMES.filter((x) => x.collection === collectionName || x.collection.startsWith(`${collectionName}.`));
    // Parent paths first for forward migration, nested paths first for rollback.
    const ordered = [...renames].sort((a, b) => rollback ? b.collection.length - a.collection.length : a.collection.length - b.collection.length);
    for (const rename of ordered) {
      if (rename.collection.endsWith('.items')) continue;
      const operation = operationPath(rename, rollback);
      const collision = { [operation.from]: { $exists: true }, [operation.to]: { $exists: true } };
      if (await collection.countDocuments(collision)) throw new Error(`Collision in ${collectionName}: ${operation.from} and ${operation.to}`);
      await collection.updateMany({ [operation.from]: { $exists: true }, [operation.to]: { $exists: false } }, { $rename: { [operation.from]: operation.to } });
    }
    const arrayRenames = renames.filter((item) => item.collection.endsWith('.items'));
    for (const rename of arrayRenames) {
      const operation = operationPath(rename, rollback);
      const legacy = operation.from.split('.').at(-1)!;
      const canonical = operation.to.split('.').at(-1)!;
      const arrayPath = rename.collection.split('.')[1];
      const collision = { [`${arrayPath}.${legacy}`]: { $exists: true }, [`${arrayPath}.${canonical}`]: { $exists: true } };
      if (await collection.countDocuments(collision)) throw new Error(`Collision in ${collectionName}: ${operation.from} and ${operation.to}`);
      const pipeline = [{
        $set: {
          [arrayPath]: {
            $map: {
              input: { $ifNull: [`$${arrayPath}`, []] },
              as: 'item',
              in: {
                $let: {
                  vars: {
                    withoutLegacy: {
                      $arrayToObject: {
                        $filter: {
                          input: { $objectToArray: '$$item' },
                          as: 'entry',
                          cond: { $ne: ['$$entry.k', legacy] },
                        },
                      },
                    },
                  },
                  in: { $mergeObjects: ['$$withoutLegacy', { [canonical]: `$$item.${legacy}` }] },
                },
              },
            },
          },
        },
      }];
      await collection.updateMany(
        { [`${arrayPath}.${legacy}`]: { $exists: true }, [`${arrayPath}.${canonical}`]: { $exists: false } },
        pipeline,
      );
    }
  }
};

const rebuildIndexes = async (db: Db, rollback = false, dropOnly = false) => {
  for (const collectionName of ROOT_COLLECTIONS) {
    const collection = db.collection(collectionName);
    const indexes = await collection.listIndexes().toArray();
    for (const index of indexes) {
      if (index.name === '_id_') continue;
      const transformed = transformedIndexKey(collectionName, index.key as Record<string, 1 | -1>, rollback);
      if (JSON.stringify(transformed) === JSON.stringify(index.key)) continue;
      await collection.dropIndex(index.name);
      if (!dropOnly) await collection.createIndex(transformed, { name: index.name, unique: index.unique, sparse: index.sparse });
    }
  }
};

export async function runMigration(rollback = process.env.DORMITORY_ROLLBACK === '1') {
  if (execute && (!mongoUri || isProductionConnection(mongoUri))) {
    throw new Error('Migration execute is blocked without a non-production MONGO_URI. Use dry-run first.');
  }
  if (!mongoUri) {
    console.log('[DRY RUN] No MONGO_URI supplied; mapping validation completed without connecting or writing.');
    for (const rename of DORMITORY_FIELD_RENAMES) console.log(`  ${rename.collection}: ${rollback ? rename.canonical : rename.legacy} -> ${rollback ? rename.legacy : rename.canonical}`);
    return;
  }
  if (isProductionConnection(mongoUri)) throw new Error('Production connection detected; migration is blocked.');
  await mongoose.connect(mongoUri);
  try {
    const db = mongoose.connection.db;
    if (!db) throw new Error('MongoDB database handle unavailable');
    const plan = await report(db, rollback);
    for (const line of plan.lines) console.log(line);
    if (plan.collisions) throw new Error(`${plan.collisions} collision(s) detected; no writes performed.`);
    if (!execute) {
      console.log('[DRY RUN] No writes performed. Re-run with --execute only after reviewing this report.');
      return;
    }
    await rebuildIndexes(db, rollback, true);
    await applyRenames(db, rollback);
    await rebuildIndexes(db, rollback);
    const after = await report(db, rollback);
    for (const line of after.lines) console.log(line);
    console.log('[EXECUTE] Dormitory field migration completed.');
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) runMigration().catch((error) => { console.error(error.message); process.exitCode = 1; });
