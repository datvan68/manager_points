import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AcademicRecordService } from './academic-record.service';
import { AcademicRecordController } from './academic-record.controller';
import { ScoreEngineService } from './score-engine.service';
import { CountResolutionService } from './count-resolution.service';
import { ProjectionService } from './projection.service';
import { ProjectionListener } from './projection.listener';
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
import { SummariesPointModule } from '../summaries-point/summaries-point.module';

@Module({
  imports: [
    forwardRef(() => SummariesPointModule),
    MongooseModule.forFeature([
      { name: AcademicRecord.name, schema: AcademicRecordSchema },
      { name: SummaryPoint.name, schema: SummaryPointSchema },
      { name: Criterion.name, schema: CriterionSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Class.name, schema: ClassSchema },
    ]),
  ],
  controllers: [AcademicRecordController],
  providers: [
    AcademicRecordService,
    ScoreEngineService,
    CountResolutionService,
    ProjectionService,
    ProjectionListener,
  ],
  exports: [
    AcademicRecordService,
    ScoreEngineService,
    CountResolutionService,
    ProjectionService,
  ],
})
export class AcademicRecordModule {}
