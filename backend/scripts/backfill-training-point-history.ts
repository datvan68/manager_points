import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AppModule } from '../src/app.module';

type Counts = { scanned: number; repaired: number; skipped: number; mismatched: number };

const sameValue = (left: unknown, right: unknown) => {
  if (left instanceof Date || right instanceof Date) return new Date(left as any).getTime() === new Date(right as any).getTime();
  return left?.toString() === right?.toString();
};

async function main() {
  const execute = process.argv.slice(2).includes('--execute');
  const app = await NestFactory.createApplicationContext(AppModule);
  const connection: Connection = app.get(getConnectionToken());
  const db = connection.db;
  if (!db) throw new Error('Could not get raw MongoDB database reference');

  const counts: Counts = { scanned: 0, repaired: 0, skipped: 0, mismatched: 0 };
  const periods = await db.collection('evaluationperiods').find({ status: 'closed' }).toArray();
  try {
    for (const period of periods) {
      const summaries = await db.collection('summarypoints').find({ period_id: period._id, status: 'locked' }).toArray();
      for (const summary of summaries) {
        counts.scanned++;
        if (!summary.student_id || !summary.semester_id || !summary.period_id || summary.total_score === null || summary.total_score === undefined) {
          counts.skipped++;
          console.warn(`[SKIP] summary ${summary._id} is missing required identifiers or score`);
          continue;
        }
        const student = await db.collection('students').findOne({ _id: summary.student_id }, { projection: { training_point_history: 1 } });
        if (!student) {
          counts.skipped++;
          console.warn(`[SKIP] student ${summary.student_id} not found`);
          continue;
        }
        const existing = (student.training_point_history || []).find((snapshot: any) => sameValue(snapshot.period_id, summary.period_id));
        const valuesMatch = existing && ['semester_id', 'total_score', 'grading', 'rank_tier', 'rank_label'].every((field) => sameValue(existing[field], summary[field]));
        if (existing && !valuesMatch) {
          counts.mismatched++;
          console.warn(`[MISMATCH] student ${summary.student_id}, period ${summary.period_id}`);
          continue;
        }
        if (existing) {
          counts.skipped++;
          continue;
        }
        counts.repaired++;
        if (!execute) continue;
        const snapshot = {
          semester_id: summary.semester_id,
          period_id: summary.period_id,
          total_score: summary.total_score,
          grading: summary.grading ?? null,
          rank_tier: summary.rank_tier ?? null,
          rank_label: summary.rank_label ?? null,
          locked_at: summary.rank_locked_at || new Date(),
        };
        await db.collection('students').updateOne(
          { _id: summary.student_id },
          [{ $set: { training_point_history: { $concatArrays: [{ $filter: { input: { $ifNull: ['$training_point_history', []] }, as: 'snapshot', cond: { $ne: ['$$snapshot.period_id', summary.period_id] } } }, [snapshot]] } } }],
        );
      }
    }
    console.log(`${execute ? 'EXECUTE' : 'DRY RUN'} counts: ${JSON.stringify(counts)}`);
  } finally {
    await app.close();
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
