/**
 * Migration 001: Add Role-Aware Fields to Academic Records
 *
 * This migration backfills existing academic_record documents with:
 * - recorded_by_role: inferred from recorded_by user's role
 * - quantity: default 1 for all existing records
 * - action_type + payload: parsed from record_title
 * - source_type + source_id: split from source + daily_report_id
 * - status: 'inactive' → 'cancelled'
 *
 * Idempotent: safe to run multiple times. Skips already-migrated records.
 * Resumable: processes in batches, can be interrupted and restarted.
 *
 * Usage:
 *   npx ts-node src/academic-record/migrations/001-add-role-aware-fields.ts
 *
 * Or import and call migrate() from a NestJS command/script.
 */

import { connect, model, Schema, Types } from 'mongoose';

const BATCH_SIZE = 500;

// Minimal schemas for migration — no validation needed
const UserSchema = new Schema({}, { strict: false, collection: 'users' });
const RoleSchema = new Schema({}, { strict: false, collection: 'roles' });
const AcademicRecordSchema = new Schema(
  {},
  { strict: false, collection: 'academicrecords' },
);

/**
 * Infer recorded_by_role from a user's role name string.
 */
function inferRoleFromRoleName(roleName: string): string {
  if (!roleName) return 'system';
  const lower = roleName.toLowerCase();
  if (lower.includes('admin')) return 'admin';
  if (
    lower.includes('supervisor') ||
    lower.includes('quản sinh') ||
    lower.includes('quan sinh')
  )
    return 'supervisor';
  if (
    lower.includes('teacher') ||
    lower.includes('adviser') ||
    lower.includes('advisor') ||
    lower.includes('giảng viên') ||
    lower.includes('giang vien') ||
    lower.includes('lecturer')
  )
    return 'teacher';
  if (
    lower.includes('student') ||
    lower.includes('sinh viên') ||
    lower.includes('sinh vien')
  )
    return 'student';
  return 'system'; // Unknown roles default to system
}

/**
 * Parse record_title into structured action_type + payload.
 */
function parseRecordTitle(recordTitle: string | null | undefined): {
  action_type: string | null;
  payload: Record<string, unknown> | null;
} {
  if (!recordTitle) return { action_type: null, payload: null };

  // Manual score: "Nhập điểm tay: 8.5"
  if (recordTitle.startsWith('Nhập điểm tay: ')) {
    const scoreStr = recordTitle.replace('Nhập điểm tay: ', '');
    const score = parseFloat(scoreStr);
    if (!isNaN(score)) {
      return {
        action_type: 'manual_score',
        payload: { manual_score: score, original_title: recordTitle },
      };
    }
  }

  // Selected option: "Lựa chọn option A" or "Lua chon option B"
  const optionMatch = recordTitle.match(/Lu[aạ]\s*ch[oọ]n\s*option\s*(.+)/i);
  if (optionMatch) {
    return {
      action_type: 'select_option',
      payload: {
        parsed_option_id: optionMatch[1].trim(),
        original_title: recordTitle,
      },
    };
  }

  // Default: count-based activity
  return { action_type: 'count', payload: null };
}

/**
 * Split legacy source field into source_type + source_id.
 */
function splitSource(
  source: string | null | undefined,
  dailyReportId: any,
): { source_type: string | null; source_id: string | null } {
  if (dailyReportId) {
    return {
      source_type: 'daily_report',
      source_id: dailyReportId.toString(),
    };
  }

  if (!source) return { source_type: null, source_id: null };

  switch (source) {
    case 'manual':
      return { source_type: 'manual', source_id: null };
    case 'import':
      return { source_type: 'import', source_id: null };
    case 'daily_report':
      return { source_type: 'daily_report', source_id: null };
    case 'bulk_grading':
      return { source_type: 'bulk_grading', source_id: null };
    default:
      return { source_type: source, source_id: null };
  }
}

