import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CriterionDocument = Criterion & Document;

@Schema({ timestamps: true })
export class Criterion {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Category', required: true, index: true })
  category_id: MongooseSchema.Types.ObjectId;

  @Prop({ required: true })
  criterion_name: string;

  @Prop({ required: true, default: 1 })
  score_per_unit: number;

  @Prop({ required: true, default: 10 })
  max_score: number;

  @Prop({ required: true, default: 0 })
  min_score: number;

  @Prop({ required: true, enum: ['khen_thuong', 'cong_diem', 'ky_luat'], default: 'cong_diem' })
  criterion_type: string;
}

export const CriterionSchema = SchemaFactory.createForClass(Criterion);
