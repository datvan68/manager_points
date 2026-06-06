import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Student } from '../../students/schemas/student.schema';
import { Semester } from '../../semesters/schemas/semester.schema';
import {
  EvaluationDetail,
  EvaluationDetailSchema,
} from '../../evaluation-detail/schemas/evaluation-detail.schema';

export type SummaryPointDocument = SummaryPoint & Document;

@Schema({ timestamps: true })
export class SummaryPoint {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  })
  student_id: Student;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Semester',
    required: true,
    index: true,
  })
  semester_id: Semester;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'EvaluationPeriod',
    required: false,
    index: true,
  })
  period_id?: MongooseSchema.Types.ObjectId;

  // null cho đến khi locked — SUM(details.final_score)
  @Prop({ type: Number, default: null })
  total_score: number | null;

  // Xuất sắc | Tốt | Khá | TB | Yếu | Kém — computed khi locked
  @Prop({ type: String, default: null })
  grading: string | null;

  @Prop({
    type: String,
    enum: ['draft', 'sv_submitted', 'gv_reviewed', 'locked'],
    default: 'draft',
    index: true,
  })
  status: string;

  // EMBEDDED — toàn bộ chi tiết đánh giá theo từng tiêu chí
  @Prop({ type: [EvaluationDetailSchema], default: [] })
  details: EvaluationDetail[];
}

export const SummaryPointSchema = SchemaFactory.createForClass(SummaryPoint);

SummaryPointSchema.index(
  { student_id: 1, semester_id: 1, period_id: 1 },
  { unique: true, name: 'uq_student_period' },
);
SummaryPointSchema.index({ period_id: 1, status: 1 }, { name: 'idx_period_status' });
