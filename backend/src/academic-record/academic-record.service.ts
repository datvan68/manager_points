import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AcademicRecord,
  AcademicRecordDocument,
} from './schemas/academic-record.schema';
import {
  SummaryPoint,
  SummaryPointDocument,
} from '../summaries-point/schemas/summary-point.schema';
import {
  Criterion,
  CriterionDocument,
} from '../criteria/schemas/criterion.schema';
import { CreateAcademicRecordDto } from './dto/create-academic-record.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';

@Injectable()
export class AcademicRecordService {
  constructor(
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<AcademicRecordDocument>,
    @InjectModel(SummaryPoint.name)
    private readonly summaryPointModel: Model<SummaryPointDocument>,
    @InjectModel(Criterion.name)
    private readonly criterionModel: Model<CriterionDocument>,
  ) { }

  /**
   * Helper function to sync student's criterion count and system score in SummaryPoint(s)
   */
  async syncStudentCriterionScore(
    studentId: string,
    semesterId: string,
    criterionId: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(studentId) || !Types.ObjectId.isValid(semesterId) || !Types.ObjectId.isValid(criterionId)) {
      return;
    }

    // 1. Count how many active academic records exist for this student, semester, and criterion
    const activeCount = await this.academicRecordModel.countDocuments({
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
      criterion_id: new Types.ObjectId(criterionId),
      status: 'active',
      is_deleted: { $ne: true },
    } as any).exec();

    // 2. Fetch the criterion definition to get details
    const criterion = await this.criterionModel.findById(criterionId).exec();
    if (!criterion) return;

    // 3. Compute system_score
    let systemScore = activeCount * criterion.score_per_unit;
    if (criterion.score_per_unit >= 0) {
      systemScore = Math.max(criterion.min_score, Math.min(criterion.max_score, systemScore));
    } else {
      systemScore = Math.max(-criterion.max_score, Math.min(criterion.min_score, systemScore));
    }

    // 4. Find all SummaryPoints for this student and semester
    let summaries = await this.summaryPointModel.find({
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
    } as any).exec();

