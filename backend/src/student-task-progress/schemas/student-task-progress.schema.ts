import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { StudentTaskStatus } from '../../student-tasks/schemas/student-task.schema';

export type StudentTaskProgressDocument = StudentTaskProgress & Document;

export enum AssigneeType {
  STUDENT = 'student',
  TEACHER = 'teacher',
  SUPERVISOR = 'supervisor',
}

@Schema({ timestamps: true })
export class StudentTaskProgress {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'StudentTask',
    required: true,
  })
  taskId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  assigneeUserId: Types.ObjectId;

  @Prop({ required: true, enum: AssigneeType })
  assigneeType: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Student' })
  studentId?: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Class' })
  classId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: StudentTaskStatus,
    default: StudentTaskStatus.NOT_STARTED,
  })
  status: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  @Prop()
  lastActivityAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy: Types.ObjectId;

  @Prop({ enum: ['manual', 'linked_event', 'system'], default: 'manual' })
  statusSource?: string;

  @Prop()
  sourceType?: string;

  @Prop()
  sourceId?: string;

  @Prop()
  lastSyncedAt?: Date;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date })
  removedAt?: Date;

  @Prop()
  removedReason?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  criteriaProgress?: {
    totalCriteria: number;
    completedCriteria: number;
    completionRate: number;
    status: string;
    lastCalculatedAt: Date;
  };

  @Prop({ type: MongooseSchema.Types.Mixed })
  teacherProgress?: {
    teacherId: string;
    teacherName: string;
    classIds: string[];
    classNames: string[];
    totalStudents: number;
    completedStudents: number;
    inProgressStudents: number;
    notStartedStudents: number;
    totalRequiredItems?: number;
    completedTeacherItems?: number;
    completionRate: number;
    status: string;
  };
}

export const StudentTaskProgressSchema =
  SchemaFactory.createForClass(StudentTaskProgress);

// Indexes (đã loại bỏ unique để hỗ trợ record cũ bị inactive nếu cần thiết, hoặc giữ unique nếu mỗi assignee chỉ có 1 record active)
// Ở đây ta giữ unique theo (taskId, assigneeUserId) để chống trùng, mỗi người chỉ có max 1 record per task bất kể active/inactive,
// khi bỏ khỏi phạm vi ta chỉ đánh dấu isActive = false chứ ko xoá, nếu đc add lại thì set isActive = true.
StudentTaskProgressSchema.index(
  { taskId: 1, assigneeUserId: 1 },
  { unique: true },
);
StudentTaskProgressSchema.index({ isActive: 1, status: 1, updatedAt: -1 });
StudentTaskProgressSchema.index({ taskId: 1, isActive: 1 });
StudentTaskProgressSchema.index({ classId: 1, status: 1 });
