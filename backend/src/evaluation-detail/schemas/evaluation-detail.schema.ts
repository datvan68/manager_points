import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { SummaryPoint } from '../../summaries-point/schemas/summary-point.schema';
import { Criterion } from '../../criteria/schemas/criterion.schema';

export type EvaluationDetailDocument = EvaluationDetail & Document;

@Schema({ timestamps: true })
export class EvaluationDetail {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SummaryPoint', required: true, index: true })
  summary_id: SummaryPoint;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Criterion', required: true, index: true })
  criterion_id: Criterion;

  @Prop({ required: true, min: 0, default: 0 })
  student_score: number;

  @Prop({ required: true, min: 0, default: 0 })
  advisor_score: number;
}

export const EvaluationDetailSchema = SchemaFactory.createForClass(EvaluationDetail);
