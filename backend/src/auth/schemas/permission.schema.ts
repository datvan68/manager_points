import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PermissionDocument = Permission & Document;

@Schema({ timestamps: true })
export class Permission {
  @Prop({ required: true, unique: true })
  code: string; // VD: STUDENT_READ, USER_CREATE

  @Prop({ required: true })
  name: string; // Tên hiển thị: "Xem sinh viên"

  @Prop()
  module: string; // Nhóm: "Sinh viên", "Công việc"

  @Prop()
  description: string;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
