import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcademicRecordService } from './academic-record.service';
import { AcademicRecordController } from './academic-record.controller';
import {
  AcademicRecord,
  AcademicRecordSchema,
} from './schemas/academic-record.schema';
import {
  SummaryPoint,
  SummaryPointSchema,
} from '../summaries-point/schemas/summary-point.schema';
import {
  Criterion,
  CriterionSchema,
} from '../criteria/schemas/criterion.schema';

import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AcademicRecord.name, schema: AcademicRecordSchema },
      { name: SummaryPoint.name, schema: SummaryPointSchema },
      { name: Criterion.name, schema: CriterionSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Class.name, schema: ClassSchema },
    ]),
  ],
  controllers: [AcademicRecordController],
  providers: [AcademicRecordService],
  exports: [AcademicRecordService],
})
export class AcademicRecordModule {}
