import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';

export type InvoiceDocument = Invoice & Document;

@Schema({ _id: false })
export class UtilityDetail {
  @Prop({ default: 0 })
  previous_reading: number;

  @Prop({ default: 0 })
  current_reading: number;

  @Prop({ default: 0 })
  consumption: number;

  @Prop({ default: 0 })
  quota_per_person: number;

  @Prop({ default: 0 })
  quota_total: number;

  @Prop({ default: 0 })
  excess_consumption: number;

  @Prop({ default: 0 })
  unit_price: number;

  @Prop({ default: 0 })
  amount: number;
}

export const UtilityDetailSchema = SchemaFactory.createForClass(UtilityDetail);

@Schema({ _id: false })
export class PaymentProof {
  @Prop({ required: true })
  url: string;

  @Prop()
  file_name?: string;

  @Prop()
  mime_type?: string;

  @Prop()
  size?: number;

  @Prop({ default: () => new Date() })
  uploaded_at?: Date;
}

@Schema({ _id: false })
export class PaymentReview {
  @Prop({ enum: ['pending', 'approved', 'rejected'] }) status?: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) reviewed_by_id?: Types.ObjectId;
  @Prop() reviewed_at?: Date;
  @Prop() submitted_at?: Date;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' }) revoked_by_id?: Types.ObjectId;
  @Prop() revoked_at?: Date;
}

export const PaymentProofSchema = SchemaFactory.createForClass(PaymentProof);

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

  // New room-based monthly invoice fields
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', index: true })
  room_id?: Types.ObjectId;

  @Prop({ index: true })
  billing_month?: string; // Canonical format 'YYYY-MM', e.g. '2026-03'

  @Prop()
  reading_date?: Date;

  @Prop({ default: 0 })
  occupant_count?: number;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'DormitoryRosterEntry' }],
    default: [],
  })
  roster_entry_ids?: Types.ObjectId[];

  @Prop({ type: UtilityDetailSchema })
  electricity?: UtilityDetail;

  @Prop({ type: UtilityDetailSchema })
  water?: UtilityDetail;

  @Prop({ default: false })
  is_exempt?: boolean;

  @Prop()
  payment_start_date?: Date;

  @Prop({ required: true })
  due_date: Date;

  @Prop({ required: true, default: 0 })
  total_amount: number;

  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.invoiceStatus,
    default: 'Chưa thu',
  })
  status: string;

  @Prop()
  paid_at?: Date;

  @Prop({ enum: ['Tiền mặt', 'Chuyển khoản', 'Cổng thanh toán'] })
  payment_method?: string;

  @Prop({ type: PaymentProofSchema })
  payment_proof?: PaymentProof;
  @Prop({ type: PaymentReview })
  payment_review?: PaymentReview;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  confirmed_by_id?: Types.ObjectId;

  @Prop()
  notes?: string;

  // Legacy fields for backward compatibility
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Contract' })
  contract_id?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student' })
  student_id?: Types.ObjectId;

  @Prop()
  billing_period?: string; // e.g. 'T01/2026'

  @Prop({ type: [InvoiceItemSchema], default: [] })
  items?: InvoiceItem[];
}

export const InvoiceSchema = SchemaFactory.createForClass(Invoice);

InvoiceSchema.index({ room_id: 1, billing_month: 1 }, { unique: true, sparse: true });
