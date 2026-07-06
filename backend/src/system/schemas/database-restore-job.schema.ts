import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type DatabaseRestoreJobDocument = DatabaseRestoreJob & Document;

export class CollectionSummary {
  @Prop()
  name: string;

  @Prop()
  document_count_in_backup: number;

  @Prop()
  document_count_in_db: number;

  @Prop()
  status: string;
}

@Schema({ timestamps: true, collection: 'database_restore_jobs' })
export class DatabaseRestoreJob {
  @Prop({
    required: true,
    enum: [
      'queued',
      'running',
      'success',
      'failed',
      'preview',
      'cancelled',
      'expired',
    ],
    default: 'queued',
  })
  status: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requested_by: Types.ObjectId;

  @Prop({ type: Date })
  started_at: Date;

  @Prop({ type: Date })
  finished_at: Date;

  @Prop()
  source_file_name: string;

  @Prop()
  source_file_size: number;

  @Prop()
  source_file_hash: string;

  @Prop()
  preview_session_id: string;

  @Prop()
  mode: string;

  @Prop()
  format: string;

  @Prop({ type: [String] })
  collections: string[];

  @Prop({ type: [Object] })
  collection_summaries: CollectionSummary[];

  @Prop({ type: Types.ObjectId, ref: 'DatabaseBackupJob' })
  pre_restore_backup_job_id: Types.ObjectId;

  @Prop()
  error_message: string;
}

export const DatabaseRestoreJobSchema =
  SchemaFactory.createForClass(DatabaseRestoreJob);
