import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  DailyClassReport,
  DailyClassReportDocument,
} from './schemas/daily-class-report.schema';
import { CreateDailyClassReportDto } from './dto/create-daily-class-report.dto';
import { UpdateDailyClassReportDto } from './dto/update-daily-class-report.dto';
import { AcademicRecordService } from '../academic-record/academic-record.service';

@Injectable()
export class DailyClassReportService {
  constructor(
    @InjectModel(DailyClassReport.name)
    private readonly dailyClassReportModel: Model<DailyClassReportDocument>,
    private readonly academicRecordService: AcademicRecordService,
  ) {}

  async create(
    createDailyClassReportDto: CreateDailyClassReportDto,
  ): Promise<DailyClassReport> {
    try {
      const createdReport = new this.dailyClassReportModel(
        createDailyClassReportDto,
      );
      const saved = await createdReport.save();
      return saved.populate(['class_id', 'reported_by']);
    } catch (error) {
      if ((error as any)?.code === 11000) {
        throw new ConflictException(
          'Daily class report already exists for this class and report date',
        );
      }
      throw error;
    }
  }

  async findAll(): Promise<DailyClassReport[]> {
    return this.dailyClassReportModel
      .find({ is_delete: { $ne: true } })
      .populate('class_id')
      .populate('reported_by', 'user_name email')
      .exec();
  }

  async findDeleted(): Promise<DailyClassReport[]> {
    return this.dailyClassReportModel
      .find({ is_delete: true })
      .populate('class_id')
      .populate('reported_by', 'user_name email')
      .exec();
  }

  async findOne(id: string): Promise<DailyClassReport> {
    const report = await this.dailyClassReportModel
      .findOne({ _id: id, is_delete: { $ne: true } })
      .populate('class_id')
      .populate('reported_by', 'user_name email')
      .exec();
    if (!report) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }
    return report;
  }

  async findByClassId(classId: string): Promise<DailyClassReport[]> {
    return this.dailyClassReportModel
      .find({ class_id: classId as any, is_delete: { $ne: true } })
      .populate('class_id')
      .populate('reported_by', 'user_name email')
      .exec();
  }

  async update(
    id: string,
    updateDailyClassReportDto: UpdateDailyClassReportDto,
  ): Promise<DailyClassReport> {
    const oldReport = await this.dailyClassReportModel.findOne({ _id: id, is_delete: { $ne: true } }).exec();
    if (!oldReport) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }

    const updated = await this.dailyClassReportModel
      .findByIdAndUpdate(id, updateDailyClassReportDto, {
        returnDocument: 'after',
      })
      .populate('class_id')
      .populate('reported_by', 'user_name email')
      .exec();
    if (!updated) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<DailyClassReport> {
    // Soft-delete tất cả AcademicRecord liên kết trước
    const associatedRecords = await this.academicRecordService.findByDailyReportId(id);
    for (const record of associatedRecords) {
      const recordId = (record as any)._id ? (record as any)._id.toString() : record.toString();
      await this.academicRecordService.remove(recordId, true);
    }

    const deleted = await this.dailyClassReportModel
      .findByIdAndUpdate(id, { is_delete: true }, { returnDocument: 'after' })
      .populate('class_id')
      .populate('reported_by', 'user_name email')
      .exec();
    if (!deleted) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }
    return deleted;
  }

  async restore(id: string): Promise<DailyClassReport> {
    const report = await this.dailyClassReportModel.findOne({ _id: id, is_delete: true }).exec();
    if (!report) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found trong thùng rác`);
    }

    // Khôi phục tất cả AcademicRecord liên kết (kể cả đã bị soft-deleted)
    const associatedRecords = await this.academicRecordService.findByDailyReportId(id, true);
    for (const record of associatedRecords) {
      const recordId = (record as any)._id ? (record as any)._id.toString() : record.toString();
      await this.academicRecordService.restore(recordId);
    }

    report.is_delete = false;
    const saved = await report.save();
    return saved.populate(['class_id', 'reported_by']);
  }

  async forceRemove(id: string): Promise<DailyClassReport> {
    const report = await this.dailyClassReportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }

    // Xoá vĩnh viễn tất cả AcademicRecord liên kết (kể cả đã bị soft-deleted)
    const associatedRecords = await this.academicRecordService.findByDailyReportId(id, true);
    for (const record of associatedRecords) {
      const recordId = (record as any)._id ? (record as any)._id.toString() : record.toString();
      await this.academicRecordService.forceRemove(recordId, true);
    }

    const deleted = await this.dailyClassReportModel
      .findByIdAndDelete(id)
      .exec();
    if (!deleted) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }
    return deleted;
  }
}
