import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ViolationDocument = Violation & Document;

@Schema({ timestamps: true })
export class Violation {
  @Prop({ required: true, unique: true })
  ma_vp: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room' })
  room_id: Types.ObjectId;

  @Prop({ required: true })
  loai_vi_pham: string;

  @Prop({
    required: true,
    enum: ['Nhẹ', 'Trung bình', 'Nghiêm trọng'],
  })
  muc_do: string;

  @Prop({ default: 0 })
  diem_tru: number;

  @Prop({ required: true, default: () => new Date() })
  ngay_ghi_nhan: Date;

  @Prop()
  mo_ta: string;

  @Prop({ type: [String], default: [] })
  minh_chung: string[];

  @Prop({
    enum: ['Nhắc nhở', 'Cảnh cáo', 'Phạt tiền', 'Buộc rời KTX'],
    default: 'Nhắc nhở',
  })
  hinh_thuc_xu_ly: string;

  @Prop({
    required: true,
    enum: ['Mới', 'Đã xử lý', 'Đang xét'],
    default: 'Mới',
  })
  trang_thai: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  nguoi_ghi_nhan_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  nguoi_xu_ly_id: Types.ObjectId;

  @Prop()
  ghi_chu_xu_ly: string;
}

export const ViolationSchema = SchemaFactory.createForClass(Violation);
