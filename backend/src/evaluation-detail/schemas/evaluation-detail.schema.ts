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

  @Prop({ type: String, default: null })
  selected_option_id?: string | null;

  @Prop({ type: String, default: null })
  selected_option_label?: string | null;

  @Prop({ type: Number, default: null })
  selected_option_score?: number | null;

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

  // === NEW FIELDS — Role-Aware Counts (taskscope §2, §3, §5) ===

  // Role-specific record counts — replaces single ambiguous current_count
  @Prop({ type: Object, default: null })
  counts_by_role?: {
    student?: number;
    teacher?: number;
    supervisor?: number;
    admin?: number;
    system?: number;
    import?: number;
  };

  // === Count Resolution (taskscope §3) ===

  // Approved count after role-aware resolution
  @Prop({ type: Number, default: null })
  resolved_count?: number | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    default: null,
  })
  resolved_by_user_id?: MongooseSchema.Types.ObjectId | null;

  // Role of the resolver — students cannot resolve their own counts
  @Prop({
    type: String,
    enum: ['teacher', 'supervisor', 'admin', 'system'],
    default: null,
  })
  resolved_by_role?: string | null;

  @Prop({ type: Date, default: null })
  resolved_at?: Date | null;

  // How the count was resolved
  @Prop({
    type: String,
    enum: ['teacher_review', 'supervisor_approval', 'admin_override', 'automatic_rule'],
    default: null,
  })
  resolution_source?: string | null;

  // === Audit Reference (taskscope §5) ===

  // Total active records count (lightweight audit reference)
  @Prop({ type: Number, default: 0 })
  source_record_count?: number;

  // Most recent record ID (for quick audit lookup)
  @Prop({ type: String, default: null })
  last_source_record_id?: string | null;

  @Prop({ type: Date, default: null })
  last_record_at?: Date | null;

  // === Conflict Indicator (taskscope §3.1) ===

  // True when role counts disagree and no resolution exists
  @Prop({ type: Boolean, default: false })
  has_conflict?: boolean;
}

export const EvaluationDetailSchema =
  SchemaFactory.createForClass(EvaluationDetail);
