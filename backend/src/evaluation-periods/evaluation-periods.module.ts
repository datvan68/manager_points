import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  EvaluationPeriod,
  EvaluationPeriodSchema,
} from './schemas/evaluation-period.schema';
import { EvaluationPeriodsService } from './evaluation-periods.service';
import { EvaluationPeriodsController } from './evaluation-periods.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: EvaluationPeriod.name, schema: EvaluationPeriodSchema },
    ]),
  ],
  controllers: [EvaluationPeriodsController],
  providers: [EvaluationPeriodsService],
  exports: [EvaluationPeriodsService],
})
export class EvaluationPeriodsModule {}
