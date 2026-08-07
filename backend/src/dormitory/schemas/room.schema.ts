import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Building } from './building.schema';
import { DORMITORY_ENUMS } from '../dormitory-enums';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true, unique: true })
  room_code: string;

  @Prop()
  room_name: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Building', required: true })
  building_id: Types.ObjectId | Building;

  @Prop({ required: true, default: 1 })
  floor: number;

  @Prop({ required: true })
  room_type: string; // e.g. '4 người', '6 người', '8 người'

  @Prop({ required: true })
  bed_count: number;

  @Prop({ default: 0 })
  available_bed_count: number;

  @Prop({ required: true })
  room_price: number; // VND per kỳ

  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.roomStatus,
    default: 'Trống',
  })
  status: string;

  @Prop({ type: [String], default: [] })
  amenities: string[]; // ['Điều hòa', 'Nóng lạnh', ...]

  @Prop()
  qr_code: string; // auto-generated

  @Prop()
  public_url: string; // auto-generated

  @Prop()
  description: string;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
