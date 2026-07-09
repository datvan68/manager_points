import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true, collection: 'notifications' })
export class Notification {
  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ required: true, trim: true })
  description: string;

  @Prop({
    required: true,
    type: String,
    enum: ['warning', 'success', 'info', 'system'],
    default: 'system',
    index: true,
  })
  type: string;

  @Prop({ trim: true })
  routeUrl?: string;

  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    ref: 'User',
    default: [],
    index: true,
  })
  readByUserIds: Types.ObjectId[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    index: true,
    default: null,
  })
  recipientUserId?: Types.ObjectId | null;

  @Prop({
    type: String,
    enum: ['all', 'student', 'teacher', 'supervisor'],
    default: 'all',
    index: true,
  })
  targetRole?: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  createdBy?: Types.ObjectId | null;

  @Prop({ type: String, default: 'system' })
  source?: string;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop({ type: Date, default: null })
  deletedAt?: Date | null;

  @Prop({ trim: true })
  deduplicationKey?: string;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);

NotificationSchema.index({
  recipientUserId: 1,
  readByUserIds: 1,
  createdAt: -1,
});
NotificationSchema.index({ type: 1, createdAt: -1 });
NotificationSchema.index({ deletedAt: 1 });
NotificationSchema.index({ deduplicationKey: 1 }, { unique: true, sparse: true });
