import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Semester } from '../../semesters/schemas/semester.schema';
import { User } from '../../auth/schemas/user.schema';

export type EvaluationPeriodDocument = EvaluationPeriod & Document;

@Schema({ timestamps: true })
export class EvaluationPeriod {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Semester',
    required: true,
    index: true,
  })
  semester_id: Semester;

  @Prop({
    type: String,
    required: true,
    enum: ['pending', 'sv_phase', 'gv_phase', 'admin_phase', 'closed'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop({ type: Date, required: true })
  sv_deadline: Date;

  @Prop({ type: Date, required: true })
  gv_deadline: Date;

  @Prop({ type: Date, required: true })
  admin_deadline: Date;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  created_by: User;
}

export const EvaluationPeriodSchema =
  SchemaFactory.createForClass(EvaluationPeriod);
