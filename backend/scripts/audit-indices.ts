import mongoose from 'mongoose';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/manager-point';

async function audit() {
  console.log('--- STARTING INDEX & DATA AUDIT FOR SUMMARIES POINTS ---');
  console.log(`Connecting to: ${MONGO_URI}`);

  try {
    await mongoose.connect(MONGO_URI);
    console.log('Connected successfully!');

    const collection = mongoose.connection.collection('summariespoints');

    // 1. Count total documents
    const totalDocs = await collection.countDocuments();
    console.log(`Total documents in 'summariespoints': ${totalDocs}`);

    // 2. Count period_id stats
    const nullPeriodCount = await collection.countDocuments({ period_id: null });
    const missingPeriodCount = await collection.countDocuments({ period_id: { $exists: false } });
    const concretePeriodCount = await collection.countDocuments({ period_id: { $ne: null, $exists: true } });

    console.log(`- Documents with period_id explicitly null: ${nullPeriodCount}`);
    console.log(`- Documents missing period_id field: ${missingPeriodCount}`);
    console.log(`- Documents with concrete period_id: ${concretePeriodCount}`);

    // 3. Find duplicates by student_id + semester_id + period_id
    console.log('\nChecking duplicate groups by student_id + semester_id + period_id...');
    const duplicateGroups = await collection.aggregate([
      {
        $group: {
          _id: {
            student_id: '$student_id',
            semester_id: '$semester_id',
            period_id: '$period_id'
          },
          count: { $sum: 1 },
          ids: { $push: '$_id' }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    if (duplicateGroups.length === 0) {
      console.log('✅ No duplicate groups found by student_id + semester_id + period_id!');
    } else {
      console.log(`⚠️ Found ${duplicateGroups.length} duplicate groups! Details:`);
      for (const group of duplicateGroups) {
        console.log(`- Group Student: ${group._id.student_id}, Semester: ${group._id.semester_id}, Period: ${group._id.period_id} has ${group.count} duplicates.`);
        console.log(`  IDs: ${group.ids.join(', ')}`);
      }
    }

    // 4. Find students with multiple summaries (both semester-level and period-level)
    console.log('\nChecking students with mixed semester-level and period-level summaries...');
    const mixedSummaries = await collection.aggregate([
      {
        $group: {
          _id: {
            student_id: '$student_id',
            semester_id: '$semester_id'
          },
          periods: { $addToSet: '$period_id' },
          count: { $sum: 1 }
        }
      },
      {
        $match: {
          count: { $gt: 1 }
        }
      }
    ]).toArray();

    if (mixedSummaries.length === 0) {
      console.log('✅ No students have mixed semester/period summaries in the same semester.');
    } else {
      console.log(`ℹ️ Found ${mixedSummaries.length} cases of student + semester having multiple summaries:`);
      for (const caseObj of mixedSummaries) {
        console.log(`- Student: ${caseObj._id.student_id}, Semester: ${caseObj._id.semester_id} has ${caseObj.count} summaries.`);
        console.log(`  Periods: ${JSON.stringify(caseObj.periods)}`);
      }
    }

    console.log('\n--- AUDIT COMPLETE ---');
  } catch (error) {
    console.error('Audit failed with error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

audit();
