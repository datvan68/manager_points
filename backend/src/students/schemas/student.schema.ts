import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Class } from '../../classes/schemas/class.schema';
import { User } from '../../auth/schemas/user.schema';
import { SummaryPoint } from '../../summaries-point/schemas/summary-point.schema';

export type StudentDocument = Student & Document;

@Schema({ _id: false })
export class TrainingPointSnapshot {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester', required: true })
  semester_id: Types.ObjectId;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'EvaluationPeriod', required: true })
  period_id: Types.ObjectId;
  @Prop({ type: Number, required: true }) total_score: number;
  @Prop({ type: String, default: null }) grading: string | null;
  @Prop({ type: String, default: null }) rank_tier: string | null;
  @Prop({ type: String, default: null }) rank_label: string | null;
  @Prop({ type: Date, required: true }) locked_at: Date;
}

@Schema({ timestamps: true })
export class Student {
  @Prop({ required: true, unique: true })
  student_code: string;

  @Prop({ required: true })
  full_name: string;

  @Prop()
  email: string;

  @Prop({ required: true })
  date_bir: Date;

  @Prop({ required: true, enum: ['Male', 'Female', 'Other'] })
  sex: string;

  @Prop({
    required: true,
    enum: ['Studying', 'Reserved', 'Dropped', 'Graduated', 'Suspended'],
    default: 'Studying',
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Class' })
  class_id: Types.ObjectId | Class;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'SummaryPoint' })
  training_point_id: Types.ObjectId | SummaryPoint;

  @Prop({ type: [TrainingPointSnapshot], default: [] })
  training_point_history: TrainingPointSnapshot[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    unique: true,
    sparse: true,
  })
  user_id?: Types.ObjectId | User;
}

export const StudentSchema = SchemaFactory.createForClass(Student);
