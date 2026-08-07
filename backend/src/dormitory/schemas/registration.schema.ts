import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';

export type RegistrationDocument = Registration & Document;

@Schema({ timestamps: true })
export class Registration {
  @Prop({ required: true, unique: true })
  registration_code: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room' })
  room_id?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Bed' })
  bed_id?: Types.ObjectId;

  @Prop({ required: true })
  semester: string;

  @Prop({ required: true })
  academic_year: string;

  @Prop({ type: Date })
  date_of_birth: Date;

  @Prop({ enum: ['Male', 'Female', 'Other'] })
  gender: 'Male' | 'Female' | 'Other';

  @Prop({ trim: true })
  phone_number: string;

  @Prop({
    type: {
      room_type: { type: String },
      building_id: { type: MongooseSchema.Types.ObjectId, ref: 'Building' },
      notes: { type: String },
    },
    _id: false,
  })
  preference: {
    room_type: string;
    building_id?: Types.ObjectId;
    notes: string;
  };

  @Prop({
    enum: ['Chính sách', 'Xa nhà', 'Học lực giỏi', 'Khó khăn', 'Không'],
    default: 'Không',
  })
  priority_group: string;

  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.registrationStatus,
    default: 'Đã duyệt',
  })
  status: string;

  @Prop()
  rejection_reason: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  reviewed_by_id: Types.ObjectId;

  @Prop()
  reviewed_at: Date;
}

export const RegistrationSchema = SchemaFactory.createForClass(Registration);
