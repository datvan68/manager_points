import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AcademicRecord,
  AcademicRecordDocument,
} from './schemas/academic-record.schema';
import {
  EvaluationDetail,
  EvaluationDetailDocument,
} from '../evaluation-detail/schemas/evaluation-detail.schema';
import { CreateAcademicRecordDto } from './dto/create-academic-record.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';

@Injectable()
export class AcademicRecordService {
  constructor(
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<AcademicRecordDocument>,
    @InjectModel(EvaluationDetail.name)
    private readonly evaluationDetailModel: Model<EvaluationDetailDocument>,
  ) {}

  private async decrementEvaluationDetailCount(evaluationDetailId: string): Promise<void> {
    if (!evaluationDetailId) return;
    
    const detail = await this.evaluationDetailModel.findById(evaluationDetailId).exec();
    if (!detail) return;

    const newCount = Math.max(0, detail.current_count - 1);
    
    const history = [...(detail.history || [])];
    history.push({
      role: 'admin',
      count: newCount,
      reason: 'Trừ do ghi nhận bị xoá/vô hiệu hoá',
      updated_at: new Date()
    } as any);

    detail.current_count = newCount;
    detail.history = history;
    await detail.save();
  }

  private async incrementEvaluationDetailCount(evaluationDetailId: string, customReason?: string): Promise<void> {
    if (!evaluationDetailId) return;
    
    const detail = await this.evaluationDetailModel.findById(evaluationDetailId).exec();
    if (!detail) return;

    const newCount = detail.current_count + 1;
    
    const history = [...(detail.history || [])];
    history.push({
      role: 'admin',
      count: newCount,
      reason: customReason || 'Cộng do ghi nhận được kích hoạt lại',
      updated_at: new Date()
    } as any);

    detail.current_count = newCount;
    detail.history = history;
    await detail.save();
  }

  async create(
    createAcademicRecordDto: CreateAcademicRecordDto,
  ): Promise<AcademicRecord> {
    const createdRecord = new this.academicRecordModel(createAcademicRecordDto);
    const saved = await createdRecord.save();
    
    if (saved.evaluation_detail_id && saved.status === 'active') {
      const evalIdRaw = saved.evaluation_detail_id as any;
      const evalId = evalIdRaw._id ? evalIdRaw._id.toString() : evalIdRaw.toString();
      await this.incrementEvaluationDetailCount(evalId, 'Tạo mới ghi nhận thủ công');
    }

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
      .find({ is_delete: { $ne: true } })
      .populate('evaluation_detail_id')
      .populate('criteria_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('user_id')
      .exec();
  }

  async findDeleted(): Promise<AcademicRecord[]> {
    return this.academicRecordModel
      .find({ is_delete: true })
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
      .findOne({ _id: id, is_delete: { $ne: true } })
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
      .find({ student_id: studentId as any, is_delete: { $ne: true } })
      .populate('evaluation_detail_id')
      .populate('criteria_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('user_id')
      .exec();
  }

  async findByDailyReportId(dailyReportId: string, includeDeleted: boolean = false): Promise<AcademicRecord[]> {
    if (!Types.ObjectId.isValid(dailyReportId)) {
      return [];
    }
    const query = includeDeleted
      ? { daily_report_id: dailyReportId as any }
      : { daily_report_id: dailyReportId as any, is_delete: { $ne: true } };

    return this.academicRecordModel
      .find(query)
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
    bypassDailyReportCheck: boolean = false,
  ): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const oldRecord = await this.academicRecordModel.findOne({ _id: id, is_delete: { $ne: true } }).exec();
    if (!oldRecord) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    if (oldRecord.daily_report_id && !bypassDailyReportCheck) {
      throw new BadRequestException(
        'Ghi nhận này thuộc báo cáo điểm danh ngày, không thể chỉnh sửa trực tiếp. Vui lòng chỉnh sửa qua báo cáo ngày tương ứng.',
      );
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

    // Handle status change
    if (updated.evaluation_detail_id) {
      const evalIdRaw = updated.evaluation_detail_id as any;
      const evalId = evalIdRaw._id ? evalIdRaw._id.toString() : evalIdRaw.toString();
      
      if (oldRecord.status === 'active' && updated.status === 'inactive') {
        await this.decrementEvaluationDetailCount(evalId);
      } else if (oldRecord.status === 'inactive' && updated.status === 'active') {
        await this.incrementEvaluationDetailCount(evalId);
      }
    }

    return updated;
  }

  async remove(id: string, bypassDailyReportCheck: boolean = false): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findOne({ _id: id, is_delete: { $ne: true } }).exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    if (record.daily_report_id && !bypassDailyReportCheck) {
      throw new BadRequestException(
        'Ghi nhận này thuộc báo cáo điểm danh ngày, không thể xoá trực tiếp. Vui lòng chỉnh sửa hoặc xoá qua báo cáo ngày tương ứng.',
      );
    }

    const deleted = await this.academicRecordModel.findByIdAndUpdate(
      id,
      { is_delete: true },
      { returnDocument: 'after' },
    ).exec();

    if (!deleted) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    if (deleted.evaluation_detail_id && deleted.status === 'active') {
      const evalIdRaw = deleted.evaluation_detail_id as any;
      const evalId = evalIdRaw._id ? evalIdRaw._id.toString() : evalIdRaw.toString();
      await this.decrementEvaluationDetailCount(evalId);
    }

    return deleted;
  }

  async restore(id: string): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findOne({ _id: id, is_delete: true }).exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found trong thùng rác`);
    }

    record.is_delete = false;
    const saved = await record.save();

    if (saved.evaluation_detail_id && saved.status === 'active') {
      const evalIdRaw = saved.evaluation_detail_id as any;
      const evalId = evalIdRaw._id ? evalIdRaw._id.toString() : evalIdRaw.toString();
      await this.incrementEvaluationDetailCount(evalId, 'Khôi phục ghi nhận vi phạm');
    }

    return saved.populate([
      'evaluation_detail_id',
      'criteria_id',
      'student_id',
      'semester_id',
      'daily_report_id',
      'user_id',
    ]);
  }

  async forceRemove(id: string, bypassDailyReportCheck: boolean = false): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findById(id).exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    if (record.daily_report_id && !bypassDailyReportCheck) {
      throw new BadRequestException(
        'Ghi nhận này thuộc báo cáo điểm danh ngày, không thể xoá vĩnh viễn trực tiếp. Vui lòng xoá báo cáo ngày tương ứng.',
      );
    }

    const deleted = await this.academicRecordModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    return deleted;
  }
}
