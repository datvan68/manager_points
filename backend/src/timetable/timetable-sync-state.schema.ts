import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TimetableSyncStateDocument = TimetableSyncState & Document;

@Schema({ timestamps: true, collection: 'timetable_sync_states' })
export class TimetableSyncState {
  @Prop({ required: true, unique: true, default: 'default' }) name!: string;
  @Prop({ type: Object, default: null }) catalog?: Record<string, any> | null;
  @Prop({ type: Object, default: { enabled: false, intervalMinutes: 60, coverage: [] } }) settings!: Record<string, any>;
  @Prop({ type: Object, default: null }) job?: Record<string, any> | null;
  @Prop({ type: Object, default: null }) lease?: { owner: string; expiresAt: Date; epoch: number } | null;
}

export const TimetableSyncStateSchema = SchemaFactory.createForClass(TimetableSyncState);
