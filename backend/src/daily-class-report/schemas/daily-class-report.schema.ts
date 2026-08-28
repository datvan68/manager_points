import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Class } from '../../classes/schemas/class.schema';
import { User } from '../../auth/schemas/user.schema';

export type DailyClassReportDocument = DailyClassReport & Document;

@Schema({ timestamps: true })
export class DailyClassReport {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Class',
    required: true,
    index: true,
  })
  class_id: Class;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  reported_by: User;

  @Prop({ required: true, type: Date })
  report_date: Date;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  total_present: number;

  @Prop({ required: true, type: Number, default: 0, min: 0 })
  total_absent: number;

  @Prop({ type: String, default: '' })
  teacher_name?: string;

  @Prop({ type: String, default: '' })
  class_notes: string;

  @Prop({ type: Boolean, default: false, index: true })
  is_delete: boolean;
}

export const DailyClassReportSchema =
  SchemaFactory.createForClass(DailyClassReport);

DailyClassReportSchema.index(
  { class_id: 1, report_date: 1 },
  { name: 'idx_class_date' },
);
