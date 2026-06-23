import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PasswordResetRequestDocument = PasswordResetRequest & Document;

@Schema({ timestamps: true, collection: 'password_reset_requests' })
export class PasswordResetRequest {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  user_id: Types.ObjectId | null;

  @Prop({ required: true })
  normalized_email: string;

  @Prop({ type: String, default: null })
  otp_hash: string | null;

  @Prop({ type: Date, default: null })
  otp_expires_at: Date | null;

  @Prop({ required: true, default: 0 })
  otp_attempts: number;

  @Prop({ required: true, default: 5 })
  max_otp_attempts: number;

  @Prop({ required: true, default: 0 })
  resend_count: number;

  @Prop({ type: Date, default: null })
  resend_available_at: Date | null;

  @Prop({ type: Date, default: null })
  verified_at: Date | null;

  @Prop({ type: String, default: null })
  reset_token_hash: string | null;

  @Prop({ type: Date, default: null })
  reset_token_expires_at: Date | null;

  @Prop({ type: Date, default: null })
  used_at: Date | null;

  @Prop({ type: Date, default: null })
  invalidated_at: Date | null;

  @Prop({ type: String, default: null })
  requester_ip_hash: string | null;

  @Prop({ type: String, default: null })
  user_agent_hash: string | null;

  @Prop({ required: true })
  expires_at: Date;
}

export const PasswordResetRequestSchema = SchemaFactory.createForClass(PasswordResetRequest);

PasswordResetRequestSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });
PasswordResetRequestSchema.index({ user_id: 1 });
PasswordResetRequestSchema.index({ normalized_email: 1 });
PasswordResetRequestSchema.index({ reset_token_hash: 1 });
