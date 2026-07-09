import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type PublicRegistrationDocument = PublicRegistration & Document;

/**
 * Public registration from QR scan — stored separately from authenticated registrations.
 * Admin reviews and converts to formal registration if eligible.
 */
@Schema({ timestamps: true })
export class PublicRegistration {
  @Prop({ required: true, unique: true })
  ma_dk_public: string;

  @Prop({ required: true })
  ho_ten: string;

  @Prop({ required: true })
  so_dien_thoai: string;

  @Prop()
  email: string;

  @Prop()
  ma_sinh_vien: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room' })
  room_id: Types.ObjectId;

  @Prop()
  ma_phong: string;

  @Prop()
  ten_toa_nha: string;

  @Prop()
  loai_phong: string;

  @Prop({ default: () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 8 ? 'HK1' : month >= 1 && month < 6 ? 'HK2' : 'Hè';
  }})
  ky_hoc: string;

  @Prop({ default: () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getFullYear() + 1}`;
  }})
  nam_hoc: string;

  @Prop({
    enum: ['Chính sách', 'Xa nhà', 'Học lực giỏi', 'Không'],
    default: 'Không',
  })
  doi_tuong_uu_tien: string;

  @Prop()
  ghi_chu: string;

  @Prop({
    required: true,
    enum: ['Chờ xác nhận', 'Đã xác nhận', 'Từ chối'],
    default: 'Chờ xác nhận',
  })
  trang_thai: string;

  @Prop()
  ly_do_tu_choi: string;

  @Prop()
  nguon: string; // 'QR_SCAN'
}

export const PublicRegistrationSchema =
  SchemaFactory.createForClass(PublicRegistration);
