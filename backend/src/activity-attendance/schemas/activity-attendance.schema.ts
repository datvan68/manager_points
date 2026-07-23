import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityAttendanceDocument = ActivityAttendance & Document;

@Schema({ timestamps: true, collection: 'activity_attendances' })
export class ActivityAttendance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Activity', required: true })
  activity_id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'ActivitySchedule',
    required: true,
  })
  schedule_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Semester',
    required: true,
  })
  semester_id: Types.ObjectId;

  // Attendance data
  @Prop({
    type: String,
    enum: ['present', 'absent', 'late', 'excused'],
    required: true,
  })
  status: string;

  @Prop()
  check_in_time: Date;

  @Prop()
  check_out_time: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Class' })
  class_id?: Types.ObjectId;

  @Prop({ enum: ['qr', 'proximity', 'manual_class'] })
  attendance_method?: string;

  @Prop({ trim: true })
  note: string;

  // Who recorded
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  recorded_by: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['student', 'teacher', 'advisor', 'president'],
    required: true,
  })
  recorded_by_role: string;

  @Prop({ default: () => new Date() })
  recorded_at: Date;

  // Approval workflow
  @Prop({
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  })
  approval_status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  approved_by: Types.ObjectId;

  @Prop()
  approved_at: Date;

  @Prop({ trim: true })
  rejection_reason: string;

  // Training point sync
  @Prop({ default: false })
  synced_to_academic_record: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'AcademicRecord' })
  academic_record_id: Types.ObjectId;
}

export const ActivityAttendanceSchema =
  SchemaFactory.createForClass(ActivityAttendance);

ActivityAttendanceSchema.index({ schedule_id: 1, student_id: 1 }, { unique: true });
ActivityAttendanceSchema.index({ activity_id: 1, semester_id: 1, approval_status: 1 });
ActivityAttendanceSchema.index({ student_id: 1, semester_id: 1 });
ActivityAttendanceSchema.index({ approval_status: 1 });
