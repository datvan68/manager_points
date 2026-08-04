import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type RegistrationDocument = Registration & Document;

@Schema({ timestamps: true })
export class Registration {
  @Prop({ required: true, unique: true })
  ma_dk: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ required: true })
  ky_hoc: string;

  @Prop({ required: true })
  nam_hoc: string;

  @Prop({ type: Date })
  ngay_sinh: Date;

  @Prop({ enum: ['Male', 'Female', 'Other'] })
  gioi_tinh: 'Male' | 'Female' | 'Other';

  @Prop({ trim: true })
  so_dien_thoai: string;

  @Prop({
    type: {
      loai_phong: { type: String },
      building_id: { type: MongooseSchema.Types.ObjectId, ref: 'Building' },
      ghi_chu: { type: String },
    },
    _id: false,
  })
  nguyen_vong: {
    loai_phong: string;
    building_id?: Types.ObjectId;
    ghi_chu: string;
  };

  @Prop({
    enum: ['Chính sách', 'Xa nhà', 'Học lực giỏi', 'Khó khăn', 'Không'],
    default: 'Không',
  })
  doi_tuong_uu_tien: string;

  @Prop({
    required: true,
    enum: ['Chờ duyệt', 'Đã duyệt', 'Từ chối'],
    default: 'Chờ duyệt',
  })
  trang_thai: string;

  @Prop()
  ly_do_tu_choi: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  nguoi_duyet_id: Types.ObjectId;

  @Prop()
  ngay_duyet: Date;
}

export const RegistrationSchema = SchemaFactory.createForClass(Registration);
