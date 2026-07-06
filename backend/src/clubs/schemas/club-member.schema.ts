import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';

export type ClubMemberDocument = ClubMember & Document;

@Schema({ timestamps: true, collection: 'club_members' })
export class ClubMember {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Club', required: true })
  club_id: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student', required: true })
  student_id: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['member', 'president', 'vice_president', 'secretary', 'treasurer'],
    default: 'member',
  })
  role: string;

  @Prop({
    type: String,
    enum: ['pending', 'active', 'inactive', 'rejected', 'left'],
    default: 'pending',
  })
  status: string;

  @Prop()
  joined_at?: Date;

  @Prop()
  left_at?: Date;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  approved_by?: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Semester',
    required: true,
  })
  semester_id: Types.ObjectId;
}

export const ClubMemberSchema = SchemaFactory.createForClass(ClubMember);

ClubMemberSchema.index(
  { club_id: 1, student_id: 1, semester_id: 1 },
  { unique: true },
);
ClubMemberSchema.index({ student_id: 1 });
ClubMemberSchema.index({ club_id: 1, status: 1 });
