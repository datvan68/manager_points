import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';
import { PaymentProof, PaymentProofSchema, PaymentReview } from './invoice.schema';

export type RoomFeeInvoiceDocument = RoomFeeInvoice & Document;

@Schema({ collection: 'dormitory_room_fee_invoices', timestamps: true })
export class RoomFeeInvoice {
  @Prop({ required: true, unique: true, trim: true })
  invoice_code: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'DormitoryRosterEntry',
    required: true,
    index: true,
  })
  roster_entry_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', index: true })
  student_id?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true, index: true })
  room_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester', index: true })
  semester_id?: Types.ObjectId;

  // Immutable snapshots at the time of charge generation
  @Prop({ required: true, trim: true })
  member_name: string;

  @Prop({ trim: true })
  member_code?: string;

  @Prop({ required: true, trim: true })
  room_code: string;

  @Prop({ trim: true })
  room_name?: string;

  @Prop({ required: true, enum: DORMITORY_ENUMS.roomType })
  room_type: string;

  @Prop({ required: true, min: 0 })
  monthly_rate: number;

  @Prop({ required: true, trim: true })
  start_month: string; // 'YYYY-MM'

  @Prop({ required: true, trim: true })
  end_month: string; // 'YYYY-MM'

  @Prop({ required: true, min: 1 })
  months_count: number;

  @Prop({ trim: true })
  line_description?: string;

  @Prop({ required: true, min: 0 })
  total_amount: number;

  // Payment lifecycle and review fields
  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.invoiceStatus,
    default: 'Chưa thu',
  })
  status: string;

  @Prop()
  due_date?: Date;

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

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  created_by_id?: Types.ObjectId;

  @Prop({ trim: true })
  notes?: string;
}

export const RoomFeeInvoiceSchema = SchemaFactory.createForClass(RoomFeeInvoice);

RoomFeeInvoiceSchema.index(
  { roster_entry_id: 1, start_month: 1, end_month: 1 },
  { unique: true, name: 'room_fee_roster_period_unique' },
);
RoomFeeInvoiceSchema.index({ room_id: 1 }, { name: 'room_fee_room_idx' });
RoomFeeInvoiceSchema.index({ status: 1 }, { name: 'room_fee_status_idx' });
RoomFeeInvoiceSchema.index({ start_month: 1, end_month: 1 }, { name: 'room_fee_period_idx' });
