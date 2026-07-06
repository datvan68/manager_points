import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SummariesPointModule } from '../summaries-point/summaries-point.module';
import { EvaluationDetailService } from './evaluation-detail.service';
import { EvaluationDetailController } from './evaluation-detail.controller';
import {
  EvaluationDetail,
  EvaluationDetailSchema,
} from './schemas/evaluation-detail.schema';
import {
  AcademicRecord,
  AcademicRecordSchema,
} from '../academic-record/schemas/academic-record.schema';
import {
  Criterion,
  CriterionSchema,
} from '../criteria/schemas/criterion.schema';
import {
  SummaryPoint,
  SummaryPointSchema,
} from '../summaries-point/schemas/summary-point.schema';
import { User, UserSchema } from '../auth/schemas/user.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';
import { Class, ClassSchema } from '../classes/schemas/class.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EvaluationDetail.name, schema: EvaluationDetailSchema },
      { name: AcademicRecord.name, schema: AcademicRecordSchema },
      { name: Criterion.name, schema: CriterionSchema },
      { name: SummaryPoint.name, schema: SummaryPointSchema },
      { name: User.name, schema: UserSchema },
      { name: Student.name, schema: StudentSchema },
      { name: Class.name, schema: ClassSchema },
    ]),
    forwardRef(() => SummariesPointModule),
  ],
  controllers: [EvaluationDetailController],
  providers: [EvaluationDetailService],
  exports: [EvaluationDetailService],
})
export class EvaluationDetailModule {}
