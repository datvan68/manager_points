import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { Model, Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { ClubMember } from '../src/clubs/schemas/club-member.schema';

async function bootstrap() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  console.log(`Starting club membership slots migration script...`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY RUN (read-only)'}`);

  const app = await NestFactory.createApplicationContext(AppModule);
  
  try {
    const clubMemberModel: Model<any> = app.get(getModelToken(ClubMember.name));

    // 1. Detect duplicates (conflicts): student_id + semester_id having > 1 active or pending memberships
    const conflicts = await clubMemberModel.aggregate([
      {
        $match: {
          status: { $in: ['active', 'pending'] }
        }
      },
      {
        $group: {
          _id: { student_id: '$student_id', semester_id: '$semester_id' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).exec();

    if (conflicts.length > 0) {
      console.error(`[ERROR] Found ${conflicts.length} conflict groups (student_id + semester_id containing more than one active/pending membership).`);
      console.error(`Exit migration. No database changes were made.`);
      process.exit(1);
    }

    // 2. Count memberships to update
    const allMembers = await clubMemberModel.find().exec();
    let occupyCount = 0;
    let releaseCount = 0;

    const bulkOps = [];

    for (const member of allMembers) {
      const shouldOccupy = ['active', 'pending'].includes(member.status);
      if (shouldOccupy) {
        occupyCount++;
      } else {
        releaseCount++;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: member._id },
          update: { $set: { occupies_slot: shouldOccupy } }
        }
      });
    }

    console.log(`Dry run summary:`);
    console.log(`  Total memberships analyzed: ${allMembers.length}`);
    console.log(`  Memberships to set occupies_slot=true (active/pending): ${occupyCount}`);
    console.log(`  Memberships to set occupies_slot=false (inactive/rejected/left): ${releaseCount}`);

    if (apply) {
      if (bulkOps.length > 0) {
        console.log(`Writing changes to database...`);
        const result = await clubMemberModel.bulkWrite(bulkOps);
        console.log(`Database write completed: modified ${result.modifiedCount} documents.`);
      }

      console.log(`Synchronizing database indexes for ClubMember...`);
      await clubMemberModel.syncIndexes();
      console.log(`Index synchronization completed successfully.`);
      console.log(`[SUCCESS] Migration completed.`);
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
