import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityMemberDocument = ActivityMember & Document;

@Schema({ timestamps: true, collection: 'activity_members' })
export class ActivityMember {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Activity', required: true })
  activity_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['member', 'president', 'vice_president', 'secretary', 'treasurer'],
    default: 'member',
  })
  role: string;

  @Prop({
    type: String,
    enum: ['pending', 'active', 'inactive', 'rejected', 'left'],
    default: 'pending',
  })
  status: string;

  @Prop()
  joined_at?: Date;

  @Prop()
  left_at?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  approved_by?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester', required: true })
  semester_id: Types.ObjectId;

  @Prop({ type: Boolean, required: true, default: false })
  occupies_slot: boolean;
}

export const ActivityMemberSchema = SchemaFactory.createForClass(ActivityMember);

ActivityMemberSchema.index(
  { activity_id: 1, student_id: 1, semester_id: 1 },
  { unique: true },
);
ActivityMemberSchema.index({ student_id: 1 });
ActivityMemberSchema.index({ activity_id: 1, status: 1 });
ActivityMemberSchema.index(
  { student_id: 1, semester_id: 1 },
  {
    unique: true,
    partialFilterExpression: { occupies_slot: true },
  },
);
