
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Task, TaskDocument, TaskStatus } from './schemas/task.schema';

@Injectable()
export class TasksService {
  constructor(@InjectModel(Task.name) private taskModel: Model<TaskDocument>) {}

  async create(createTaskDto: any): Promise<TaskDocument> {
    const createdTask = new this.taskModel(createTaskDto);
    return createdTask.save();
  }

  async findAll(): Promise<TaskDocument[]> {
    return this.taskModel.find().exec();
  }

  async findOne(id: string): Promise<TaskDocument | null> {
    return this.taskModel.findById(id).exec();
  }

  async updateStatus(id: string, status: TaskStatus): Promise<TaskDocument | null> {
    return this.taskModel.findByIdAndUpdate(id, { status }, { returnDocument: 'after' }).exec();
  }

  async updateResult(id: string, result: any): Promise<TaskDocument | null> {
    return this.taskModel
      .findByIdAndUpdate(id, { result, status: TaskStatus.COMPLETED }, { returnDocument: 'after' })
      .exec();
  }
}
