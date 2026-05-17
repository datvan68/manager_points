import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Department } from '../../departments/schemas/department.schema';
import { User } from '../../auth/schemas/user.schema';

export type ClassDocument = Class & Document;

@Schema({ timestamps: true })
export class Class {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  class_name: string;

  @Prop({ required: true })
  class_year: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Department', required: true })
  dept_id: Department;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  user_id: User;

  @Prop({ type: [String], default: [] })
  class_courses: string[];
}

export const ClassSchema = SchemaFactory.createForClass(Class);
