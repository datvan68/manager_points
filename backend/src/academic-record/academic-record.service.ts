import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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
  ) {}

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
      'criterion_id',
      'student_id',
      'semester_id',
      'daily_report_id',
      'recorded_by',
    ]);
  }

  async findAll(): Promise<AcademicRecord[]> {
    return this.academicRecordModel
      .find({ status: 'active' })
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('recorded_by')
      .exec();
  }

  async findDeleted(): Promise<AcademicRecord[]> {
    return this.academicRecordModel
      .find({ status: 'inactive' })
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('recorded_by')
      .exec();
  }

  async findOne(id: string): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }
    const record = await this.academicRecordModel
      .findOne({ _id: id, status: 'active' })
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('recorded_by')
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
      .find({ student_id: new Types.ObjectId(studentId), status: 'active' } as any)
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('recorded_by')
      .exec();
  }

  async findByDailyReportId(dailyReportId: string, includeDeleted: boolean = false): Promise<AcademicRecord[]> {
    if (!Types.ObjectId.isValid(dailyReportId)) {
      return [];
    }
    const query: any = includeDeleted
      ? { daily_report_id: new Types.ObjectId(dailyReportId) }
      : { daily_report_id: new Types.ObjectId(dailyReportId), status: 'active' };

    return this.academicRecordModel
      .find(query)
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate('recorded_by')
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

    const oldRecord = await this.academicRecordModel.findOne({ _id: id, status: 'active' }).exec();
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
      .populate('recorded_by')
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

  async remove(id: string, bypassDailyReportCheck: boolean = false): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findOne({ _id: id, status: 'active' }).exec();
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
      { status: 'inactive' },
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

    const record = await this.academicRecordModel.findOne({ _id: id, status: 'inactive' }).exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found trong thùng rác`);
    }

    record.status = 'active';
    const saved = await record.save();

    // Sync score update
    await this.syncStudentCriterionScore(
      saved.student_id.toString(),
      saved.semester_id.toString(),
      saved.criterion_id.toString(),
    );

    return saved.populate([
      'criterion_id',
      'student_id',
      'semester_id',
      'daily_report_id',
      'recorded_by',
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

    // Sync score update
    await this.syncStudentCriterionScore(
      deleted.student_id.toString(),
      deleted.semester_id.toString(),
      deleted.criterion_id.toString(),
    );

    return deleted;
  }
}
