import { ForbiddenException, Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  SummaryPoint,
  SummaryPointDocument,
} from './schemas/summary-point.schema';
import { CreateSummaryPointDto } from './dto/create-summary-point.dto';
import { UpdateSummaryPointDto } from './dto/update-summary-point.dto';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Class, ClassDocument } from '../classes/schemas/class.schema';

/**
 * Tính rank tier dựa trên tổng điểm và trạng thái.
 * Chỉ xếp hạng khi status = 'locked' và có điểm hợp lệ.
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
  if (totalScore >= 50) return { rank_tier: 'bronze', rank_label: 'Trung Bình' };
  return { rank_tier: 'unranked', rank_label: 'Yếu' };
}

export interface LatestStudentSummaryDto {
  _id: any;
  status: string;
  total_score: number | null;
  grading: string | null;
  rank_tier?: string;
  rank_label?: string;
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

  private async assertCanAccessStudent(studentId: string, requester?: any) {
    const teacherClassIds = await this.getTeacherClassIds(requester);
    if (!teacherClassIds) return;

    const student = await this.studentModel
      .findOne({ _id: studentId, class_id: { $in: teacherClassIds } } as any)
      .select('_id')
      .lean()
      .exec();

    if (!student) {
      throw new ForbiddenException('Bạn không có quyền thao tác bảng điểm của sinh viên ngoài lớp GVCN.');
    }
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
      throw new ForbiddenException('Bạn không có quyền thao tác bảng điểm ngoài lớp GVCN.');
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
      period_id: (periodId && Types.ObjectId.isValid(periodId)) ? new Types.ObjectId(periodId) : null,
    };
  }

  async create(
    createSummaryPointDto: CreateSummaryPointDto,
    requester?: any,
  ): Promise<SummaryPoint> {
    await this.assertCanAccessStudent(createSummaryPointDto.student_id, requester);

    const student = await this.studentModel.findById(createSummaryPointDto.student_id).exec();
    if (!student) {
      throw new NotFoundException(`Student with ID ${createSummaryPointDto.student_id} not found`);
    }
    if (student.status !== 'Studying') {
      throw new BadRequestException('Chỉ sinh viên đang học mới được tạo bảng điểm rèn luyện.');
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
      if (!result) throw new NotFoundException('SummaryPoint not found after save');
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
        throw new ConflictException('Bảng điểm cho học kỳ/kỳ đánh giá này đã tồn tại.');
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

    const roleName = ((requester?.roleName || requester?.role || '') + '').toLowerCase();
    const isAdminOrSupervisor =
      roleName.includes('admin') ||
      roleName.includes('supervisor') ||
      roleName.includes('quản sinh') ||
      roleName.includes('quan sinh');

    if (!isAdminOrSupervisor && classObj.advisor_id?.toString() !== requester?.userId) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên lớp học này.');
    }

    const students = await this.studentModel.find({
      class_id: new Types.ObjectId(classId),
      status: 'Studying'
    }).exec();

    if (students.length === 0) {
      return { success: true, createdCount: 0 };
    }

    const studentIds = students.map(s => s._id);
    const existingSummaries = await this.summaryPointModel.find({
      student_id: { $in: studentIds },
      semester_id: new Types.ObjectId(semesterId),
      period_id: null
    } as any).select('student_id').exec();

    const existingStudentIds = new Set(existingSummaries.map(s => s.student_id.toString()));

    const studentsToInit = students.filter(s => !existingStudentIds.has(s._id.toString()));

    if (studentsToInit.length === 0) {
      return { success: true, createdCount: 0 };
    }

    const insertPayloads = studentsToInit.map(s => ({
      student_id: s._id,
      semester_id: new Types.ObjectId(semesterId),
      period_id: null,
      total_score: 100,
      grading: 'Xuất sắc',
      status: 'draft'
    }));

    await this.summaryPointModel.insertMany(insertPayloads);

    return {
      success: true,
      createdCount: studentsToInit.length
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
    },
  ): Promise<any> {
    const teacherStudentIds = await this.getTeacherStudentIds(requester);
    const filter: any = teacherStudentIds
      ? { student_id: { $in: teacherStudentIds } }
      : {};

    if (query?.semesterId) {
      if (Types.ObjectId.isValid(query.semesterId)) {
        filter.semester_id = query.semesterId;
      } else {
        filter.semester_id = new Types.ObjectId();
      }
    }
    if (query?.studentId) {
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
        studentIdsList = query.studentIds.split(',').map(id => id.trim()).filter(Boolean);
      }
    }

    if (studentIdsList.length > 0) {
      const validObjectIds = studentIdsList
        .filter(id => Types.ObjectId.isValid(id))
        .map(id => new Types.ObjectId(id));
      
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

    const rawPage = query?.page ? Number(query.page) : 1;
    const rawLimit = query?.limit ? Number(query.limit) : 10;
    const page = Math.max(1, isNaN(rawPage) ? 1 : rawPage);
    const limit = Math.max(1, Math.min(100, isNaN(rawLimit) ? 10 : rawLimit));
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.summaryPointModel
        .find(filter)
        .select('-details')
        .populate('student_id')
        .populate('semester_id')
        .populate('period_id')
        .sort({ createdAt: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
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

  async findOne(id: string, requester?: any): Promise<SummaryPoint> {
    await this.assertCanAccessSummary(id, requester);
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
      throw new BadRequestException('Để phê duyệt điểm rèn luyện, vui lòng sử dụng chức năng phê duyệt.');
    }

    if (existingSummary.status === 'locked') {
      throw new BadRequestException('Không thể sửa bảng điểm đã chốt. Vui lòng sử dụng chức năng hủy phê duyệt.');
    }

    if (updateSummaryPointDto.status === 'draft') {
      (updateSummaryPointDto as any).rank_tier = null;
      (updateSummaryPointDto as any).rank_label = null;
      (updateSummaryPointDto as any).rank_locked_at = null;
      (updateSummaryPointDto as any).rank_updated_by = null;
    }

    if (updateSummaryPointDto.student_id) {
      await this.assertCanAccessStudent(updateSummaryPointDto.student_id, requester);
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
    return updated;
  }

  async recomputeTotalScore(summaryId: string): Promise<void> {
    const summary = await this.summaryPointModel.findById(summaryId);
    if (!summary) return;

    const details = summary.details || [];
    if (details.length === 0) return;

    // We need criterionModel to fetch category info.
    // However, criterionModel is not injected in SummariesPointService yet.
    // Instead of doing it here, we will do the calculation using aggregate.
    const aggResult = await this.summaryPointModel.aggregate([
      { $match: { _id: summary._id } },
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
  }

  /**
   * Phê duyệt điểm rèn luyện: khóa các chi tiết điểm, tính lại total_score, grading, rank_tier.
   * Yêu cầu: User phải là Admin hoặc Supervisor.
   */
  async approveGrading(summaryId: string, requester: any): Promise<SummaryPointDocument> {
    const roleName = ((requester?.roleName || requester?.role || '') + '').toLowerCase();
    const isAdminOrSupervisor =
      roleName.includes('admin') ||
      roleName.includes('supervisor') ||
      roleName.includes('quản sinh') ||
      roleName.includes('quan sinh');

    if (!isAdminOrSupervisor) {
      throw new ForbiddenException('Bạn không có quyền phê duyệt bảng điểm rèn luyện.');
    }

    // 1. Kiểm tra quyền truy cập
    await this.assertCanAccessSummary(summaryId, requester);

    // Find the summary from DB. If not found, throw NotFoundException.
    const summary = await this.summaryPointModel.findById(summaryId);
    if (!summary) {
      throw new NotFoundException(`Summary ${summaryId} không tồn tại`);
    }

    // Set the status of all details to 'locked' and calculate final_score
    if (summary.details && summary.details.length > 0) {
      const lockedBy = new Types.ObjectId(requester.userId);
      const lockedAt = new Date();
      for (const detail of summary.details) {
        const oldStatus = detail.status || 'draft';
        detail.status = 'locked';

        const finalScore = detail.gv_score !== null && detail.gv_score !== undefined
          ? detail.gv_score
          : (detail.sv_score !== null && detail.sv_score !== undefined
              ? detail.sv_score
              : (detail.system_score !== null && detail.system_score !== undefined
                  ? detail.system_score
                  : 0));

        detail.final_score = finalScore;
        detail.locked_at = lockedAt;
        detail.locked_by = lockedBy as any;

        detail.log = detail.log || [];
        detail.log.push({
          from_status: oldStatus,
          to_status: 'locked',
          score_before: detail.system_score !== undefined && detail.system_score !== null ? detail.system_score : 0,
          score_after: finalScore,
          count: detail.current_count,
          updated_by: lockedBy as any,
          updated_at: lockedAt,
          reason: 'Phê duyệt rèn luyện bởi ' + (requester.roleName?.toLowerCase().includes('supervisor') ? 'Quản sinh' : 'Admin'),
        });
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
    const { rank_tier, rank_label } = resolveRankTier(recomputedSummary.total_score, 'locked');

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
    return result;
  }

  /**
   * Hủy duyệt điểm rèn luyện: chuyển summary và các detail về draft,
   * reset rank fields, tính toán lại total_score và grading.
   * Yêu cầu: User phải là Admin hoặc Supervisor.
   */
  async cancelApproval(summaryId: string, requester: any): Promise<SummaryPointDocument> {
    // 1. Kiểm tra quyền Admin/Supervisor
    const roleName = ((requester?.roleName || requester?.role || '') + '').toLowerCase();
    const isAdminOrSupervisor =
      roleName.includes('admin') ||
      roleName.includes('supervisor') ||
      roleName.includes('quản sinh') ||
      roleName.includes('quan sinh');

    if (!isAdminOrSupervisor) {
      throw new ForbiddenException('Bạn không có quyền hủy duyệt bảng điểm rèn luyện.');
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
      throw new BadRequestException('Chỉ có thể hủy duyệt bảng điểm rèn luyện đã chốt.');
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
    return result;
  }

  /**
   * Hủy duyệt điểm rèn luyện hàng loạt.
   */
  async cancelApprovalBulk(summaryIds: string[], requester: any): Promise<any[]> {
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
      semester: semester?.semester_name || semester?.name || semester?.title || 'N/A',
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
      throw new BadRequestException('Không thể xóa điểm rèn luyện đã phê duyệt');
    }

    const deleted = await this.summaryPointModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`SummaryPoint with ID ${id} not found`);
    }
    return deleted;
  }

  async generatePdf(
    selectedStudents: any[],
    categories: any[],
    evaluationCounts: any,
    semesterName: string,
    className: string,
    pdfConfig?: any,
  ): Promise<Buffer> {
    // Dynamically require puppeteer at runtime to support backend initialization
    const puppeteer = require('puppeteer');
    const htmlContent = this.generateHtml(
      selectedStudents,
      categories,
      evaluationCounts,
      semesterName,
      className,
      pdfConfig,
    );

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(htmlContent, { waitUntil: 'load' });

      // Render to A4 PDF with full-bleed background colors (margin: 0)
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      });

      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  private generateHtml(
    selectedStudents: any[],
    categories: any[],
    evaluationCounts: any,
    semesterName: string,
    className: string,
    pdfConfig?: any,
  ): string {
    const formatDate = (dateStr?: string) => {
      if (!dateStr) return 'Chưa rõ';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
      } catch {
        return dateStr;
      }
    };

    // Set fallback default config if not provided by the client
    const config = pdfConfig || {
      sectionsOrder: [
        'header',
        'title',
        'student_info',
        'criteria_1_2',
        'criteria_3',
        'summary',
        'signatures',
      ],
      hiddenSections: {},
      themeColor: '#135bec',
      fontFamily: 'Times New Roman',
      fontSize: 'md',
      customTexts: {
        semester: semesterName || 'I - Năm học 2025 - 2026',
        creatorName: 'Trần Thị Bích Ngọc',
        approverName: 'NGƯỜI PHÊ DUYỆT',
        approverTitle: 'XÁC NHẬN CỦA NHÀ TRƯỜNG',
        ubnd: 'ỦY BAN NHÂN DÂN',
        city: 'THÀNH PHỐ HỒ CHÍ MINH',
        school: 'TRƯỜNG CAO ĐẲNG BÁCH KHOA\nNAM SÀI GÒN',
        title: 'PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH, SINH VIÊN',
      },
    };

    const customTexts = config.customTexts || {
      semester: semesterName || 'I - Năm học 2025 - 2026',
      creatorName: 'Trần Thị Bích Ngọc',
      approverName: 'PGS.TS. NGUYỄN KHẮC HÙNG',
      approverTitle: 'XÁC NHẬN CỦA NHÀ TRƯỜNG',
      ubnd: 'ỦY BAN NHÂN DÂN',
      city: 'THÀNH PHỐ HỒ CHÍ MINH',
      school: 'TRƯỜNG CAO ĐẲNG BÁCH KHOA\nNAM SÀI GÒN',
      title: 'PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH, SINH VIÊN',
    };

    const hiddenSections = config.hiddenSections || {};
    const sectionsOrder = config.sectionsOrder || [
      'header',
      'title',
      'student_info',
      'criteria_1_2',
      'criteria_3',
      'summary',
      'signatures',
    ];

    // Helper to generate dynamic colors based on chosen theme
    const getThemeColors = (colorStr: string) => {
      switch (colorStr) {
        case '#10b981': // Emerald
          return {
            primary: '#10b981',
            light: '#ecfdf5',
            border: '#d1fae5',
            text: '#047857',
          };
        case '#475569': // Slate
          return {
            primary: '#475569',
            light: '#f8fafc',
            border: '#e2e8f0',
            text: '#334155',
          };
        case '#991b1b': // Burgundy
          return {
            primary: '#991b1b',
            light: '#fdf2f2',
            border: '#fde8e8',
            text: '#b91c1c',
          };
        case '#135bec': // Blue
        default:
          return {
            primary: '#135bec',
            light: '#eff6ff',
            border: '#dbeafe',
            text: '#1d4ed8',
          };
      }
    };

    const colors = getThemeColors(config.themeColor);

    // Dynamic rendering of each section to HTML
    const renderSectionHtml = (
      sectionName: string,
      student: any,
      counts: any,
    ) => {
      if (hiddenSections[sectionName]) return '';

      switch (sectionName) {
        case 'header':
          return `
            <div class="flex justify-between items-start border-b border-slate-100 pb-5 w-full shrink-0">
              <div class="text-center flex flex-col gap-0.5 w-[320px] shrink-0">
                <p class="font-medium text-[#1a1b1e] text-[13px] uppercase tracking-wide">${customTexts.ubnd || 'ỦY BAN NHÂN DÂN'}</p>
                <p class="font-medium text-[#1a1b1e] text-[13px] uppercase tracking-wide">${customTexts.city || 'THÀNH PHỐ HỒ CHÍ MINH'}</p>
                <p class="font-bold text-[#1a1b1e] text-[13px] uppercase tracking-wide" style="white-space: pre-line">${customTexts.school || 'TRƯỜNG CAO ĐẲNG BÁCH KHOA\nNAM SÀI GÒN'}</p>
              </div>
              <div class="text-center flex flex-col gap-0.5 w-[320px] shrink-0">
                <p class="font-bold text-[#1a1b1e] text-[13px] uppercase tracking-wide">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                <p class="font-bold text-[#1a1b1e] text-[13px] tracking-wide">Độc lập - Tự do - Hạnh phúc</p>
              </div>
            </div>
          `;

        case 'title':
          return `
            <div class="text-center py-5 flex flex-col gap-1 w-full mt-1 shrink-0">
              <h2 class="font-bold text-slate-900 text-[14px] tracking-tight uppercase leading-snug">
                ${customTexts.title || 'PHIẾU ĐÁNH GIÁ KẾT QUẢ RÈN LUYỆN HỌC SINH, SINH VIÊN'}
              </h2>
              <p class="font-medium text-slate-500 text-[13px] italic">
                Học kỳ: ${customTexts.semester}
              </p>
            </div>
          `;

        case 'student_info':
          return `
            <div class="bg-[#f8fafc] border border-slate-100 rounded-2xl w-full mb-2 shrink-0" style="padding: 18px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 32px; row-gap: 10px;">
              <div class="flex items-center gap-2 text-[13px]">
                <span class="font-semibold text-slate-500" style="min-width: 110px; display: inline-block;">Họ và tên HSSV:</span>
                <span class="font-bold text-slate-800">${student.name}</span>
              </div>
              <div class="flex items-center gap-2 text-[13px]">
                <span class="font-semibold text-slate-500" style="min-width: 90px; display: inline-block;">Ngày sinh:</span>
                <span class="font-medium text-slate-800">${formatDate(student.dob) || '13/02/2004'}</span>
              </div>
              <div class="flex items-center gap-2 text-[13px]">
                <span class="font-semibold text-slate-500" style="min-width: 110px; display: inline-block;">Lớp học:</span>
                <span class="font-semibold text-slate-800">${className}</span>
              </div>
              <div class="flex items-center gap-2 text-[13px]">
                <span class="font-semibold text-slate-500" style="min-width: 90px; display: inline-block;">Mã HSSV:</span>
                <span class="font-bold text-slate-800 font-mono">${student.id}</span>
              </div>
            </div>
          `;

        case 'criteria_1_2':
          let allCategoriesHtml = '';
          categories.forEach((cat) => {
            let catScore = 0;
            cat.items.forEach((item: any) => {
              const count = counts[item.id] || 0;
              const maxScore = item.maxScore || item.max_score || 10;
              const minScore = item.minScore || item.min_score || 0;
              const criterionScore = item.pointsPerUnit >= 0
                ? Math.max(minScore, Math.min(maxScore, count * item.pointsPerUnit))
                : Math.max(-maxScore, Math.min(0, count * item.pointsPerUnit));
              catScore += criterionScore;
            });
            const clampedScore = Math.max(0, Math.min(cat.maxPoints, catScore));

            let itemsTrHtml = '';
            cat.items.forEach((item: any) => {
              const count = counts[item.id] || 0;
              const maxScore = item.maxScore || item.max_score || 10;
              const minScore = item.minScore || item.min_score || 0;
              const criterionScore = item.pointsPerUnit >= 0
                ? Math.max(minScore, Math.min(maxScore, count * item.pointsPerUnit))
                : Math.max(-maxScore, Math.min(0, count * item.pointsPerUnit));
              const sign = criterionScore > 0 ? '+' : '';
              itemsTrHtml += `
                <tr class="hover:bg-slate-50/50">
                  <td class="px-4 py-2.5 leading-relaxed text-left">${item.name}</td>
                  <td class="px-4 py-2.5 text-right font-bold text-[var(--pdf-primary)] font-mono text-[12.5px]">
                    ${sign}${criterionScore.toFixed(1)}
                  </td>
                </tr>
              `;
            });

            allCategoriesHtml += `
              <div class="border border-slate-200/80 rounded-xl overflow-hidden shadow-sm w-full mb-3 break-inside-avoid" style="break-inside: avoid; page-break-inside: avoid; background-color: white;">
                <div class="bg-[#f8fafc] border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between w-full gap-2">
                  <span class="font-bold text-slate-800 text-[12.5px] uppercase">
                    ${cat.code ? `${cat.code}. ` : ''}${cat.title}
                  </span>
                  <div class="flex flex-col items-end text-right shrink-0 gap-2">
                    <span class="font-bold text-[#5f6368] text-[9.5px] tracking-wide uppercase leading-none">
                      Điểm đạt: ${clampedScore}đ
                    </span>
                    <span class="font-bold text-slate-400 text-[8.5px] tracking-wide uppercase leading-none">
                      Tối đa: ${cat.maxPoints}đ
                    </span>
                  </div>
                </div>
                <table class="w-full text-left border-collapse">
                  <thead>
                    <tr class="bg-white border-b border-slate-100">
                      <th class="px-4 py-1.5 text-[9.5px] font-bold text-slate-400 uppercase w-[520px]">Nội dung đánh giá</th>
                      <th class="px-4 py-1.5 text-[9.5px] font-bold text-slate-400 uppercase text-right w-[110px]">Điểm đạt</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100 text-[12px] text-slate-700 font-medium">
                    ${itemsTrHtml}
                  </tbody>
                </table>
              </div>
            `;
          });
          return `<div class="flex flex-col gap-4 w-full">${allCategoriesHtml}</div>`;

        case 'criteria_3':
          // Đã được gộp toàn bộ vào criteria_1_2 phía trên để tự động phân trang tự nhiên giống frontend
          return '';

        case 'summary':
          return `
            <div class="bg-[var(--pdf-light)] border border-[var(--pdf-border)] rounded-2xl flex items-center justify-between w-full mt-2 shadow-sm shrink-0" style="padding: 18px 24px;">
              <div class="flex flex-col gap-1 text-left">
                <span class="font-bold text-slate-800 text-[14px]">TỔNG ĐIỂM RÈN LUYỆN CHUNG:</span>
                <span class="text-[11.5px] text-[var(--pdf-text)] font-semibold">Tự động cộng các danh mục điểm đạt</span>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                <span class="font-black text-[var(--pdf-primary)] text-[22px] font-mono leading-none">
                  ${student.score} / 100đ
                </span>
                <span class="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[var(--pdf-border)] text-[var(--pdf-text)] uppercase tracking-wide">
                  Xếp loại: ${
                    student.score >= 90
                      ? 'Xuất sắc'
                      : student.score >= 80
                        ? 'Tốt'
                        : student.score >= 70
                          ? 'Khá'
                          : student.score >= 50
                            ? 'Trung bình'
                            : 'Yếu'
                  }
                </span>
              </div>
            </div>
          `;

        case 'signatures':
          return `
            <div class="mt-8 pt-6 w-full border-t border-dashed border-slate-200 shrink-0">
              <div class="grid grid-cols-2 gap-12 w-full text-center">
                <div class="flex flex-col items-center gap-14">
                  <p class="font-bold text-slate-800 text-[12.5px] uppercase tracking-wide">HỌC SINH, SINH VIÊN</p>
                  <div class="flex flex-col gap-1">
                    <p class="font-black text-slate-800 text-[13px]">${student.name}</p>
                    <p class="text-[10px] text-slate-400 italic font-semibold">(Ký và ghi rõ họ tên)</p>
                  </div>
                </div>
                <div class="flex flex-col items-center gap-14">
                  <p class="font-bold text-slate-800 text-[12.5px] uppercase tracking-wide">${customTexts.approverTitle}</p>
                  <div class="flex flex-col gap-1">
                    <p class="font-black text-slate-800 text-[13px] uppercase">${customTexts.approverName}</p>
                    <p class="text-[10px] text-slate-400 italic font-semibold">(Ký và ghi rõ họ tên)</p>
                  </div>
                </div>
              </div>
            </div>
          `;

        default:
          return '';
      }
    };

    let studentsHtml = '';

    selectedStudents.forEach((student) => {
      const counts = evaluationCounts[student.id] || {};

      // Aggregate all configuration sections into a single flow with auto-page break rules
      let contentHtml = '';
      sectionsOrder.forEach((sectionName: string) => {
        const sectionHtml = renderSectionHtml(sectionName, student, counts);
        if (sectionHtml && sectionHtml.trim() !== '') {
          contentHtml += `
            <div class="break-inside-avoid">
              ${sectionHtml}
            </div>
          `;
        }
      });

      studentsHtml += `
        <div class="student-container page-break-after-always">
          <!-- ====== BẢN IN CO GIÃN TỰ ĐỘNG CHUẨN A4 ====== -->
          <div class="page bg-white relative box-border">
            <!-- Background Decorative -->
            <div class="absolute inset-0 opacity-[0.03] pointer-events-none z-0">
              <div class="absolute bg-[var(--pdf-primary)] blur-[80px] bottom-[-150px] left-[-100px] rounded-full w-[350px] h-[350px]"></div>
            </div>

            <div class="relative z-10 flex flex-col justify-between min-h-full">
              <div class="flex flex-col gap-5 text-left">
                ${contentHtml}
              </div>

              <!-- Footer chung cho phiếu điểm cố định ở cuối mỗi trang in -->
              <div class="print-footer">
                <span class="font-semibold text-slate-400 text-[9px] tracking-wider uppercase">
                  EDUPOINT MANAGEMENT SYSTEM - LƯU HÀNH NỘI BỘ
                </span>
                <span class="font-bold text-slate-700 text-[10.5px]">Phiếu điểm rèn luyện HSSV</span>
              </div>
            </div>
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
        <!-- Google Fonts: Inter, Roboto, Times New Roman CDN -->
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Roboto:ital,wght@0,400;0,500;0,700;0,900;1,400&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400&display=swap" rel="stylesheet">
        <link href="https://fonts.cdnfonts.com/css/times-new-roman" rel="stylesheet">
        <!-- CDN Tailwind CSS v4 -->
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          :root {
            --pdf-primary: ${colors.primary};
            --pdf-light: ${colors.light};
            --pdf-border: ${colors.border};
            --pdf-text: ${colors.text};
          }
          body {
            font-family: ${
              config.fontFamily === 'Times New Roman'
                ? "'Times New Roman', Times, serif"
                : config.fontFamily === 'Inter'
                  ? "'Inter', sans-serif"
                  : config.fontFamily === 'Roboto'
                    ? "'Roboto', sans-serif"
                    : "'Playfair Display', serif"
            };
            margin: 0;
            padding: 0;
            background-color: #f1f5f9;
            -webkit-print-color-adjust: exact;
            font-size: ${config.fontSize === 'sm' ? '12px' : config.fontSize === 'lg' ? '16px' : '14px'};
          }
          
          /* Override color classes on the fly for compatibility */
          .bg-\\[\\#135bec\\] { background-color: var(--pdf-primary) !important; }
          .text-\\[\\#135bec\\] { color: var(--pdf-primary) !important; }
          .border-\\[\\#135bec\\] { border-color: var(--pdf-primary) !important; }
          
          .text-\\[\\#1a1b1e\\] { color: #1a1b1e !important; }
          .text-\\[\\#5f6368\\] { color: #5f6368 !important; }
          
          .bg-\\[\\#f8fafc\\] { background-color: #f8fafc !important; }
          .bg-\\[\\#eff6ff\\] { background-color: var(--pdf-light) !important; }
          
          .text-slate-900 { color: #0f172a !important; }
          .text-slate-800 { color: #1e293b !important; }
          .text-slate-700 { color: #334155 !important; }
          .text-slate-500 { color: #64748b !important; }
          .text-slate-400 { color: #94a3b8 !important; }
          
          .border-slate-100 { border-color: #f1f5f9 !important; }
          .border-slate-200 { border-color: #e2e8f0 !important; }
          .border-slate-200\\/80 { border-color: #e2e8f0 !important; }
          
          .bg-blue-50 { background-color: var(--pdf-light) !important; }
          .bg-blue-100 { background-color: var(--pdf-border) !important; }
          .border-blue-100 { border-color: var(--pdf-border) !important; }
          .text-blue-600 { color: var(--pdf-primary) !important; }
          .text-blue-700 { color: var(--pdf-primary) !important; }
          .text-blue-800 { color: var(--pdf-text) !important; }
          .text-blue-900 { color: var(--pdf-text) !important; }
          
          .page {
            width: 210mm;
            min-height: 297mm;
            padding: 15mm 16mm 22mm 16mm;
            box-sizing: border-box;
            background-color: white;
            position: relative;
          }
          .print-footer {
            position: absolute;
            bottom: 10mm;
            left: 16mm;
            right: 16mm;
            border-top: 1px solid #e2e8f0;
            padding-top: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            background-color: white;
            z-index: 50;
          }
          .break-inside-avoid {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .page-break-after-always {
            page-break-after: always;
            break-after: page;
          }
          @media print {
            body {
              background-color: white;
            }
            .page {
              width: 210mm;
              min-height: 297mm;
              padding: 15mm 16mm 22mm 16mm;
              margin: 0;
              box-shadow: none;
            }
            .print-footer {
              position: fixed;
              bottom: 10mm;
              left: 16mm;
              right: 16mm;
              border-top: 1px solid #e2e8f0;
              padding-top: 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              background-color: white;
              z-index: 9999;
            }
          }
        </style>
      </head>
      <body>
        <div class="flex flex-col items-center gap-8 py-8 no-print print:p-0 print:gap-0">
          ${studentsHtml}
        </div>
      </body>
      </html>
    `;
  }
}
