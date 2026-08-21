import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { TransferQrImage, TransferQrImageSchema } from './utility-config.schema';

export type RoomFeeConfigDocument = RoomFeeConfig & Document;

@Schema({ collection: 'dormitory_room_fee_configs', timestamps: true })
export class RoomFeeConfig {
  @Prop({ required: true, default: 500000, min: 0 })
  standard_monthly_rate: number;

  @Prop({ required: true, default: 700000, min: 0 })
  air_conditioned_monthly_rate: number;

  @Prop({ required: true, default: 5, min: 1, max: 36 })
  months_to_collect: number;

  @Prop({ type: TransferQrImageSchema })
  transfer_qr_image?: TransferQrImage;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  updated_by_id?: Types.ObjectId;
}

export const RoomFeeConfigSchema = SchemaFactory.createForClass(RoomFeeConfig);
