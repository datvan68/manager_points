import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, SchemaTypes } from 'mongoose';

export type AuthSessionDocument = AuthSession & Document;

@Schema({ timestamps: true, collection: 'auth_sessions' })
export class AuthSession {
  @Prop({ type: SchemaTypes.ObjectId, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ required: true })
  expires_at: Date;

  @Prop({ default: false })
  remember: boolean;

  // These credentials have the same storage boundary as existing refresh_tokens.
  // Never return them in session-management responses.
  @Prop({ required: true })
  current_token: string;

  @Prop({ type: String, default: null })
  previous_token: string | null;

  @Prop({ type: Date, default: null })
  retry_until: Date | null;

  @Prop({ type: Date, default: null })
  revoked_at: Date | null;

  @Prop({ default: 'Trình duyệt' })
  device_label: string;

  @Prop({ type: Date, default: Date.now })
  last_active_at: Date;

  @Prop({ type: SchemaTypes.ObjectId, default: null, index: true })
  parent_session_id: Types.ObjectId | null;

  @Prop({ type: SchemaTypes.ObjectId, default: null })
  impersonation_session_id: Types.ObjectId | null;
}

export const AuthSessionSchema = SchemaFactory.createForClass(AuthSession);
