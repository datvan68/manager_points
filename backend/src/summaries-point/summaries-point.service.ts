import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SummaryPoint,
  SummaryPointDocument,
} from './schemas/summary-point.schema';
import {
  normalizeObjectId,
  calculateCriterionScoreHelper,
} from '../academic-record/academic-record.utils';
import { CreateSummaryPointDto } from './dto/create-summary-point.dto';
import { UpdateSummaryPointDto } from './dto/update-summary-point.dto';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Class, ClassDocument } from '../classes/schemas/class.schema';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import {
  Criterion,
  CriterionDocument,
} from '../criteria/schemas/criterion.schema';
import {
  Department,
  DepartmentDocument,
} from '../departments/schemas/department.schema';
import {
  Semester,
  SemesterDocument,
} from '../semesters/schemas/semester.schema';
import { ExportSummaryExcelDto } from './dto/export-summary-excel.dto';
import { generatePl03Excel } from './export/pl03-summary-excel.service';
import { gradingEventEmitter } from '../system/grading-event-emitter';
import { AcademicRecordService } from '../academic-record/academic-record.service';
import {
  AcademicRecord,
  AcademicRecordDocument,
} from '../academic-record/schemas/academic-record.schema';
import {
  getGradingRole,
  evaluateGradingAccess,
  assertCanAccessClass,
  assertCanAccessStudent,
} from '../auth/utils/grading-access.util';

/**
 * Tính toán hạng (rank tier) và nhãn hạng (rank label) dựa trên tổng điểm và trạng thái của bảng điểm.
 * Chỉ thực hiện xếp hạng khi trạng thái bảng điểm là 'locked' (đã chốt).
 *
 * @param totalScore - Tổng điểm rèn luyện của sinh viên (từ 0 đến 100).
 * @param status - Trạng thái của bảng điểm (vd: 'draft', 'locked').
 * @returns Object chứa `rank_tier` (diamond, gold, silver, bronze, unranked) và `rank_label`.
 */
export function resolveRankTier(
  totalScore: number | null,
  status: string,
): { rank_tier: string; rank_label: string } {
  if (status !== 'locked' || totalScore === null || totalScore === undefined) {
    return { rank_tier: 'unranked', rank_label: 'Chưa chốt' };
  }
  if (totalScore >= 90) return { rank_tier: 'diamond', rank_label: 'Xuất sắc' };
  if (totalScore >= 80) return { rank_tier: 'gold', rank_label: 'Tốt' };
  if (totalScore >= 70) return { rank_tier: 'silver', rank_label: 'Khá' };
  if (totalScore >= 50)
    return { rank_tier: 'bronze', rank_label: 'Trung Bình' };
  return { rank_tier: 'unranked', rank_label: 'Yếu' };
}

export interface LatestStudentSummaryDto {
  _id: any;
  status: string;
  total_score: number | null;
  grading: string | null;
  rank_tier?: string | null;
  rank_label?: string | null;
  semester: string;
  period?: any;
  locked_at: Date | string;
  studentName: string;
  className: string;
  student: {
    full_name: string;
    student_code: string;
    class_id: {
      _id: any;
      class_name: string;
    } | null;
  };
}

