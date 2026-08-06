import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Building } from './building.schema';

export type RoomDocument = Room & Document;

@Schema({ timestamps: true })
export class Room {
  @Prop({ required: true, unique: true })
  ma_phong: string;

  @Prop()
  ten_phong: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Building', required: true })
  building_id: Types.ObjectId | Building;

  @Prop({ required: true })
  tang: number;

  @Prop({ required: true })
  loai_phong: string; // e.g. '4 người', '6 người', '8 người'

  @Prop({ required: true })
  so_giuong: number;

  @Prop({ default: 0 })
  so_giuong_trong: number;

  @Prop({ required: true })
  gia_phong: number; // VND per kỳ

  @Prop({
    required: true,
    enum: ['Trống', 'Đầy', 'Khóa', 'Bảo trì'],
    default: 'Trống',
  })
  trang_thai: string;

  @Prop({ type: [String], default: [] })
  tien_ich: string[]; // ['Điều hòa', 'Nóng lạnh', ...]

  @Prop()
  ma_qr: string; // auto-generated

  @Prop()
  url_xem_nhanh: string; // auto-generated

  @Prop()
  mo_ta: string;
}

export const RoomSchema = SchemaFactory.createForClass(Room);
