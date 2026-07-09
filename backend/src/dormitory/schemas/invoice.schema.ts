import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type InvoiceDocument = Invoice & Document;

@Schema({ _id: false })
export class InvoiceItem {
  @Prop({
    required: true,
    enum: ['Phí phòng', 'Điện', 'Nước', 'Dịch vụ', 'Phạt vi phạm'],
  })
  loai: string;

  @Prop()
  mo_ta: string;

  @Prop({ required: true })
  so_tien: number;
}

export const InvoiceItemSchema = SchemaFactory.createForClass(InvoiceItem);

@Schema({ timestamps: true })
export class Invoice {
  @Prop({ required: true, unique: true })
  ma_hoa_don: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contract', required: true })
  contract_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ required: true })
  ky_thu: string; // e.g. 'T01/2026'

  @Prop({ type: [InvoiceItemSchema], default: [] })
  chi_tiet: InvoiceItem[];

  @Prop({ required: true })
  tong_tien: number;

  @Prop({
    required: true,
    enum: ['Chưa thanh toán', 'Đã thanh toán', 'Quá hạn'],
    default: 'Chưa thanh toán',
  })
  trang_thai: string;

  @Prop({ required: true })
  han_thanh_toan: Date;

  @Prop()
  ngay_thanh_toan: Date;

  @Prop({ enum: ['Tiền mặt', 'Chuyển khoản', 'Cổng thanh toán'] })
  phuong_thuc: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  nguoi_xac_nhan_id: Types.ObjectId;

  @Prop()
  ghi_chu: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
