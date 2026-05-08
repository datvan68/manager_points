import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Permission } from './permission.schema';

export type PermissionGroupDocument = PermissionGroup & Document;

@Schema({ timestamps: true })
export class PermissionGroup {
  @Prop({ required: true, unique: true })
  code: string; // VD: G_STUDENT, G_FINANCE

  @Prop({ required: true, unique: true })
  name: string; // Tên hiển thị: "Quản lý Sinh viên"

  @Prop()
  description: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Permission' }] })
  permissions: Permission[];

  @Prop({ default: 'Active' })
  status: string;
}

export const PermissionGroupSchema = SchemaFactory.createForClass(PermissionGroup);
