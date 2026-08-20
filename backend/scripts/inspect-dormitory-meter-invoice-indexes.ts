import * as dotenv from 'dotenv';
import * as path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../.env') });
const canonical = { room_id: 1, billing_month: 1 };
const collections = [
  { name: 'meterreadings', sparse: false },
  { name: 'invoices', sparse: true },
];

export async function inspectDormitoryIndexes(db: any) {
  const report: any[] = [];
  for (const collection of collections) {
    const indexes = await db.collection(collection.name).indexes();
    report.push({
      collection: collection.name,
      expected: { key: canonical, unique: true, sparse: collection.sparse },
      indexes: indexes.map((index: any) => ({ name: index.name, key: index.key, unique: index.unique === true, sparse: index.sparse === true })),
      canonicalMatches: indexes.filter((index: any) => JSON.stringify(index.key) === JSON.stringify(canonical) && index.unique === true && (index.sparse === true) === collection.sparse).length,
    });
  }
  return report;
}

async function main() {
  const uri = process.env.MONGO_URI || '';
  if (!uri) {
    console.log(JSON.stringify({ mode: 'dry-run', databaseReads: 0, writes: 0, message: 'No MONGO_URI supplied.' }, null, 2));
    return;
  }
  await mongoose.connect(uri);
  try {
    console.log(JSON.stringify({ mode: 'dry-run', writes: 0, report: await inspectDormitoryIndexes(mongoose.connection.db) }, null, 2));
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) void main();
