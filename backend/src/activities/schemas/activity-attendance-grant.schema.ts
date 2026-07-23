import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityAttendanceGrantDocument = ActivityAttendanceGrant & Document;
export type ActivityAttendanceMethod = 'qr' | 'proximity' | 'manual_class';

@Schema({ timestamps: true, collection: 'activity_attendance_grants' })
export class ActivityAttendanceGrant {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Activity', required: true })
  activity_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  teacher_id: Types.ObjectId;

  @Prop({ type: [String], enum: ['qr', 'proximity', 'manual_class'], required: true })
  allowed_methods: ActivityAttendanceMethod[];

  @Prop({ enum: ['active', 'revoked'], default: 'active' })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  granted_by: Types.ObjectId;

  @Prop() granted_at: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) revoked_by?: Types.ObjectId;
  @Prop() revoked_at?: Date;
}

export const ActivityAttendanceGrantSchema =
  SchemaFactory.createForClass(ActivityAttendanceGrant);
ActivityAttendanceGrantSchema.index({ activity_id: 1, teacher_id: 1 }, { unique: true });
ActivityAttendanceGrantSchema.index({ teacher_id: 1, status: 1 });
