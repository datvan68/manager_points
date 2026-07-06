import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type CriterionDocument = Criterion & Document;

@Schema({ timestamps: true })
export class Criterion {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Category',
    required: true,
    index: true,
  })
  category_id: MongooseSchema.Types.ObjectId;

  @Prop({ trim: true })
  criterion_code: string;

  @Prop({ required: true })
  criterion_name: string;

  @Prop({ required: true, default: 1 })
  score_per_unit: number;

  @Prop({ required: true, default: 10 })
  max_score: number;

  @Prop({ required: true, default: 0 })
  min_score: number;

  @Prop({
    required: true,
    enum: ['khen_thuong', 'cong_diem', 'ky_luat'],
    default: 'cong_diem',
  })
  criterion_type: string;

  @Prop({ default: false })
  is_locked: boolean;

  @Prop({ default: true })
  is_score_counted: boolean;

  @Prop({
    required: true,
    enum: ['count', 'single_option'],
    default: 'count',
  })
  scoring_mode: string;

  @Prop({
    type: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        score: { type: Number, required: true },
      },
    ],
    default: [],
  })
  options: { id: string; label: string; score: number }[];
}

export const CriterionSchema = SchemaFactory.createForClass(Criterion);

CriterionSchema.index(
  { criterion_code: 1 },
  {
    unique: true,
    partialFilterExpression: { criterion_code: { $type: 'string' } },
  },
);
