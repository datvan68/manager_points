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
    enum: ['active', 'inactive'],
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
}

export const AcademicRecordSchema =
  SchemaFactory.createForClass(AcademicRecord);

AcademicRecordSchema.index(
  { idempotency_key: 1 },
  { unique: true, sparse: true, name: 'idx_idempotency_key' }
);

AcademicRecordSchema.index(
  { student_id: 1, semester_id: 1, criterion_id: 1, status: 1 },
  { name: 'idx_aggregate' },
);
