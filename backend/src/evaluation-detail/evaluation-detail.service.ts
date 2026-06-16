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

  private isStudent(requester?: any) {
    const role = (requester?.roleName || '').toLowerCase();
    return role.includes('student');
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

  async getPreExistingCountsBulk(
    summaryIds: string[],
    requester?: any,
  ): Promise<Record<string, Record<string, { original_count: number; current_count: number }>>> {
    if (!summaryIds || summaryIds.length === 0) return {};

    // 1. Tìm tất cả summaries được yêu cầu
    const summaries = await this.summaryPointModel.find({
      _id: { $in: summaryIds.map(id => new Types.ObjectId(id)) }
    } as any).lean().exec();

    if (!summaries || summaries.length === 0) return {};

    const summaryMap: Record<string, string> = {};
    const studentIds: Types.ObjectId[] = [];
    const semesterIds: Types.ObjectId[] = [];

    for (const s of summaries) {
      const studentId = s.student_id.toString();
      const semesterId = s.semester_id.toString();
      summaryMap[`${studentId}_${semesterId}`] = s._id.toString();
      studentIds.push(new Types.ObjectId(studentId));
      semesterIds.push(new Types.ObjectId(semesterId));
    }

    // 3. Sử dụng MongoDB Aggregation để gom nhóm records
    const groupedRecords = await this.academicRecordModel.aggregate([
      {
        $match: {
          student_id: { $in: studentIds },
          semester_id: { $in: semesterIds },
          status: 'active',
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'recorded_by',
          foreignField: '_id',
          as: 'recorded_by_user'
        }
      },
      { $unwind: { path: '$recorded_by_user', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'roles',
          localField: 'recorded_by_user.role',
          foreignField: '_id',
          as: 'recorded_by_role'
        }
      },
      { $unwind: { path: '$recorded_by_role', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: {
            student_id: '$student_id',
            semester_id: '$semester_id',
            criterion_id: '$criterion_id'
          },
          current_count: { $sum: 1 },
          records: {
            $push: {
              daily_report_id: '$daily_report_id',
              recorded_by: {
                _id: '$recorded_by_user._id',
                role: { name: '$recorded_by_role.name' }
              }
            }
          }
        }
      }
    ]).exec();

    const result: Record<string, Record<string, { original_count: number; current_count: number }>> = {};

    // Khởi tạo map kết quả
    for (const s of summaries) {
      result[s._id.toString()] = {};
    }

    for (const group of groupedRecords) {
      const studentIdStr = group._id.student_id.toString();
      const semesterIdStr = group._id.semester_id.toString();
      const criterionIdStr = group._id.criterion_id?.toString();

      if (!criterionIdStr) continue;

      const summaryId = summaryMap[`${studentIdStr}_${semesterIdStr}`];
      if (!summaryId) continue;

      let original_count = 0;
      for (const rec of group.records) {
        if (!this.canRequesterDeleteRecord(rec, requester)) {
          original_count++;
        }
      }

      result[summaryId][criterionIdStr] = {
        current_count: group.current_count,
        original_count,
      };
    }

    return result;
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

    if (summary.status === 'locked') {
      throw new BadRequestException('Không thể thêm chi tiết chấm điểm cho bảng điểm đã chốt');
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
    const createdByUserId = requester?.userId || firstLog?.updated_by || rest.gv_reviewed_by;
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
      sv_score: rest.sv_score !== undefined ? rest.sv_score : null,
      sv_submitted_at: rest.sv_submitted_at || null,
      gv_score: rest.gv_score !== undefined ? rest.gv_score : null,
      gv_reviewed_at: rest.gv_reviewed_at || null,
      gv_reviewed_by: rest.gv_reviewed_by ? new Types.ObjectId(rest.gv_reviewed_by) : null,
      final_score: null,
      locked_at: null,
      locked_by: null,
      status: rest.status === 'locked' ? 'draft' : (rest.status || 'draft'),
      description: rest.description || '',
      log: rest.log || [],
    };

    await this.summaryPointModel.findByIdAndUpdate(
      summary_id,
      { $push: { details: newDetail } },
      { new: true }
    ).exec();

    return newDetail;
  }

  async findAll(
    query?: {
      page?: number;
      limit?: number;
      summaryId?: string;
      semesterId?: string;
      classId?: string;
      studentId?: string;
    },
    requester?: any,
  ): Promise<any> {
    let page: number | undefined;
    let limit: number | undefined;
    let summaryId: string | undefined;
    let semesterId: string | undefined;
    let classId: string | undefined;
    let studentId: string | undefined;
    let actualRequester = requester;

    if (query && ('roleName' in query || 'userId' in query || 'role' in query || 'username' in query)) {
      actualRequester = query;
    } else if (query) {
      page = query.page;
      limit = query.limit;
      summaryId = query.summaryId;
      semesterId = query.semesterId;
      classId = query.classId;
      studentId = query.studentId;
    }

    const scopeFilter = await this.getSummaryScopeFilter(actualRequester);
    const filter: any = { ...scopeFilter };

    if (summaryId && Types.ObjectId.isValid(summaryId)) {
      filter._id = new Types.ObjectId(summaryId);
    }

    if (semesterId && Types.ObjectId.isValid(semesterId)) {
      filter.semester_id = new Types.ObjectId(semesterId);
    }

    if (classId && Types.ObjectId.isValid(classId)) {
      const classStudents = await this.studentModel.find({ class_id: new Types.ObjectId(classId) }).select('_id').exec();
      const studentIds = classStudents.map(s => s._id);
      if (filter.student_id) {
        if (filter.student_id.$in) {
          filter.student_id.$in = filter.student_id.$in.filter((id: any) =>
            studentIds.some(sId => sId.toString() === id.toString())
          );
        } else {
          if (!studentIds.some(sId => sId.toString() === filter.student_id.toString())) {
            return (page !== undefined || limit !== undefined) ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } } : [];
          }
        }
      } else {
        filter.student_id = { $in: studentIds };
      }
    }

    if (studentId && Types.ObjectId.isValid(studentId)) {
      const targetStudentObjectId = new Types.ObjectId(studentId);
      if (filter.student_id) {
        if (filter.student_id.$in) {
          const hasAccess = filter.student_id.$in.some((id: any) => id.toString() === studentId);
          if (!hasAccess) {
            return (page !== undefined || limit !== undefined) ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } } : [];
          }
        } else {
          if (filter.student_id.toString() !== studentId) {
            return (page !== undefined || limit !== undefined) ? { data: [], meta: { total: 0, page: page || 1, limit: limit || 10, totalPages: 0 } } : [];
          }
        }
      }
      filter.student_id = targetStudentObjectId;
    }

    const summaries = await this.summaryPointModel.find(filter).lean().exec();

    const allDetails: any[] = [];
    for (const s of summaries) {
      if (s.details && s.details.length > 0) {
        for (const detail of s.details) {
          allDetails.push({
            ...detail,
            summary_id: s._id.toString(),
            student_id: s.student_id ? s.student_id.toString() : null,
            semester_id: s.semester_id ? s.semester_id.toString() : null,
          });
        }
      }
    }

    const isPaginationRequested = page !== undefined || limit !== undefined;
    if (isPaginationRequested) {
      const p = page || 1;
      const l = limit || 10;
      const total = allDetails.length;
      const startIndex = (p - 1) * l;
      const paginatedData = allDetails.slice(startIndex, startIndex + l);

      return {
        data: paginatedData,
        meta: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l)
        }
      };
    } else {
      return allDetails;
    }
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

  async findBySummaryId(summaryId: string, requester?: any, fetchLogs: boolean = true): Promise<EvaluationDetail[]> {
    if (!Types.ObjectId.isValid(summaryId)) {
      throw new NotFoundException(`SummaryPoint with ID ${summaryId} not found`);
    }

    await this.assertCanAccessSummary(summaryId, requester);
    let query = this.summaryPointModel.findById(summaryId);
    if (!fetchLogs) {
      query = query.select({
        'details.log': 0,
      });
    }
    const summary = await query.exec();
    return summary ? summary.details || [] : [];
  }

  async update(
    id: string,
    updateEvaluationDetailDto: UpdateEvaluationDetailDto,
    requester?: any,
  ): Promise<EvaluationDetail> {
    if (updateEvaluationDetailDto.status === 'locked') {
      throw new BadRequestException('Không thể chốt trạng thái chi tiết chấm điểm trực tiếp');
    }
    const rawDto = updateEvaluationDetailDto as any;
    if (
      rawDto.final_score !== undefined ||
      rawDto.locked_at !== undefined ||
      rawDto.locked_by !== undefined
    ) {
      throw new BadRequestException('Không thể chỉnh sửa các trường khóa trực tiếp');
    }

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

    if (summary.status === 'locked') {
      throw new BadRequestException('Không thể chỉnh sửa chi tiết chấm điểm của bảng điểm đã chốt');
    }

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
      const fallbackUserId = lastLog?.updated_by || updateEvaluationDetailDto.gv_reviewed_by;
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

    const setObj: any = {};
    
    if (updateEvaluationDetailDto.current_count !== undefined) {
      setObj['details.$.current_count'] = detail.current_count;
      setObj['details.$.system_score'] = detail.system_score;
    }
    if (updateEvaluationDetailDto.sv_score !== undefined) setObj['details.$.sv_score'] = updateEvaluationDetailDto.sv_score;
    if (updateEvaluationDetailDto.sv_submitted_at !== undefined) setObj['details.$.sv_submitted_at'] = updateEvaluationDetailDto.sv_submitted_at ? new Date(updateEvaluationDetailDto.sv_submitted_at) : null;
    if (updateEvaluationDetailDto.gv_score !== undefined) setObj['details.$.gv_score'] = updateEvaluationDetailDto.gv_score;
    
    // Clear gv_score if student updates sv_score and gv hasn't reviewed
    if (
      this.isStudent(requester) &&
      updateEvaluationDetailDto.sv_score !== undefined &&
      updateEvaluationDetailDto.gv_score === undefined &&
      !detail.gv_reviewed_at &&
      !detail.gv_reviewed_by
    ) {
      setObj['details.$.gv_score'] = null;
    }

    if (updateEvaluationDetailDto.gv_reviewed_at !== undefined) setObj['details.$.gv_reviewed_at'] = updateEvaluationDetailDto.gv_reviewed_at ? new Date(updateEvaluationDetailDto.gv_reviewed_at) : null;
    if (updateEvaluationDetailDto.gv_reviewed_by !== undefined) setObj['details.$.gv_reviewed_by'] = updateEvaluationDetailDto.gv_reviewed_by ? new Types.ObjectId(updateEvaluationDetailDto.gv_reviewed_by) : null;

    if (updateEvaluationDetailDto.status !== undefined) setObj['details.$.status'] = updateEvaluationDetailDto.status;
    if (updateEvaluationDetailDto.description !== undefined) setObj['details.$.description'] = updateEvaluationDetailDto.description;
    if (updateEvaluationDetailDto.log && updateEvaluationDetailDto.log.length > 0) {
      setObj['details.$.log'] = updateEvaluationDetailDto.log;
    }

    const updateQuery: any = {};
    if (Object.keys(setObj).length > 0) {
      updateQuery.$set = setObj;
    }

    const updatedSummary = await this.summaryPointModel.findOneAndUpdate(
      { 'details._id': new Types.ObjectId(id) },
      updateQuery,
      { returnDocument: 'after' },
    ).exec();

    if (!updatedSummary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    // --- Recompute total score ---
    const aggResult = await this.summaryPointModel.aggregate([
      { $match: { _id: updatedSummary._id } },
      { $unwind: '$details' },
      {
        $lookup: {
          from: 'criteria',
          localField: 'details.criterion_id',
          foreignField: '_id',
          as: 'criterion'
        }
      },
      { $unwind: { path: '$criterion', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'categories',
          localField: 'criterion.category_id',
          foreignField: '_id',
          as: 'category'
        }
      },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          categoryId: '$category._id',
          maxScore: { $ifNull: ['$category.max_score', 100] },
          score: {
            $ifNull: [
              '$details.final_score',
              {
                $ifNull: [
                  '$details.gv_score',
                  {
                    $ifNull: [
                      '$details.sv_score',
                      { $ifNull: ['$details.system_score', 0] }
                    ]
                  }
                ]
              }
            ]
          }
        }
      },
      {
        $group: {
          _id: '$categoryId',
          maxScore: { $first: '$maxScore' },
          currentScore: { $sum: '$score' }
        }
      },
      {
        $project: {
          clampedScore: {
            $cond: [
              { $gt: ['$currentScore', '$maxScore'] },
              '$maxScore',
              { $cond: [{ $lt: ['$currentScore', 0] }, 0, '$currentScore'] }
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          totalScore: { $sum: '$clampedScore' }
        }
      }
    ]).exec();

    let totalScore = aggResult.length > 0 ? aggResult[0].totalScore : 0;
    if (totalScore > 100) totalScore = 100;
    if (totalScore < 0) totalScore = 0;

    let grading = 'Chưa xếp loại';
    if (updatedSummary.status === 'locked') {
      if (totalScore >= 90) grading = 'Xuất sắc';
      else if (totalScore >= 80) grading = 'Tốt';
      else if (totalScore >= 70) grading = 'Khá';
      else if (totalScore >= 50) grading = 'Trung bình';
      else grading = 'Yếu';
    }

    await this.summaryPointModel.updateOne(
      { _id: updatedSummary._id },
      { $set: { total_score: totalScore, grading: grading } }
    ).exec();

    const finalSummary = await this.summaryPointModel.findById(updatedSummary._id).exec();
    if (!finalSummary) {
      throw new NotFoundException(`SummaryPoint with ID ${updatedSummary._id} not found after update`);
    }
    const updatedDetail = (finalSummary.details as any).id(id);
    return updatedDetail;
  }

  async remove(id: string, requester?: any): Promise<EvaluationDetail> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    if (this.isStudent(requester)) {
      throw new ForbiddenException('Sinh viên không có quyền xóa lịch sử ghi nhận.');
    }

    if (this.isTeacher(requester)) {
      throw new ForbiddenException('Cố vấn không có quyền xóa lịch sử ghi nhận.');
    }

    const summary = await this.summaryPointModel.findOne({
      'details._id': new Types.ObjectId(id),
    }).exec();

    if (!summary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }
    await this.assertCanAccessSummary(summary._id.toString(), requester);

    if (summary.status === 'locked') {
      throw new BadRequestException('Không thể xóa chi tiết chấm điểm của bảng điểm đã chốt');
    }

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
      detail.final_score = null;
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
