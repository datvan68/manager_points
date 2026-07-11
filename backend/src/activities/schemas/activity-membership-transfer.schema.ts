import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityMembershipTransferDocument = ActivityMembershipTransfer & Document;

@Schema({ timestamps: true, collection: 'activity_membership_transfers' })
export class ActivityMembershipTransfer {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester', required: true })
  semester_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Activity', required: true })
  from_activity_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Activity', required: true })
  to_activity_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ActivityMember', required: true })
  from_membership_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ActivityMember', required: true })
  to_membership_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['self_service', 'teacher_approval', 'admin_direct'],
    required: true,
  })
  mode: 'self_service' | 'teacher_approval' | 'admin_direct';

  @Prop({
    type: String,
    enum: ['pending', 'completed', 'rejected'],
    required: true,
  })
  status: 'pending' | 'completed' | 'rejected';

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  requested_by: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  decided_by?: Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  requested_at: Date;

  @Prop({ type: Date })
  decided_at?: Date;
}

export const ActivityMembershipTransferSchema =
  SchemaFactory.createForClass(ActivityMembershipTransfer);

ActivityMembershipTransferSchema.index(
  { student_id: 1, semester_id: 1, mode: 1, status: 1 }
);
ActivityMembershipTransferSchema.index(
  { to_membership_id: 1 },
  { unique: true }
);
ActivityMembershipTransferSchema.index(
  { to_activity_id: 1, status: 1, requested_at: -1 }
);
