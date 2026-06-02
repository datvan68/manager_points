import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { EvaluationDetail } from '../../evaluation-detail/schemas/evaluation-detail.schema';
import { Student } from '../../students/schemas/student.schema';
import { Semester } from '../../semesters/schemas/semester.schema';
import { DailyClassReport } from '../../daily-class-report/schemas/daily-class-report.schema';

export type AcademicRecordDocument = AcademicRecord & Document;

@Schema({ timestamps: true })
export class AcademicRecord {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'EvaluationDetail',
    required: true,
    index: true,
  })
  evaluation_detail_id: EvaluationDetail;

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
    type: MongooseSchema.Types.ObjectId,
    ref: 'DailyClassReport',
    required: false,
    index: true,
  })
  daily_report_id?: DailyClassReport;
}

export const AcademicRecordSchema =
  SchemaFactory.createForClass(AcademicRecord);
