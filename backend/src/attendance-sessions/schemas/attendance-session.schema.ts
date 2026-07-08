import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type AttendanceSessionDocument = AttendanceSession & Document;

@Schema({ timestamps: true, collection: 'attendance_sessions' })
export class AttendanceSession {
  // ── Context: xác định phiên thuộc domain nào ──
  @Prop({
    type: String,
    enum: ['club', 'class', 'event', 'dormitory'],
    required: true,
  })
  context_type: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  context_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'ClubSchedule' })
  schedule_id: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Semester',
    required: true,
  })
  semester_id: Types.ObjectId;

  // ── Session config ──
  @Prop({
    type: String,
    enum: ['qr', 'proximity', 'manual'],
    required: true,
  })
  method: string;

  @Prop({
    type: String,
    enum: ['active', 'closed', 'expired'],
    default: 'active',
  })
  status: string;

  // ── QR specific ──
  @Prop()
  qr_token: string;

  @Prop()
  qr_token_expires_at: Date;

  @Prop({ default: 30 })
  qr_refresh_interval: number;

  // ── Proximity specific ──
  @Prop({ type: Number })
  latitude: number;

  @Prop({ type: Number })
  longitude: number;

  @Prop({ type: Number, default: 100 })
  radius_meters: number;

  // ── Lifecycle ──
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  opened_by: Types.ObjectId;

  @Prop({ default: () => new Date() })
  opened_at: Date;

  @Prop()
  closed_at: Date;

  @Prop()
  auto_close_at: Date;

  // ── Settings ──
  @Prop({ default: false })
  allow_late_checkin: boolean;

  @Prop({ default: true })
  auto_approve: boolean;

  @Prop()
  max_checkins: number;

  // ── Metadata ──
  @Prop({ trim: true })
  title: string;

  @Prop({ trim: true })
  description: string;

  @Prop({ default: 0 })
  checkin_count: number;
}

export const AttendanceSessionSchema =
  SchemaFactory.createForClass(AttendanceSession);

// Indexes
AttendanceSessionSchema.index(
  { context_type: 1, context_id: 1, status: 1 },
);
AttendanceSessionSchema.index({ qr_token: 1 }, { sparse: true });
AttendanceSessionSchema.index({ status: 1, auto_close_at: 1 });
AttendanceSessionSchema.index({ schedule_id: 1 }, { sparse: true });
