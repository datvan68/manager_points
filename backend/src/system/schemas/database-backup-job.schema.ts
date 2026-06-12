import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DatabaseBackupJobDocument = DatabaseBackupJob & Document;

@Schema({ timestamps: true, collection: 'database_backup_jobs' })
export class DatabaseBackupJob {
  @Prop({ required: true, enum: ['queued', 'running', 'success', 'failed'], default: 'queued' })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requested_by: Types.ObjectId;

  @Prop({ type: Date })
  started_at: Date;

  @Prop({ type: Date })
  finished_at: Date;

  @Prop()
  file_name: string;

  @Prop()
  file_path: string;

  @Prop()
  file_size: number;

  @Prop({ type: [String] })
  collections: string[];

  @Prop()
  error_message: string;
}

export const DatabaseBackupJobSchema = SchemaFactory.createForClass(DatabaseBackupJob);
