import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ClubAttendanceDocument = ClubAttendance & Document;

@Schema({ timestamps: true, collection: 'club_attendances' })
export class ClubAttendance {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Club', required: true })
  club_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ClubSchedule', required: true })
  schedule_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester', required: true })
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

export const ClubAttendanceSchema =
  SchemaFactory.createForClass(ClubAttendance);

ClubAttendanceSchema.index(
  { schedule_id: 1, student_id: 1 },
  { unique: true },
);
ClubAttendanceSchema.index({ club_id: 1, semester_id: 1, approval_status: 1 });
ClubAttendanceSchema.index({ student_id: 1, semester_id: 1 });
ClubAttendanceSchema.index({ approval_status: 1 });
