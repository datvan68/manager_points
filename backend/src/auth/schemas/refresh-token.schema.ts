import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema({ timestamps: true, collection: 'refresh_tokens' })
export class RefreshToken {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  token: string;

  @Prop({ required: true })
  expires_at: Date;

  @Prop({ default: false })
  is_revoked: boolean;

  @Prop({ default: false })
  remember: boolean;

  @Prop({ type: String, default: null })
  replaced_by: string | null;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
