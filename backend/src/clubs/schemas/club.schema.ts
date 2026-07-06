import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ClubDocument = Club & Document;

@Schema({ _id: false })
export class ClubSettings {
  @Prop({ default: true })
  allow_self_registration: boolean;

  @Prop({ default: true })
  require_approval: boolean;

  @Prop({ default: false })
  attendance_point_enabled: boolean;

  @Prop({ default: 0 })
  point_per_attendance: number;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Criterion' })
  criterion_id?: Types.ObjectId;
}

export const ClubSettingsSchema = SchemaFactory.createForClass(ClubSettings);

@Schema({ timestamps: true, collection: 'clubs' })
export class Club {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop({ trim: true })
  description: string;

  @Prop({
    required: true,
    enum: ['academic', 'sports', 'art', 'volunteer', 'technology', 'other'],
    default: 'other',
  })
  category: string;

  @Prop()
  logo_url: string;

  @Prop()
  cover_url: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  advisor_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student' })
  president_id: Types.ObjectId;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Student' }] })
  vice_president_ids: Types.ObjectId[];

  @Prop()
  max_members: number;

  @Prop()
  founded_date: Date;

  @Prop()
  activity_start_date: Date;

  @Prop()
  activity_end_date: Date;

  @Prop({
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester' })
  semester_id: Types.ObjectId;

  @Prop({ type: ClubSettingsSchema, default: () => ({}) })
  settings: ClubSettings;
}

export const ClubSchema = SchemaFactory.createForClass(Club);

ClubSchema.index({ advisor_id: 1 });
ClubSchema.index({ status: 1 });
ClubSchema.index({ semester_id: 1 });
