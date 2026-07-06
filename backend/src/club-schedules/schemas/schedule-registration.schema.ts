import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ScheduleRegistrationDocument = ScheduleRegistration & Document;

@Schema({ timestamps: true, collection: 'schedule_registrations' })
export class ScheduleRegistration {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ClubSchedule',
    required: true,
  })
  schedule_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Club', required: true })
  club_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['registered', 'cancelled', 'waitlisted'],
    default: 'registered',
  })
  status: string;

  @Prop({ default: () => new Date() })
  registered_at: Date;

  @Prop()
  cancelled_at?: Date;
}

export const ScheduleRegistrationSchema =
  SchemaFactory.createForClass(ScheduleRegistration);

ScheduleRegistrationSchema.index(
  { schedule_id: 1, student_id: 1 },
  { unique: true },
);
ScheduleRegistrationSchema.index({ student_id: 1, status: 1 });
