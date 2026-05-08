import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from './role.schema';

export type UserDocument = User & Document;

export enum UserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, unique: true, trim: true })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password_hash: string;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Prop({ type: Types.ObjectId, ref: 'Role' })
  role: Role | Types.ObjectId;

  @Prop({ default: 0 })
  failed_login_attempts: number;

  @Prop({ type: Date, default: null })
  locked_until: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
