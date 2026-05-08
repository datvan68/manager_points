import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Permission } from './permission.schema';

export type RoleDocument = Role & Document;

@Schema({ timestamps: true })
export class Role {
  @Prop({ required: true, unique: true })
  name: string; // VD: Admin, Manager, User

  @Prop()
  description: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Permission' }] })
  permissions: Permission[];
}

export const RoleSchema = SchemaFactory.createForClass(Role);
