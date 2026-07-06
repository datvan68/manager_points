import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Student } from '../../students/schemas/student.schema';
import { Semester } from '../../semesters/schemas/semester.schema';
import { DailyClassReport } from '../../daily-class-report/schemas/daily-class-report.schema';
import { User } from '../../auth/schemas/user.schema';
import { Criterion } from '../../criteria/schemas/criterion.schema';

export type AcademicRecordDocument = AcademicRecord & Document;

@Schema({ timestamps: true })
export class AcademicRecord {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Student',
    required: true,
    index: true,
  })
  student_id: Student;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Criterion',
    required: true,
    index: true,
  })
  criterion_id: Criterion;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Semester',
    required: true,
    index: true,
  })
  semester_id: Semester;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'DailyClassReport',
    required: false,
    index: true,
  })
  daily_report_id?: DailyClassReport;

  @Prop({ type: String, required: false })
  record_title?: string;

  @Prop({ type: String, required: false })
  evidence_url?: string;

  @Prop({ type: String, required: false })
  description?: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  })
  recorded_by?: User;

  @Prop({ type: Date, required: false, default: Date.now })
  recorded_at?: Date;

  @Prop({
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'rejected', 'confirmed'],
    default: 'active',
    index: true,
  })
  status: string;

  @Prop({ type: Boolean, default: false, index: true })
  is_deleted: boolean;

  @Prop({ type: String, required: false })
  idempotency_key?: string;

  @Prop({ type: String, required: false, default: 'manual' })
  source?: string;

  @Prop({ type: String, required: false })
  selected_option_id?: string;

  @Prop({ type: String, required: false })
  selected_option_label?: string;

  @Prop({ type: Number, required: false })
  selected_option_score?: number;

  // === NEW FIELDS — Role-Aware Academic Record (taskscope §1) ===

  // Who recorded this occurrence — virtual roles 'system'/'import' represent automated sources
  @Prop({
    type: String,
    enum: ['student', 'teacher', 'supervisor', 'admin', 'system', 'import'],
    default: null,
    index: true,
  })
  recorded_by_role?: string;

  // What type of record this represents
  @Prop({
    type: String,
    enum: [
      'activity',
      'discipline',
      'manual_score',
      'selected_option',
      'adjustment',
    ],
    default: null,
  })
  record_type?: string;

  // What scoring action this record represents
  @Prop({
    type: String,
    enum: ['count', 'select_option', 'manual_score', 'bonus', 'penalty'],
    default: null,
  })
  action_type?: string;

  // Number of occurrences this record represents (default: 1 for count-based)
  @Prop({ type: Number, default: 1 })
  quantity: number;

  // Structured source reference — replaces string 'source' field after migration
  @Prop({ type: String, default: null })
  source_type?: string;

  @Prop({ type: String, default: null })
  source_id?: string;

  // Structured data — replaces string-based parsing from record_title
  @Prop({ type: Object, default: null })
  payload?: Record<string, unknown>;

  // When the actual occurrence happened (may differ from recorded_at)
  @Prop({ type: Date, default: null })
  occurred_at?: Date;

  // Groups records belonging to the same logical occurrence across multiple criteria
  @Prop({ type: String, default: null })
  occurrence_key?: string;
}

export const AcademicRecordSchema =
  SchemaFactory.createForClass(AcademicRecord);

AcademicRecordSchema.index(
  { idempotency_key: 1 },
  { unique: true, sparse: true, name: 'idx_idempotency_key' },
);

// Legacy index — preserved during migration, will be replaced by idx_role_aware_aggregate
AcademicRecordSchema.index(
  { student_id: 1, semester_id: 1, criterion_id: 1, status: 1 },
  { name: 'idx_aggregate' },
);

// Covered index for role-aware count queries (taskscope §Migration step 4)
AcademicRecordSchema.index(
  {
    student_id: 1,
    semester_id: 1,
    criterion_id: 1,
    recorded_by_role: 1,
    status: 1,
    is_deleted: 1,
  },
  { name: 'idx_role_aware_aggregate' },
);

// Source-based lookups (taskscope §Migration step 4)
AcademicRecordSchema.index(
  { source_type: 1, source_id: 1 },
  { name: 'idx_source_lookup' },
);
