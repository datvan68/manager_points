import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcademicRecordService } from './academic-record.service';
import { AcademicRecordController } from './academic-record.controller';
import {
  AcademicRecord,
  AcademicRecordSchema,
} from './schemas/academic-record.schema';
import {
  EvaluationDetail,
  EvaluationDetailSchema,
} from '../evaluation-detail/schemas/evaluation-detail.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AcademicRecord.name, schema: AcademicRecordSchema },
      { name: EvaluationDetail.name, schema: EvaluationDetailSchema },
    ]),
  ],
  controllers: [AcademicRecordController],
  providers: [AcademicRecordService],
  exports: [AcademicRecordService],
})
export class AcademicRecordModule {}
