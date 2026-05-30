import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Student } from '../../students/schemas/student.schema';
import { Semester } from '../../semesters/schemas/semester.schema';

export type SummaryPointDocument = SummaryPoint & Document;

@Schema({ timestamps: true })
export class SummaryPoint {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Student;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester', required: true })
  semester_id: Semester;

  @Prop({ required: true, min: 0, max: 100 })
  total_score: number;

  @Prop({ required: true })
  grading: string;

  @Prop({ required: true, default: 'inactive', enum: ['active', 'inactive'] })
  status: string;
}

export const SummaryPointSchema = SchemaFactory.createForClass(SummaryPoint);
