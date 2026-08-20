import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type UtilityConfigDocument = UtilityConfig & Document;

@Schema({ _id: false })
export class UtilityTariff {
  @Prop({ default: 0, required: true })
  quota_per_person: number;

  @Prop({ default: 0, required: true })
  unit_price: number;

  @Prop({ default: '' })
  unit: string;
}

export const UtilityTariffSchema = SchemaFactory.createForClass(UtilityTariff);

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

  @Prop({ default: 10, required: true })
  configured_collection_days: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  updated_by_id?: Types.ObjectId;
}

export const UtilityConfigSchema = SchemaFactory.createForClass(UtilityConfig);
