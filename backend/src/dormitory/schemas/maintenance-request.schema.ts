import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type MaintenanceRequestDocument = MaintenanceRequest & Document;

@Schema({ timestamps: true })
export class MaintenanceRequest {
  @Prop({ required: true, unique: true })
  ma_ycbt: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true })
  room_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student' })
  student_id: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['Điện', 'Nước', 'Thiết bị', 'Cơ sở vật chất', 'Khác'],
  })
  loai_su_co: string;

  @Prop({ required: true })
  mo_ta: string;

  @Prop({ type: [String], default: [] })
  hinh_anh: string[];

  @Prop({
    required: true,
    enum: ['Mới', 'Đang xử lý', 'Hoàn tất', 'Từ chối'],
    default: 'Mới',
  })
  trang_thai: string;

  @Prop({
    enum: ['Thấp', 'Trung bình', 'Cao', 'Khẩn cấp'],
    default: 'Trung bình',
  })
  do_uu_tien: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  ky_thuat_vien_id: Types.ObjectId;

  @Prop()
  ghi_chu_xu_ly: string;

  @Prop()
  ngay_hoan_tat: Date;
}

export const MaintenanceRequestSchema =
  SchemaFactory.createForClass(MaintenanceRequest);
