import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Student } from '../../students/schemas/student.schema';
import { Semester } from '../../semesters/schemas/semester.schema';
import { AcademicRecord } from './academic-record.schema';
import { User } from '../../auth/schemas/user.schema';

export type AcademicRecordFollowUpDocument = AcademicRecordFollowUp & Document;

@Schema({ timestamps: true })
export class AcademicRecordFollowUp {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Student;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester', required: true })
  semester_id: Semester;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AcademicRecord', required: true })
  handled_through_record_id: AcademicRecord;

  @Prop({ type: Date, required: true })
  handled_through_created_at: Date;

  @Prop({ type: Number, required: true, min: 1 })
  handled_record_count: number;

  @Prop({ type: Date, required: true })
  handled_at: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  handled_by: User;

  @Prop({ type: String, required: false, maxlength: 500 })
  note?: string;
}

export const AcademicRecordFollowUpSchema = SchemaFactory.createForClass(AcademicRecordFollowUp);
AcademicRecordFollowUpSchema.index(
  { student_id: 1, semester_id: 1 },
  { unique: true, name: 'idx_academic_record_follow_up_student_semester' },
);
