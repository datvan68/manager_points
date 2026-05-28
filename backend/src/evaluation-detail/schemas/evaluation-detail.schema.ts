import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { SummaryPoint } from '../../summaries-point/schemas/summary-point.schema';
import { Criterion } from '../../criteria/schemas/criterion.schema';
import { EvaluationLog, EvaluationLogSchema } from './evaluation-log.schema';

export type EvaluationDetailDocument = EvaluationDetail & Document;

@Schema({ timestamps: true })
export class EvaluationDetail {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SummaryPoint', required: true, index: true })
  summary_id: SummaryPoint;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Criterion', required: true, index: true })
  criterion_id: Criterion;

  // Lịch sử toàn bộ các bước chấm/chỉnh sửa
  @Prop({ type: [EvaluationLogSchema], default: [] })
  history: EvaluationLog[];

  // Số lần hiện tại (lấy từ bước chấm mới nhất để query mượt mà)
  @Prop({ required: true, min: 0, default: 0 })
  current_count: number;

  @Prop({
    type: String,
    enum: ['draft', 'teacher_evaluated', 'supervisor_evaluated', 'finalized'],
    default: 'draft',
    index: true
  })
  status: string;
}

export const EvaluationDetailSchema = SchemaFactory.createForClass(EvaluationDetail);
