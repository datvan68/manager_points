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

  @Prop({
    type: String,
    enum: ['diamond', 'gold', 'silver', 'bronze', 'unranked'],
    default: null,
  })
  rank_tier: string | null;

  @Prop({ type: String, default: null })
  rank_label: string | null;

  @Prop({ type: Date, default: null })
  rank_locked_at: Date | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  rank_updated_by: MongooseSchema.Types.ObjectId | null;
}

export const SummaryPointSchema = SchemaFactory.createForClass(SummaryPoint);

// Unique index uq_student_period:
// Ràng buộc tính độc nhất trên bộ ba { student_id, semester_id, period_id }.
// Thiết kế này cho phép:
// - Một bản ghi điểm tổng kết cấp học kỳ (period_id: null) duy nhất cho mỗi sinh viên trong một học kỳ.
// - Hoặc có thể có thêm các bản ghi điểm rèn luyện cho các kỳ đánh giá con (period_id cụ thể) của cùng một sinh viên trong học kỳ đó.
SummaryPointSchema.index(
  { student_id: 1, semester_id: 1, period_id: 1 },
  { unique: true, name: 'uq_student_period' },
);
SummaryPointSchema.index(
  { period_id: 1, status: 1 },
  { name: 'idx_period_status' },
);
SummaryPointSchema.index(
  { student_id: 1, status: 1, updatedAt: -1 },
  { name: 'idx_student_status_updated' },
);
