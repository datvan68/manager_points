import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { Permission } from './permission.schema';

export type RoutePermissionDocument = RoutePermission & Document;

@Schema({ timestamps: true })
export class RoutePermission {
  @Prop({ required: true, unique: true, trim: true })
  route_path: string; // e.g., '/students', '/grading', 'POST:/classes'

  @Prop({ required: true, trim: true })
  route_name: string; // Display name: 'Quản lý sinh viên'

  @Prop()
  description: string;

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Permission' }] })
  permissions: Permission[];

  @Prop({ enum: ['all', 'any'], default: 'all' })
  check_type: string; // 'all' = require ALL permissions, 'any' = require at least one

  @Prop({ default: true })
  is_active: boolean;

  @Prop({ enum: ['page', 'api', 'feature'], default: 'page' })
  type: string; // Classify: frontend page, backend API, or feature/button
}

export const RoutePermissionSchema = SchemaFactory.createForClass(RoutePermission);
