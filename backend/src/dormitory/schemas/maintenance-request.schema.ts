import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';

export type MaintenanceRequestDocument = MaintenanceRequest & Document;

@Schema({ timestamps: true })
export class MaintenanceRequest {
  @Prop({ required: true, unique: true })
  request_code: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', required: true })
  room_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student' })
  student_id: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['Điện', 'Nước', 'Thiết bị', 'Cơ sở vật chất', 'Khác'],
  })
  issue_type: string;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.maintenanceStatus,
    default: 'Mới',
  })
  status: string;

  @Prop({
    enum: ['Thấp', 'Trung bình', 'Cao', 'Khẩn cấp'],
    default: 'Trung bình',
  })
  priority: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  technician_id: Types.ObjectId;

  @Prop()
  resolution_notes: string;

  @Prop()
  completed_at: Date;
}

export const MaintenanceRequestSchema =
  SchemaFactory.createForClass(MaintenanceRequest);
