import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Role } from './role.schema';
import { Department } from '../../departments/schemas/department.schema';

export type UserDocument = User & Document;

export enum UserStatus {
  ACTIVE = 'active',
  LOCKED = 'locked',
  INACTIVE = 'inactive',
}

@Schema({ timestamps: true, collection: 'users' })
export class User {
  @Prop({ required: true, trim: true })
  user_name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  pw_hash: string;

  @Prop({ type: String, enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Prop({ type: Types.ObjectId, ref: 'Role' })
  role: Role | Types.ObjectId;

  @Prop({ default: 0 })
  failed_login_attempts: number;

  @Prop()
  phone_number: string;

  @Prop()
  department: string;

  @Prop()
  date_birth: Date;

  @Prop({ type: Date, default: null })
  locked_until: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);
