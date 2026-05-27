import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type SemesterDocument = Semester & Document;

@Schema({ timestamps: true })
export class Semester {
  @Prop({ required: true, unique: true })
  semester_name: string;

  @Prop({ required: true })
  start_date: Date;

  @Prop({ required: true })
  end_date: Date;

  @Prop({ required: true, default: 'active', enum: ['active', 'inactive', 'upcoming'] })
  status: string;
}

export const SemesterSchema = SchemaFactory.createForClass(Semester);
