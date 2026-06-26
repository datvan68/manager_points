import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { AcademicRecordService } from './src/academic-record/academic-record.service';
import { Model } from 'mongoose';
import { AcademicRecordDocument } from './src/academic-record/schemas/academic-record.schema';
import { CriterionDocument } from './src/criteria/schemas/criterion.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  
  // Lấy các Model và Service từ Nest Context
  // Tên Model token trong Mongoose thường là [ModelName]Model (ví dụ: AcademicRecordModel, CriterionModel)
  // Để đảm bảo an toàn, ta lấy trực tiếp qua getModelToken hoặc lấy Model từ db connection, hoặc qua inject string.
  // NestJS Mongoose thường đăng ký model với tên "[ModelName]Model" hoặc sử dụng string.
  // Hãy xem file migration.ts cũ: app.get<Model<CriterionDocument>>('CriterionModel') -> Token là 'CriterionModel'
  const academicRecordModel = app.get<Model<AcademicRecordDocument>>('AcademicRecordModel');
  const criterionModel = app.get<Model<CriterionDocument>>('CriterionModel');
  const academicRecordService = app.get(AcademicRecordService);

  console.log('Starting migration for select_option academic records...');

  // 1. Tìm các academic_record active, chưa deleted và có record_title bắt đầu bằng "Lựa chọn option "
  const records = await academicRecordModel.find({
    status: 'active',
    is_deleted: { $ne: true },
    record_title: { $regex: /^Lựa chọn option / }
  }).exec();

  console.log(`Found ${records.length} potential legacy option records.`);

  let updatedCount = 0;
  const groupsToSync = new Map<string, { studentId: string; semesterId: string; criterionId: string }>();

  for (const record of records) {
    const recordTitle = record.record_title || '';
    const optionIdStr = recordTitle.replace('Lựa chọn option ', '').trim();
    if (!optionIdStr) continue;

    const criterionId = record.criterion_id ? (record.criterion_id as any)._id || record.criterion_id : null;
    if (!criterionId) continue;

    const criterion = await criterionModel.findById(criterionId).exec();
    if (!criterion) continue;

    const option = criterion.options?.find((o: any) => o.id === optionIdStr);
    if (option) {
      record.selected_option_id = option.id;
      record.selected_option_label = option.label;
      record.selected_option_score = option.score;
      await record.save();

      const studentId = record.student_id ? (record.student_id as any)._id || record.student_id : null;
      const semesterId = record.semester_id ? (record.semester_id as any)._id || record.semester_id : null;
      if (studentId && semesterId) {
        const key = `${studentId}_${semesterId}_${criterionId}`;
        groupsToSync.set(key, {
          studentId: studentId.toString(),
          semesterId: semesterId.toString(),
          criterionId: criterionId.toString()
        });
      }
      updatedCount++;
    }
  }

  console.log(`Updated ${updatedCount} academic records with structured option fields.`);

  // 2. Rebuild lại evaluation_detail
  console.log(`Syncing evaluation details for ${groupsToSync.size} student-criterion groups...`);
  let syncCount = 0;
  for (const group of groupsToSync.values()) {
    try {
      await academicRecordService.syncStudentCriterionScore(group.studentId, group.semesterId, group.criterionId);
      syncCount++;
    } catch (err) {
      console.error(`Failed to sync group student:${group.studentId} criterion:${group.criterionId}`, err);
    }
  }

  console.log(`Migration finished. Synced ${syncCount}/${groupsToSync.size} groups.`);
  await app.close();
}

bootstrap();
