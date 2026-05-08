
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Class } from '../../classes/schemas/class.schema';

export type StudentDocument = Student & Document;

@Schema({ timestamps: true })
export class Student {
  @Prop({ required: true, unique: true })
  studentId: string; // "Mã sinh viên" - distinct from MongoDB _id

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  dob: Date;

  @Prop({ required: true, enum: ['Male', 'Female', 'Other'] })
  gender: string;

  @Prop()
  phone: string;

  @Prop()
  email: string;

  @Prop()
  address: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Class' })
  class: Class;

  @Prop()
  course: string; // Khóa học like K66

  @Prop({ required: true, enum: ['Studying', 'Reserved', 'Dropped', 'Graduated', 'Suspended'], default: 'Studying' })
  status: string;

  @Prop()
  admissionDate: Date;
}

export const StudentSchema = SchemaFactory.createForClass(Student);
