import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type UtilityConfigDocument = UtilityConfig & Document;

@Schema({ _id: false })
export class RoomQuotaOverride {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true })
  room_id: Types.ObjectId;

  @Prop({ default: 0, required: true })
  quota_per_person: number;
}

export const RoomQuotaOverrideSchema = SchemaFactory.createForClass(RoomQuotaOverride);

@Schema({ _id: false })
export class RoomUnitPriceOverride {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true })
  room_id: Types.ObjectId;

  @Prop({ default: 0, required: true })
  unit_price: number;
}

export const RoomUnitPriceOverrideSchema = SchemaFactory.createForClass(RoomUnitPriceOverride);

@Schema({ _id: false })
export class UtilityTariff {
  @Prop({ default: 0, required: true })
  quota_per_person: number;

  @Prop({ default: 0, required: true })
  unit_price: number;

  @Prop({ default: '' })
  unit: string;

  @Prop({ type: [RoomQuotaOverrideSchema], default: [] })
  room_quota_overrides?: RoomQuotaOverride[];

  @Prop({ type: [RoomUnitPriceOverrideSchema], default: [] })
  room_unit_price_overrides?: RoomUnitPriceOverride[];
}

export const UtilityTariffSchema = SchemaFactory.createForClass(UtilityTariff);

@Schema({ _id: false })
export class TransferQrImage {
  @Prop({ required: true })
  url: string;

  @Prop() file_name?: string;
  @Prop() mime_type?: string;
  @Prop() size?: number;
  @Prop({ default: () => new Date() }) uploaded_at?: Date;
}

export const TransferQrImageSchema = SchemaFactory.createForClass(TransferQrImage);

@Schema({ timestamps: true })
export class UtilityConfig {
  @Prop({
    type: UtilityTariffSchema,
    default: () => ({ quota_per_person: 15, unit_price: 2500, unit: 'kWh' }),
  })
  electricity: UtilityTariff;

  @Prop({
    type: UtilityTariffSchema,
    default: () => ({ quota_per_person: 4, unit_price: 10000, unit: 'm³' }),
  })
  water: UtilityTariff;

  @Prop()
  configured_collection_days: number;

  @Prop()
  payment_deadline?: Date;

  @Prop({ type: TransferQrImageSchema })
  transfer_qr_image?: TransferQrImage;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  updated_by_id?: Types.ObjectId;
}

export const UtilityConfigSchema = SchemaFactory.createForClass(UtilityConfig);
