import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  EvaluationDetail,
  EvaluationDetailDocument,
} from './schemas/evaluation-detail.schema';
import { CreateEvaluationDetailDto } from './dto/create-evaluation-detail.dto';
import { UpdateEvaluationDetailDto } from './dto/update-evaluation-detail.dto';
import {
  AcademicRecord,
  AcademicRecordDocument,
} from '../academic-record/schemas/academic-record.schema';
import {
  Criterion,
  CriterionDocument,
} from '../criteria/schemas/criterion.schema';
import {
  SummaryPoint,
  SummaryPointDocument,
} from '../summaries-point/schemas/summary-point.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Class, ClassDocument } from '../classes/schemas/class.schema';

@Injectable()
export class EvaluationDetailService {
  constructor(
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<AcademicRecordDocument>,
    @InjectModel(Criterion.name)
    private readonly criterionModel: Model<CriterionDocument>,
    @InjectModel(SummaryPoint.name)
    private readonly summaryPointModel: Model<SummaryPointDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Class.name)
    private readonly classModel: Model<ClassDocument>,
  ) {}

  private isTeacher(requester?: any) {
    const role = (requester?.roleName || '').toLowerCase();
    return role.includes('teacher') || role.includes('advisor');
  }

  private async getTeacherClassIds(requester?: any) {
    if (!this.isTeacher(requester) || !requester?.userId) return null;

    const classes = await this.classModel
      .find({ advisor_id: requester.userId })
      .select('_id')
      .lean()
      .exec();

    return classes.map((cls) => cls._id);
  }

  private async getTeacherStudentIds(requester?: any) {
    const teacherClassIds = await this.getTeacherClassIds(requester);
    if (!teacherClassIds) return null;

    const students = await this.studentModel
      .find({ class_id: { $in: teacherClassIds } } as any)
      .select('_id')
      .lean()
      .exec();

    return students.map((student) => student._id);
  }

  private async getSummaryScopeFilter(requester?: any) {
    const teacherStudentIds = await this.getTeacherStudentIds(requester);
    return teacherStudentIds
      ? ({ student_id: { $in: teacherStudentIds } } as any)
      : {};
  }

  private async assertCanAccessSummary(summaryId: string, requester?: any) {
    const teacherStudentIds = await this.getTeacherStudentIds(requester);
    if (!teacherStudentIds) return;

    const summary = await this.summaryPointModel
      .findOne({ _id: summaryId, student_id: { $in: teacherStudentIds } } as any)
      .select('_id')
      .lean()
      .exec();

    if (!summary) {
      throw new ForbiddenException('Bạn không có quyền thao tác chi tiết điểm ngoài lớp GVCN.');
    }
  }

  private getRoleLevel(roleName?: string): number {
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
    return 1;
  }

  private getRecordCreator(record: any): { id: string; level: number } | null {
    if (!record.recorded_by) return null;

    const recordedBy = record.recorded_by as any;
    const id = recordedBy._id ? recordedBy._id.toString() : recordedBy.toString();
    const roleName = recordedBy.role
      ? (typeof recordedBy.role === 'object' ? recordedBy.role.name : recordedBy.role)
      : '';

    return { id, level: this.getRoleLevel(roleName) };
  }

  private canRequesterDeleteRecord(record: any, requester?: any): boolean {
    if (!requester?.userId || record.daily_report_id) return false;

    const creator = this.getRecordCreator(record);
    if (!creator) return false;

    const requesterLevel = this.getRoleLevel(requester.roleName);
    if (requesterLevel > creator.level) return true;

    return requesterLevel === creator.level && requester.userId === creator.id;
  }

  /**
   * Helper function to sync direct grading academic records based on currentCount
   */
  private async syncAcademicRecords(
    summary: SummaryPointDocument,
    criterion: CriterionDocument,
    currentCount: number,
    requester?: any,
  ): Promise<void> {
    // Find all active academic records for this student, semester, and criterion
    const records = await this.academicRecordModel.find({
      student_id: summary.student_id as any,
      semester_id: summary.semester_id as any,
      criterion_id: criterion._id as any,
      status: 'active',
    } as any)
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();

    const diff = currentCount - records.length;
    if (diff > 0) {
      let userName = 'Hệ thống';
      const updatedByUserId = requester?.userId;
      if (updatedByUserId && Types.ObjectId.isValid(updatedByUserId)) {
        const user = await this.userModel.findById(updatedByUserId).exec();
        if (user) {
          userName = user.user_name;
        }
      }

      // Create diff new records
      const promises = [];
      for (let i = 0; i < diff; i++) {
        promises.push(
          new this.academicRecordModel({
            criterion_id: criterion._id as any,
            student_id: summary.student_id,
            semester_id: summary.semester_id,
            record_title: criterion.criterion_name,
            description: `(Chấm điểm trực tiếp từ ${userName})`,
            status: 'active',
            recorded_by: updatedByUserId ? new Types.ObjectId(updatedByUserId) : undefined,
          }).save()
        );
      }
      await Promise.all(promises);
    } else if (diff < 0) {
      // Delete excess direct grading records created by the current user
      const excessCount = Math.abs(diff);
      const requesterLevel = this.getRoleLevel(requester?.roleName);
      const deletableRecords = records
        .filter((rec) => this.canRequesterDeleteRecord(rec, requester))
        .sort((a, b) => {
          const aCreator = this.getRecordCreator(a);
          const bCreator = this.getRecordCreator(b);
          const aLevel = aCreator?.level || requesterLevel;
          const bLevel = bCreator?.level || requesterLevel;
          if (aLevel !== bLevel) return aLevel - bLevel;
          return new Date((b as any).createdAt || 0).getTime() - new Date((a as any).createdAt || 0).getTime();
        });
      const recordsToDelete = deletableRecords.slice(0, excessCount);
      const promises = recordsToDelete.map((rec) =>
        this.academicRecordModel.findByIdAndDelete(rec._id).exec()
      );
      await Promise.all(promises);
    }
  }

  /**
   * Đếm số academic_record đã có sẵn cho 1 summary + 1 criterion.
   */
  async getPreExistingRecordCount(
    summaryId: string,
    criterionId: string,
  ): Promise<number> {
    const summary = await this.summaryPointModel.findById(summaryId).exec();
    if (!summary) return 0;

    const count = await this.academicRecordModel.countDocuments({
      student_id: summary.student_id as any,
      semester_id: summary.semester_id as any,
      criterion_id: new Types.ObjectId(criterionId) as any,
      status: 'active',
    } as any).exec();

    return count;
  }

  /**
   * Đếm hàng loạt số academic_record đã có sẵn cho tất cả criteria của 1 summary.
   */
  async getPreExistingCountsForSummary(
    summaryId: string,
    requester?: any,
  ): Promise<Record<string, { original_count: number; current_count: number }>> {
    const summary = await this.summaryPointModel.findById(summaryId).exec();
    if (!summary) return {};

    const records = await this.academicRecordModel.find({
      student_id: summary.student_id as any,
      semester_id: summary.semester_id as any,
      status: 'active',
    } as any)
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();

    const countsMap: Record<string, { original_count: number; current_count: number }> = {};
    records.forEach((rec) => {
      const criId = rec.criterion_id?.toString();
      if (criId) {
        if (!countsMap[criId]) {
          countsMap[criId] = { original_count: 0, current_count: 0 };
        }
        countsMap[criId].current_count += 1;
        if (!this.canRequesterDeleteRecord(rec, requester)) {
          countsMap[criId].original_count += 1;
        }
      }
    });

    return countsMap;
  }

  async create(
    createEvaluationDetailDto: CreateEvaluationDetailDto,
    requester?: any,
  ): Promise<EvaluationDetail> {
    const { summary_id, criterion_id, current_count, ...rest } = createEvaluationDetailDto;
    await this.assertCanAccessSummary(summary_id, requester);

    const summary = await this.summaryPointModel.findById(summary_id).exec();
    if (!summary) {
      throw new NotFoundException(`SummaryPoint with ID ${summary_id} not found`);
    }

    const criterion = await this.criterionModel.findById(criterion_id).exec();
    if (!criterion) {
      throw new NotFoundException(`Criterion with ID ${criterion_id} not found`);
    }

    // Check if detail already exists
    const existingIndex = summary.details.findIndex(
      (d) => d.criterion_id && d.criterion_id.toString() === criterion_id
    );
    if (existingIndex !== -1) {
      throw new ConflictException(`EvaluationDetail for Criterion ${criterion_id} already exists on this SummaryPoint`);
    }

    const countVal = current_count || 0;

    // Sync academic records first
    const firstLog = rest.log && rest.log.length > 0 ? rest.log[0] : null;
    const createdByUserId = requester?.userId || firstLog?.updated_by || rest.gv_reviewed_by || rest.locked_by;
    await this.syncAcademicRecords(
      summary,
      criterion,
      countVal,
      requester || { userId: createdByUserId },
    );

    // Compute system score
    let systemScore = countVal * criterion.score_per_unit;
    if (criterion.score_per_unit >= 0) {
      systemScore = Math.max(criterion.min_score, Math.min(criterion.max_score, systemScore));
    } else {
      systemScore = Math.max(-criterion.max_score, Math.min(criterion.min_score, systemScore));
    }

    const newDetail: any = {
      _id: new Types.ObjectId(),
      criterion_id: new Types.ObjectId(criterion_id),
      current_count: countVal,
      system_score: systemScore,
      sv_score: rest.sv_score !== undefined ? rest.sv_score : systemScore,
      sv_submitted_at: rest.sv_submitted_at || null,
      gv_score: rest.gv_score !== undefined ? rest.gv_score : systemScore,
      gv_reviewed_at: rest.gv_reviewed_at || null,
      gv_reviewed_by: rest.gv_reviewed_by ? new Types.ObjectId(rest.gv_reviewed_by) : null,
      final_score: rest.final_score !== undefined ? rest.final_score : systemScore,
      locked_at: rest.locked_at || null,
      locked_by: rest.locked_by ? new Types.ObjectId(rest.locked_by) : null,
      status: rest.status || 'draft',
      description: rest.description || '',
      log: rest.log || [],
    };

    summary.details.push(newDetail);
    summary.markModified('details');
    await summary.save();

    return newDetail;
  }

  async findAll(requester?: any): Promise<EvaluationDetail[]> {
    const scopeFilter = await this.getSummaryScopeFilter(requester);
    const summaries = await this.summaryPointModel.find(scopeFilter).exec();
    return summaries.flatMap((s) => s.details || []);
  }

  async findOne(id: string, requester?: any): Promise<EvaluationDetail> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const scopeFilter = await this.getSummaryScopeFilter(requester);
    const summary = await this.summaryPointModel.findOne({
      ...scopeFilter,
      'details._id': new Types.ObjectId(id),
    } as any).exec();

    if (!summary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const detail = (summary.details as any).id(id);
    return detail;
  }

  async findBySummaryId(summaryId: string, requester?: any): Promise<EvaluationDetail[]> {
    if (!Types.ObjectId.isValid(summaryId)) {
      throw new NotFoundException(`SummaryPoint with ID ${summaryId} not found`);
    }

    await this.assertCanAccessSummary(summaryId, requester);
    const summary = await this.summaryPointModel.findById(summaryId).exec();
    return summary ? summary.details || [] : [];
  }

  async update(
    id: string,
    updateEvaluationDetailDto: UpdateEvaluationDetailDto,
    requester?: any,
  ): Promise<EvaluationDetail> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const summary = await this.summaryPointModel.findOne({
      'details._id': new Types.ObjectId(id),
    }).exec();

    if (!summary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }
    await this.assertCanAccessSummary(summary._id.toString(), requester);

    const detailIndex = summary.details.findIndex((d: any) => d._id.toString() === id);
    const detail = summary.details[detailIndex];

    const criterion = await this.criterionModel.findById(detail.criterion_id).exec();
    if (!criterion) {
      throw new NotFoundException(`Criterion with ID ${detail.criterion_id} not found`);
    }

    if (updateEvaluationDetailDto.current_count !== undefined) {
      let newCount = updateEvaluationDetailDto.current_count;

      const lastLog = updateEvaluationDetailDto.log && updateEvaluationDetailDto.log.length > 0
        ? updateEvaluationDetailDto.log[updateEvaluationDetailDto.log.length - 1]
        : null;
      const fallbackUserId = lastLog?.updated_by || updateEvaluationDetailDto.gv_reviewed_by || updateEvaluationDetailDto.locked_by;
      const effectiveRequester = requester || { userId: fallbackUserId };

      const records = await this.academicRecordModel.find({
        student_id: summary.student_id as any,
        semester_id: summary.semester_id as any,
        criterion_id: criterion._id as any,
        status: 'active',
      } as any)
        .populate({ path: 'recorded_by', populate: { path: 'role' } })
        .exec();

      const originalCount = records.filter((rec) => !this.canRequesterDeleteRecord(rec, effectiveRequester)).length;

      if (newCount < originalCount) {
        newCount = originalCount;
      }

      await this.syncAcademicRecords(summary, criterion, newCount, effectiveRequester);
      detail.current_count = newCount;

      let systemScore = newCount * criterion.score_per_unit;
      if (criterion.score_per_unit >= 0) {
        systemScore = Math.max(criterion.min_score, Math.min(criterion.max_score, systemScore));
      } else {
        systemScore = Math.max(-criterion.max_score, Math.min(criterion.min_score, systemScore));
      }
      detail.system_score = systemScore;
    }

    // Map other update properties
    if (updateEvaluationDetailDto.sv_score !== undefined) detail.sv_score = updateEvaluationDetailDto.sv_score;
    if (updateEvaluationDetailDto.sv_submitted_at !== undefined) detail.sv_submitted_at = updateEvaluationDetailDto.sv_submitted_at ? new Date(updateEvaluationDetailDto.sv_submitted_at) : null;
    if (updateEvaluationDetailDto.gv_score !== undefined) detail.gv_score = updateEvaluationDetailDto.gv_score;
    if (updateEvaluationDetailDto.gv_reviewed_at !== undefined) detail.gv_reviewed_at = updateEvaluationDetailDto.gv_reviewed_at ? new Date(updateEvaluationDetailDto.gv_reviewed_at) : null;
    if (updateEvaluationDetailDto.gv_reviewed_by !== undefined) detail.gv_reviewed_by = (updateEvaluationDetailDto.gv_reviewed_by ? new Types.ObjectId(updateEvaluationDetailDto.gv_reviewed_by) : null) as any;
    if (updateEvaluationDetailDto.final_score !== undefined) detail.final_score = updateEvaluationDetailDto.final_score;
    if (updateEvaluationDetailDto.locked_at !== undefined) detail.locked_at = updateEvaluationDetailDto.locked_at ? new Date(updateEvaluationDetailDto.locked_at) : null;
    if (updateEvaluationDetailDto.locked_by !== undefined) detail.locked_by = (updateEvaluationDetailDto.locked_by ? new Types.ObjectId(updateEvaluationDetailDto.locked_by) : null) as any;
    if (updateEvaluationDetailDto.status !== undefined) detail.status = updateEvaluationDetailDto.status;
    if (updateEvaluationDetailDto.description !== undefined) detail.description = updateEvaluationDetailDto.description;
    if (updateEvaluationDetailDto.log !== undefined) detail.log = updateEvaluationDetailDto.log as any;

    const updatedSummary = await this.summaryPointModel.findOneAndUpdate(
      { 'details._id': new Types.ObjectId(id) },
      {
        $set: {
          'details.$.current_count': detail.current_count,
          'details.$.system_score': detail.system_score,
          'details.$.sv_score': detail.sv_score,
          'details.$.sv_submitted_at': detail.sv_submitted_at,
          'details.$.gv_score': detail.gv_score,
          'details.$.gv_reviewed_at': detail.gv_reviewed_at,
          'details.$.gv_reviewed_by': detail.gv_reviewed_by,
          'details.$.final_score': detail.final_score,
          'details.$.locked_at': detail.locked_at,
          'details.$.locked_by': detail.locked_by,
          'details.$.status': detail.status,
          'details.$.description': detail.description,
          'details.$.log': detail.log,
        },
      },
      { returnDocument: 'after' },
    ).exec();

    if (!updatedSummary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const updatedDetail = (updatedSummary.details as any).id(id);
    return updatedDetail;
  }

  async remove(id: string, requester?: any): Promise<EvaluationDetail> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const summary = await this.summaryPointModel.findOne({
      'details._id': new Types.ObjectId(id),
    }).exec();

    if (!summary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }
    await this.assertCanAccessSummary(summary._id.toString(), requester);

    const detailIndex = summary.details.findIndex((d: any) => d._id.toString() === id);
    const deletedDetail = summary.details[detailIndex];

    const criterion = await this.criterionModel.findById(deletedDetail.criterion_id).exec();
    if (!criterion) {
      throw new NotFoundException(`Criterion with ID ${deletedDetail.criterion_id} not found`);
    }

    const records = await this.academicRecordModel.find({
      student_id: summary.student_id as any,
      semester_id: summary.semester_id as any,
      criterion_id: deletedDetail.criterion_id as any,
      status: 'active',
    } as any)
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();

    const recordsToDelete = records.filter((rec) => this.canRequesterDeleteRecord(rec, requester));
    await Promise.all(recordsToDelete.map((rec) => this.academicRecordModel.findByIdAndDelete(rec._id).exec()));

    const remainingCount = records.length - recordsToDelete.length;
    if (remainingCount > 0) {
      let systemScore = remainingCount * criterion.score_per_unit;
      if (criterion.score_per_unit >= 0) {
        systemScore = Math.max(criterion.min_score, Math.min(criterion.max_score, systemScore));
      } else {
        systemScore = Math.max(-criterion.max_score, Math.min(criterion.min_score, systemScore));
      }

      const detail = summary.details[detailIndex];
      detail.current_count = remainingCount;
      detail.system_score = systemScore;
      detail.sv_score = systemScore;
      detail.gv_score = systemScore;
      detail.final_score = systemScore;
      detail.status = 'draft';
      detail.log = [];
      summary.markModified('details');
      await summary.save();
      return detail;
    }

    summary.details.splice(detailIndex, 1);
    summary.markModified('details');
    await summary.save();

    return deletedDetail;
  }
}
