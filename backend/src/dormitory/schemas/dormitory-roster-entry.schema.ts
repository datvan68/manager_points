import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { DORMITORY_ENUMS } from '../dormitory-enums';
import { ApplicantProfileSchema } from './applicant-profile.schema';
import type { ApplicantProfile } from './applicant-profile.schema';

export const ROSTER_IDENTITY_STATES = ['LINKED', 'UNLINKED', 'CONFLICT'] as const;

export type DormitoryRosterIdentityState = (typeof ROSTER_IDENTITY_STATES)[number];
export type DormitoryRosterEntryDocument = DormitoryRosterEntry & Document;

@Schema({ collection: 'dormitory_roster_entries', timestamps: true })
export class DormitoryRosterEntry {
  @Prop({ required: true, unique: true, trim: true })
  roster_entry_code: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', index: true })
  student_id?: Types.ObjectId;

  @Prop({ required: true, trim: true })
  full_name: string;

  @Prop({ required: true, trim: true, index: true })
  full_name_normalized: string;

  @Prop({ required: true, type: Date })
  date_of_birth: Date;

  @Prop({ required: true, enum: ['Male', 'Female', 'Other'] })
  gender: 'Male' | 'Female' | 'Other';

  @Prop({ required: true, trim: true })
  phone_number: string;

  @Prop({ trim: true, index: true })
  student_code?: string;

  @Prop({ trim: true, index: true })
  student_code_normalized?: string;

  @Prop({ required: true, type: MongooseSchema.Types.ObjectId, ref: 'Semester', index: true })
  semester_id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  semester: string;

  @Prop({ required: true, trim: true })
  academic_year: string;

  @Prop({ required: true, enum: DORMITORY_ENUMS.roomType })
  room_type: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ type: ApplicantProfileSchema })
  applicant_profile?: ApplicantProfile;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Room', index: true })
  room_id?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Bed', index: true })
  bed_id?: Types.ObjectId;

  @Prop({ type: Boolean, default: false })
  is_room_leader?: boolean;

  @Prop({ required: true, type: String, enum: ROSTER_IDENTITY_STATES, index: true })
  identity_state: DormitoryRosterIdentityState;
}

export const DormitoryRosterEntrySchema = SchemaFactory.createForClass(DormitoryRosterEntry);

DormitoryRosterEntrySchema.index(
  { student_id: 1, semester_id: 1 },
  {
    unique: true,
    name: 'roster_student_semester_unique',
    partialFilterExpression: { student_id: { $exists: true, $ne: null } },
  },
);
DormitoryRosterEntrySchema.index({ full_name_normalized: 1, date_of_birth: 1 }, { name: 'roster_identity_lookup' });
DormitoryRosterEntrySchema.index({ student_code_normalized: 1 }, { name: 'roster_student_code_lookup', sparse: true });
DormitoryRosterEntrySchema.index(
  { room_id: 1, is_room_leader: 1 },
  {
    unique: true,
    name: 'roster_room_leader_unique',
    partialFilterExpression: { room_id: { $exists: true, $ne: null }, is_room_leader: true },
  },
);
