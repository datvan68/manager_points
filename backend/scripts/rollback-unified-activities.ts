import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from backend/.env file before bootstrapping Nest
dotenv.config({ path: path.join(__dirname, '../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const mongoUri = process.env.MONGO_URI || '';

const isProdUri = mongoUri.toLowerCase().includes('prod') || 
                  mongoUri.toLowerCase().includes('production') || 
                  mongoUri.toLowerCase().includes('atlas') || 
                  mongoUri.toLowerCase().includes('cluster');

if (nodeEnv === 'production' || isProdUri) {
  console.error('==================================================');
  console.error('🔥 CRITICAL WARNING: PRODUCTION ENVIRONMENT DETECTED 🔥');
  console.error(`NODE_ENV: ${nodeEnv}`);
  const maskedUri = mongoUri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.*)/, '$1***REDACTED***$2');
  console.error(`MONGO_URI: ${maskedUri}`);
  console.error('This rollback script is blocked on production to prevent accidental data changes.');
  console.error('==================================================');
  process.exit(1);
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Connection } from 'mongoose';
import { getConnectionToken } from '@nestjs/mongoose';

async function bootstrap() {
  const args = process.argv.slice(2);
  const execute = args.includes('--execute');

  console.log(`Starting activities backend rollback...`);
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);

  const app = await NestFactory.createApplicationContext(AppModule);
  const connection: Connection = app.get(getConnectionToken());
  const db = connection.db;
  if (!db) {
    throw new Error('Could not get raw MongoDB database reference');
  }

  try {
    // 1. Define mappings and collections (rollback direction)
    const collectionsToRename = [
      { src: 'activities', dest: 'clubs' },
      { src: 'activity_members', dest: 'club_members' },
      { src: 'activity_favorites', dest: 'club_favorites' },
      { src: 'activity_membership_transfers', dest: 'club_membership_transfers' },
      { src: 'activity_schedules', dest: 'club_schedules' },
      { src: 'activity_attendance_configs', dest: 'club_attendance_configs' },
    ];

    const allCollections = await db.listCollections().toArray();
    const existingCollectionNames = allCollections.map(c => c.name);

    // 2. Validate target collections
    if (execute) {
      for (const mapping of collectionsToRename) {
        if (existingCollectionNames.includes(mapping.dest)) {
          const docCount = await db.collection(mapping.dest).countDocuments();
          if (docCount > 0) {
            console.error(`[ERROR] Target collection "${mapping.dest}" already exists and contains ${docCount} documents. Stop to prevent data corruption.`);
            process.exit(1);
          }
        }
      }
    }

    // 3. Log counts
    console.log('\n--- Pre-rollback Collection Counts ---');
    const counts: Record<string, number> = {};
    for (const mapping of collectionsToRename) {
      if (existingCollectionNames.includes(mapping.src)) {
        const count = await db.collection(mapping.src).countDocuments();
        counts[mapping.src] = count;
        console.log(`  Source "${mapping.src}": ${count} documents`);
      } else {
        counts[mapping.src] = 0;
        console.log(`  Source "${mapping.src}": Collection does not exist (0 documents)`);
      }
    }

    if (!execute) {
      console.log('\n[DRY RUN] Would perform the following rollback renames:');
      for (const mapping of collectionsToRename) {
        console.log(`  Rename collection: "${mapping.src}" -> "${mapping.dest}"`);
      }
      console.log('  Would rename fields inside documents back:');
      console.log('    - activity_id -> club_id');
      console.log('    - from_activity_id -> from_club_id');
      console.log('    - to_activity_id -> to_club_id');
      console.log('    - activity_ids -> club_ids');
      console.log('    - occupied_activity_id -> occupied_club_id');
      console.log('    - context_type: "activity" -> "club" in attendance_sessions');
      console.log('  Would update permission codes in G_ACTIVITY group and permissions starting with "ACTIVITY_" back');
      console.log('\n[INFO] Dry run finished. Run with "--execute" to commit changes.');
      return;
    }

    // 4. Perform Renames
    console.log('\nRenaming collections back...');
    for (const mapping of collectionsToRename) {
      if (existingCollectionNames.includes(mapping.src)) {
        console.log(`  Renaming "${mapping.src}" -> "${mapping.dest}"`);
        if (existingCollectionNames.includes(mapping.dest) || (await db.listCollections({ name: mapping.dest }).toArray()).length > 0) {
          try {
            await db.collection(mapping.dest).drop();
            console.log(`    Dropped empty target collection "${mapping.dest}"`);
          } catch (e) {}
        }
        await db.collection(mapping.src).rename(mapping.dest);
      } else {
        console.log(`  Skipping rename for "${mapping.src}" (does not exist)`);
      }
    }

    // 5. Drop indexes on rolled back collections before field updates to avoid dup key errors on old indexes
    console.log('\nDropping old indexes...');
    for (const mapping of collectionsToRename) {
      try {
        await db.collection(mapping.dest).dropIndexes();
        console.log(`  Dropped indexes for "${mapping.dest}"`);
      } catch (e) {}
    }

    // 5. Update Persisted Fields back
    console.log('\nUpdating document fields back...');

    // club_members: activity_id -> club_id
    console.log('  Updating club_members...');
    await db.collection('club_members').updateMany(
      { activity_id: { $exists: true } },
      { $rename: { activity_id: 'club_id' } }
    );

    // club_favorites: activity_id -> club_id
    console.log('  Updating club_favorites...');
    await db.collection('club_favorites').updateMany(
      { activity_id: { $exists: true } },
      { $rename: { activity_id: 'club_id' } }
    );

    // club_membership_transfers: from_activity_id -> from_club_id, to_activity_id -> to_club_id
    console.log('  Updating club_membership_transfers...');
    await db.collection('club_membership_transfers').updateMany(
      { from_activity_id: { $exists: true } },
      { $rename: { from_activity_id: 'from_club_id' } }
    );
    await db.collection('club_membership_transfers').updateMany(
      { to_activity_id: { $exists: true } },
      { $rename: { to_activity_id: 'to_club_id' } }
    );

    // club_schedules: activity_id -> club_id
    console.log('  Updating club_schedules...');
    await db.collection('club_schedules').updateMany(
      { activity_id: { $exists: true } },
      { $rename: { activity_id: 'club_id' } }
    );

    // club_attendance_configs: activity_id -> club_id
    console.log('  Updating club_attendance_configs...');
    await db.collection('club_attendance_configs').updateMany(
      { activity_id: { $exists: true } },
      { $rename: { activity_id: 'club_id' } }
    );

    // club_attendances: activity_id -> club_id
    if (existingCollectionNames.includes('club_attendances')) {
      console.log('  Updating club_attendances fields back...');
      await db.collection('club_attendances').updateMany(
        { activity_id: { $exists: true } },
        { $rename: { activity_id: 'club_id' } }
      );
    }

    // schedule_registrations: activity_id -> club_id
    if (existingCollectionNames.includes('schedule_registrations')) {
      console.log('  Updating schedule_registrations fields back...');
      await db.collection('schedule_registrations').updateMany(
        { activity_id: { $exists: true } },
        { $rename: { activity_id: 'club_id' } }
      );
    }

    // attendance_sessions: context_type: 'activity' -> 'club'
    if (existingCollectionNames.includes('attendance_sessions')) {
      console.log('  Updating attendance_sessions back...');
      await db.collection('attendance_sessions').updateMany(
        { context_type: 'activity' },
        { $set: { context_type: 'club' } }
      );
    }

    // notifications: rename metadata fields and routeUrls back
    if (existingCollectionNames.includes('notifications')) {
      console.log('  Updating notifications back...');
      await db.collection('notifications').updateMany(
        { 'metadata.activity_id': { $exists: true } },
        { $rename: { 'metadata.activity_id': 'metadata.club_id' } }
      );
      
      // Replace routeUrl path '/activities/' with '/clubs/'
      const cursor = db.collection('notifications').find({ routeUrl: { $regex: /^\/activities/ } });
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (doc && doc.routeUrl) {
          const newRoute = doc.routeUrl.replace(/^\/activities/, '/clubs');
          await db.collection('notifications').updateOne(
            { _id: doc._id },
            { $set: { routeUrl: newRoute } }
          );
        }
      }
    }

    // 6. Rebuild Legacy Indexes
    console.log('\nRebuilding legacy indexes...');
    
    // clubs indexes
    console.log('  Rebuilding clubs indexes...');
    try { await db.collection('clubs').dropIndexes(); } catch (e) {}
    await db.collection('clubs').createIndex({ advisor_id: 1 });
    await db.collection('clubs').createIndex({ status: 1 });
    await db.collection('clubs').createIndex({ semester_id: 1 });
    await db.collection('clubs').createIndex({ activity_type: 1, participation_status: 1 });

    // club_members indexes
    console.log('  Rebuilding club_members indexes...');
    try { await db.collection('club_members').dropIndexes(); } catch (e) {}
    await db.collection('club_members').createIndex({ club_id: 1, student_id: 1, semester_id: 1 }, { unique: true });
    await db.collection('club_members').createIndex({ student_id: 1 });
    await db.collection('club_members').createIndex({ club_id: 1, status: 1 });
    await db.collection('club_members').createIndex(
      { student_id: 1, semester_id: 1 },
      { unique: true, partialFilterExpression: { occupies_slot: true } }
    );

    // club_favorites indexes
    console.log('  Rebuilding club_favorites indexes...');
    try { await db.collection('club_favorites').dropIndexes(); } catch (e) {}
    await db.collection('club_favorites').createIndex({ club_id: 1, user_id: 1 }, { unique: true });
    await db.collection('club_favorites').createIndex({ club_id: 1 });
    await db.collection('club_favorites').createIndex({ user_id: 1 });

    // club_membership_transfers indexes
    console.log('  Rebuilding club_membership_transfers indexes...');
    try { await db.collection('club_membership_transfers').dropIndexes(); } catch (e) {}
    await db.collection('club_membership_transfers').createIndex({ student_id: 1, semester_id: 1, mode: 1, status: 1 });
    await db.collection('club_membership_transfers').createIndex({ to_membership_id: 1 }, { unique: true });
    await db.collection('club_membership_transfers').createIndex({ to_club_id: 1, status: 1, requested_at: -1 });

    // club_schedules indexes
    console.log('  Rebuilding club_schedules indexes...');
    try { await db.collection('club_schedules').dropIndexes(); } catch (e) {}
    await db.collection('club_schedules').createIndex({ club_id: 1, start_time: 1 });
    await db.collection('club_schedules').createIndex({ club_id: 1, semester_id: 1 });
    await db.collection('club_schedules').createIndex({ status: 1, start_time: 1 });

    // club_attendance_configs indexes
    console.log('  Rebuilding club_attendance_configs indexes...');
    try { await db.collection('club_attendance_configs').dropIndexes(); } catch (e) {}
    await db.collection('club_attendance_configs').createIndex({ club_id: 1, semester_id: 1 }, { unique: true, sparse: true });
    await db.collection('club_attendance_configs').createIndex({ semester_id: 1, status: 1 });

    // club_attendances indexes
    if (existingCollectionNames.includes('club_attendances')) {
      console.log('  Rebuilding club_attendances indexes back...');
      try { await db.collection('club_attendances').dropIndexes(); } catch (e) {}
      await db.collection('club_attendances').createIndex({ schedule_id: 1, student_id: 1 }, { unique: true });
      await db.collection('club_attendances').createIndex({ club_id: 1, semester_id: 1, approval_status: 1 });
      await db.collection('club_attendances').createIndex({ student_id: 1, semester_id: 1 });
      await db.collection('club_attendances').createIndex({ approval_status: 1 });
    }

    // 7. Update Permissions and Permission Groups back
    console.log('\nUpdating permissions and groups back...');
    
    // Group G_ACTIVITY -> G_CLUB
    if (existingCollectionNames.includes('permissiongroups')) {
      console.log('  Updating permission group G_ACTIVITY back...');
      await db.collection('permissiongroups').deleteOne({ code: 'G_CLUB' });
      await db.collection('permissiongroups').updateOne(
        { code: 'G_ACTIVITY' },
        {
          $set: {
            code: 'G_CLUB',
            name: 'Quản lý Câu lạc bộ',
            description: 'Quản lý câu lạc bộ, lịch sinh hoạt, điểm danh và cấu hình điểm rèn luyện.',
          }
        }
      );
    }

    // Permissions module 'Quản lý Hoạt động' -> 'Quản lý Câu lạc bộ'
    if (existingCollectionNames.includes('permissions')) {
      console.log('  Updating permissions module names back...');
      await db.collection('permissions').updateMany(
        { module: 'Quản lý Hoạt động' },
        { $set: { module: 'Quản lý Câu lạc bộ' } }
      );

      // ACTIVITY_* codes -> CLUB_* codes
      console.log('  Renaming permission codes back...');
      const cursor = db.collection('permissions').find({ code: { $regex: /^ACTIVITY_/ } });
      while (await cursor.hasNext()) {
        const perm = await cursor.next();
        if (perm && perm.code) {
          const newCode = perm.code.replace(/^ACTIVITY_/, 'CLUB_');
          const newName = perm.name.replace(/Hoạt động/g, 'CLB');
          await db.collection('permissions').deleteOne({ code: newCode });
          await db.collection('permissions').updateOne(
            { _id: perm._id },
            { $set: { code: newCode, name: newName } }
          );
        }
      }
    }

    console.log('\n[SUCCESS] Rollback completed successfully.');

  } catch (error: any) {
    console.error(`\n🔥 [ERROR] Rollback failed:`, error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
