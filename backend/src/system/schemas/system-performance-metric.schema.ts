import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';

export type SystemPerformanceMetricDocument =
  HydratedDocument<SystemPerformanceMetric>;

@Schema({ timestamps: true, collection: 'system_performance_metrics' })
export class SystemPerformanceMetric {
  @Prop({ type: String, required: true })
  route: string;

  @Prop({ type: SchemaTypes.ObjectId })
  user_id?: Types.ObjectId;

  @Prop({ type: String })
  role_name?: string;

  @Prop({
    type: String,
    enum: ['desktop', 'tablet', 'mobile', 'unknown'],
    default: 'unknown',
  })
  device_type: string;

  @Prop({ type: String })
  network_effective_type?: string;

  @Prop({
    type: String,
    enum: ['navigate', 'reload', 'back_forward', 'prerender', 'unknown'],
  })
  navigation_type?: string;

  @Prop({ type: Number })
  ttfb_ms?: number;

  @Prop({ type: Number })
  dom_content_loaded_ms?: number;

  @Prop({ type: Number })
  load_event_ms?: number;

  @Prop({ type: Number })
  fcp_ms?: number;

  @Prop({ type: Number })
  lcp_ms?: number;

  @Prop({ type: Number })
  cls?: number;

  @Prop({ type: Number })
  inp_ms?: number;

  @Prop({ type: Number })
  api_total_ms?: number;

  @Prop({
    type: [
      {
        name: { type: String, required: true },
        duration_ms: { type: Number, required: true },
        status: { type: Number },
        ok: { type: Boolean },
      },
    ],
    default: undefined,
  })
  api_breakdown?: Array<{
    name: string;
    duration_ms: number;
    status?: number;
    ok?: boolean;
  }>;

  @Prop({
    type: [
      {
        severity: {
          type: String,
          enum: ['critical', 'warning', 'info'],
          required: true,
        },
        code: { type: String, required: true },
        message: { type: String, required: true },
      },
    ],
    default: undefined,
  })
  recommendations_snapshot?: Array<{
    severity: 'critical' | 'warning' | 'info';
    code: string;
    message: string;
  }>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const SystemPerformanceMetricSchema = SchemaFactory.createForClass(
  SystemPerformanceMetric,
);

SystemPerformanceMetricSchema.index({ route: 1, createdAt: -1 });
SystemPerformanceMetricSchema.index({ createdAt: -1 });
SystemPerformanceMetricSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 7776000 },
); // 90 days TTL
