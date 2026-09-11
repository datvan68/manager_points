import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TimetableSnapshotDocument = TimetableSnapshot & Document;

@Schema({ timestamps: true, collection: 'timetable_snapshots' })
export class TimetableSnapshot {
  @Prop({ required: true, unique: true, index: true, maxlength: 600 }) key!: string;
  @Prop({ required: true, maxlength: 80 }) year!: string;
  @Prop({ required: true, maxlength: 30 }) semester!: string;
  @Prop({ required: true, maxlength: 30 }) week!: string;
  @Prop({ maxlength: 120 }) faculty?: string;
  @Prop({ maxlength: 120 }) course?: string;
  @Prop({ maxlength: 120 }) className?: string;
  @Prop({ required: true, maxlength: 120 }) coverageKey!: string;
  @Prop({ type: Object, required: true }) result!: Record<string, any>;
  @Prop({ required: true }) syncedAt!: Date;
  @Prop({ required: true, maxlength: 80 }) jobId!: string;
}

export const TimetableSnapshotSchema = SchemaFactory.createForClass(TimetableSnapshot);
