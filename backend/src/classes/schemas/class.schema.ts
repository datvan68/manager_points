
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Department } from '../../departments/schemas/department.schema';

export type ClassDocument = Class & Document;

@Schema({ timestamps: true })
export class Class {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop()
  year: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Department' })
  department: Department;
}

export const ClassSchema = SchemaFactory.createForClass(Class);
