import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityCompletionAwardDocument = ActivityCompletionAward & Document;

@Schema({ timestamps: true, collection: 'activity_completion_awards' })
export class ActivityCompletionAward {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Activity', required: true })
  activity_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Criterion', required: true })
  criterion_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester', required: true })
  semester_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AcademicRecord', required: true })
  academic_record_id: Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  awarded_at: Date;
}

export const ActivityCompletionAwardSchema =
  SchemaFactory.createForClass(ActivityCompletionAward);

ActivityCompletionAwardSchema.index(
  { activity_id: 1, student_id: 1, criterion_id: 1 },
  { unique: true },
);
