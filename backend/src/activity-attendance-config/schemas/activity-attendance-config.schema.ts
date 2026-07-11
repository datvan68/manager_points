import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityAttendanceConfigDocument = ActivityAttendanceConfig & Document;

@Schema({ timestamps: true, collection: 'activity_attendance_configs' })
export class ActivityAttendanceConfig {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Activity', default: null })
  activity_id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Semester',
    required: true,
  })
  semester_id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Criterion',
    required: true,
  })
  criterion_id: Types.ObjectId;

  // Point rules
  @Prop({ required: true, default: 0.5 })
  point_per_attendance: number;

  @Prop({ default: 0.25 })
  point_per_late: number;

  @Prop()
  max_points_per_semester: number;

  @Prop({ default: 1 })
  min_attendance_for_points: number;

  // Auto-sync settings
  @Prop({ default: true })
  auto_sync_on_approve: boolean;

  @Prop({ default: false })
  require_all_approved: boolean;

  @Prop({
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  created_by: Types.ObjectId;
}

export const ActivityAttendanceConfigSchema =
  SchemaFactory.createForClass(ActivityAttendanceConfig);

ActivityAttendanceConfigSchema.index(
  { activity_id: 1, semester_id: 1 },
  { unique: true, sparse: true },
);
ActivityAttendanceConfigSchema.index({ semester_id: 1, status: 1 });
