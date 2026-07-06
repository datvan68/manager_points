import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { User } from '../../auth/schemas/user.schema';

export type StudentTaskDocument = StudentTask & Document;

export enum StudentTaskType {
  PROJECT = 'project',
  ASSIGNMENT = 'assignment',
  ACTIVITY = 'activity',
}

export enum StudentTaskPriority {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum StudentTaskStatus {
  NOT_STARTED = 'not_started',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
}

export enum StudentTaskTargetType {
  STUDENT = 'student',
  TEACHER = 'teacher',
  SUPERVISOR = 'supervisor',
}

export enum StudentTaskTargetScope {
  ALL = 'all',
  SPECIFIC = 'specific',
}

@Schema({ timestamps: true })
export class StudentTask {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, enum: StudentTaskType })
  type: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  deadline: Date;

  @Prop({ required: true, enum: StudentTaskPriority })
  priority: string;

  @Prop({
    required: true,
    enum: StudentTaskStatus,
    default: StudentTaskStatus.NOT_STARTED,
  })
  status: string;

  @Prop({ default: '' })
  linkedPage?: string;

  @Prop({ required: true, enum: StudentTaskTargetType })
  targetType: string;

  @Prop({
    required: true,
    enum: StudentTaskTargetScope,
    default: StudentTaskTargetScope.ALL,
  })
  targetScope: string;

  @Prop()
  targetDetail?: string;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Student' }] })
  targetStudentIds?: Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Class' }] })
  targetClassIds?: Types.ObjectId[];

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'User' }] })
  targetTeacherIds?: Types.ObjectId[];

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  createdBy: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const StudentTaskSchema = SchemaFactory.createForClass(StudentTask);

// Indexes
StudentTaskSchema.index({ deletedAt: 1, createdAt: -1 });
StudentTaskSchema.index({ targetType: 1, status: 1, deadline: 1 });
StudentTaskSchema.index(
  { title: 'text', subject: 'text', targetDetail: 'text' },
  { weights: { title: 10, subject: 5, targetDetail: 2 } },
);
