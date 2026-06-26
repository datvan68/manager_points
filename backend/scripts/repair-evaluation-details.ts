import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { AcademicRecordService } from '../src/academic-record/academic-record.service';
import { SummariesPointService } from '../src/summaries-point/summaries-point.service';
import { Model, Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { AcademicRecord } from '../src/academic-record/schemas/academic-record.schema';
import { SummaryPoint } from '../src/summaries-point/schemas/summary-point.schema';

async function bootstrap() {
  const args = process.argv.slice(2);
  let mode = 'report'; // default mode
  
  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      mode = arg.split('=')[1];
    }
  }
  
  if (!['report', 'repair-from-records', 'backfill-records'].includes(mode)) {
    console.error('Invalid mode. Use --mode=report, --mode=repair-from-records, or --mode=backfill-records');
    process.exit(1);
  }

  console.log(`Starting script in mode: ${mode}`);
  
  const app = await NestFactory.createApplicationContext(AppModule);
  
  const academicRecordModel: Model<any> = app.get(getModelToken(AcademicRecord.name));
  const summaryPointModel: Model<any> = app.get(getModelToken(SummaryPoint.name));
  const academicRecordService: AcademicRecordService = app.get(AcademicRecordService);
  const summariesPointService: SummariesPointService = app.get(SummariesPointService);

  const summaries = await summaryPointModel.find().exec();
  console.log(`Found ${summaries.length} summaries to process.`);

  let stats = {
    total_details: 0,
    missing_records: 0,
    extra_records: 0,
    count_mismatch: 0,
    orphan_details: 0,
    repaired: 0,
    backfilled: 0,
  };

  for (const summary of summaries) {
    if (!summary.details || summary.details.length === 0) continue;

    const studentId = summary.student_id;
    const semesterId = summary.semester_id;

    let summaryRepaired = false;

    for (const detail of summary.details) {
      if (!detail.criterion_id) continue;
      stats.total_details++;
      
      const criterionId = detail.criterion_id;
      const currentCount = detail.current_count || 0;
      
      const activeRecordsCount = await academicRecordModel.countDocuments({
        student_id: studentId,
        semester_id: semesterId,
        criterion_id: criterionId,
        status: 'active',
        is_deleted: { $ne: true },
      });

      if (currentCount !== activeRecordsCount) {
        console.log(`Mismatch found - Summary: ${summary._id}, Student: ${studentId}, Semester: ${semesterId}, Criterion: ${criterionId}`);
        console.log(`  evaluation_detail.current_count: ${currentCount}, active records: ${activeRecordsCount}`);
        
        let issueType = '';
        if (activeRecordsCount === 0 && currentCount > 0) {
          issueType = 'orphan_detail';
          stats.orphan_details++;
        } else if (currentCount > activeRecordsCount) {
          issueType = 'missing_records';
          stats.missing_records++;
        } else if (currentCount < activeRecordsCount) {
          issueType = 'extra_records';
          stats.extra_records++;
        } else {
          issueType = 'count_mismatch';
          stats.count_mismatch++;
        }
        
        if (mode === 'repair-from-records') {
           console.log(`  Repairing detail to match records...`);
           await academicRecordService.syncStudentCriterionScore(studentId.toString(), semesterId.toString(), criterionId.toString());
           summaryRepaired = true;
           stats.repaired++;
        } else if (mode === 'backfill-records') {
           if (currentCount > activeRecordsCount) {
             const diff = currentCount - activeRecordsCount;
             console.log(`  Backfilling ${diff} records...`);
             const newRecords = [];
             for(let i=0; i<diff; i++) {
               newRecords.push({
                 student_id: studentId,
                 semester_id: semesterId,
                 criterion_id: criterionId,
                 record_title: 'Hệ thống tự động backfill',
                 status: 'active'
               });
             }
             await academicRecordModel.insertMany(newRecords);
             stats.backfilled++;
           } else {
             console.log(`  Cannot backfill when active records (${activeRecordsCount}) > current_count (${currentCount}).`);
           }
        }
      }
    }
    
    if (summaryRepaired) {
      await summariesPointService.recomputeTotalScore(summary._id.toString());
    }
  }

  console.log('Script completed.');
  console.log('Stats:', stats);
  
  await app.close();
}

bootstrap();
