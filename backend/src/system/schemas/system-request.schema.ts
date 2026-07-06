import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SystemRequestDocument = SystemRequest & Document;

@Schema({ timestamps: true, collection: 'system_requests' })
export class SystemRequest {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({
    required: true,
    enum: ['access', 'data_change', 'support', 'backup', 'other'],
  })
  type: string;

  @Prop({
    required: true,
    enum: [
      'pending',
      'in_progress',
      'approved',
      'rejected',
      'completed',
      'cancelled',
    ],
    default: 'pending',
  })
  status: string;

  @Prop({
    required: true,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  })
  priority: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  requester_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', default: null })
  assignee_id: Types.ObjectId | null;

  @Prop()
  related_entity_type: string;

  @Prop()
  related_entity_id: string;

  @Prop({ type: Object })
  metadata: Record<string, any>;

  @Prop()
  decision_note: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  created_by: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updated_by: Types.ObjectId;

  @Prop({ type: Date, default: null })
  deletedAt: Date | null;

  @Prop({
    type: [
      {
        from_status: { type: String, required: true },
        to_status: { type: String, required: true },
        note: { type: String, required: true },
        changed_by: { type: Types.ObjectId, ref: 'User', required: true },
        changed_at: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  status_history: Array<{
    from_status: string;
    to_status: string;
    note: string;
    changed_by: Types.ObjectId;
    changed_at: Date;
  }>;
}

export const SystemRequestSchema = SchemaFactory.createForClass(SystemRequest);

SystemRequestSchema.index({ status: 1, createdAt: -1 });
SystemRequestSchema.index({ type: 1, createdAt: -1 });
SystemRequestSchema.index({ requester_id: 1, createdAt: -1 });
SystemRequestSchema.index({ assignee_id: 1, createdAt: -1 });
