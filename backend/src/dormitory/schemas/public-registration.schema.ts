import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';
import { ApplicantProfileSchema } from './applicant-profile.schema';
import type { ApplicantProfile } from './applicant-profile.schema';

export type PublicRegistrationDocument = PublicRegistration & Document;

/**
 * Public registration from QR scan — stored separately from authenticated registrations.
 * Admin reviews and converts to formal registration if eligible.
 */
@Schema({ timestamps: true })
export class PublicRegistration {
  @Prop({ required: true, unique: true })
  public_registration_code: string;

  @Prop({ required: true })
  full_name: string;

  @Prop({ required: true })
  phone_number: string;

  @Prop({ type: ApplicantProfileSchema })
  applicant_profile?: ApplicantProfile;

  @Prop()
  email: string;

  @Prop()
  student_code: string;

  @Prop({ required: true })
  date_of_birth: string;

  @Prop({ required: true, enum: ['Male', 'Female', 'Other'] })
  gender: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room' })
  room_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Bed' })
  bed_id?: Types.ObjectId;

  @Prop()
  room_code: string;

  @Prop()
  building_name: string;

  @Prop({ enum: DORMITORY_ENUMS.roomType, default: 'Thường' })
  room_type: string;

  @Prop({ default: () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    return month >= 8 ? 'HK1' : month >= 1 && month < 6 ? 'HK2' : 'Hè';
  }})
  semester: string;

  @Prop({ default: () => {
    const now = new Date();
    return `${now.getFullYear()}-${now.getFullYear() + 1}`;
  }})
  academic_year: string;

  @Prop({
    enum: ['Chính sách', 'Xa nhà', 'Học lực giỏi', 'Không'],
    default: 'Không',
  })
  priority_group: string;

  @Prop()
  notes: string;

  @Prop({
    required: true,
    enum: DORMITORY_ENUMS.publicRegistrationStatus,
    default: 'Chờ xác nhận',
  })
  status: string;

  @Prop()
  rejection_reason: string;

  @Prop()
  source: string; // 'QR_SCAN'

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', index: true })
  linked_student_id?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Registration', index: true })
  linked_registration_id?: Types.ObjectId;
}

export const PublicRegistrationSchema =
  SchemaFactory.createForClass(PublicRegistration);
