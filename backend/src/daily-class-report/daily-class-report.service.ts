import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DailyClassReport, DailyClassReportDocument } from './schemas/daily-class-report.schema';
import { CreateDailyClassReportDto } from './dto/create-daily-class-report.dto';
import { UpdateDailyClassReportDto } from './dto/update-daily-class-report.dto';

@Injectable()
export class DailyClassReportService {
  constructor(
    @InjectModel(DailyClassReport.name)
    private readonly dailyClassReportModel: Model<DailyClassReportDocument>,
  ) {}

  async create(createDailyClassReportDto: CreateDailyClassReportDto): Promise<DailyClassReport> {
    const createdReport = new this.dailyClassReportModel(createDailyClassReportDto);
    const saved = await createdReport.save();
    return saved.populate(['class_id', 'user_id']);
  }

  async findAll(): Promise<DailyClassReport[]> {
    return this.dailyClassReportModel
      .find()
      .populate('class_id')
      .populate('user_id', 'user_name email')
      .exec();
  }

  async findOne(id: string): Promise<DailyClassReport> {
    const report = await this.dailyClassReportModel
      .findById(id)
      .populate('class_id')
      .populate('user_id', 'user_name email')
      .exec();
    if (!report) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }
    return report;
  }

  async findByClassId(classId: string): Promise<DailyClassReport[]> {
    return this.dailyClassReportModel
      .find({ class_id: classId as any })
      .populate('class_id')
      .populate('user_id', 'user_name email')
      .exec();
  }

  async update(id: string, updateDailyClassReportDto: UpdateDailyClassReportDto): Promise<DailyClassReport> {
    const updated = await this.dailyClassReportModel
      .findByIdAndUpdate(id, updateDailyClassReportDto, { returnDocument: 'after' })
      .populate('class_id')
      .populate('user_id', 'user_name email')
      .exec();
    if (!updated) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<DailyClassReport> {
    const deleted = await this.dailyClassReportModel
      .findByIdAndDelete(id)
      .exec();
    if (!deleted) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }
    return deleted;
  }
}
