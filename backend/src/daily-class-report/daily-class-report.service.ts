import { ConflictException, Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
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
    requester?: any,
  ): Promise<DailyClassReport> {
    try {
      if (requester) {
        createDailyClassReportDto.reported_by = requester.userId;
      }
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

  private async getScopeFilter(requester?: any): Promise<any> {
    if (!requester) return {};
    const roleName = (requester.roleName || '').toLowerCase();
    
    // Admin, Supervisor xem tất cả
    if (roleName.includes('admin') || roleName.includes('supervisor') || roleName.includes('quản sinh')) {
      return {};
    }
    
    // Teacher chỉ xem các lớp phụ trách
    if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
      const classes = await this.academicRecordService['classModel'].find({ advisor_id: requester.userId }).select('_id').exec();
      return { class_id: { $in: classes.map(c => c._id) } };
    }
    
    // Student chỉ xem báo cáo của lớp mình
    if (roleName.includes('student')) {
      const student = await this.academicRecordService['studentModel'].findOne({ user_id: new Types.ObjectId(requester.userId) }).select('class_id').exec();
      if (student && student.class_id) {
        return { class_id: student.class_id };
      }
      return { class_id: null }; // Không có lớp -> không xem được gì
    }
    
    return {};
  }

  async findAll(requester?: any): Promise<DailyClassReport[]> {
    const scopeFilter = await this.getScopeFilter(requester);
    return this.dailyClassReportModel
      .find({ is_delete: { $ne: true }, ...scopeFilter })
      .populate('class_id')
      .populate('reported_by', 'user_name email')
      .exec();
  }

  async findDeleted(requester?: any): Promise<DailyClassReport[]> {
    const scopeFilter = await this.getScopeFilter(requester);
    return this.dailyClassReportModel
      .find({ is_delete: true, ...scopeFilter })
      .populate('class_id')
      .populate('reported_by', 'user_name email')
      .exec();
  }

  async findOne(id: string, requester?: any): Promise<DailyClassReport> {
    const scopeFilter = await this.getScopeFilter(requester);
    const report = await this.dailyClassReportModel
      .findOne({ _id: id, is_delete: { $ne: true }, ...scopeFilter })
      .populate('class_id')
      .populate('reported_by', 'user_name email')
      .exec();
    if (!report) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }
    return report;
  }

  async findByClassId(classId: string, requester?: any): Promise<DailyClassReport[]> {
    const scopeFilter = await this.getScopeFilter(requester);
    return this.dailyClassReportModel
      .find({ class_id: classId as any, is_delete: { $ne: true }, ...scopeFilter })
      .populate('class_id')
      .populate('reported_by', 'user_name email')
      .exec();
  }

  async update(
    id: string,
    updateDailyClassReportDto: UpdateDailyClassReportDto,
    requester?: any,
  ): Promise<DailyClassReport> {
    const scopeFilter = await this.getScopeFilter(requester);
    const oldReport = await this.dailyClassReportModel.findOne({ _id: id, is_delete: { $ne: true }, ...scopeFilter }).exec();
    if (!oldReport) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found or you don't have permission`);
    }

    if (requester) {
      this.checkReportPermission(oldReport, requester);
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

  private checkReportPermission(report: any, requester: any): void {
    if (!requester) {
      throw new ForbiddenException('Thông tin người yêu cầu không hợp lệ.');
    }

    const roleName = requester.roleName ? requester.roleName.toLowerCase() : '';
    const isAdmin = roleName.includes('admin');

    if (isAdmin) return;

    const reportedBy = report.reported_by && typeof report.reported_by === 'object'
      ? (report.reported_by._id ? report.reported_by._id.toString() : report.reported_by.toString())
      : (report.reported_by ? report.reported_by.toString() : '');

    if (reportedBy !== requester.userId) {
      throw new ForbiddenException('Bạn chỉ có thể xoá báo cáo ngày do chính mình tạo ra.');
    }
  }

  async remove(id: string, requester: any): Promise<DailyClassReport> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`ID báo cáo không hợp lệ: ${id}`);
    }

    const report = await this.dailyClassReportModel.findOne({ _id: id, is_delete: { $ne: true } }).exec();
    if (!report) {
      throw new NotFoundException(`Báo cáo lớp học với ID ${id} không tồn tại hoặc đã bị xóa`);
    }

    this.checkReportPermission(report, requester);

    // Soft-delete tất cả AcademicRecord liên kết trước
    const associatedRecords = await this.academicRecordService.findByDailyReportId(id);
    for (const record of associatedRecords) {
      const recordId = (record as any)._id ? (record as any)._id.toString() : record.toString();
      await this.academicRecordService.remove(recordId, requester, true);
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

  async restore(id: string, requester?: any): Promise<DailyClassReport> {
    const scopeFilter = await this.getScopeFilter(requester);
    const report = await this.dailyClassReportModel.findOne({ _id: id, is_delete: true, ...scopeFilter }).exec();
    if (!report) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found trong thùng rác`);
    }

    if (requester) {
      this.checkReportPermission(report, requester);
    }

    // Khôi phục tất cả AcademicRecord liên kết (kể cả đã bị soft-deleted)
    const associatedRecords = await this.academicRecordService.findByDailyReportId(id, true);
    for (const record of associatedRecords) {
      const recordId = (record as any)._id ? (record as any)._id.toString() : record.toString();
      await this.academicRecordService.restore(recordId, requester);
    }

    report.is_delete = false;
    const saved = await report.save();
    return saved.populate(['class_id', 'reported_by']);
  }

  async forceRemove(id: string, requester: any): Promise<DailyClassReport> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`ID báo cáo không hợp lệ: ${id}`);
    }

    const report = await this.dailyClassReportModel.findById(id).exec();
    if (!report) {
      throw new NotFoundException(`Báo cáo lớp học với ID ${id} không tồn tại`);
    }

    this.checkReportPermission(report, requester);

    // Xoá vĩnh viễn tất cả AcademicRecord liên kết (kể cả đã bị soft-deleted)
    const associatedRecords = await this.academicRecordService.findByDailyReportId(id, true);
    for (const record of associatedRecords) {
      const recordId = (record as any)._id ? (record as any)._id.toString() : record.toString();
      await this.academicRecordService.forceRemove(recordId, requester, true);
    }

    const deleted = await this.dailyClassReportModel
      .findByIdAndDelete(id)
      .exec();
    if (!deleted) {
      throw new NotFoundException(`DailyClassReport with ID ${id} not found`);
    }
    return deleted;
  }

  async bulkRemove(ids: string[], requester: any) {
    if (!Array.isArray(ids) || ids.length === 0) {
      return { deletedCount: 0, failed: [] };
    }
    const uniqueIds = Array.from(new Set(ids));
    let deletedCount = 0;
    const failed: Array<{ id: string; message: string }> = [];

    for (const id of uniqueIds) {
      try {
        await this.remove(id, requester);
        deletedCount++;
      } catch (error: any) {
        failed.push({
          id,
          message: error.message || 'Lỗi không xác định khi xóa báo cáo lớp học.',
        });
      }
    }

    return { deletedCount, failed };
  }
}
