import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ClubFavoriteDocument = ClubFavorite & Document;

@Schema({ timestamps: true, collection: 'club_favorites' })
export class ClubFavorite {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Club', required: true })
  club_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;
}

export const ClubFavoriteSchema = SchemaFactory.createForClass(ClubFavorite);

ClubFavoriteSchema.index({ club_id: 1, user_id: 1 }, { unique: true });
ClubFavoriteSchema.index({ club_id: 1 });
ClubFavoriteSchema.index({ user_id: 1 });
