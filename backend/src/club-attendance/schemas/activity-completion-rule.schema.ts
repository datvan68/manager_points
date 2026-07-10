import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ActivityCompletionRuleDocument = ActivityCompletionRule & Document;

@Schema({ timestamps: true, collection: 'activity_completion_rules' })
export class ActivityCompletionRule {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Club', required: true })
  club_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Semester', required: true })
  semester_id: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1 })
  minimum_attendance: number;

  @Prop({
    type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Criterion' }],
    required: true,
    validate: {
      validator: (val: any[]) => val && val.length >= 1,
      message: 'criterion_ids phải chứa ít nhất 1 phần tử',
    },
  })
  criterion_ids: Types.ObjectId[];

  @Prop({
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  })
  status: string;
}

export const ActivityCompletionRuleSchema =
  SchemaFactory.createForClass(ActivityCompletionRule);

ActivityCompletionRuleSchema.index({ club_id: 1, semester_id: 1 }, { unique: true });
