import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AcademicRecord,
  AcademicRecordDocument,
} from './schemas/academic-record.schema';
import { CreateAcademicRecordDto } from './dto/create-academic-record.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';

@Injectable()
export class AcademicRecordService {
  constructor(
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<AcademicRecordDocument>,
  ) {}

  async create(
    createAcademicRecordDto: CreateAcademicRecordDto,
  ): Promise<AcademicRecord> {
    const createdRecord = new this.academicRecordModel(createAcademicRecordDto);
    const saved = await createdRecord.save();
    return saved.populate([
      'evaluation_detail_id',
      'criteria_id',
      'student_id',
      'semester_id',
      'daily_report_id',
      'user_id',
    ]);
  }

  async findAll(): Promise<AcademicRecord[]> {
    return this.academicRecordModel
      .find()
      .populate('evaluation_detail_id')
      .populate('criteria_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('user_id')
      .exec();
  }

  async findOne(id: string): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }
    const record = await this.academicRecordModel
      .findById(id)
      .populate('evaluation_detail_id')
      .populate('criteria_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('user_id')
      .exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }
    return record;
  }

  async findByStudentId(studentId: string): Promise<AcademicRecord[]> {
    if (!Types.ObjectId.isValid(studentId)) {
      return [];
    }
    return this.academicRecordModel
      .find({ student_id: studentId as any })
      .populate('evaluation_detail_id')
      .populate('criteria_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('user_id')
      .exec();
  }

  async findByDailyReportId(dailyReportId: string): Promise<AcademicRecord[]> {
    if (!Types.ObjectId.isValid(dailyReportId)) {
      return [];
    }
    return this.academicRecordModel
      .find({ daily_report_id: dailyReportId as any })
      .populate('evaluation_detail_id')
      .populate('criteria_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('user_id')
      .exec();
  }

  async update(
    id: string,
    updateAcademicRecordDto: UpdateAcademicRecordDto,
  ): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }
    const updated = await this.academicRecordModel
      .findByIdAndUpdate(id, updateAcademicRecordDto, {
        returnDocument: 'after',
      })
      .populate('evaluation_detail_id')
      .populate('criteria_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('user_id')
      .exec();
    if (!updated) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }
    return updated;
  }

  async remove(id: string): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }
    const deleted = await this.academicRecordModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }
    return deleted;
  }
}
