import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EvaluationDetailService } from './evaluation-detail.service';
import { EvaluationDetailController } from './evaluation-detail.controller';
import { EvaluationDetail, EvaluationDetailSchema } from './schemas/evaluation-detail.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: EvaluationDetail.name, schema: EvaluationDetailSchema }]),
  ],
  controllers: [EvaluationDetailController],
  providers: [EvaluationDetailService],
  exports: [EvaluationDetailService],
})
export class EvaluationDetailModule {}
