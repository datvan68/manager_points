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
  console.error('This migration script is blocked on production to prevent accidental data changes.');
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

  console.log(`Starting activities backend migration...`);
  console.log(`Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);

  const app = await NestFactory.createApplicationContext(AppModule);
  const connection: Connection = app.get(getConnectionToken());
  const db = connection.db;
  if (!db) {
    throw new Error('Could not get raw MongoDB database reference');
  }

  try {
    // 1. Define mappings and collections
    const collectionsToRename = [
      { src: 'clubs', dest: 'activities' },
      { src: 'club_members', dest: 'activity_members' },
      { src: 'club_favorites', dest: 'activity_favorites' },
      { src: 'club_membership_transfers', dest: 'activity_membership_transfers' },
      { src: 'club_schedules', dest: 'activity_schedules' },
      { src: 'club_attendance_configs', dest: 'activity_attendance_configs' },
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
    console.log('\n--- Pre-migration Collection Counts ---');
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
      console.log('\n[DRY RUN] Would perform the following renames:');
      for (const mapping of collectionsToRename) {
        console.log(`  Rename collection: "${mapping.src}" -> "${mapping.dest}"`);
      }
      console.log('  Would rename fields inside documents:');
      console.log('    - club_id -> activity_id');
      console.log('    - from_club_id -> from_activity_id');
      console.log('    - to_club_id -> to_activity_id');
      console.log('    - club_ids -> activity_ids');
      console.log('    - occupied_club_id -> occupied_activity_id');
      console.log('    - context_type: "club" -> "activity" in attendance_sessions');
      console.log('  Would update permission codes in G_CLUB group and permissions starting with "CLUB_"');
      console.log('\n[INFO] Dry run finished. Run with "--execute" to commit changes.');
      return;
    }

    // 4. Perform Renames
    console.log('\nRenaming collections...');
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

    // 5. Drop indexes on renamed collections before field updates to avoid dup key errors on old indexes
    console.log('\nDropping old indexes...');
    for (const mapping of collectionsToRename) {
      try {
        await db.collection(mapping.dest).dropIndexes();
        console.log(`  Dropped indexes for "${mapping.dest}"`);
      } catch (e) {}
    }

    // 5. Update Persisted Fields
    console.log('\nUpdating document fields...');
    
    // activities: set default fields if missing
    console.log('  Seeding defaults in activities...');
    await db.collection('activities').updateMany(
      {
        $or: [
          { activity_type: { $exists: false } },
          { activity_type: null },
          { activity_type: '' },
          { participation_status: { $exists: false } },
          { participation_status: null },
          { participation_status: '' }
        ]
      },
      [
        {
          $set: {
            activity_type: { $ifNull: ['$activity_type', 'club'] },
            participation_status: { $ifNull: ['$participation_status', 'published'] }
          }
        }
      ]
    );

    // activity_members: club_id -> activity_id
    console.log('  Updating activity_members...');
    await db.collection('activity_members').updateMany(
      { club_id: { $exists: true } },
      { $rename: { club_id: 'activity_id' } }
    );

    // activity_favorites: club_id -> activity_id
    console.log('  Updating activity_favorites...');
    await db.collection('activity_favorites').updateMany(
      { club_id: { $exists: true } },
      { $rename: { club_id: 'activity_id' } }
    );

    // activity_membership_transfers: from_club_id -> from_activity_id, to_club_id -> to_activity_id
    console.log('  Updating activity_membership_transfers...');
    await db.collection('activity_membership_transfers').updateMany(
      { from_club_id: { $exists: true } },
      { $rename: { from_club_id: 'from_activity_id' } }
    );
    await db.collection('activity_membership_transfers').updateMany(
      { to_club_id: { $exists: true } },
      { $rename: { to_club_id: 'to_activity_id' } }
    );

    // activity_schedules: club_id -> activity_id
    console.log('  Updating activity_schedules...');
    await db.collection('activity_schedules').updateMany(
      { club_id: { $exists: true } },
      { $rename: { club_id: 'activity_id' } }
    );

    // activity_attendance_configs: club_id -> activity_id
    console.log('  Updating activity_attendance_configs...');
    await db.collection('activity_attendance_configs').updateMany(
      { club_id: { $exists: true } },
      { $rename: { club_id: 'activity_id' } }
    );

    // club_attendances: club_id -> activity_id
    if (existingCollectionNames.includes('club_attendances')) {
      console.log('  Updating club_attendances fields...');
      await db.collection('club_attendances').updateMany(
        { club_id: { $exists: true } },
        { $rename: { club_id: 'activity_id' } }
      );
    }

    // schedule_registrations: club_id -> activity_id
    if (existingCollectionNames.includes('schedule_registrations')) {
      console.log('  Updating schedule_registrations fields...');
      await db.collection('schedule_registrations').updateMany(
        { club_id: { $exists: true } },
        { $rename: { club_id: 'activity_id' } }
      );
    }

    // attendance_sessions: context_type: 'club' -> 'activity', metadata.club_id -> metadata.activity_id
    if (existingCollectionNames.includes('attendance_sessions')) {
      console.log('  Updating attendance_sessions...');
      await db.collection('attendance_sessions').updateMany(
        { context_type: 'club' },
        { $set: { context_type: 'activity' } }
      );
    }

    // notifications: rename metadata fields and routeUrls
    if (existingCollectionNames.includes('notifications')) {
      console.log('  Updating notifications...');
      await db.collection('notifications').updateMany(
        { 'metadata.club_id': { $exists: true } },
        { $rename: { 'metadata.club_id': 'metadata.activity_id' } }
      );
      
      // Replace routeUrl path '/clubs/' with '/activities/'
      const cursor = db.collection('notifications').find({ routeUrl: { $regex: /^\/clubs/ } });
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        if (doc && doc.routeUrl) {
          const newRoute = doc.routeUrl.replace(/^\/clubs/, '/activities');
          await db.collection('notifications').updateOne(
            { _id: doc._id },
            { $set: { routeUrl: newRoute } }
          );
        }
      }
    }

    // 6. Rebuild Indexes
    console.log('\nRebuilding indexes...');
    
    // activities indexes
    console.log('  Rebuilding activities indexes...');
    try { await db.collection('activities').dropIndexes(); } catch (e) {}
    await db.collection('activities').createIndex({ advisor_id: 1 });
    await db.collection('activities').createIndex({ status: 1 });
    await db.collection('activities').createIndex({ semester_id: 1 });
    await db.collection('activities').createIndex({ activity_type: 1, participation_status: 1 });

    // activity_members indexes
    console.log('  Rebuilding activity_members indexes...');
    try { await db.collection('activity_members').dropIndexes(); } catch (e) {}
    await db.collection('activity_members').createIndex({ activity_id: 1, student_id: 1, semester_id: 1 }, { unique: true });
    await db.collection('activity_members').createIndex({ student_id: 1 });
    await db.collection('activity_members').createIndex({ activity_id: 1, status: 1 });
    await db.collection('activity_members').createIndex(
      { student_id: 1, semester_id: 1 },
      { unique: true, partialFilterExpression: { occupies_slot: true } }
    );

    // activity_favorites indexes
    console.log('  Rebuilding activity_favorites indexes...');
    try { await db.collection('activity_favorites').dropIndexes(); } catch (e) {}
    await db.collection('activity_favorites').createIndex({ activity_id: 1, user_id: 1 }, { unique: true });
    await db.collection('activity_favorites').createIndex({ activity_id: 1 });
    await db.collection('activity_favorites').createIndex({ user_id: 1 });

    // activity_membership_transfers indexes
    console.log('  Rebuilding activity_membership_transfers indexes...');
    try { await db.collection('activity_membership_transfers').dropIndexes(); } catch (e) {}
    await db.collection('activity_membership_transfers').createIndex({ student_id: 1, semester_id: 1, mode: 1, status: 1 });
    await db.collection('activity_membership_transfers').createIndex({ to_membership_id: 1 }, { unique: true });
    await db.collection('activity_membership_transfers').createIndex({ to_activity_id: 1, status: 1, requested_at: -1 });

    // activity_schedules indexes
    console.log('  Rebuilding activity_schedules indexes...');
    try { await db.collection('activity_schedules').dropIndexes(); } catch (e) {}
    await db.collection('activity_schedules').createIndex({ activity_id: 1, start_time: 1 });
    await db.collection('activity_schedules').createIndex({ activity_id: 1, semester_id: 1 });
    await db.collection('activity_schedules').createIndex({ status: 1, start_time: 1 });

    // activity_attendance_configs indexes
    console.log('  Rebuilding activity_attendance_configs indexes...');
    try { await db.collection('activity_attendance_configs').dropIndexes(); } catch (e) {}
    await db.collection('activity_attendance_configs').createIndex({ activity_id: 1, semester_id: 1 }, { unique: true, sparse: true });
    await db.collection('activity_attendance_configs').createIndex({ semester_id: 1, status: 1 });

    // club_attendances indexes
    if (existingCollectionNames.includes('club_attendances')) {
      console.log('  Rebuilding club_attendances indexes...');
      try { await db.collection('club_attendances').dropIndexes(); } catch (e) {}
      await db.collection('club_attendances').createIndex({ schedule_id: 1, student_id: 1 }, { unique: true });
      await db.collection('club_attendances').createIndex({ activity_id: 1, semester_id: 1, approval_status: 1 });
      await db.collection('club_attendances').createIndex({ student_id: 1, semester_id: 1 });
      await db.collection('club_attendances').createIndex({ approval_status: 1 });
    }

    // 7. Update Permissions and Permission Groups
    console.log('\nUpdating permissions and groups...');
    
    // Group G_CLUB -> G_ACTIVITY
    if (existingCollectionNames.includes('permissiongroups')) {
      console.log('  Updating permission group G_CLUB...');
      await db.collection('permissiongroups').deleteOne({ code: 'G_ACTIVITY' });
      await db.collection('permissiongroups').updateOne(
        { code: 'G_CLUB' },
        {
          $set: {
            code: 'G_ACTIVITY',
            name: 'Quản lý Hoạt động',
            description: 'Quản lý hoạt động, lịch sinh hoạt, điểm danh và cấu hình điểm rèn luyện.',
          }
        }
      );
    }

    // Permissions module 'Quản lý Câu lạc bộ' -> 'Quản lý Hoạt động'
    if (existingCollectionNames.includes('permissions')) {
      console.log('  Updating permissions module names...');
      await db.collection('permissions').updateMany(
        { module: 'Quản lý Câu lạc bộ' },
        { $set: { module: 'Quản lý Hoạt động' } }
      );

      // CLUB_* codes -> ACTIVITY_* codes
      console.log('  Renaming permission codes...');
      const cursor = db.collection('permissions').find({ code: { $regex: /^CLUB_/ } });
      while (await cursor.hasNext()) {
        const perm = await cursor.next();
        if (perm && perm.code) {
          const newCode = perm.code.replace(/^CLUB_/, 'ACTIVITY_');
          const newName = perm.name.replace(/CLB/g, 'Hoạt động');
          await db.collection('permissions').deleteOne({ code: newCode });
          await db.collection('permissions').updateOne(
            { _id: perm._id },
            { $set: { code: newCode, name: newName } }
          );
        }
      }
    }

    console.log('\n[SUCCESS] Migration completed successfully.');

  } catch (error: any) {
    console.error(`\n🔥 [ERROR] Migration failed:`, error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