export async function migrate(mongoUri?: string): Promise<{
  totalProcessed: number;
  totalUpdated: number;
  totalSkipped: number;
  errors: Array<{ recordId: string; error: string }>;
}> {
  const uri = mongoUri || process.env.MONGODB_URI || process.env.DATABASE_URL;
  if (!uri) {
    throw new Error(
      'MongoDB URI not provided. Set MONGODB_URI or DATABASE_URL env var.',
    );
  }

  const conn = await connect(uri);
  console.log('[Migration 001] Connected to MongoDB');

  const UserModel = conn.models.User || model('User', UserSchema);
  const RoleModel = conn.models.Role || model('Role', RoleSchema);
  const RecordModel =
    conn.models.AcademicRecord || model('AcademicRecord', AcademicRecordSchema);

  // Preload all users with their roles for fast lookup
  console.log('[Migration 001] Preloading users and roles...');
  const users = await UserModel.find({}).lean().exec();
  const roles = await RoleModel.find({}).lean().exec();
  const roleMap = new Map<string, string>();
  roles.forEach((r: any) => {
    roleMap.set(r._id.toString(), r.name || r.role_name || r.role_code || '');
  });
  const userRoleMap = new Map<string, string>();
  users.forEach((u: any) => {
    const roleId = u.role ? u.role.toString() : '';
    const roleName = roleMap.get(roleId) || '';
    userRoleMap.set(u._id.toString(), inferRoleFromRoleName(roleName));
  });
  console.log(
    `[Migration 001] Loaded ${users.length} users, ${roles.length} roles`,
  );

  let totalProcessed = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  const errors: Array<{ recordId: string; error: string }> = [];

  // Process in batches — only records NOT yet migrated (recorded_by_role is null)
  let lastId: any = null;

  while (true) {
    const filter: any = { recorded_by_role: { $eq: null } };
    if (lastId) {
      filter._id = { $gt: lastId };
    }

    const batch = await RecordModel.find(filter)
      .sort({ _id: 1 })
      .limit(BATCH_SIZE)
      .lean()
      .exec();

    if (batch.length === 0) break;

    const bulkOps: any[] = [];

    for (const record of batch) {
      try {
        const recordId = record._id.toString();

        // 1. Infer recorded_by_role
        const recordedById = record.recorded_by
          ? record.recorded_by.toString()
          : null;
        const recorded_by_role = recordedById
          ? userRoleMap.get(recordedById) || 'system'
          : 'system';

        // 2. Parse record_title → action_type + payload
        const { action_type, payload } = parseRecordTitle(record.record_title);

        // 3. Split source → source_type + source_id
        const { source_type, source_id } = splitSource(
          record.source,
          record.daily_report_id,
        );

        // 4. Determine record_type from criterion context (simplified)
        let record_type: string | null = null;
        if (action_type === 'manual_score') {
          record_type = 'manual_score';
        } else if (action_type === 'select_option') {
          record_type = 'selected_option';
        } else {
          record_type = 'activity'; // Default — will be refined by criterion type later
        }

        // 5. Status migration: inactive → cancelled
        const currentStatus = record.status;
        const newStatus =
          currentStatus === 'inactive' ? 'cancelled' : currentStatus;

        // 6. Build update
        const updateFields: any = {
          recorded_by_role,
          record_type,
          action_type,
          quantity: 1,
          source_type,
          source_id,
        };

        if (payload) {
          updateFields.payload = payload;
        }

        if (newStatus !== currentStatus) {
          updateFields.status = newStatus;
        }

        // Set occurred_at to recorded_at if not set
        if (!record.occurred_at && record.recorded_at) {
          updateFields.occurred_at = record.recorded_at;
        }

        bulkOps.push({
          updateOne: {
            filter: { _id: record._id },
            update: { $set: updateFields },
          },
        });

        totalUpdated++;
      } catch (err: any) {
        errors.push({
          recordId: record._id.toString(),
          error: err.message || String(err),
        });
      }
    }

    if (bulkOps.length > 0) {
      await RecordModel.bulkWrite(bulkOps, { ordered: false });
    }

    totalProcessed += batch.length;
    lastId = batch[batch.length - 1]._id;
    console.log(
      `[Migration 001] Processed ${totalProcessed} records (${totalUpdated} updated, ${errors.length} errors)`,
    );
  }

  const skippedCount = await RecordModel.countDocuments({
    recorded_by_role: { $ne: null },
  }).exec();
  totalSkipped = skippedCount - totalUpdated;

  console.log(
    `[Migration 001] Complete. Processed: ${totalProcessed}, Updated: ${totalUpdated}, Skipped (already migrated): ${totalSkipped}, Errors: ${errors.length}`,
  );

  return { totalProcessed, totalUpdated, totalSkipped, errors };
}

// CLI entry point
if (require.main === module) {
  migrate()
    .then((result) => {
      console.log('[Migration 001] Result:', JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('[Migration 001] Failed:', err);
      process.exit(1);
    });
}
