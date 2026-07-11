import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityFavoriteDocument = ActivityFavorite & Document;

@Schema({ timestamps: true, collection: 'activity_favorites' })
export class ActivityFavorite {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Activity', required: true })
  activity_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;
}

export const ActivityFavoriteSchema = SchemaFactory.createForClass(ActivityFavorite);

ActivityFavoriteSchema.index({ activity_id: 1, user_id: 1 }, { unique: true });
ActivityFavoriteSchema.index({ activity_id: 1 });
ActivityFavoriteSchema.index({ user_id: 1 });
