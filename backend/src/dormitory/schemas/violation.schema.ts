import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';

export type ViolationDocument = Violation & Document;

@Schema({ timestamps: true })
export class Violation {
  @Prop({ required: true, unique: true })
  violation_code: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room' })
  room_id: Types.ObjectId;

  @Prop({ required: true })
  violation_type: string;

  @Prop({
    required: true,
    enum: ['Nhẹ', 'Trung bình', 'Nghiêm trọng'],
  })
  severity: string;

  @Prop({ default: 0 })
  deducted_points: number;

  @Prop({ required: true, default: () => new Date() })
  recorded_at: Date;

  @Prop()
  description: string;

  @Prop({ type: [String], default: [] })
  evidence: string[];

  @Prop({
    enum: ['Nhắc nhở', 'Cảnh cáo', 'Phạt tiền', 'Buộc rời KTX'],
    default: 'Nhắc nhở',
  })
  resolution_type: string;

  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.violationStatus,
    default: 'Mới',
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  recorded_by_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  resolved_by_id: Types.ObjectId;

  @Prop()
  resolution_notes: string;
}

export const ViolationSchema = SchemaFactory.createForClass(Violation);
