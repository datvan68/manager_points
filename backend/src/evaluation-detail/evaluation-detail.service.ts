import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
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
import { SummariesPointService } from '../summaries-point/summaries-point.service';
import { calculateCriterionScoreHelper } from '../academic-record/academic-record.utils';
import { getGradingRole } from '../auth/utils/grading-access.util';

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
    @Inject(forwardRef(() => SummariesPointService))
    private readonly summariesPointService: SummariesPointService,
  ) {}

  private isTeacher(requester?: any) {
    return getGradingRole(requester) === 'teacher';
  }

  private isStudent(requester?: any) {
    return getGradingRole(requester) === 'student';
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
      .findOne({
        _id: summaryId,
        student_id: { $in: teacherStudentIds },
      } as any)
      .select('_id')
      .lean()
      .exec();

    if (!summary) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác chi tiết điểm ngoài lớp GVCN.',
      );
    }
  }

  private getRoleLevel(roleName?: string, requester?: any): number {
    if (requester) {
      const role = getGradingRole(requester);
      if (role === 'admin') return 4;
      if (role === 'supervisor') return 3;
      if (role === 'teacher') return 2;
      if (role === 'student') return 1;
    }
    if (!roleName) return 1;
    const nameLower = roleName.toLowerCase();
    if (nameLower.includes('admin')) return 4;
    if (
      nameLower.includes('supervisor') ||
      nameLower.includes('quản sinh') ||
      nameLower.includes('quan sinh')
    )
      return 3;
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

    const recordedBy = record.recorded_by;
    const id = recordedBy._id
      ? recordedBy._id.toString()
      : recordedBy.toString();
    const roleName = recordedBy.role
      ? typeof recordedBy.role === 'object'
        ? recordedBy.role.name
        : recordedBy.role
      : '';

    return { id, level: this.getRoleLevel(roleName, recordedBy) };
  }

  private isAdminRole(requester?: any): boolean {
    return getGradingRole(requester) === 'admin';
  }

  private canRequesterDeleteRecord(record: any, requester?: any): boolean {
    if (!requester?.userId) return false;
    if (record.daily_report_id) return false;
    if (this.isAdminRole(requester)) return true;

    const creator = this.getRecordCreator(record);
    if (!creator) return true;

    // Luôn cho phép nếu chính người tạo thao tác
    if (requester.userId.toString() === creator.id.toString()) return true;

    const requesterLevel = this.getRoleLevel(requester.roleName, requester);
    // Cho phép nếu role level của requester lớn hơn role level của người tạo
    if (requesterLevel > creator.level) return true;

    return false;
  }

  /**
   * Helper function to sync direct grading academic records based on currentCount
   */
  private async syncAcademicRecords(
    summary: SummaryPointDocument,
    criterion: CriterionDocument,
    currentCount: number,
    requester?: any,
  ): Promise<{
    actualCount: number;
    originalCount: number;
    dailyReportCount: number;
    permissionLockedCount: number;
  }> {
    // Find all active academic records for this student, semester, and criterion
    const records = await this.academicRecordModel
      .find({
        student_id: summary.student_id as any,
        semester_id: summary.semester_id as any,
        criterion_id: criterion._id as any,
        status: 'active',
        is_deleted: { $ne: true },
      } as any)
      .exec();

    const diff = currentCount - records.length;
    let actualCount = records.length;

    const dailyReportCount = records.filter(
      (rec) => rec.daily_report_id,
    ).length;
    const originalCount = records.filter(
      (rec) => !this.canRequesterDeleteRecord(rec, requester),
    ).length;
    const permissionLockedCount = originalCount - dailyReportCount;

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
            recorded_by: updatedByUserId
              ? new Types.ObjectId(updatedByUserId)
              : undefined,
          }).save(),
        );
      }
      await Promise.all(promises);
      actualCount += diff;
    } else if (diff < 0) {
      // Delete excess direct grading records created by the current user
      const excessCount = Math.abs(diff);
      const requesterLevel = this.getRoleLevel(requester?.roleName, requester);
      const deletableRecords = records
        .filter((rec) => this.canRequesterDeleteRecord(rec, requester))
        .sort((a, b) => {
          const aCreator = this.getRecordCreator(a);
          const bCreator = this.getRecordCreator(b);
          const aLevel = aCreator?.level || requesterLevel;
          const bLevel = bCreator?.level || requesterLevel;
          if (aLevel !== bLevel) return aLevel - bLevel;
          return (
            new Date((b as any).createdAt || 0).getTime() -
            new Date((a as any).createdAt || 0).getTime()
          );
        });
      const recordsToDelete = deletableRecords.slice(0, excessCount);
      const promises = recordsToDelete.map((rec) =>
        this.academicRecordModel.findByIdAndDelete(rec._id).exec(),
      );
      await Promise.all(promises);
      actualCount -= recordsToDelete.length;
    }

    return {
      actualCount,
      originalCount,
      dailyReportCount,
      permissionLockedCount,
    };
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

    const count = await this.academicRecordModel
      .countDocuments({
        student_id: summary.student_id as any,
        semester_id: summary.semester_id as any,
        criterion_id: new Types.ObjectId(criterionId) as any,
        status: 'active',
        is_deleted: { $ne: true },
      } as any)
      .exec();

    return count;
  }

  /**
   * Đếm hàng loạt số academic_record đã có sẵn cho tất cả criteria của 1 summary.
   */
  async getPreExistingCountsForSummary(
    summaryId: string,
    requester?: any,
  ): Promise<
    Record<
      string,
      {
        original_count: number;
        non_deletable_count: number;
        deletable_count: number;
        current_count: number;
      }
    >
  > {
    const summary = await this.summaryPointModel.findById(summaryId).exec();
    if (!summary) return {};

    const records = await this.academicRecordModel
      .find({
        student_id: summary.student_id as any,
        semester_id: summary.semester_id as any,
        status: 'active',
        is_deleted: { $ne: true },
      } as any)
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();

    const countsMap: Record<
      string,
      {
        original_count: number;
        non_deletable_count: number;
        deletable_count: number;
        current_count: number;
      }
    > = {};
    records.forEach((rec) => {
      const criId = rec.criterion_id?.toString();
      if (criId) {
        if (!countsMap[criId]) {
          countsMap[criId] = {
            original_count: 0,
            non_deletable_count: 0,
            deletable_count: 0,
            current_count: 0,
          };
        }
        countsMap[criId].current_count += 1;
        if (!this.canRequesterDeleteRecord(rec, requester)) {
          countsMap[criId].original_count += 1;
          countsMap[criId].non_deletable_count += 1;
        } else {
          countsMap[criId].deletable_count += 1;
        }
      }
    });

    return countsMap;
  }

  async getPreExistingCountsBulk(
    summaryIds: string[],
    requester?: any,
  ): Promise<
    Record<
      string,
      Record<
        string,
        {
          original_count: number;
          non_deletable_count: number;
          deletable_count: number;
          current_count: number;
        }
      >
    >
  > {
    if (!summaryIds || summaryIds.length === 0) return {};

    // 1. Tìm tất cả summaries được yêu cầu
    const summaries = await this.summaryPointModel
      .find({
        _id: { $in: summaryIds.map((id) => new Types.ObjectId(id)) },
      } as any)
      .lean()
      .exec();

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
    const groupedRecords = await this.academicRecordModel
      .aggregate([
        {
          $match: {
            student_id: { $in: studentIds },
            semester_id: { $in: semesterIds },
            status: 'active',
            is_deleted: { $ne: true },
          },
        },
        {
          $lookup: {
            from: 'users',
            localField: 'recorded_by',
            foreignField: '_id',
            as: 'recorded_by_user',
          },
        },
        {
          $unwind: {
            path: '$recorded_by_user',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: 'roles',
            localField: 'recorded_by_user.role',
            foreignField: '_id',
            as: 'recorded_by_role',
          },
        },
        {
          $unwind: {
            path: '$recorded_by_role',
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $group: {
            _id: {
              student_id: '$student_id',
              semester_id: '$semester_id',
              criterion_id: '$criterion_id',
            },
            current_count: { $sum: 1 },
            records: {
              $push: {
                daily_report_id: '$daily_report_id',
                recorded_by: {
                  $cond: {
                    if: { $ifNull: ['$recorded_by_user._id', false] },
                    then: {
                      _id: '$recorded_by_user._id',
                      role: { name: '$recorded_by_role.name' },
                    },
                    else: null,
                  },
                },
              },
            },
          },
        },
      ])
      .exec();

    const result: Record<
      string,
      Record<
        string,
        {
          original_count: number;
          non_deletable_count: number;
          deletable_count: number;
          current_count: number;
        }
      >
    > = {};

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

      let non_deletable_count = 0;
      let deletable_count = 0;
      for (const rec of group.records) {
        if (!this.canRequesterDeleteRecord(rec, requester)) {
          non_deletable_count++;
        } else {
          deletable_count++;
        }
      }

      result[summaryId][criterionIdStr] = {
        current_count: group.current_count,
        original_count: non_deletable_count,
        non_deletable_count,
        deletable_count,
      };
    }

    return result;
  }

  async create(
    createEvaluationDetailDto: CreateEvaluationDetailDto,
    requester?: any,
  ): Promise<EvaluationDetail> {
    const { summary_id, criterion_id, current_count, ...rest } =
      createEvaluationDetailDto;
    await this.assertCanAccessSummary(summary_id, requester);

    const summary = await this.summaryPointModel.findById(summary_id).exec();
    if (!summary) {
      throw new NotFoundException(
        `SummaryPoint with ID ${summary_id} not found`,
      );
    }

    if (summary.status === 'locked') {
      throw new BadRequestException(
        'Không thể thêm chi tiết chấm điểm cho bảng điểm đã chốt',
      );
    }

    const criterion = await this.criterionModel.findById(criterion_id).exec();
    if (!criterion) {
      throw new NotFoundException(
        `Criterion with ID ${criterion_id} not found`,
      );
    }

    // Check if detail already exists
    const existingIndex = summary.details.findIndex(
      (d) => d.criterion_id && d.criterion_id.toString() === criterion_id,
    );
    if (existingIndex !== -1) {
      throw new ConflictException(
        `EvaluationDetail for Criterion ${criterion_id} already exists on this SummaryPoint`,
      );
    }

    const rawRest = rest as any;
    if (
      criterion.scoring_mode === 'single_option' &&
      rawRest.selected_option_id
    ) {
      const option = criterion.options?.find(
        (o: any) => o.id === rawRest.selected_option_id,
      );
      if (!option) {
        throw new BadRequestException('Option không hợp lệ');
      }
    }

    const scoringResult = calculateCriterionScoreHelper({
      criterion,
      count: current_count ?? 0,
      selectedOptionId: rawRest.selected_option_id,
      selectedOptionLabel: rawRest.selected_option_label,
      selectedOptionScore: rawRest.selected_option_score,
      isSyncPath: false,
    });

    const countVal = scoringResult.currentCount;
    const systemScore = scoringResult.systemScore;
    const optId = scoringResult.selectedOptionId;
    const optLabel = scoringResult.selectedOptionLabel;
    const optScore = scoringResult.selectedOptionScore;

    // We no longer sync records from evaluation_detail as academic_record is the source of truth

    const newDetail: any = {
      _id: new Types.ObjectId(),
      criterion_id: new Types.ObjectId(criterion_id),
      current_count: countVal,
      system_score: systemScore,
      selected_option_id: optId || null,
      selected_option_label: optLabel,
      selected_option_score: optScore,
      sv_score: rest.sv_score !== undefined ? rest.sv_score : null,
      sv_submitted_at: rest.sv_submitted_at || null,
      gv_score: rest.gv_score !== undefined ? rest.gv_score : null,
      gv_reviewed_at: rest.gv_reviewed_at || null,
      gv_reviewed_by: rest.gv_reviewed_by
        ? new Types.ObjectId(rest.gv_reviewed_by)
        : null,
      final_score: null,
      locked_at: null,
      locked_by: null,
      status: rest.status === 'locked' ? 'draft' : rest.status || 'draft',
      description: rest.description || '',
      log: rest.log || [],
    };

    await this.summaryPointModel
      .findByIdAndUpdate(
        summary_id,
        { $push: { details: newDetail } },
        { returnDocument: 'after' },
      )
      .exec();

    await this.summariesPointService.recomputeTotalScore(summary_id);

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

    if (
      query &&
      ('roleName' in query ||
        'userId' in query ||
        'role' in query ||
        'username' in query)
    ) {
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
      const classStudents = await this.studentModel
        .find({ class_id: new Types.ObjectId(classId) })
        .select('_id')
        .exec();
      const studentIds = classStudents.map((s) => s._id);
      if (filter.student_id) {
        if (filter.student_id.$in) {
          filter.student_id.$in = filter.student_id.$in.filter((id: any) =>
            studentIds.some((sId) => sId.toString() === id.toString()),
          );
        } else {
          if (
            !studentIds.some(
              (sId) => sId.toString() === filter.student_id.toString(),
            )
          ) {
            return page !== undefined || limit !== undefined
              ? {
                  data: [],
                  meta: {
                    total: 0,
                    page: page || 1,
                    limit: limit || 10,
                    totalPages: 0,
                  },
                }
              : [];
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
          const hasAccess = filter.student_id.$in.some(
            (id: any) => id.toString() === studentId,
          );
          if (!hasAccess) {
            return page !== undefined || limit !== undefined
              ? {
                  data: [],
                  meta: {
                    total: 0,
                    page: page || 1,
                    limit: limit || 10,
                    totalPages: 0,
                  },
                }
              : [];
          }
        } else {
          if (filter.student_id.toString() !== studentId) {
            return page !== undefined || limit !== undefined
              ? {
                  data: [],
                  meta: {
                    total: 0,
                    page: page || 1,
                    limit: limit || 10,
                    totalPages: 0,
                  },
                }
              : [];
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
          totalPages: Math.ceil(total / l),
        },
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
    const summary = await this.summaryPointModel
      .findOne({
        ...scopeFilter,
        'details._id': new Types.ObjectId(id),
      })
      .exec();

    if (!summary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const detail = (summary.details as any).id(id);
    return detail;
  }

  async findBySummaryId(
    summaryId: string,
    requester?: any,
    fetchLogs: boolean = true,
  ): Promise<EvaluationDetail[]> {
    if (!Types.ObjectId.isValid(summaryId)) {
      throw new NotFoundException(
        `SummaryPoint with ID ${summaryId} not found`,
      );
    }

    await this.assertCanAccessSummary(summaryId, requester);

    // Tự động đồng bộ hóa với academic records trước khi load chi tiết
    await this.summariesPointService.syncSummaryWithAcademicRecords(summaryId);

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
      throw new BadRequestException(
        'Không thể chốt trạng thái chi tiết chấm điểm trực tiếp',
      );
    }
    const rawDto = updateEvaluationDetailDto as any;
    if (
      rawDto.final_score !== undefined ||
      rawDto.locked_at !== undefined ||
      rawDto.locked_by !== undefined
    ) {
      throw new BadRequestException(
        'Không thể chỉnh sửa các trường khóa trực tiếp',
      );
    }

    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    const summary = await this.summaryPointModel
      .findOne({
        'details._id': new Types.ObjectId(id),
      })
      .exec();

    if (!summary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }
    await this.assertCanAccessSummary(summary._id.toString(), requester);

    if (summary.status === 'locked') {
      throw new BadRequestException(
        'Không thể chỉnh sửa chi tiết chấm điểm của bảng điểm đã chốt',
      );
    }

    const detailIndex = summary.details.findIndex(
      (d: any) => d._id.toString() === id,
    );
    const detail = summary.details[detailIndex];

    const criterion = await this.criterionModel
      .findById(detail.criterion_id)
      .exec();
    if (!criterion) {
      throw new NotFoundException(
        `Criterion with ID ${detail.criterion_id} not found`,
      );
    }

    const setObj: any = {};

    if (
      rawDto.current_count !== undefined ||
      rawDto.selected_option_id !== undefined ||
      (rawDto.log && rawDto.log.length > 0)
    ) {
      throw new BadRequestException(
        'Tiêu chí này phải được cập nhật điểm thông qua hồ sơ minh chứng (academic_record) hoặc cơ chế intent.',
      );
    }
    if (updateEvaluationDetailDto.sv_score !== undefined)
      setObj['details.$.sv_score'] = updateEvaluationDetailDto.sv_score;
    if (updateEvaluationDetailDto.sv_submitted_at !== undefined)
      setObj['details.$.sv_submitted_at'] =
        updateEvaluationDetailDto.sv_submitted_at
          ? new Date(updateEvaluationDetailDto.sv_submitted_at)
          : null;
    if (updateEvaluationDetailDto.gv_score !== undefined)
      setObj['details.$.gv_score'] = updateEvaluationDetailDto.gv_score;

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

    if (updateEvaluationDetailDto.gv_reviewed_at !== undefined)
      setObj['details.$.gv_reviewed_at'] =
        updateEvaluationDetailDto.gv_reviewed_at
          ? new Date(updateEvaluationDetailDto.gv_reviewed_at)
          : null;
    if (updateEvaluationDetailDto.gv_reviewed_by !== undefined)
      setObj['details.$.gv_reviewed_by'] =
        updateEvaluationDetailDto.gv_reviewed_by
          ? new Types.ObjectId(updateEvaluationDetailDto.gv_reviewed_by)
          : null;

    if (updateEvaluationDetailDto.status !== undefined)
      setObj['details.$.status'] = updateEvaluationDetailDto.status;
    if (updateEvaluationDetailDto.description !== undefined)
      setObj['details.$.description'] = updateEvaluationDetailDto.description;

    const updateQuery: any = {};
    if (Object.keys(setObj).length > 0) {
      updateQuery.$set = setObj;
    }

    const updatedSummary = await this.summaryPointModel
      .findOneAndUpdate(
        { 'details._id': new Types.ObjectId(id) },
        updateQuery,
        { returnDocument: 'after' },
      )
      .exec();

    if (!updatedSummary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    // --- Recompute total score ---
    await this.summariesPointService.recomputeTotalScore(
      updatedSummary._id.toString(),
    );

    const finalSummary = await this.summaryPointModel
      .findById(updatedSummary._id)
      .exec();
    if (!finalSummary) {
      throw new NotFoundException(
        `SummaryPoint with ID ${updatedSummary._id} not found after update`,
      );
    }
    const updatedDetail = (finalSummary.details as any).id(id);
    return updatedDetail;
  }

  async bulkUpsert(
    bulkUpsertDto: import('./dto/bulk-upsert-evaluation-detail.dto').BulkUpsertEvaluationDetailDto,
    requester?: any,
  ): Promise<any> {
    const { summary_id, details, reason } = bulkUpsertDto;
    await this.assertCanAccessSummary(summary_id, requester);

    const summary = await this.summaryPointModel.findById(summary_id).exec();
    if (!summary) {
      throw new NotFoundException(
        `SummaryPoint with ID ${summary_id} not found`,
      );
    }

    if (summary.status === 'locked') {
      throw new BadRequestException(
        'Không thể thêm/chỉnh sửa chi tiết chấm điểm cho bảng điểm đã chốt',
      );
    }

    const clampResults: any[] = [];

    for (const detailDto of details) {
      const { criterion_id, current_count, selected_option_id } = detailDto;
      const criterion = await this.criterionModel.findById(criterion_id).exec();
      if (!criterion) continue;

      const existingIndex = summary.details.findIndex(
        (d) => d.criterion_id && d.criterion_id.toString() === criterion_id,
      );

      const detail =
        existingIndex !== -1 ? summary.details[existingIndex] : null;

      if (detail) {
        const isReviewed =
          detail.status === 'gv_reviewed' ||
          !!detail.gv_reviewed_by ||
          !!detail.gv_reviewed_at;
        const isLocked =
          detail.status === 'locked' ||
          !!detail.locked_at ||
          !!detail.locked_by;
        const isApproved =
          detail.final_score !== null && detail.final_score !== undefined;
        const isManuallyReviewed = isReviewed || isLocked || isApproved;

        if (isManuallyReviewed) {
          clampResults.push({
            criterion_id,
            status: 'skipped',
            reason: 'Detail is already locked, reviewed, or approved.',
          });
          continue;
        }
      }

      // Đếm active academic records cho student/semester của summary này và criterion này
      const activeCount = await this.academicRecordModel
        .countDocuments({
          student_id: summary.student_id,
          semester_id: summary.semester_id,
          criterion_id: new Types.ObjectId(criterion_id),
          status: 'active',
          is_deleted: { $ne: true },
        } as any)
        .exec();

      // Tính system_score từ records
      let optId: string | null = null;
      let optLabel: string | null = null;
      let optScore: number | null = null;
      let manualScore: number | null = null;
      if (activeCount > 0) {
        const latestRecord = await this.academicRecordModel
          .findOne({
            student_id: summary.student_id,
            semester_id: summary.semester_id,
            criterion_id: new Types.ObjectId(criterion_id),
            status: 'active',
            is_deleted: { $ne: true },
          } as any)
          .sort({ createdAt: -1 })
          .exec();

        if (latestRecord) {
          if (criterion.scoring_mode === 'single_option') {
            if (latestRecord.selected_option_id) {
              optId = latestRecord.selected_option_id;
              optLabel = latestRecord.selected_option_label || null;
              optScore =
                latestRecord.selected_option_score !== undefined
                  ? latestRecord.selected_option_score
                  : null;
            } else if (
              latestRecord.record_title &&
              latestRecord.record_title.startsWith('Lựa chọn option ')
            ) {
              optId = latestRecord.record_title.replace('Lựa chọn option ', '');
            }
          } else {
            if (
              latestRecord.record_title &&
              latestRecord.record_title.startsWith('Nhập điểm tay: ')
            ) {
              const manualScoreStr = latestRecord.record_title.replace(
                'Nhập điểm tay: ',
                '',
              );
              manualScore = parseFloat(manualScoreStr) || 0;
            }
          }
        }
      }

      const scoringResult = calculateCriterionScoreHelper({
        criterion,
        count: activeCount,
        selectedOptionId: optId,
        selectedOptionLabel: optLabel,
        selectedOptionScore: optScore,
        manualScore,
        isSyncPath: true,
      });
      const realSystemScore = scoringResult.systemScore;

      // Bảo vệ chống ghi đè stale zero/null values từ frontend khi có active academic records
      if (activeCount > 0) {
        detailDto.current_count = scoringResult.currentCount;
        detailDto.selected_option_id =
          scoringResult.selectedOptionId ?? undefined;

        const isRewardOrViolation =
          criterion.score_per_unit > 0 ||
          criterion.criterion_type === 'reward' ||
          criterion.criterion_type === 'bonus' ||
          criterion.score_per_unit < 0 ||
          criterion.criterion_type === 'violation';
        if (realSystemScore > 0 && isRewardOrViolation) {
          if (
            detailDto.sv_score === undefined ||
            detailDto.sv_score === 0 ||
            detailDto.sv_score === null
          ) {
            detailDto.sv_score = realSystemScore;
          }
          if (
            detailDto.gv_score === undefined ||
            detailDto.gv_score === 0 ||
            detailDto.gv_score === null
          ) {
            detailDto.gv_score = realSystemScore;
          }
        }
      }

      const setObj: any = {
        criterion_id: new Types.ObjectId(criterion_id),
      };

      // Đồng bộ thông tin đếm và điểm số thật vào setObj
      if (activeCount > 0) {
        setObj.current_count = scoringResult.currentCount;
        setObj.system_score = realSystemScore;
        setObj.selected_option_id = scoringResult.selectedOptionId;
        setObj.selected_option_label = scoringResult.selectedOptionLabel;
        setObj.selected_option_score = scoringResult.selectedOptionScore;
      } else {
        // Đảm bảo option chỉ được xóa khi có intent rõ ràng, không được tự động xóa do payload gửi thiếu
        if (detailDto.selected_option_id !== undefined) {
          setObj.selected_option_id = detailDto.selected_option_id;
          if (detailDto.selected_option_id === null) {
            setObj.selected_option_label = null;
            setObj.selected_option_score = 0;
          } else {
            const option = criterion.options?.find(
              (o: any) => o.id === detailDto.selected_option_id,
            );
            if (option) {
              setObj.selected_option_label = option.label;
              setObj.selected_option_score = option.score;
            }
          }
        } else if (detail) {
          setObj.selected_option_id = detail.selected_option_id;
          setObj.selected_option_label = detail.selected_option_label;
          setObj.selected_option_score = detail.selected_option_score;
        }

        if (detailDto.current_count !== undefined) {
          setObj.current_count = detailDto.current_count;
        } else if (detail) {
          setObj.current_count = detail.current_count;
        } else {
          setObj.current_count = 0;
        }

        if ((detailDto as any).system_score !== undefined) {
          setObj.system_score = (detailDto as any).system_score;
        } else if (detail) {
          setObj.system_score = detail.system_score;
        } else {
          setObj.system_score = 0;
        }
      }

      if (detailDto.sv_score !== undefined)
        setObj.sv_score = detailDto.sv_score;
      if (detailDto.sv_submitted_at !== undefined)
        setObj.sv_submitted_at = detailDto.sv_submitted_at
          ? new Date(detailDto.sv_submitted_at)
          : null;
      if (detailDto.gv_score !== undefined)
        setObj.gv_score = detailDto.gv_score;

      const isGVScoreCleared =
        this.isStudent(requester) &&
        detailDto.sv_score !== undefined &&
        detailDto.gv_score === undefined;

      if (detailDto.gv_reviewed_at !== undefined)
        setObj.gv_reviewed_at = detailDto.gv_reviewed_at
          ? new Date(detailDto.gv_reviewed_at)
          : null;
      if (detailDto.gv_reviewed_by !== undefined)
        setObj.gv_reviewed_by = detailDto.gv_reviewed_by
          ? new Types.ObjectId(detailDto.gv_reviewed_by)
          : null;
      if (detailDto.status !== undefined) setObj.status = detailDto.status;
      if (detailDto.log && detailDto.log.length > 0) setObj.log = detailDto.log;

      if (existingIndex !== -1) {
        if (
          detail &&
          isGVScoreCleared &&
          !detail.gv_reviewed_at &&
          !detail.gv_reviewed_by
        ) {
          setObj.gv_score = null;
        }

        const updateQuery: any = {};
        for (const key of Object.keys(setObj)) {
          updateQuery[`details.$.${key}`] = setObj[key];
        }
        await this.summaryPointModel
          .findOneAndUpdate(
            { 'details._id': (detail as any)._id },
            { $set: updateQuery },
          )
          .exec();
      } else {
        const newDetail: any = {
          _id: new Types.ObjectId(),
          ...setObj,
          current_count:
            activeCount > 0
              ? scoringResult.currentCount
              : (setObj.current_count ?? 0),
          system_score:
            activeCount > 0 ? realSystemScore : (setObj.system_score ?? 0),
          sv_score:
            setObj.sv_score !== undefined
              ? setObj.sv_score
              : activeCount > 0
                ? realSystemScore
                : null,
          sv_submitted_at: setObj.sv_submitted_at || null,
          gv_score:
            setObj.gv_score !== undefined
              ? setObj.gv_score
              : activeCount > 0
                ? realSystemScore
                : null,
          gv_reviewed_at: setObj.gv_reviewed_at || null,
          gv_reviewed_by: setObj.gv_reviewed_by || null,
          final_score: null,
          locked_at: null,
          locked_by: null,
          status: setObj.status || 'draft',
          description: '',
          log: setObj.log || [],
        };
        await this.summaryPointModel
          .findByIdAndUpdate(summary_id, { $push: { details: newDetail } })
          .exec();
      }
    }

    await this.summariesPointService.recomputeTotalScore(summary_id);
    return { success: true, clampResults };
  }

  async remove(id: string, requester?: any): Promise<EvaluationDetail> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }

    if (this.isStudent(requester)) {
      throw new ForbiddenException(
        'Sinh viên không có quyền xóa lịch sử ghi nhận.',
      );
    }

    if (this.isTeacher(requester)) {
      throw new ForbiddenException(
        'Cố vấn không có quyền xóa lịch sử ghi nhận.',
      );
    }

    const summary = await this.summaryPointModel
      .findOne({
        'details._id': new Types.ObjectId(id),
      })
      .exec();

    if (!summary) {
      throw new NotFoundException(`EvaluationDetail with ID ${id} not found`);
    }
    await this.assertCanAccessSummary(summary._id.toString(), requester);

    if (summary.status === 'locked') {
      throw new BadRequestException(
        'Không thể xóa chi tiết chấm điểm của bảng điểm đã chốt',
      );
    }

    throw new BadRequestException(
      'Vui lòng sử dụng cơ chế intent (clear_score) hoặc xóa hồ sơ minh chứng để xóa điểm.',
    );
  }
}
