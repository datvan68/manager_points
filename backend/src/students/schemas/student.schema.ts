import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Class } from '../../classes/schemas/class.schema';
import { User } from '../../auth/schemas/user.schema';

export type StudentDocument = Student & Document;

@Schema({ timestamps: true })
export class Student {
  @Prop({ required: true, unique: true })
  student_code: string;

  @Prop({ required: true })
  full_name: string;

  @Prop()
  email: string;

  @Prop({ required: true })
  date_bir: Date;

  @Prop({ required: true, enum: ['Male', 'Female', 'Other'] })
  sex: string;

  @Prop({
    required: true,
    enum: ['Studying', 'Reserved', 'Dropped', 'Graduated', 'Suspended'],
    default: 'Studying',
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Class' })
  class_id: Types.ObjectId | Class;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'TrainingPoint' })
  training_point_id: any;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    unique: true,
    sparse: true,
  })
  user_id?: Types.ObjectId | User;
}

export const StudentSchema = SchemaFactory.createForClass(Student);
