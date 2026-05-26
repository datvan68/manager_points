import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CategoryDocument = Category & Document;

@Schema({ timestamps: true })
export class Category {
  @Prop({ required: true, unique: true, index: true })
  category_code: string;

  @Prop({ required: true })
  category_name: string;

  @Prop({ required: true, default: 10 })
  max_score: number;

  @Prop({ required: true, default: 10 })
  sort_order: number;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
