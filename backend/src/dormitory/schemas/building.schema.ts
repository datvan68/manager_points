import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';

export type BuildingDocument = Building & Document;

@Schema({ timestamps: true })
export class Building {
  @Prop({ required: true, unique: true })
  building_code: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  address: string;

  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.buildingStatus,
    default: 'Trống',
  })
  status: string;

  @Prop()
  description: string;
}

export const BuildingSchema = SchemaFactory.createForClass(Building);