    // If no summaries exist, we don't automatically create one since it should be generated via period/import flow
    // but just to be safe, if we need to initialize one, we can check.
    for (const summary of summaries) {
      let details = summary.details || [];
      const detailIndex = details.findIndex(
        (d) => d.criterion_id && d.criterion_id.toString() === criterionId,
      );

      if (detailIndex === -1) {
        // Add new embedded detail
        const newDetail: any = {
          criterion_id: new Types.ObjectId(criterionId),
          current_count: activeCount,
          system_score: systemScore,
          sv_score: null,
          sv_submitted_at: null,
          gv_score: null,
          gv_reviewed_at: null,
          gv_reviewed_by: null,
          final_score: null,
          locked_at: null,
          locked_by: null,
          status: 'draft',
          description: '',
          log: [],
        };
        details.push(newDetail);
      } else {
        // Update existing embedded detail
        const detail = details[detailIndex];
        detail.current_count = activeCount;
        detail.system_score = systemScore;
        // Also update final_score to systemScore if it hasn't been set by student/gv/admin yet
        if (detail.status === 'draft') {
          detail.sv_score = systemScore;
          detail.gv_score = systemScore;
          detail.final_score = systemScore;
        }
        details[detailIndex] = detail;
      }

      summary.details = details;
      summary.markModified('details');
      await summary.save();
    }
  }

  async create(
    createAcademicRecordDto: CreateAcademicRecordDto,
  ): Promise<AcademicRecord> {
    const createdRecord = new this.academicRecordModel(createAcademicRecordDto);
    const saved = await createdRecord.save();

    // Sync points to SummaryPoints
    await this.syncStudentCriterionScore(
      saved.student_id.toString(),
      saved.semester_id.toString(),
      saved.criterion_id.toString(),
    );

    return saved.populate([
      { path: 'criterion_id' },
      { path: 'student_id' },
      { path: 'semester_id' },
      { path: 'daily_report_id' },
      { path: 'recorded_by', populate: { path: 'role' } },
    ]);
  }

  async findAll(): Promise<AcademicRecord[]> {
    return this.academicRecordModel
      .find({ status: 'active', is_deleted: { $ne: true } })
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
  }

  async findDeleted(): Promise<AcademicRecord[]> {
    return this.academicRecordModel
      .find({ $or: [{ status: 'inactive' }, { is_deleted: true }] })
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
  }

  async findOne(id: string): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }
    const record = await this.academicRecordModel
      .findOne({ _id: id, status: 'active', is_deleted: { $ne: true } })
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
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
      .find({ student_id: new Types.ObjectId(studentId), status: 'active', is_deleted: { $ne: true } } as any)
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
  }

  async findByDailyReportId(dailyReportId: string, includeDeleted: boolean = false): Promise<AcademicRecord[]> {
    if (!Types.ObjectId.isValid(dailyReportId)) {
      return [];
    }
    const query: any = includeDeleted
      ? { daily_report_id: new Types.ObjectId(dailyReportId) }
      : { daily_report_id: new Types.ObjectId(dailyReportId), status: 'active', is_deleted: { $ne: true } };

    return this.academicRecordModel
      .find(query)
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
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

    const oldRecord = await this.academicRecordModel.findOne({ _id: id, status: 'active', is_deleted: { $ne: true } }).exec();
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
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!updated) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    // Sync old key
    await this.syncStudentCriterionScore(
      oldRecord.student_id.toString(),
      oldRecord.semester_id.toString(),
      oldRecord.criterion_id.toString(),
    );

    // Sync new key if changed
    if (
      updated.student_id.toString() !== oldRecord.student_id.toString() ||
      updated.semester_id.toString() !== oldRecord.semester_id.toString() ||
      updated.criterion_id.toString() !== oldRecord.criterion_id.toString()
    ) {
      await this.syncStudentCriterionScore(
        updated.student_id.toString(),
        updated.semester_id.toString(),
        updated.criterion_id.toString(),
      );
    }

    return updated;
  }

  async remove(id: string, requester: any, bypassDailyReportCheck: boolean = false): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findOne({ _id: id, status: 'active', is_deleted: { $ne: true } })
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    if (record.daily_report_id && !bypassDailyReportCheck) {
      throw new BadRequestException(
        'Ghi nhận này thuộc báo cáo điểm danh ngày, không thể xoá trực tiếp. Vui lòng chỉnh sửa hoặc xoá qua báo cáo ngày tương ứng.',
      );
    }

    this.checkHierarchyPermission(record, requester);

    const deleted = await this.academicRecordModel.findByIdAndUpdate(
      id,
      { status: 'inactive', is_deleted: true },
      { returnDocument: 'after' },
    ).exec();

    if (!deleted) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    // Sync score update
    await this.syncStudentCriterionScore(
      deleted.student_id.toString(),
      deleted.semester_id.toString(),
      deleted.criterion_id.toString(),
    );

    return deleted;
  }

  async restore(id: string): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findOne({ _id: id, $or: [{ status: 'inactive' }, { is_deleted: true }] }).exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found trong thùng rác`);
    }

    record.status = 'active';
    record.is_deleted = false;
    const saved = await record.save();

    // Sync score update
    await this.syncStudentCriterionScore(
      saved.student_id.toString(),
      saved.semester_id.toString(),
      saved.criterion_id.toString(),
    );

    return saved.populate([
      { path: 'criterion_id' },
      { path: 'student_id' },
      { path: 'semester_id' },
      { path: 'daily_report_id' },
      { path: 'recorded_by', populate: { path: 'role' } },
    ]);
  }

  async forceRemove(id: string, requester: any, bypassDailyReportCheck: boolean = false): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findById(id)
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    if (record.daily_report_id && !bypassDailyReportCheck) {
      throw new BadRequestException(
        'Ghi nhận này thuộc báo cáo điểm danh ngày, không thể xoá vĩnh viễn trực tiếp. Vui lòng xoá báo cáo ngày tương ứng.',
      );
    }

    this.checkHierarchyPermission(record, requester);

    const deleted = await this.academicRecordModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    // Sync score update
    await this.syncStudentCriterionScore(
      deleted.student_id.toString(),
      deleted.semester_id.toString(),
      deleted.criterion_id.toString(),
    );

    return deleted;
  }

  private checkHierarchyPermission(record: any, requester: any): void {
    if (!requester) {
      throw new ForbiddenException('Thông tin người yêu cầu không hợp lệ.');
    }

    const getRoleLevel = (roleName?: string): number => {
      if (!roleName) return 1;
      const nameLower = roleName.toLowerCase();
      if (nameLower.includes('admin')) return 4;
      if (nameLower.includes('supervisor') || nameLower.includes('quản sinh') || nameLower.includes('quan sinh')) return 3;
      if (
        nameLower.includes('teacher') ||
        nameLower.includes('adviser') ||
        nameLower.includes('advisor') ||
        nameLower.includes('giảng viên') ||
        nameLower.includes('giang vien') ||
        nameLower.includes('lecturer')
      ) {
        return 2;
      }
      return 1; // student or generic user
    };

    const requesterLevel = getRoleLevel(requester.roleName);
    
    // Nếu là Admin, cho phép xóa luôn
    if (requesterLevel === 4) return;

    // Nếu người yêu cầu là sinh viên (Level 1)
    if (requesterLevel === 1) {
      const studentEmail = record.student_id && typeof record.student_id === 'object' ? record.student_id.email : '';
      
      // So sánh email của tài khoản đang đăng nhập với email của sinh viên sở hữu bản ghi
      if (requester.email && studentEmail && requester.email.toLowerCase() === studentEmail.toLowerCase()) {
        let creatorId = '';
        if (record.recorded_by) {
          creatorId = typeof record.recorded_by === 'object' ? record.recorded_by._id?.toString() : record.recorded_by.toString();
        }
        
        // Cho phép sinh viên xóa nếu bản ghi do chính họ tạo, hoặc bản ghi trống recorded_by
        if (
          !creatorId || 
          creatorId === requester.userId
        ) {
          return; // Cho phép xóa!
        }
      }
      throw new ForbiddenException('Bạn chỉ có thể xóa ghi nhận rèn luyện tự chấm của chính mình.');
    }

    let creatorLevel = 1;
    let creatorId = '';

    if (record.recorded_by) {
      creatorId = typeof record.recorded_by === 'object' ? record.recorded_by._id?.toString() : record.recorded_by.toString();
      const creatorRoleName = record.recorded_by.role 
        ? (typeof record.recorded_by.role === 'object' ? record.recorded_by.role.name : record.recorded_by.role)
        : '';
      creatorLevel = getRoleLevel(creatorRoleName);
    }

    // Quyền cao hơn (requesterLevel > creatorLevel) được xóa
    if (requesterLevel > creatorLevel) {
      return;
    }

    // Cùng cấp (requesterLevel === creatorLevel) chỉ được xóa của chính mình
    if (requesterLevel === creatorLevel) {
      if (requester.userId === creatorId) {
        return;
      }
      throw new ForbiddenException('Bạn chỉ có thể xóa ghi nhận rèn luyện do chính mình tạo ra.');
    }

    // Cấp thấp hơn không được xóa
    throw new ForbiddenException('Bạn không có quyền xóa ghi nhận rèn luyện của cấp bậc cao hơn.');
  }
}
