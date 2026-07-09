import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type BuildingDocument = Building & Document;

@Schema({ timestamps: true })
export class Building {
  @Prop({ required: true, unique: true })
  ma_toa_nha: string;

  @Prop({ required: true })
  ten: string;

  @Prop()
  dia_chi: string;

  @Prop({ default: 1 })
  so_tang: number;

  @Prop({
    required: true,
    enum: ['Active', 'Inactive', 'Maintenance'],
    default: 'Active',
  })
  trang_thai: string;

  @Prop()
  mo_ta: string;
}

export const BuildingSchema = SchemaFactory.createForClass(Building);
