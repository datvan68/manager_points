import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';

export type InvoiceDocument = Invoice & Document;

@Schema({ _id: false })
export class InvoiceItem {
  @Prop({
    required: true,
    enum: ['Phí phòng', 'Điện', 'Nước', 'Dịch vụ', 'Phạt vi phạm'],
  })
  type: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  amount: number;
}

export const InvoiceItemSchema = SchemaFactory.createForClass(InvoiceItem);

@Schema({ timestamps: true })
export class Invoice {
  @Prop({ required: true, unique: true })
  invoice_code: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contract', required: true })
  contract_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ required: true })
  billing_period: string; // e.g. 'T01/2026'

  @Prop({ type: [InvoiceItemSchema], default: [] })
  items: InvoiceItem[];

  @Prop({ required: true })
  total_amount: number;

  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.invoiceStatus,
    default: 'Chưa thanh toán',
  })
  status: string;

  @Prop({ required: true })
  due_date: Date;

  @Prop()
  paid_at: Date;

  @Prop({ enum: ['Tiền mặt', 'Chuyển khoản', 'Cổng thanh toán'] })
  payment_method: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  confirmed_by_id: Types.ObjectId;

  @Prop()
  notes: string;
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);
