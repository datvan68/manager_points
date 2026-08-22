import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ImpersonationSessionDocument = ImpersonationSession &
  Document & {
    createdAt: Date;
    updatedAt: Date;
  };

export enum ImpersonationSessionStatus {
  ACTIVE = 'active',
  ENDED = 'ended',
  EXPIRED = 'expired',
}

@Schema({ timestamps: true, collection: 'impersonation_sessions' })
export class ImpersonationSession {
  @Prop({ required: true, min: 1, max: 5 })
  slot: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actor_user_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  subject_user_id: Types.ObjectId;

  @Prop({ required: true })
  browser_session_id: string;

  @Prop({
    type: String,
    enum: ImpersonationSessionStatus,
    default: ImpersonationSessionStatus.ACTIVE,
    required: true,
  })
  status: ImpersonationSessionStatus;

  @Prop({ required: true })
  expires_at: Date;

  @Prop({ type: Date, default: null })
  ended_at: Date | null;

  @Prop({ type: String, default: null })
  ended_reason: string | null;

  @Prop({ required: true })
  ip_address: string;
}

export const ImpersonationSessionSchema =
  SchemaFactory.createForClass(ImpersonationSession);

ImpersonationSessionSchema.index(
  { slot: 1 },
  {
    name: 'uq_active_impersonation_slot',
    unique: true,
    partialFilterExpression: { status: ImpersonationSessionStatus.ACTIVE },
  },
);
ImpersonationSessionSchema.index(
  { subject_user_id: 1 },
  {
    name: 'uq_active_impersonation_subject',
    unique: true,
    partialFilterExpression: { status: ImpersonationSessionStatus.ACTIVE },
  },
);
ImpersonationSessionSchema.index(
  { status: 1, expires_at: 1 },
  { name: 'impersonation_expiry_lookup' },
);
ImpersonationSessionSchema.index(
  { actor_user_id: 1, createdAt: -1 },
  { name: 'impersonation_actor_history' },
);
