import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ClubScheduleDocument = ClubSchedule & Document;

@Schema({ _id: false })
export class ScheduleRecurrence {
  @Prop({ type: String, enum: ['weekly', 'biweekly', 'monthly'] })
  type: string;

  @Prop({ min: 0, max: 6 })
  day_of_week: number;

  @Prop()
  until: Date;
}

export const ScheduleRecurrenceSchema =
  SchemaFactory.createForClass(ScheduleRecurrence);

@Schema({ timestamps: true, collection: 'club_schedules' })
export class ClubSchedule {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Club', required: true })
  club_id: Types.ObjectId;

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

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester', required: true })
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

export const ClubScheduleSchema = SchemaFactory.createForClass(ClubSchedule);

ClubScheduleSchema.index({ club_id: 1, start_time: 1 });
ClubScheduleSchema.index({ club_id: 1, semester_id: 1 });
ClubScheduleSchema.index({ status: 1, start_time: 1 });
