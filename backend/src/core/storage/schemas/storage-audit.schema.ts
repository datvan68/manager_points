import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type StorageAuditLogDocument = StorageAuditLog & Document;
export type StorageReconciliationRunDocument = StorageReconciliationRun & Document;

@Schema({ timestamps: true, collection: 'storage_audit_logs' })
export class StorageAuditLog {
  @Prop({ required: true, index: true })
  run_id: string;

  @Prop({
    required: true,
    enum: ['preview', 'quarantine', 'restore', 'purge', 'domain_cleanup'],
    index: true,
  })
  action: string;

  @Prop({ required: true, default: 'system' })
  actor: string;

  @Prop({ required: true, enum: ['manual', 'scheduled', 'domain'], default: 'manual' })
  mode: string;

  @Prop({ required: true, enum: ['success', 'failed', 'partial'], default: 'success' })
  status: string;

  @Prop({ type: MongooseSchema.Types.Mixed, default: () => ({}) })
  details: Record<string, any>;
}

export const StorageAuditLogSchema = SchemaFactory.createForClass(StorageAuditLog);
StorageAuditLogSchema.index({ createdAt: -1 });

@Schema({ timestamps: true, collection: 'storage_reconciliation_runs' })
export class StorageReconciliationRun {
  @Prop({ required: true, unique: true, index: true })
  run_id: string;

  @Prop({
    required: true,
    enum: ['running', 'completed', 'failed'],
    default: 'running',
    index: true,
  })
  status: string;

  @Prop({ required: true, enum: ['preview', 'execute'], default: 'preview' })
  mode: string;

  @Prop({ required: true, default: 'system' })
  actor: string;

  @Prop({ default: 0 })
  scanned_files_count: number;

  @Prop({ default: 0 })
  scanned_bytes: number;

  @Prop({ default: 0 })
  referenced_files_count: number;

  @Prop({ default: 0 })
  orphan_files_count: number;

  @Prop({ default: 0 })
  missing_references_count: number;

  @Prop({ default: 0 })
  quarantined_files_count: number;

  @Prop({ default: 0 })
  quarantined_bytes: number;

  @Prop({ required: true, default: () => new Date() })
  started_at: Date;

  @Prop()
  completed_at?: Date;

  @Prop()
  error?: string;
}

export const StorageReconciliationRunSchema = SchemaFactory.createForClass(StorageReconciliationRun);
StorageReconciliationRunSchema.index({ started_at: -1 });
