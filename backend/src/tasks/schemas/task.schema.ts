import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { Agent } from '../../agents/schemas/agent.schema';

export type TaskDocument = Task & Document;

export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Schema({ timestamps: true })
export class Task {
  @Prop({ required: true })
  title: string;

  @Prop()
  description: string;

  @Prop({ required: true, enum: TaskStatus, default: TaskStatus.PENDING })
  status: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'Agent' })
  assignedTo: string;

  @Prop({ type: Object })
  result: Record<string, any>;

  @Prop([String])
  logs: string[];
}

export const TaskSchema = SchemaFactory.createForClass(Task);
