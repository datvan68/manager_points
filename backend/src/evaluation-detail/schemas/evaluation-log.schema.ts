import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: true })
export class EvaluationLog {
  @Prop({ type: String, required: false })
  from_status?: string;

  @Prop({ type: String, required: false })
  to_status?: string;

  @Prop({ type: Number, required: false, default: null })
  score_before?: number | null;

  @Prop({ type: Number, required: false, default: null })
  score_after?: number | null;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
  })
  updated_by: MongooseSchema.Types.ObjectId;

  @Prop({ type: Date, required: true, default: Date.now })
  updated_at: Date;

  @Prop({ type: String, required: false, default: '' })
  reason?: string;
}

export const EvaluationLogSchema = SchemaFactory.createForClass(EvaluationLog);
