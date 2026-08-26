import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  EvaluationPeriod,
  EvaluationPeriodSchema,
} from './schemas/evaluation-period.schema';
import { EvaluationPeriodsService } from './evaluation-periods.service';
import { EvaluationPeriodsController } from './evaluation-periods.controller';
import { SummaryPoint, SummaryPointSchema } from '../summaries-point/schemas/summary-point.schema';
import { Student, StudentSchema } from '../students/schemas/student.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EvaluationPeriod.name, schema: EvaluationPeriodSchema },
      { name: SummaryPoint.name, schema: SummaryPointSchema },
      { name: Student.name, schema: StudentSchema },
    ]),
  ],
  controllers: [EvaluationPeriodsController],
  providers: [EvaluationPeriodsService],
  exports: [EvaluationPeriodsService],
})
export class EvaluationPeriodsModule {}