@Injectable()
export class SummariesPointService {
  constructor(
    @InjectModel(SummaryPoint.name)
    private readonly summaryPointModel: Model<SummaryPointDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @InjectModel(Class.name)
    private readonly classModel: Model<ClassDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Criterion.name)
    private readonly criterionModel: Model<CriterionDocument>,
    @InjectModel(Department.name)
    private readonly departmentModel: Model<DepartmentDocument>,
    @InjectModel(Semester.name)
    private readonly semesterModel: Model<SemesterDocument>,
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<AcademicRecordDocument>,
    @Inject(forwardRef(() => AcademicRecordService))
    private readonly academicRecordService: AcademicRecordService,
  ) {}

  private isTeacher(requester?: any) {
    return getGradingRole(requester) === 'teacher';
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

  private async assertCanAccessStudent(studentId: string, requester?: any) {
    const teacherClassIds = await this.getTeacherClassIds(requester);
    if (!teacherClassIds) return;

    const student = await this.studentModel
      .findOne({ _id: studentId, class_id: { $in: teacherClassIds } } as any)
      .select('_id')
      .lean()
      .exec();

    if (!student) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác bảng điểm của sinh viên ngoài lớp GVCN.',
      );
    }
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
        'Bạn không có quyền thao tác bảng điểm ngoài lớp GVCN.',
      );
    }
  }

  private buildSummaryIdentity(
    studentId: string | Types.ObjectId,
    semesterId: string | Types.ObjectId,
    periodId?: string | Types.ObjectId | null,
  ) {
    if (!studentId || !Types.ObjectId.isValid(studentId)) {
      throw new BadRequestException('Mã sinh viên không hợp lệ');
    }
    if (!semesterId || !Types.ObjectId.isValid(semesterId)) {
      throw new BadRequestException('Mã học kỳ không hợp lệ');
    }
    if (periodId === '') {
      throw new BadRequestException('Mã kỳ đánh giá không hợp lệ');
    }
    if (periodId && !Types.ObjectId.isValid(periodId)) {
      throw new BadRequestException('Mã kỳ đánh giá không hợp lệ');
    }

    return {
      student_id: new Types.ObjectId(studentId),
      semester_id: new Types.ObjectId(semesterId),
      period_id:
        periodId && Types.ObjectId.isValid(periodId)
          ? new Types.ObjectId(periodId)
          : null,
    };
  }

  async create(
    createSummaryPointDto: CreateSummaryPointDto,
    requester?: any,
  ): Promise<SummaryPoint> {
    await this.assertCanAccessStudent(
      createSummaryPointDto.student_id,
      requester,
    );

    const student = await this.studentModel
      .findById(createSummaryPointDto.student_id)
      .exec();
    if (!student) {
      throw new NotFoundException(
        `Student with ID ${createSummaryPointDto.student_id} not found`,
      );
    }
    if (student.status !== 'Studying') {
      throw new BadRequestException(
        'Chỉ sinh viên đang học mới được tạo bảng điểm rèn luyện.',
      );
    }

    const identity = this.buildSummaryIdentity(
      createSummaryPointDto.student_id,
      createSummaryPointDto.semester_id,
      createSummaryPointDto.period_id,
    );

    const existing = await this.summaryPointModel
      .findOne(identity as any)
      .populate('student_id')
      .populate('semester_id')
      .populate('period_id')
      .populate('details.criterion_id')
      .exec();

    if (existing) {
      return existing;
    }

    try {
      const payload = {
        ...createSummaryPointDto,
        student_id: identity.student_id,
        semester_id: identity.semester_id,
        period_id: identity.period_id,
      };
      const created = new this.summaryPointModel(payload);
      const saved = await created.save();
      const result = await this.summaryPointModel
        .findById(saved._id)
        .populate('student_id')
        .populate('semester_id')
        .populate('period_id')
        .populate('details.criterion_id')
        .exec();
      if (!result)
        throw new NotFoundException('SummaryPoint not found after save');

      gradingEventEmitter.emit('grading_event', {
        type: 'summary_created',
        classId: student?.class_id?.toString(),
        semesterId: identity.semester_id?.toString(),
        studentId: identity.student_id?.toString(),
        summaryId: result._id.toString(),
        data: result,
      });

      return result;
    } catch (error: any) {
      if (error.code === 11000) {
        const raceExisting = await this.summaryPointModel
          .findOne(identity as any)
          .populate('student_id')
          .populate('semester_id')
          .populate('period_id')
          .populate('details.criterion_id')
          .exec();
        if (raceExisting) {
          return raceExisting;
        }
        throw new ConflictException(
          'Bảng điểm cho học kỳ/kỳ đánh giá này đã tồn tại.',
        );
      }
      throw error;
    }
  }

  async initializeClass(
    classId: string,
    semesterId: string,
    requester?: any,
  ): Promise<{ success: boolean; createdCount: number }> {
    if (!classId || !Types.ObjectId.isValid(classId)) {
      throw new BadRequestException('Mã lớp học không hợp lệ.');
    }
    if (!semesterId || !Types.ObjectId.isValid(semesterId)) {
      throw new BadRequestException('Mã học kỳ không hợp lệ.');
    }

    const classObj = await this.classModel.findById(classId).exec();
    if (!classObj) {
      throw new NotFoundException(`Lớp học với ID ${classId} không tồn tại.`);
    }

    const role = getGradingRole(requester);
    const isAdminOrSupervisor = role === 'admin' || role === 'supervisor';

    if (
      !isAdminOrSupervisor &&
      classObj.advisor_id?.toString() !== requester?.userId
    ) {
      throw new ForbiddenException(
        'Bạn không có quyền thao tác trên lớp học này.',
      );
    }

    const students = await this.studentModel
      .find({
        class_id: new Types.ObjectId(classId),
        status: 'Studying',
      })
      .exec();

    if (students.length === 0) {
      return { success: true, createdCount: 0 };
    }

    const studentIds = students.map((s) => s._id);
    const existingSummaries = await this.summaryPointModel
      .find({
        student_id: { $in: studentIds },
        semester_id: new Types.ObjectId(semesterId),
        period_id: null,
      } as any)
      .select('student_id')
      .exec();

    const existingStudentIds = new Set(
      existingSummaries.map((s) => s.student_id.toString()),
    );

    const studentsToInit = students.filter(
      (s) => !existingStudentIds.has(s._id.toString()),
    );

    if (studentsToInit.length === 0) {
      return { success: true, createdCount: 0 };
    }

    const insertPayloads = studentsToInit.map((s) => ({
      student_id: s._id,
      semester_id: new Types.ObjectId(semesterId),
      period_id: null,
      total_score: 0,
      grading: 'CHUA XEP LOAI',
      status: 'draft',
    }));

    await this.summaryPointModel.insertMany(insertPayloads);

    gradingEventEmitter.emit('grading_event', {
      type: 'summary_created',
      classId: classId,
      semesterId: semesterId,
    });

    return {
      success: true,
      createdCount: studentsToInit.length,
    };
  }

  async findAll(
    requester?: any,
    query?: {
      page?: number;
      limit?: number;
      semesterId?: string;
      classId?: string;
      studentId?: string;
      studentIds?: string | string[];
      status?: string;
      fields?: string;
    },
  ): Promise<any> {
    const teacherStudentIds = await this.getTeacherStudentIds(requester);
    const isStudentRequester = getGradingRole(requester) === 'student';
    const filter: any = teacherStudentIds
      ? { student_id: { $in: teacherStudentIds } }
      : {};
    if (isStudentRequester) {
      const ownStudent = await this.studentModel
        .findOne({ user_id: requester?.userId })
        .select('_id')
        .lean()
        .exec();
      filter.student_id = ownStudent?._id || new Types.ObjectId();
    }

    if (query?.semesterId) {
      if (Types.ObjectId.isValid(query.semesterId)) {
        filter.semester_id = query.semesterId;
      } else {
        filter.semester_id = new Types.ObjectId();
      }
    }
    if (query?.studentId && !isStudentRequester) {
      if (Types.ObjectId.isValid(query.studentId)) {
        filter.student_id = query.studentId;
      } else {
        const student = await this.studentModel
          .findOne({ student_code: query.studentId })
          .select('_id')
          .lean()
          .exec();
        if (student) {
          filter.student_id = student._id;
        } else {
          filter.student_id = new Types.ObjectId();
        }
      }
    }

    let studentIdsList: string[] = [];
    if (query?.studentIds) {
      if (Array.isArray(query.studentIds)) {
        studentIdsList = query.studentIds;
      } else if (typeof query.studentIds === 'string') {
        studentIdsList = query.studentIds
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean);
      }
    }

    if (studentIdsList.length > 0 && !isStudentRequester) {
      const validObjectIds = studentIdsList
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));

      if (filter.student_id && filter.student_id.$in) {
        filter.student_id.$in = filter.student_id.$in.filter((id: any) =>
          validObjectIds.some((sId: any) => sId.toString() === id.toString()),
        );
      } else {
        filter.student_id = { $in: validObjectIds };
      }
    }

    if (query?.status) {
      filter.status = query.status;
    }
    if (query?.classId) {
      if (Types.ObjectId.isValid(query.classId)) {
        const studentsInClass = await this.studentModel
          .find({ class_id: query.classId })
          .select('_id')
          .lean()
          .exec();
        const studentIds = studentsInClass.map((s) => s._id);

        if (filter.student_id && filter.student_id.$in) {
          filter.student_id.$in = filter.student_id.$in.filter((id: any) =>
            studentIds.some((sId: any) => sId.toString() === id.toString()),
          );
        } else {
          filter.student_id = { $in: studentIds };
        }
      } else {
        filter.student_id = { $in: [] };
      }
    }

    const isSliderMode = query?.fields === 'slider';
    const rawPage = query?.page ? Number(query.page) : 1;
    const rawLimit = query?.limit ? Number(query.limit) : 10;
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const maxLimit =
      isSliderMode || rawLimit === 1000 || rawLimit > 100 ? 1000 : 100;
    const limit = Math.max(
      1,
      Math.min(maxLimit, isNaN(rawLimit) ? 10 : rawLimit),
    );
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      isSliderMode
        ? this.summaryPointModel
            .find(filter)
            .select('_id student_id total_score status grading period_id')
            .populate('student_id', '_id student_code full_name')
            .sort({ createdAt: 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec()
        : this.summaryPointModel
            .find(filter)
            .select(query?.fields?.includes('details') ? '' : '-details')
            .populate('student_id')
            .populate('semester_id')
            .populate('period_id')
            .sort({ createdAt: 1, _id: 1 })
            .skip(skip)
            .limit(limit)
            .lean()
            .exec(),
      this.summaryPointModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  async syncSummaryWithAcademicRecords(summaryId: string): Promise<any> {
    if (!Types.ObjectId.isValid(summaryId)) return null;

    const summary = await this.summaryPointModel.findById(summaryId).exec();
    if (!summary || summary.status === 'locked') return null;

    const criteria = await this.criterionModel.find().lean().exec();
    if (!criteria || criteria.length === 0) return null;

    const batch = criteria.map((cri) => ({
      student_id: summary.student_id,
      semester_id: summary.semester_id,
      criterion_id: cri._id,
    }));

    return this.academicRecordService.syncMultipleStudentCriterionScores(batch);
  }

  async findOne(id: string, requester?: any): Promise<SummaryPoint> {
    await this.assertCanAccessSummary(id, requester);

    // Tự động đồng bộ hóa với academic records trước khi load chi tiết
    await this.syncSummaryWithAcademicRecords(id);

    const summaryPoint = await this.summaryPointModel
      .findById(id)
      .populate('student_id')
      .populate('semester_id')
      .populate('period_id')
      .populate('details.criterion_id')
      .exec();
    if (!summaryPoint) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }
    return summaryPoint;
  }

  async update(
    id: string,
    updateSummaryPointDto: UpdateSummaryPointDto,
    requester?: any,
  ): Promise<SummaryPoint> {
    await this.assertCanAccessSummary(id, requester);

    const existingSummary = await this.summaryPointModel.findById(id).exec();
    if (!existingSummary) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }

    if (updateSummaryPointDto.status === 'locked') {
      throw new BadRequestException(
        'Để phê duyệt điểm rèn luyện, vui lòng sử dụng chức năng phê duyệt.',
      );
    }

    if (existingSummary.status === 'locked') {
      throw new BadRequestException(
        'Không thể sửa bảng điểm đã chốt. Vui lòng sử dụng chức năng hủy phê duyệt.',
      );
    }

    if (updateSummaryPointDto.status === 'draft') {
      (updateSummaryPointDto as any).rank_tier = null;
      (updateSummaryPointDto as any).rank_label = null;
      (updateSummaryPointDto as any).rank_locked_at = null;
      (updateSummaryPointDto as any).rank_updated_by = null;
    }

    if (updateSummaryPointDto.student_id) {
      await this.assertCanAccessStudent(
        updateSummaryPointDto.student_id,
        requester,
      );
    }

    const updated = await this.summaryPointModel
      .findByIdAndUpdate(id, updateSummaryPointDto, { returnDocument: 'after' })
      .populate('student_id')
      .populate('semester_id')
      .populate('period_id')
      .populate('details.criterion_id')
      .exec();
    if (!updated) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }

    gradingEventEmitter.emit('grading_event', {
      type: 'summary_updated',
      classId: (updated.student_id as any)?.class_id?.toString(),
      semesterId:
        (updated.semester_id as any)?._id?.toString() ||
        updated.semester_id?.toString(),
      studentId:
        (updated.student_id as any)?._id?.toString() ||
        updated.student_id?.toString(),
      summaryId: updated._id.toString(),
      data: updated,
    });

    return updated;
  }

  private getCriterionContributionForTotal(cri: any, rawScore: number): number {
    const isDiscipline =
      cri.criterion_type === 'ky_luat' || cri.score_per_unit < 0;
    if (isDiscipline && cri.is_score_counted === false) {
      return rawScore - (cri.max_score || 10);
    }
    return rawScore;
  }

  /**
   * Tính toán lại tổng điểm rèn luyện của một bảng điểm dựa trên các tiêu chí và danh mục.
   * Đồng thời cập nhật trường `grading` (xếp loại) nếu bảng điểm đã được chốt.
   *
   * @param summaryId - ID của bảng điểm rèn luyện cần tính toán lại.
   * @returns Promise<any>
   */
  async recomputeTotalScore(
    summaryId: string,
    preloadedMetadata?: { categories: any[]; criteria: any[] },
  ): Promise<SummaryPointDocument | null> {
    const summary = await this.summaryPointModel.findById(summaryId);
    if (!summary) return null;

    const details = summary.details || [];

    const categories =
      preloadedMetadata?.categories ||
      (await this.categoryModel.find().lean().exec());
    const criteria =
      preloadedMetadata?.criteria ||
      (await this.criterionModel.find().lean().exec());

    // Map categories by ID
    const categoryMap = new Map<string, any>();
    categories.forEach((cat) => {
      categoryMap.set(cat._id.toString(), {
        maxScore: cat.max_score || 100,
        currentScore: 0,
      });
    });

    // Map criteria by category
    const criteriaByCategory = new Map<string, any[]>();
    criteria.forEach((cri) => {
      const catId = cri.category_id.toString();
      if (!criteriaByCategory.has(catId)) {
        criteriaByCategory.set(catId, []);
      }
      criteriaByCategory.get(catId)!.push(cri);
    });

    // Calculate score per category
    for (const [catId, catInfo] of categoryMap.entries()) {
      const catCriteria = criteriaByCategory.get(catId) || [];
      for (const cri of catCriteria) {
        // Find matching detail
        const detail = details.find(
          (d) => d.criterion_id.toString() === cri._id.toString(),
        );

        let criterionScore = 0;
        const isDiscipline =
          cri.score_per_unit < 0 || cri.criterion_type === 'ky_luat';

        if (detail) {
          const isSummaryLocked = summary.status === 'locked';
          const isDetailLocked =
            detail.status === 'locked' || !!detail.locked_at;
          const isReviewed =
            detail.status === 'gv_reviewed' ||
            !!detail.gv_reviewed_by ||
            !!detail.gv_reviewed_at;
          const isApproved =
            detail.final_score !== null && detail.final_score !== undefined;
          const isEditableDraft =
            !isSummaryLocked && !isDetailLocked && !isReviewed && !isApproved;

          let rawScore = 0;
          if (isEditableDraft && (detail.current_count ?? 0) === 0) {
            rawScore = isDiscipline ? cri.max_score || 10 : 0;
          } else if (isSummaryLocked || isDetailLocked) {
            // For locked summaries or locked details, final_score is authoritative
            rawScore =
              detail.final_score !== null && detail.final_score !== undefined
                ? detail.final_score
                : detail.gv_score !== null && detail.gv_score !== undefined
                  ? detail.gv_score
                  : detail.sv_score !== null && detail.sv_score !== undefined
                    ? detail.sv_score
                    : detail.system_score !== null &&
                        detail.system_score !== undefined
                      ? detail.system_score
                      : 0;
          } else if (isReviewed) {
            // For reviewed but not locked, gv_score is authoritative
            rawScore =
              detail.gv_score !== null && detail.gv_score !== undefined
                ? detail.gv_score
                : detail.sv_score !== null && detail.sv_score !== undefined
                  ? detail.sv_score
                  : detail.system_score !== null &&
                      detail.system_score !== undefined
                    ? detail.system_score
                    : 0;
          } else {
            // Draft, unreviewed detail
            if (cri.scoring_mode === 'single_option') {
              const option = cri.options?.find(
                (o: any) => o.id === detail.selected_option_id,
              );
              if (option) {
                rawScore = option.score;
              } else if (
                detail.selected_option_score !== null &&
                detail.selected_option_score !== undefined
              ) {
                rawScore = detail.selected_option_score;
              } else {
                rawScore = isDiscipline ? cri.max_score || 10 : 0;
              }
            } else {
              if (
                detail.system_score !== null &&
                detail.system_score !== undefined
              ) {
                rawScore = detail.system_score;
              } else if (
                detail.current_count !== null &&
                detail.current_count !== undefined
              ) {
                // If system_score is missing but current_count is available, recompute fallback
                const fallbackResult = calculateCriterionScoreHelper({
                  criterion: cri,
                  count: detail.current_count,
                  selectedOptionId: detail.selected_option_id,
                  isSyncPath: true,
                });
                rawScore = fallbackResult.systemScore;
              } else {
                // If both system_score and current_count are missing, fallback to detail scores
                rawScore =
                  detail.final_score !== null &&
                  detail.final_score !== undefined
                    ? detail.final_score
                    : detail.gv_score !== null && detail.gv_score !== undefined
                      ? detail.gv_score
                      : detail.sv_score !== null &&
                          detail.sv_score !== undefined
                        ? detail.sv_score
                        : 0;
              }
            }
          }

          if (isDiscipline) {
            const maxScore = cri.max_score || 10;
            const count = detail.current_count ?? 0;
            if (rawScore < 0) {
              rawScore = maxScore - Math.abs(rawScore);
            } else if (rawScore === 0 && count === 0) {
              rawScore = maxScore;
            }
          }
          criterionScore = rawScore;
        } else {
          // If no detail, score depends on criterion type.
          // For violation (discipline), count = 0, meaning full base score (max_score).
          // Otherwise 0.
          if (isDiscipline) {
            criterionScore = cri.max_score || 10;
          } else {
            criterionScore = 0;
          }
        }

        const countedScore = this.getCriterionContributionForTotal(
          cri,
          criterionScore,
        );
        catInfo.currentScore += countedScore;
      }
    }

    let totalScore = 0;
    for (const catInfo of categoryMap.values()) {
      let clampedScore = catInfo.currentScore;
      if (clampedScore > catInfo.maxScore) clampedScore = catInfo.maxScore;
      if (clampedScore < 0) clampedScore = 0;
      totalScore += clampedScore;
    }

    if (totalScore > 100) totalScore = 100;
    if (totalScore < 0) totalScore = 0;

    summary.total_score = totalScore;
    if (summary.status === 'locked') {
      if (totalScore >= 90) summary.grading = 'Xuất sắc';
      else if (totalScore >= 80) summary.grading = 'Tốt';
      else if (totalScore >= 70) summary.grading = 'Khá';
      else if (totalScore >= 50) summary.grading = 'Trung bình';
      else summary.grading = 'Yếu';
    } else {
      summary.grading = 'Chưa xếp loại';
    }

    await summary.save();

    const student = await this.studentModel
      .findById(summary.student_id)
      .select('class_id')
      .lean()
      .exec();
    const classId = student ? normalizeObjectId(student.class_id) : '';

    gradingEventEmitter.emit('grading_event', {
      type: 'summary_recomputed',
      classId,
      semesterId: summary.semester_id?.toString(),
      studentId: summary.student_id?.toString(),
      summaryId: summary._id.toString(),
      data: summary,
    });

    return summary;
  }

  async generateSummaryExcel(
    exportDto: ExportSummaryExcelDto,
    requester: any,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { semesterId, classId, departmentId, studentIds, mode } = exportDto;
    const scope = exportDto.scope || 'class';
    const role = getGradingRole(requester);
    const isAdmin = role === 'admin';
    let classObj: any = null;
    let departmentObj: any = null;

    if (scope === 'class') {
      classObj = await this.classModel.findById(classId).exec();
      if (!classObj) throw new NotFoundException('Lớp học không tồn tại');
      const isAdminOrSupervisor = isAdmin || role === 'supervisor';
      if (!isAdminOrSupervisor && classObj.advisor_id?.toString() !== requester?.userId) {
        throw new ForbiddenException('Bạn không có quyền xuất dữ liệu lớp này.');
      }
      departmentObj = classObj.dept_id
        ? await this.departmentModel.findById(classObj.dept_id).exec()
        : null;
    } else {
      if (!isAdmin) {
        throw new ForbiddenException('Chỉ quản trị viên có quyền xuất dữ liệu theo khoa hoặc toàn hệ thống.');
      }
      if (scope === 'faculty') {
        departmentObj = await this.departmentModel.findById(departmentId).exec();
        if (!departmentObj) throw new NotFoundException('Khoa không tồn tại');
      }
      classObj = { class_name: scope === 'faculty' ? 'TẤT CẢ LỚP TRONG KHOA' : 'TẤT CẢ LỚP' };
    }

    const semesterObj = await this.semesterModel.findById(semesterId).exec();
    if (!semesterObj) throw new NotFoundException('Học kỳ không tồn tại');

    // Build filter
    const filter: any = {
      semester_id: new Types.ObjectId(semesterId),
    };

    const studentFilter: any = {};
    if (scope === 'class') studentFilter.class_id = new Types.ObjectId(classId!);
    if (scope === 'faculty') {
      const facultyClasses = await this.classModel
        .find({ dept_id: new Types.ObjectId(departmentId!) } as any)
        .select('_id')
        .lean()
        .exec();
      studentFilter.class_id = { $in: facultyClasses.map((item: any) => item._id) };
    }
    let studentsToFetch: any[] = [];
    if (mode === 'selected' && studentIds && studentIds.length > 0) {
      const validObjectIds: Types.ObjectId[] = [];
      const mssvList: string[] = [];
      studentIds.forEach((id) => {
        // Only parse as ObjectId if it's a 24-char hex string
        if (
          Types.ObjectId.isValid(id) &&
          new Types.ObjectId(id).toString() === id
        ) {
          validObjectIds.push(new Types.ObjectId(id));
        } else {
          mssvList.push(id);
        }
      });

      const queryOr: any[] = [];
      if (validObjectIds.length > 0) {
        queryOr.push({ _id: { $in: validObjectIds } });
      }
      if (mssvList.length > 0) {
        queryOr.push({ student_code: { $in: mssvList } });
      }

      if (queryOr.length > 0) {
        studentsToFetch = await this.studentModel
          .find({
            ...studentFilter,
            $or: queryOr,
          })
          .select('_id')
          .exec();
      }
    } else {
      // all_filtered or no studentIds
      studentsToFetch = await this.studentModel
        .find(studentFilter)
        .select('_id')
        .exec();
    }

    if (studentsToFetch.length > 0) {
      filter.student_id = { $in: studentsToFetch.map((s) => s._id) };
    } else {
      filter.student_id = null; // No students to find
    }

    let summaries: any[] = [];
    if (filter.student_id) {
      summaries = await this.summaryPointModel
        .find(filter)
        .populate({
          path: 'student_id',
          select: 'full_name student_code class_id',
          populate: {
            path: 'class_id',
            select: 'class_name dept_id',
            populate: {
              path: 'dept_id',
              select: 'name',
            },
          },
        })
        .lean()
        .exec();
    }

    // Sort by student code or name if needed, assuming default or existing sorting
    // Optionally sort by first name.
    summaries.sort((a, b) => {
      const nameA = a.student_id?.full_name || '';
      const nameB = b.student_id?.full_name || '';
      return nameA.localeCompare(nameB, 'vi');
    });

    const buffer = await generatePl03Excel(
      summaries,
      classObj,
      semesterObj,
      departmentObj,
      scope,
    );

    // Sanitize filename
    const normalizeFilenamePart = (value: string, fallback: string) => {
      const normalized = (value || fallback)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      return normalized || fallback;
    };
    const filenameScope = scope === 'class' ? classObj.class_name : departmentObj?.name || 'TAT-CA';
    const safeScopeName = normalizeFilenamePart(filenameScope, 'TAT-CA');
    const filename = `PL03-TONGHOPRL-${safeScopeName}.xlsx`;

    return { buffer, filename };
  }

  /**
   * Phê duyệt bảng điểm rèn luyện: khóa các chi tiết điểm, tính toán lại tổng điểm (total_score), xếp loại (grading), và hạng (rank_tier).
   * Yêu cầu: Người dùng thực hiện phải có vai trò Admin hoặc Supervisor.
   *
   * @param summaryId - ID của bảng điểm cần phê duyệt.
   * @param requester - Thông tin của người dùng đang thực hiện request (chứa userId, roleName).
   * @returns Promise<SummaryPointDocument> - Bảng điểm sau khi đã cập nhật trạng thái chốt.
   */
  async approveGrading(
    summaryId: string,
    requester: any,
  ): Promise<SummaryPointDocument> {
    const role = getGradingRole(requester);
    const isAdminOrSupervisor = role === 'admin' || role === 'supervisor';

    if (!isAdminOrSupervisor) {
      throw new ForbiddenException(
        'Bạn không có quyền phê duyệt bảng điểm rèn luyện.',
      );
    }

    // 1. Pre-approval synchronization step
    await this.syncSummaryWithAcademicRecords(summaryId);

    // 2. Reload the summary after pre-approval sync before assigning final_score.
    const summary = await this.summaryPointModel.findById(summaryId);
    if (!summary) {
      throw new NotFoundException(`Summary ${summaryId} không tồn tại`);
    }

    // Lấy tất cả active academic records cho học kỳ đó để tính toán và kiểm tra điểm của từng tiêu chí chống chốt điểm 0 sai lệch
    const activeRecords = await this.academicRecordModel
      .find({
        student_id: summary.student_id,
        semester_id: summary.semester_id,
        status: 'active',
        is_deleted: { $ne: true },
      } as any)
      .lean()
      .exec();

    // Group active records count by criterion
    const recordCountsByCriterion = new Map<string, number>();
    const latestRecordByCriterion = new Map<string, any>();
    activeRecords.forEach((rec) => {
      const criId = rec.criterion_id.toString();
      recordCountsByCriterion.set(
        criId,
        (recordCountsByCriterion.get(criId) || 0) + 1,
      );

      const existingLatest = latestRecordByCriterion.get(criId);
      if (
        !existingLatest ||
        new Date((rec as any).createdAt) > new Date(existingLatest.createdAt)
      ) {
        latestRecordByCriterion.set(criId, rec);
      }
    });

    const criteria = await this.criterionModel.find().lean().exec();
    const criteriaMap = new Map(criteria.map((c) => [c._id.toString(), c]));

    // Set the status of all details to 'locked' and calculate final_score
    if (summary.details && summary.details.length > 0) {
      const lockedBy = new Types.ObjectId(requester.userId);
      const lockedAt = new Date();
      for (const detail of summary.details) {
        const criterionIdStr = detail.criterion_id.toString();
        const criterion = criteriaMap.get(criterionIdStr);
        const activeCount = recordCountsByCriterion.get(criterionIdStr) || 0;

        const oldStatus = detail.status || 'draft';
        detail.status = 'locked';

        const finalScore =
          detail.gv_score !== null && detail.gv_score !== undefined
            ? detail.gv_score
            : detail.sv_score !== null && detail.sv_score !== undefined
              ? detail.sv_score
              : detail.selected_option_score !== null &&
                  detail.selected_option_score !== undefined
                ? detail.selected_option_score
                : detail.system_score !== null &&
                    detail.system_score !== undefined
                  ? detail.system_score
                  : null;

        if (activeCount > 0 && criterion) {
          // Tính điểm thực từ active records dùng helper
          let optId: string | null = null;
          let optLabel: string | null = null;
          let optScore: number | null = null;
          let manualScore: number | null = null;

          const latestRecord = latestRecordByCriterion.get(criterionIdStr);
          if (latestRecord) {
            if (criterion.scoring_mode === 'single_option') {
              if (latestRecord.selected_option_id) {
                optId = latestRecord.selected_option_id;
                optLabel = latestRecord.selected_option_label || null;
                optScore =
                  latestRecord.selected_option_score !== undefined
                    ? latestRecord.selected_option_score
                    : null;
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

          const scoringResult = calculateCriterionScoreHelper({
            criterion,
            count: activeCount,
            selectedOptionId: optId,
            selectedOptionLabel: optLabel,
            selectedOptionScore: optScore,
            manualScore,
            isSyncPath: true,
          });

          const recordDerivedScore = scoringResult.systemScore;

          const calculatedExpected = recordDerivedScore;

          const isResolvedToZero = finalScore === 0 || finalScore === null;
          const isRealExpectedNotZero = calculatedExpected > 0;

          if (isResolvedToZero && isRealExpectedNotZero) {
            const isIntentionallyReviewedZero =
              (oldStatus === 'gv_reviewed' || !!detail.gv_reviewed_by) &&
              detail.gv_score === 0;

            if (isIntentionallyReviewedZero) {
              detail.final_score = 0;
            } else {
              throw new BadRequestException({
                statusCode: 400,
                message: `Không thể phê duyệt: Tiêu chí '${criterion.criterion_name}' có bản ghi hoạt động (active records) nhưng điểm phê duyệt tính ra bằng 0. Điểm mong đợi từ bản ghi là ${calculatedExpected}. Vui lòng đồng bộ hóa hoặc cập nhật điểm đánh giá trước khi phê duyệt.`,
                error: 'Bad Request',
                reasonCode: 'GRADING_APPROVAL_SCORE_CONFLICT',
              });
            }
          } else {
            detail.final_score =
              finalScore !== null ? finalScore : calculatedExpected;
          }
        } else {
          // Không có active records
          detail.final_score = finalScore !== null ? finalScore : 0;
        }

        detail.locked_at = detail.locked_at || lockedAt;
        detail.locked_by = detail.locked_by || (lockedBy as any);

        if (oldStatus !== 'locked') {
          detail.log = detail.log || [];
          detail.log.push({
            from_status: oldStatus,
            to_status: 'locked',
            score_before:
              detail.system_score !== undefined && detail.system_score !== null
                ? detail.system_score
                : 0,
            score_after: detail.final_score,
            count: detail.current_count,
            updated_by: lockedBy as any,
            updated_at: lockedAt,
            reason:
              'Phê duyệt rèn luyện bởi ' +
              (requester.roleName?.toLowerCase().includes('supervisor')
                ? 'Quản sinh'
                : 'Admin'),
          });
        }
      }
      summary.markModified('details');
    }

    // Call summary.save() to persist the detail-level final_score values.
    summary.status = 'locked';
    summary.markModified('details');
    await summary.save();

    // Call recomputeTotalScore(summaryId)
    await this.recomputeTotalScore(summaryId);

    // Load the updated summary again. If not found, throw NotFoundException.
    const recomputedSummary = await this.summaryPointModel.findById(summaryId);
    if (!recomputedSummary) {
      throw new NotFoundException(`Summary ${summaryId} không tồn tại`);
    }

    // Compute rank_tier and rank_label from resolveRankTier(recomputedSummary.total_score, 'locked')
    const { rank_tier, rank_label } = resolveRankTier(
      recomputedSummary.total_score,
      'locked',
    );

    // Update recomputedSummary fields
    recomputedSummary.rank_tier = rank_tier;
    recomputedSummary.rank_label = rank_label;
    recomputedSummary.rank_locked_at = new Date();
    recomputedSummary.rank_updated_by = requester.userId;

    // Call recomputedSummary.save()
    await recomputedSummary.save();

    // Return populated document
    const result = await this.summaryPointModel
      .findById(summaryId)
      .populate('student_id')
      .populate('semester_id')
      .populate('period_id')
      .populate('details.criterion_id')
      .exec();
    if (!result) throw new NotFoundException('Summary not found after update');

    gradingEventEmitter.emit('grading_event', {
      type: 'summary_approved',
      classId: (result.student_id as any)?.class_id?.toString(),
      semesterId:
        (result.semester_id as any)?._id?.toString() ||
        result.semester_id?.toString(),
      studentId:
        (result.student_id as any)?._id?.toString() ||
        result.student_id?.toString(),
      summaryId: result._id.toString(),
      data: result,
    });

    return result;
  }

  /**
   * Hủy phê duyệt bảng điểm rèn luyện: chuyển trạng thái bảng điểm và các chi tiết về 'draft',
   * reset các trường liên quan đến hạng, và tính toán lại tổng điểm.
   * Yêu cầu: Người dùng thực hiện phải có vai trò Admin hoặc Supervisor.
   *
   * @param summaryId - ID của bảng điểm cần hủy duyệt.
   * @param requester - Thông tin của người dùng đang thực hiện request.
   * @returns Promise<SummaryPointDocument> - Bảng điểm sau khi đã hủy chốt và trở về bản nháp.
   */
  async cancelApproval(
    summaryId: string,
    requester: any,
  ): Promise<SummaryPointDocument> {
    // 1. Kiểm tra quyền Admin/Supervisor
    const role = getGradingRole(requester);
    const isAdminOrSupervisor = role === 'admin' || role === 'supervisor';

    if (!isAdminOrSupervisor) {
      throw new ForbiddenException(
        'Bạn không có quyền hủy duyệt bảng điểm rèn luyện.',
      );
    }

    // 2. Kiểm tra quyền truy cập summary
    await this.assertCanAccessSummary(summaryId, requester);

    // 3. Tìm summary
    const summary = await this.summaryPointModel.findById(summaryId);
    if (!summary) {
      throw new NotFoundException(`Bảng điểm ${summaryId} không tồn tại`);
    }

    // 4. Kiểm tra trạng thái hiện tại
    if (summary.status !== 'locked') {
      throw new BadRequestException(
        'Chỉ có thể hủy duyệt bảng điểm rèn luyện đã chốt.',
      );
    }

    // 5. Cập nhật trạng thái locked + rank
    summary.status = 'draft';
    summary.rank_tier = null;
    summary.rank_label = null;
    summary.rank_locked_at = null;
    summary.rank_updated_by = null;

    // 6. Cập nhật các embedded details
    if (summary.details && summary.details.length > 0) {
      const updatedBy = new Types.ObjectId(requester.userId);
      for (const detail of summary.details) {
        const oldStatus = detail.status || 'locked';
        const oldFinalScore = detail.final_score;

        detail.status = 'draft';
        detail.final_score = null;
        detail.locked_at = null;
        detail.locked_by = null;

        // Thêm log vào detail
        detail.log = detail.log || [];
        detail.log.push({
          from_status: oldStatus,
          to_status: 'draft',
          score_before: oldFinalScore !== undefined ? oldFinalScore : null,
          score_after: null,
          count: detail.current_count,
          updated_by: updatedBy as any,
          updated_at: new Date(),
          reason: 'Hủy duyệt rèn luyện về Bản nháp',
        });
      }
      summary.markModified('details');
    }

    await summary.save();

    // 7. Tính lại total_score và grading
    await this.recomputeTotalScore(summaryId);

    // 8. Trả về summary đã populated
    const result = await this.summaryPointModel
      .findById(summaryId)
      .populate('student_id')
      .populate('semester_id')
      .populate('period_id')
      .populate('details.criterion_id')
      .exec();

    if (!result) throw new NotFoundException('Summary not found after update');

    gradingEventEmitter.emit('grading_event', {
      type: 'summary_cancelled',
      classId: (result.student_id as any)?.class_id?.toString(),
      semesterId:
        (result.semester_id as any)?._id?.toString() ||
        result.semester_id?.toString(),
      studentId:
        (result.student_id as any)?._id?.toString() ||
        result.student_id?.toString(),
      summaryId: result._id.toString(),
      data: result,
    });

    return result;
  }

  /**
   * Hủy duyệt điểm rèn luyện hàng loạt.
   */
  async cancelApprovalBulk(
    summaryIds: string[],
    requester: any,
  ): Promise<any[]> {
    if (!summaryIds || summaryIds.length === 0) {
      throw new BadRequestException('Danh sách ID bảng điểm không được trống.');
    }

    const results = [];
    for (const id of summaryIds) {
      try {
        const updated = await this.cancelApproval(id, requester);
        results.push({
          summaryId: id,
          success: true,
          data: updated,
        });
      } catch (err: any) {
        results.push({
          summaryId: id,
          success: false,
          error: err.message || 'Lỗi không xác định',
        });
      }
    }
    return results;
  }

  /**
   * Lấy summary đã chốt gần nhất của sinh viên (cho trang profile).
   * Chỉ trả dữ liệu của chính sinh viên đang đăng nhập.
   */
  async findLatestForStudent(
    userId: string,
    semesterId?: string,
    periodId?: string,
  ): Promise<LatestStudentSummaryDto | null> {
    // 1. Tìm student theo user_id và populate class_id
    const student = await this.studentModel
      .findOne({ user_id: userId })
      .populate('class_id')
      .exec();

    if (!student) {
      return null;
    }

    // 1.5 Lấy class name thô
    const classObj = student.class_id as any;
    const className = classObj?.class_name || 'Chưa cập nhật';

    // 2. Build query
    const query: any = {
      student_id: student._id,
      status: 'locked',
    };
    if (semesterId) query.semester_id = semesterId;
    if (periodId) query.period_id = periodId;

    // 3. Tìm summary locked mới nhất
    const summary = await this.summaryPointModel
      .findOne(query)
      .sort({ updatedAt: -1 })
      .populate('semester_id')
      .populate('period_id')
      .exec();

    if (!summary) {
      return null;
    }

    // 4. Format response cho profile
    const semester = summary.semester_id as any;
    return {
      _id: summary._id,
      status: summary.status,
      total_score: summary.total_score,
      grading: summary.grading,
      rank_tier: summary.rank_tier,
      rank_label: summary.rank_label,
      semester:
        semester?.semester_name || semester?.name || semester?.title || 'N/A',
      period: summary.period_id,
      locked_at: summary.rank_locked_at || (summary as any).updatedAt,
      studentName: student.full_name || 'Sinh viên',
      className: className,
      student: {
        full_name: student.full_name || 'Sinh viên',
        student_code: student.student_code || '',
        class_id: student.class_id
          ? {
              _id: classObj?._id || student.class_id,
              class_name: className,
            }
          : null,
      },
    };
  }

  async remove(id: string, requester?: any): Promise<SummaryPoint> {
    await this.assertCanAccessSummary(id, requester);

    const existingSummary = await this.summaryPointModel.findById(id).exec();
    if (!existingSummary) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }
    if (existingSummary.status === 'locked') {
      throw new BadRequestException(
        'Không thể xóa điểm rèn luyện đã phê duyệt',
      );
    }

    const deleted = await this.summaryPointModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }

    gradingEventEmitter.emit('grading_event', {
      type: 'summary_deleted',
      classId: (existingSummary.student_id as any)?.class_id?.toString(),
      semesterId:
        (existingSummary.semester_id as any)?._id?.toString() ||
        existingSummary.semester_id?.toString(),
      studentId:
        (existingSummary.student_id as any)?._id?.toString() ||
        existingSummary.student_id?.toString(),
      summaryId: existingSummary._id.toString(),
    });

    return deleted;
  }

  async generatePdf(payloads: any[]): Promise<Buffer> {
    // Dynamically require puppeteer at runtime to support backend initialization
    const puppeteer = require('puppeteer');
    const htmlContent = this.generateHtml(payloads);

    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'load' });

      // Render to A4 PDF with full-bleed background colors (margin: 0)
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  private generateHtml(payloads: any[]): string {
    const customTexts = {
      approverName: '',
      approverTitle: 'GIÁO VIÊN CHỦ NHIỆM/CỐ VẤN HỌC TẬP',
      ubnd: 'ỦY BAN NHÂN DÂN',
      city: 'THÀNH PHỐ HỒ CHÍ MINH',
      school: 'TRƯỜNG CAO ĐẲNG BÁCH KHOA\nNAM SÀI GÒN',
      title: 'PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH, SINH VIÊN',
    };

    let studentsHtml = '';

    payloads.forEach((payload) => {
      const {
        student,
        categories: mappedCategories,
        summary,
        semesterName,
        className,
      } = payload;
      let tableRowsHtml = '';

      mappedCategories.forEach((cat: any) => {
        tableRowsHtml += `
          <tr>
            <td style="border: 1px solid black; text-align: center; font-weight: bold; padding: 4px;">${cat.code || ''}</td>
            <td style="border: 1px solid black; font-weight: bold; padding: 4px;">${cat.title}</td>
            <td style="border: 1px solid black; text-align: center; font-weight: bold; padding: 4px;">${cat.maxPoints || ''}</td>
            <td style="border: 1px solid black; text-align: center; font-weight: bold; padding: 4px;">${cat.achievedScore}</td>
            <td style="border: 1px solid black; padding: 4px;"></td>
          </tr>
        `;

        cat.items.forEach((item: any) => {
          tableRowsHtml += `
            <tr style="break-inside: avoid; page-break-inside: avoid;">
              <td style="border: 1px solid black; text-align: center; padding: 4px;">${item.index}</td>
              <td style="border: 1px solid black; padding: 4px;">${item.name}</td>
              <td style="border: 1px solid black; text-align: center; padding: 4px;">${item.maxScore}</td>
              <td style="border: 1px solid black; text-align: center; padding: 4px;">${item.achievedScore}</td>
              <td style="border: 1px solid black; padding: 4px;"></td>
            </tr>
          `;
        });
      });

      const semesterParts = (semesterName || '').split('-');
      const termStr = semesterParts[0]?.trim() || '';
      const yearStr = semesterParts.slice(1).join('-')?.trim() || '';

      studentsHtml += `
        <div class="page page-break-after-always">
          <table style="width: 100%; border: none; margin-bottom: 10px;">
            <tr>
              <td style="width: 45%; text-align: center; vertical-align: top;">
                <div style="font-weight: normal; font-size: 13pt; white-space: nowrap;">${customTexts.ubnd || 'ỦY BAN NHÂN DÂN'}</div>
                <div style="font-weight: normal; font-size: 13pt; white-space: nowrap;">${customTexts.city || 'THÀNH PHỐ HỒ CHÍ MINH'}</div>
                <div style="font-weight: bold; font-size: 13pt; text-transform: uppercase; white-space: nowrap;">${(customTexts.school || 'TRƯỜNG CAO ĐẲNG BÁCH KHOA\\nNAM SÀI GÒN').replace(/\\\\n/g, '<br/>').replace(/\\n/g, '<br/>')}</div>
              </td>
              <td style="width: 55%; text-align: center; vertical-align: top;">
                <div style="font-weight: bold; font-size: 12pt; white-space: nowrap;">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                <div style="font-weight: bold; font-size: 13pt; text-decoration: underline; white-space: nowrap;">Độc lập - Tự do - Hạnh phúc</div>
              </td>
            </tr>
          </table>

          <div style="text-align: center; margin: 20px 0;">
            <div style="font-weight: bold; font-size: 14pt;">${customTexts.title || 'PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH, SINH VIÊN'}</div>
          </div>

          <table style="width: 100%; border: none; margin-bottom: 10px; font-size: 13pt;">
            <tr>
              <td style="width: 75%;"><span style="white-space: nowrap;">Họ và tên học sinh, sinh viên:</span> <span style="font-weight: bold;">${student.name}</span></td>
              <td style="width: 25%;"><span style="white-space: nowrap;">Ngày sinh:</span> <span style="font-weight: normal;">${student.dob || '......./......./..............'}</span></td>
            </tr>
            <tr>
              <td><span style="white-space: nowrap;">Lớp:</span> <span style="font-weight: normal;">${className}</span></td>
              <td><span style="white-space: nowrap;">Mã SV:</span> <span style="font-weight: normal;">${student.studentCode}</span></td>
            </tr>
            <tr>
              <td><span style="white-space: nowrap;">Học kỳ:</span> <span style="font-weight: normal;">${termStr}</span></td>
              <td><span style="white-space: nowrap;">Năm học:</span> <span style="font-weight: normal;">${yearStr}</span></td>
            </tr>
          </table>

          <table style="width: 100%; border-collapse: collapse; border: 1px solid black; font-size: 12pt; margin-bottom: 20px;">
            <thead>
              <tr>
                <th style="border: 1px solid black; padding: 4px; width: 5%;">STT</th>
                <th style="border: 1px solid black; padding: 4px; width: 60%;">NỘI DUNG ĐÁNH GIÁ</th>
                <th style="border: 1px solid black; padding: 4px; width: 10%;">Điểm tối đa</th>
                <th style="border: 1px solid black; padding: 4px; width: 10%;">Điểm đạt được</th>
                <th style="border: 1px solid black; padding: 4px; width: 15%;">Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              ${tableRowsHtml}
              <tr style="break-inside: avoid; page-break-inside: avoid;">
                <td colspan="3" style="border: 1px solid black; font-weight: bold; text-align: right; padding: 4px;">Tổng cộng: I, II, III, IV, V</td>
                <td style="border: 1px solid black; text-align: center; font-weight: bold; padding: 4px;">${summary.coreTotal}</td>
                <td style="border: 1px solid black; padding: 4px;"></td>
              </tr>
              <tr style="break-inside: avoid; page-break-inside: avoid;">
                <td colspan="3" style="border: 1px solid black; font-weight: bold; text-align: right; padding: 4px;">Tổng cộng điểm thưởng</td>
                <td style="border: 1px solid black; text-align: center; font-weight: bold; padding: 4px;">${summary.bonusTotal}</td>
                <td style="border: 1px solid black; padding: 4px;"></td>
              </tr>
              <tr style="break-inside: avoid; page-break-inside: avoid;">
                <td colspan="3" style="border: 1px solid black; font-weight: bold; text-align: right; padding: 4px;">Tổng cộng: I, II, III, IV, V, VI (Không quá 100 điểm)</td>
                <td style="border: 1px solid black; text-align: center; font-weight: bold; padding: 4px;">${summary.finalTotal}</td>
                <td style="border: 1px solid black; padding: 4px;"></td>
              </tr>
              <tr style="break-inside: avoid; page-break-inside: avoid;">
                <td colspan="3" style="border: 1px solid black; font-weight: bold; text-align: right; padding: 4px;">Xếp loại rèn luyện</td>
                <td style="border: 1px solid black; text-align: center; font-weight: bold; padding: 4px;">${summary.classification}</td>
                <td style="border: 1px solid black; padding: 4px;"></td>
              </tr>
            </tbody>
          </table>

          <div style="break-inside: avoid; page-break-inside: avoid;">
            <table style="width: 45%; border-collapse: collapse; border: 1px solid black; font-size: 11pt; margin-bottom: 20px;">
              <tbody>
                <tr><td style="border: 1px solid black; padding: 2px 4px;">Từ 90 đến 100</td><td style="border: 1px solid black; padding: 2px 4px;">Xuất sắc</td></tr>
                <tr><td style="border: 1px solid black; padding: 2px 4px;">Từ 80 đến dưới 90</td><td style="border: 1px solid black; padding: 2px 4px;">Tốt</td></tr>
                <tr><td style="border: 1px solid black; padding: 2px 4px;">Từ 70 đến dưới 80</td><td style="border: 1px solid black; padding: 2px 4px;">Khá</td></tr>
                <tr><td style="border: 1px solid black; padding: 2px 4px;">Từ 50 đến dưới 70</td><td style="border: 1px solid black; padding: 2px 4px;">Trung bình</td></tr>
                <tr><td style="border: 1px solid black; padding: 2px 4px;">Dưới 50</td><td style="border: 1px solid black; padding: 2px 4px;">Yếu</td></tr>
              </tbody>
            </table>

            <table style="width: 100%; border: none; font-size: 13pt;">
              <tr>
                <td style="width: 50%; text-align: center; vertical-align: top;">
                  <div style="font-weight: bold;">HỌC SINH, SINH VIÊN</div>
                  <div style="font-style: italic;">(Ký và ghi rõ họ tên)</div>
                  <div style="height: 60px;"></div>
                  <div style="font-weight: bold;">${student.name}</div>
                </td>
                <td style="width: 50%; text-align: center; vertical-align: top;">
                  <div>........, Ngày ..... tháng ..... năm 20.....</div>
                  <div style="font-weight: bold; font-size: 10pt; white-space: nowrap;">${customTexts.approverTitle || 'GIÁO VIÊN CHỦ NHIỆM/CỐ VẤN HỌC TẬP'}</div>
                  <div style="font-style: italic;">(Ký và ghi rõ họ tên)</div>
                  <div style="height: 60px;"></div>
                  <div style="font-weight: bold;"></div>
                </td>
              </tr>
            </table>
          </div>
        </div>
      `;
    });

    return `
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="UTF-8">
        <title>Phiếu điểm rèn luyện</title>
        <style>
          /* ========== Base ========== */
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: "Times New Roman", Times, serif;
            margin: 0; padding: 0;
            background-color: white;
            color: black;
            font-size: 13pt;
            line-height: 1.3;
          }
          @page { size: A4; margin: 0; }
          .page {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm 20mm 20mm 20mm;
            box-sizing: border-box;
            background-color: white;
            position: relative;
            margin: 0 auto;
          }
          .page-break-after-always {
            page-break-after: always;
            break-after: page;
          }
          table { width: 100%; border-collapse: collapse; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; break-inside: avoid; }
        </style>
      </head>
      <body>
        ${studentsHtml}
      </body>
      </html>
    `;
  }

  async auditAndRepairDraftScores(): Promise<any> {
    const activeSummaries = await this.summaryPointModel
      .find({ status: { $ne: 'locked' } })
      .lean()
      .exec();
    const criteria = await this.criterionModel.find().lean().exec();

    let repairedCount = 0;
    const mismatches = [];

    for (const summary of activeSummaries) {
      let isModified = false;
      const details = summary.details || [];
      const studentId = summary.student_id.toString();
      const semesterId = summary.semester_id.toString();

      // Đọc active academic records cho student và semester này
      const activeRecords = await this.academicRecordModel
        .find({
          student_id: summary.student_id,
          semester_id: summary.semester_id,
          status: 'active',
          is_deleted: { $ne: true },
        } as any)
        .lean()
        .exec();

      // Group records by criterion
      const recordCountsByCriterion = new Map<string, number>();
      const latestRecordByCriterion = new Map<string, any>();
      activeRecords.forEach((rec) => {
        const criId = rec.criterion_id.toString();
        recordCountsByCriterion.set(
          criId,
          (recordCountsByCriterion.get(criId) || 0) + 1,
        );

        const existingLatest = latestRecordByCriterion.get(criId);
        if (
          !existingLatest ||
          new Date((rec as any).createdAt) > new Date(existingLatest.createdAt)
        ) {
          latestRecordByCriterion.set(criId, rec);
        }
      });

      // Duyệt qua tất cả criteria để kiểm tra mismatch và repair
      for (const cri of criteria) {
        const criId = cri._id.toString();
        const activeCount = recordCountsByCriterion.get(criId) || 0;
        const latestRecord = latestRecordByCriterion.get(criId);

        const detailIndex = details.findIndex(
          (d: any) => d.criterion_id && d.criterion_id.toString() === criId,
        );
        const detail = detailIndex !== -1 ? details[detailIndex] : null;

        const detailCount = detail ? detail.current_count : 0;

        const hasActiveRecords = activeCount > 0;
        const isCountZeroOrMissing = !detail || detailCount === 0;

        if (hasActiveRecords && isCountZeroOrMissing) {
          // Tính computed score
          let optId: string | null = null;
          let optLabel: string | null = null;
          let optScore: number | null = null;
          let manualScore: number | null = null;

          if (latestRecord) {
            if (cri.scoring_mode === 'single_option') {
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
                optId = latestRecord.record_title.replace(
                  'Lựa chọn option ',
                  '',
                );
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

          const result = calculateCriterionScoreHelper({
            criterion: cri,
            count: activeCount,
            selectedOptionId: optId,
            selectedOptionLabel: optLabel,
            selectedOptionScore: optScore,
            manualScore,
            isSyncPath: true,
          });

          const expectedScore = result.systemScore;

          const isReward =
            cri.score_per_unit > 0 ||
            cri.criterion_type === 'reward' ||
            cri.criterion_type === 'bonus';
          const isViolation =
            cri.score_per_unit < 0 || cri.criterion_type === 'violation';

          const isTargetCriterion =
            (isReward || isViolation) && expectedScore > 0;

          if (isTargetCriterion) {
            const isDetailLocked =
              detail && (detail.status === 'locked' || !!detail.locked_at);
            const isDetailReviewed =
              detail &&
              (detail.status === 'gv_reviewed' ||
                !!detail.gv_reviewed_by ||
                !!detail.gv_reviewed_at);
            const isDetailApproved =
              detail &&
              detail.final_score !== null &&
              detail.final_score !== undefined;

            const isManuallyReviewed =
              isDetailLocked || isDetailReviewed || isDetailApproved;

            if (isManuallyReviewed) {
              mismatches.push({
                student_id: studentId,
                semester_id: semesterId,
                criterion_id: criId,
                active_record_count: activeCount,
                old_detail_count: detailCount,
                old_score_fields: detail
                  ? {
                      sv: detail.sv_score,
                      gv: detail.gv_score,
                      final: detail.final_score,
                    }
                  : null,
                repaired_detail_count: detailCount,
                repaired_system_score: detail ? detail.system_score : 0,
                repaired: false,
                skip_reason: isDetailLocked
                  ? 'Detail is locked'
                  : isDetailApproved
                    ? 'Detail has finalized/approved score'
                    : 'Detail is manually reviewed',
              });
              continue;
            }

            const oldScoreFields = detail
              ? {
                  sv: detail.sv_score,
                  gv: detail.gv_score,
                  final: detail.final_score,
                }
              : null;
            const repairedDetailCount = result.currentCount;

            if (!detail) {
              const newDetail: any = {
                criterion_id: new Types.ObjectId(criId),
                current_count: repairedDetailCount,
                system_score: expectedScore,
                selected_option_id: optId,
                selected_option_label: optLabel,
                selected_option_score: optScore,
                sv_score: expectedScore,
                sv_submitted_at: null,
                gv_score: expectedScore,
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
              detail.current_count = repairedDetailCount;
              detail.system_score = expectedScore;
              detail.selected_option_id = optId;
              detail.selected_option_label = optLabel;
              detail.selected_option_score = optScore;
              detail.sv_score = expectedScore;
              detail.gv_score = expectedScore;
              detail.final_score = null;
            }

            mismatches.push({
              student_id: studentId,
              semester_id: semesterId,
              criterion_id: criId,
              active_record_count: activeCount,
              old_detail_count: detailCount,
              old_score_fields: oldScoreFields,
              repaired_detail_count: repairedDetailCount,
              repaired_system_score: expectedScore,
              repaired: true,
            });

            isModified = true;
          }
        }
      }

      if (isModified) {
        await this.summaryPointModel.findByIdAndUpdate(
          summary._id,
          { $set: { details } },
        ).exec();
        await this.recomputeTotalScore(summary._id.toString());
        repairedCount++;
      }
    }

    return {
      repairedSummariesCount: repairedCount,
      mismatchDetails: mismatches,
    };
  }

  async getGradingAccess(
    requester: any,
    context: {
      classId?: string;
      studentId?: string;
      semesterId?: string;
      summaryId?: string;
    },
  ): Promise<any> {
    const decision = evaluateGradingAccess(requester);

    // Evaluate extra data scope constraints based on target context
    try {
      if (context.studentId) {
        await assertCanAccessStudent(
          requester,
          context.studentId,
          this.classModel,
          this.studentModel,
        );
      }
      if (context.classId) {
        await assertCanAccessClass(requester, context.classId, this.classModel);
      }

      // Check summary lock state if summaryId is provided
      let summaryObj = null;
      if (context.summaryId) {
        summaryObj = await this.summaryPointModel
          .findById(context.summaryId)
          .exec();
      } else if (context.studentId && context.semesterId) {
        summaryObj = await this.summaryPointModel
          .findOne({
            student_id: new Types.ObjectId(context.studentId),
            semester_id: new Types.ObjectId(context.semesterId),
          } as any)
          .exec();
      }

      if (summaryObj) {
        decision.canReadSummary = true;
        if (summaryObj.status === 'locked') {
          decision.canModifyScore = false;
          decision.canCopyScore = false;
          decision.reasonCode = 'GRADING_SUMMARY_LOCKED';
          decision.reason = 'Bảng điểm rèn luyện đã chốt.';
        }
      }
    } catch (err: any) {
      decision.canModifyScore = false;
      decision.canCopyScore = false;
      decision.canReadStudent = false;
      decision.canReadSummary = false;
      decision.reasonCode = err.response?.reasonCode || 'GRADING_SCOPE_DENIED';
      decision.reason = err.message || 'Không có quyền truy cập dữ liệu.';
    }

    return decision;
  }

  /**
   * Get approval status for all classes in a given semester.
   * Returns a map of classId -> { total, locked, allApproved }.
   */
  async getClassApprovalStatus(
    semesterId: string,
  ): Promise<
    Record<string, { total: number; locked: number; allApproved: boolean }>
  > {
    const semesterObjectId = new Types.ObjectId(semesterId);

    const pipeline = [
      // Match summaries for the given semester (semester-level only, no period)
      {
        $match: {
          semester_id: semesterObjectId,
          $or: [{ period_id: null }, { period_id: { $exists: false } }],
        },
      },
      // Lookup student to get class_id
      {
        $lookup: {
          from: 'students',
          localField: 'student_id',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: '$student' },
      // Group by class_id
      {
        $group: {
          _id: '$student.class_id',
          total: { $sum: 1 },
          locked: {
            $sum: { $cond: [{ $eq: ['$status', 'locked'] }, 1, 0] },
          },
        },
      },
      // Project result
      {
        $project: {
          _id: 1,
          total: 1,
          locked: 1,
          allApproved: {
            $and: [{ $gt: ['$total', 0] }, { $eq: ['$total', '$locked'] }],
          },
        },
      },
    ];

    const results = await this.summaryPointModel.aggregate(pipeline).exec();

    const map: Record<
      string,
      { total: number; locked: number; allApproved: boolean }
    > = {};
    for (const row of results) {
      if (row._id) {
        map[row._id.toString()] = {
          total: row.total,
          locked: row.locked,
          allApproved: !!row.allApproved,
        };
      }
    }

    return map;
  }
}
