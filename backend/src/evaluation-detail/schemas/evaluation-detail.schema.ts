import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { EvaluationLog, EvaluationLogSchema } from './evaluation-log.schema';

export type EvaluationDetailDocument = EvaluationDetail & Document;

@Schema({ _id: true, timestamps: true })
export class EvaluationDetail {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Criterion',
    required: true,
    index: true,
  })
  criterion_id: MongooseSchema.Types.ObjectId;

  // Tổng hợp từ academic_records
  @Prop({ type: Number, required: true, min: 0, default: 0 })
  current_count: number;

  // Computed: clamp(current_count × score_per_unit, min_score, max_score)
  @Prop({ type: Number, default: null })
  system_score?: number | null;

  // --- Vòng đời đánh giá ---

  // Sinh viên tự chấm
  @Prop({ type: Number, default: null })
  sv_score?: number | null;

  @Prop({ type: Date, default: null })
  sv_submitted_at?: Date | null;

  // GVCN duyệt
  @Prop({ type: Number, default: null })
  gv_score?: number | null;

  @Prop({ type: Date, default: null })
  gv_reviewed_at?: Date | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  gv_reviewed_by?: MongooseSchema.Types.ObjectId | null;

  // Admin chốt
  @Prop({ type: Number, default: null })
  final_score?: number | null;

  @Prop({ type: Date, default: null })
  locked_at?: Date | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  locked_by?: MongooseSchema.Types.ObjectId | null;

  @Prop({
    type: String,
    enum: ['draft', 'sv_submitted', 'gv_reviewed', 'locked'],
    default: 'draft',
  })
  status: string;

  @Prop({ type: String, default: '' })
  description?: string;

  // Lịch sử thay đổi (EMBEDDED)
  @Prop({ type: [EvaluationLogSchema], default: [] })
  log: EvaluationLog[];
}

export const EvaluationDetailSchema =
  SchemaFactory.createForClass(EvaluationDetail);
