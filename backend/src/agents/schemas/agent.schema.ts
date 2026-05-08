
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AgentDocument = Agent & Document;

export enum AgentRole {
  ORCHESTRATOR = 'orchestrator',
  DESIGN = 'design',
  UI = 'ui',
  QA = 'qa',
  BACKEND = 'backend',
}

export enum AgentStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BUSY = 'busy',
}

@Schema({ timestamps: true })
export class Agent {
  @Prop({ required: true, unique: true })
  name: string;

  @Prop({ required: true, enum: AgentRole })
  role: string;

  @Prop()
  description: string;

  @Prop({ required: true, enum: AgentStatus, default: AgentStatus.ACTIVE })
  status: string;

  @Prop({ type: Object })
  configuration: Record<string, any>;
}

export const AgentSchema = SchemaFactory.createForClass(Agent);
