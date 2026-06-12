import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LoginLogDocument = LoginLog & Document;

@Schema({ timestamps: true, collection: 'login_logs' })
export class LoginLog {
  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  user_id: Types.ObjectId | null;

  @Prop({ required: true })
  ip_address: string;

  @Prop({ required: true })
  action: string; // login_success, login_failure, password_reset, password_change, logout

  @Prop({ type: Date, default: Date.now })
  login_time: Date;

  @Prop({ default: null })
  details: string;
}

export const LoginLogSchema = SchemaFactory.createForClass(LoginLog);

LoginLogSchema.index({ login_time: -1 });
LoginLogSchema.index({ user_id: 1, login_time: -1 });
LoginLogSchema.index({ action: 1, login_time: -1 });
LoginLogSchema.index({ ip_address: 1 });
