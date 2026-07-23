import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityDocument = Activity & Document;

@Schema({ _id: false })
export class ActivitySettings {
  @Prop({ default: true })
  require_registration_for_attendance: boolean;

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

export const ActivitySettingsSchema = SchemaFactory.createForClass(ActivitySettings);

@Schema({ _id: false })
export class CardUi {
  @Prop({
    type: String,
    enum: ['default', 'academic', 'sports', 'art', 'volunteer', 'technology', 'other'],
    default: 'default',
  })
  theme: string;

  @Prop({ type: String })
  accent_color?: string;

  @Prop({
    type: String,
    enum: ['classic', 'spotlight', 'minimal'],
    default: 'classic',
  })
  style: string;
}

export const CardUiSchema = SchemaFactory.createForClass(CardUi);

@Schema({ _id: false })
export class StateButtonConfig {
  @Prop({ type: String })
  label?: string;

  @Prop({ type: String })
  bgClass?: string;

  @Prop({ type: String })
  textClass?: string;
}
export const StateButtonConfigSchema = SchemaFactory.createForClass(StateButtonConfig);

@Schema({ _id: false })
export class BackgroundStatesConfig {
  @Prop({ type: StateButtonConfigSchema })
  none?: StateButtonConfig;

  @Prop({ type: StateButtonConfigSchema })
  pending?: StateButtonConfig;

  @Prop({ type: StateButtonConfigSchema })
  active?: StateButtonConfig;

  @Prop({ type: StateButtonConfigSchema })
  rejected?: StateButtonConfig;
}
export const BackgroundStatesConfigSchema = SchemaFactory.createForClass(BackgroundStatesConfig);

@Schema({ _id: false })
export class BackgroundConfig {
  @Prop({ type: String, default: 'default' })
  preset?: string;

  @Prop({ type: String })
  accentColor?: string;

  @Prop({ type: String })
  backgroundImageUrl?: string;

  @Prop({ type: Boolean, default: false })
  useAvatarAsBackground?: boolean;

  @Prop({ type: String })
  backgroundFrameUrl?: string;

  @Prop({ type: String })
  pattern?: string;

  @Prop({ type: String })
  petAccentType?: string;

  @Prop({ type: BackgroundStatesConfigSchema, default: () => ({}) })
  states?: BackgroundStatesConfig;
}

export const BackgroundConfigSchema = SchemaFactory.createForClass(BackgroundConfig);

@Schema({ timestamps: true, collection: 'activities' })
export class Activity {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  @Prop({
    type: String,
    enum: ['club', 'event', 'activity', 'festival'],
    default: 'activity',
  })
  activity_type: string;

  @Prop({
    type: String,
    enum: ['draft', 'published', 'completed', 'cancelled'],
    default: 'published',
  })
  participation_status: string;

  @Prop({ required: true, trim: true })
  classroom: string;

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

  @Prop({ type: ActivitySettingsSchema, default: () => ({}) })
  settings: ActivitySettings;

  @Prop({ type: CardUiSchema, default: () => ({}) })
  card_ui: CardUi;

  @Prop({ type: BackgroundConfigSchema, default: () => ({}) })
  background_config: BackgroundConfig;
}

export const ActivitySchema = SchemaFactory.createForClass(Activity);

ActivitySchema.index({ advisor_id: 1 });
ActivitySchema.index({ status: 1 });
ActivitySchema.index({ semester_id: 1 });
ActivitySchema.index({ activity_type: 1, participation_status: 1 });
