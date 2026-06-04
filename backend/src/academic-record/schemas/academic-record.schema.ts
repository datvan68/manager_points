import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { EvaluationDetail } from '../../evaluation-detail/schemas/evaluation-detail.schema';
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
    ref: 'EvaluationDetail',
    required: false,
    index: true,
  })
  evaluation_detail_id?: EvaluationDetail;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Criterion',
    required: false,
    index: true,
  })
  criteria_id?: Criterion;

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

  @Prop({ required: true, type: String })
  record_title: string;

  @Prop({ required: true, type: Number })
  points_effect: number;

  @Prop({
    required: true,
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    index: true,
  })
  status: string;

  @Prop({
    type: String,
    enum: ['system', 'manual', 'direct_grading'],
    default: 'manual',
    index: true,
  })
  source: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'DailyClassReport',
    required: false,
    index: true,
  })
  daily_report_id?: DailyClassReport;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: false,
    index: true,
  })
  user_id?: User;

  @Prop({ required: false, type: Date })
  date_record?: Date;

  @Prop({ type: String, default: '' })
  description?: string;

  @Prop({ type: Boolean, default: false, index: true })
  is_delete: boolean;
}

export const AcademicRecordSchema = SchemaFactory.createForClass(AcademicRecord);

AcademicRecordSchema.index({ student_id: 1, semester_id: 1, status: 1 });
