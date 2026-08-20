import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type MeterReadingDocument = MeterReading & Document;

@Schema({ timestamps: true })
export class MeterReading {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true, index: true }) room_id: Types.ObjectId;
  @Prop({ required: true, index: true }) billing_month: string;
  @Prop({ required: true, default: 0 }) electricity_reading: number;
  @Prop({ required: true, default: 0 }) water_reading: number;
  @Prop({ required: true, default: () => new Date() }) reading_date: Date;
  @Prop({ default: 0 }) occupant_count?: number;
  @Prop({ type: [MongooseSchema.Types.ObjectId], ref: 'DormitoryRosterEntry', default: [] }) roster_entry_ids?: Types.ObjectId[];
}

export const MeterReadingSchema = SchemaFactory.createForClass(MeterReading);
MeterReadingSchema.index({ room_id: 1, billing_month: 1 }, { unique: true });
