import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
export class EvaluationLog {
  @Prop({
    type: String,
    enum: ['student', 'teacher', 'supervisor', 'admin'],
    required: true,
  })
  role: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: false })
  updated_by?: string; // ID người thực hiện (tùy chọn)

  @Prop({ required: true, min: 0 })
  count: number; // Số lần thực hiện ghi nhận tại bước này

  @Prop({ default: Date.now })
  updated_at: Date;

  @Prop({ required: false })
  reason?: string; // Lý do chỉnh sửa điểm/số lần
}

export const EvaluationLogSchema = SchemaFactory.createForClass(EvaluationLog);
