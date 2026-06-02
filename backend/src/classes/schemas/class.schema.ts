import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Department } from '../../departments/schemas/department.schema';
import { User } from '../../auth/schemas/user.schema';

export type ClassDocument = Class & Document;

export enum ClassType {
  TRUNG_CAP = 'Trung cấp',
  CAO_DANG = 'Cao đẳng',
}

export enum Headquarters {
  PHAN_HIEU_CSSD = 'Phân hiệu CSSĐ-NDT',
  PHAN_HIEU_CK = 'Phân hiệu CK',
}

@Schema({ timestamps: true })
export class Class {
  @Prop({ required: true })
  class_name: string;

  @Prop({ required: true })
  class_year: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Department',
    required: true,
  })
  dept_id: Department;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  user_id: User;

  @Prop({ enum: ClassType, required: true })
  class_type: ClassType;

  @Prop({ enum: Headquarters })
  headquarters: Headquarters;
}

export const ClassSchema = SchemaFactory.createForClass(Class);
