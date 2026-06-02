import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agent, AgentDocument } from './schemas/agent.schema';

@Injectable()
export class AgentsService {
  constructor(
    @InjectModel(Agent.name) private agentModel: Model<AgentDocument>,
  ) {}

  async create(createAgentDto: any): Promise<AgentDocument> {
    const createdAgent = new this.agentModel(createAgentDto);
    return createdAgent.save();
  }

  async findAll(): Promise<AgentDocument[]> {
    return this.agentModel.find().exec();
  }

  async findOne(id: string): Promise<AgentDocument | null> {
    return this.agentModel.findById(id).exec();
  }
}
