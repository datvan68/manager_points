import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { SummaryPoint, SummaryPointDocument } from './schemas/summary-point.schema';
import { CreateSummaryPointDto } from './dto/create-summary-point.dto';
import { UpdateSummaryPointDto } from './dto/update-summary-point.dto';

@Injectable()
export class SummariesPointService {
  constructor(
    @InjectModel(SummaryPoint.name) private readonly summaryPointModel: Model<SummaryPointDocument>,
  ) {}

  async create(createSummaryPointDto: CreateSummaryPointDto): Promise<SummaryPoint> {
    const created = new this.summaryPointModel(createSummaryPointDto);
    return created.save();
  }

  async findAll(): Promise<SummaryPoint[]> {
    return this.summaryPointModel
      .find()
      .populate('student_id')
      .populate('semester_id')
      .exec();
  }

  async findOne(id: string): Promise<SummaryPoint> {
    const summaryPoint = await this.summaryPointModel
      .findById(id)
      .populate('student_id')
      .populate('semester_id')
      .exec();
    if (!summaryPoint) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }
    return summaryPoint;
  }

  async update(id: string, updateSummaryPointDto: UpdateSummaryPointDto): Promise<SummaryPoint> {
    const updated = await this.summaryPointModel
      .findByIdAndUpdate(id, updateSummaryPointDto, { returnDocument: 'after' })
      .populate('student_id')
      .populate('semester_id')
      .exec();
    if (!updated) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<SummaryPoint> {
    const deleted = await this.summaryPointModel
      .findByIdAndDelete(id)
      .exec();
    if (!deleted) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }
    return deleted;
  }
}
