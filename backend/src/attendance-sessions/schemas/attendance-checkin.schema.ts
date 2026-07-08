import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AttendanceCheckinDocument = AttendanceCheckin & Document;

@Schema({ timestamps: true, collection: 'attendance_checkins' })
export class AttendanceCheckin {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'AttendanceSession',
    required: true,
  })
  session_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['qr', 'proximity'],
    required: true,
  })
  method: string;

  @Prop({
    type: String,
    enum: ['present', 'late'],
    default: 'present',
  })
  status: string;

  // ── Verification data ──
  @Prop({ default: () => new Date() })
  checked_in_at: Date;

  @Prop({ type: Number })
  latitude: number;

  @Prop({ type: Number })
  longitude: number;

  @Prop({ type: Number })
  distance_meters: number;

  @Prop()
  qr_token_used: string;

  // ── Device info (anti-fraud) ──
  @Prop({ trim: true })
  device_fingerprint: string;

  @Prop({ trim: true })
  user_agent: string;

  // ── Sync status ──
  @Prop({ default: false })
  synced: boolean;

  @Prop({ type: MongooseSchema.Types.ObjectId })
  synced_record_id: Types.ObjectId;
}

export const AttendanceCheckinSchema =
  SchemaFactory.createForClass(AttendanceCheckin);

// Unique: 1 student per session
AttendanceCheckinSchema.index(
  { session_id: 1, student_id: 1 },
  { unique: true },
);
AttendanceCheckinSchema.index({ session_id: 1, checked_in_at: 1 });
AttendanceCheckinSchema.index({ student_id: 1 });
