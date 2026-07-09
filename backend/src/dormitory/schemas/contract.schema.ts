import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ContractDocument = Contract & Document;

@Schema({ timestamps: true })
export class Contract {
  @Prop({ required: true, unique: true })
  ma_hd: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Bed', required: true })
  bed_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true })
  room_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Registration' })
  registration_id: Types.ObjectId;

  @Prop({ required: true })
  ngay_bat_dau: Date;

  @Prop({ required: true })
  ngay_ket_thuc: Date;

  @Prop({
    required: true,
    enum: ['Hiệu lực', 'Hết hạn', 'Đã hủy'],
    default: 'Hiệu lực',
  })
  trang_thai: string;

  @Prop()
  ly_do_huy: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  nguoi_tao_id: Types.ObjectId;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);
