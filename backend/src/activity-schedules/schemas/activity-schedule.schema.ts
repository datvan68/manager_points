import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityScheduleDocument = ActivitySchedule & Document;

@Schema({ _id: false })
export class ScheduleRecurrence {
  @Prop({ type: String, enum: ['weekly', 'biweekly', 'monthly'] })
  type: string;

  @Prop({ min: 0, max: 6 })
  day_of_week: number;

  @Prop()
  until: Date;

  @Prop()
  start: Date;

  @Prop()
  source_week_start_date: Date;

  @Prop()
  source_week_end_date: Date;
}

export const ScheduleRecurrenceSchema =
  SchemaFactory.createForClass(ScheduleRecurrence);

@Schema({ timestamps: true, collection: 'activity_schedules' })
export class ActivitySchedule {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Activity', required: true })
  activity_id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ trim: true })
  description: string;

  @Prop({
    type: String,
    enum: ['regular', 'event', 'exam', 'meeting'],
    default: 'regular',
  })
  schedule_type: string;

  @Prop({ trim: true })
  location: string;

  @Prop({ required: true })
  start_time: Date;

  @Prop({ required: true })
  end_time: Date;

  @Prop({ type: ScheduleRecurrenceSchema })
  recurrence: ScheduleRecurrence;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  recurrence_id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Semester',
    required: true,
  })
  semester_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  instructor_id: Types.ObjectId;

  @Prop()
  max_attendees: number;

  @Prop({
    type: String,
    enum: ['scheduled', 'ongoing', 'completed', 'cancelled'],
    default: 'scheduled',
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  created_by: Types.ObjectId;
}

export const ActivityScheduleSchema = SchemaFactory.createForClass(ActivitySchedule);

ActivityScheduleSchema.index({ activity_id: 1, start_time: 1 });
ActivityScheduleSchema.index({ activity_id: 1, semester_id: 1 });
ActivityScheduleSchema.index({ status: 1, start_time: 1 });
