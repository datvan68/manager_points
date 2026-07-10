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
  // Redact password in MongoDB URI before logging
  const maskedUri = mongoUri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)[^@]+(@.*)/, '$1***REDACTED***$2');
  console.error(`MONGO_URI: ${maskedUri}`);
  console.error('This migration script is blocked on production to prevent accidental data changes.');
  console.error('==================================================');
  process.exit(1);
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { Club } from '../src/clubs/schemas/club.schema';

async function bootstrap() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  console.log(`Starting unified activities migration script...`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (read-only)'}`);

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const clubModel: Model<any> = app.get(getModelToken(Club.name));

    // Find all clubs missing activity_type or participation_status (or having empty/null values)
    const filter = {
      $or: [
        { activity_type: { $exists: false } },
        { activity_type: null },
        { activity_type: '' },
        { participation_status: { $exists: false } },
        { participation_status: null },
        { participation_status: '' }
      ]
    };

    const clubsToMigrate = await clubModel.find(filter).lean().exec();

    console.log(`Matched clubs count: ${clubsToMigrate.length}`);

    if (clubsToMigrate.length === 0) {
      console.log('No clubs require migration. Database is already up-to-date (idempotent check passed).');
      return;
    }

    const bulkOps = [];
    let activityTypeUpdates = 0;
    let participationStatusUpdates = 0;

    for (const club of clubsToMigrate) {
      const updateFields: any = {};
      if (club.activity_type === undefined || club.activity_type === null || club.activity_type === '') {
        updateFields.activity_type = 'club';
        activityTypeUpdates++;
      }
      if (club.participation_status === undefined || club.participation_status === null || club.participation_status === '') {
        updateFields.participation_status = 'published';
        participationStatusUpdates++;
      }

      if (Object.keys(updateFields).length > 0) {
        bulkOps.push({
          updateOne: {
            filter: { _id: club._id },
            update: { $set: updateFields }
          }
        });
      }
    }

    console.log(`Dry run summary:`);
    console.log(`  Total clubs matched for update: ${clubsToMigrate.length}`);
    console.log(`  Clubs updating activity_type -> 'club': ${activityTypeUpdates}`);
    console.log(`  Clubs updating participation_status -> 'published': ${participationStatusUpdates}`);

    if (apply) {
      if (bulkOps.length > 0) {
        console.log(`Applying changes to MongoDB...`);
        const result = await clubModel.bulkWrite(bulkOps);
        console.log(`Matched count: ${result.matchedCount}`);
        console.log(`Modified count: ${result.modifiedCount}`);
        console.log(`[SUCCESS] Migration completed.`);
      }
    } else {
      console.log(`[INFO] Dry run finished. Run with "--apply" to commit changes.`);
    }
  } catch (error) {
    console.error(`[ERROR] Migration script failed:`, error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
