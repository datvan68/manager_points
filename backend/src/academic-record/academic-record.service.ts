import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
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
import { BulkCreateAcademicRecordDto } from './dto/bulk-create-academic-record.dto';
import { UpdateAcademicRecordDto } from './dto/update-academic-record.dto';
import { Student } from '../students/schemas/student.schema';
import { Class } from '../classes/schemas/class.schema';
import { getRequesterRoleName, isStudent, isTeacher } from '../auth/utils/role.util';
import { SummariesPointService } from '../summaries-point/summaries-point.service';

@Injectable()
export class AcademicRecordService {
  constructor(
    @InjectModel(AcademicRecord.name)
    private readonly academicRecordModel: Model<AcademicRecordDocument>,
    @InjectModel(SummaryPoint.name)
    private readonly summaryPointModel: Model<SummaryPointDocument>,
    @InjectModel(Criterion.name)
    private readonly criterionModel: Model<CriterionDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<any>,
    @InjectModel(Class.name)
    private readonly classModel: Model<any>,
    @Inject(forwardRef(() => SummariesPointService))
    private readonly summariesPointService: SummariesPointService,
  ) { }

  private async safeSync(record: any): Promise<void> {
    if (!record) return;
    const studentId = record.student_id ? record.student_id.toString() : '';
    const semesterId = record.semester_id ? record.semester_id.toString() : '';
    const criterionId = record.criterion_id ? record.criterion_id.toString() : '';
    
    if (studentId && semesterId && criterionId) {
      await this.syncStudentCriterionScore(studentId, semesterId, criterionId);
    }
  }

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
      if (summary.status === 'locked') {
        continue;
      }
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
        }
        details[detailIndex] = detail;
      }

      summary.details = details;
      summary.markModified('details');
      await summary.save();
      await this.summariesPointService.recomputeTotalScore(summary._id.toString());
    }
  }


  async create(
    createAcademicRecordDto: CreateAcademicRecordDto,
    requester?: any,
  ): Promise<AcademicRecord> {
    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id.toString());
        const student = await this.studentModel.findById(createAcademicRecordDto.student_id).select('class_id').exec();
        if (!student || !student.class_id || !classIds.includes(student.class_id.toString())) {
          throw new ForbiddenException('Bạn không có quyền đánh giá sinh viên ngoài lớp phụ trách.');
        }
      }
    }

    const createdRecord = new this.academicRecordModel(createAcademicRecordDto);
    const saved = await createdRecord.save();

    // Sync points to SummaryPoints
    await this.safeSync(saved);

    return saved.populate([
      { path: 'criterion_id' },
      { path: 'student_id' },
      { path: 'semester_id' },
      { path: 'daily_report_id' },
      { path: 'recorded_by', populate: { path: 'role' } },
    ]);
  }

  async bulkCreate(
    bulkCreateDto: BulkCreateAcademicRecordDto,
    requester?: any,
  ): Promise<any> {
    const { records } = bulkCreateDto;
    if (!records || records.length === 0) {
      return { batchId: Date.now().toString(), acceptedCount: 0, insertedCount: 0, duplicatedCount: 0, failedItems: [], createdRecordIds: [], groupsSynced: 0 };
    }

    let validStudentIds: Set<string> | null = null;
    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      // Nếu là Teacher, chỉ được ghi nhận cho sinh viên lớp mình
      if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id);
        const students = await this.studentModel.find({ class_id: { $in: classIds } }).select('_id').exec();
        validStudentIds = new Set(students.map(s => s._id.toString()));
      }
    }

    const validRecords = [];
    const failedItems = [];
    const idempotencyMap = new Map<string, boolean>();
    
    for (const record of records) {
      // Validate RBAC
      if (validStudentIds && !validStudentIds.has(record.student_id.toString())) {
        failedItems.push({ record, reason: 'Không có quyền đánh giá sinh viên này' });
        continue;
      }
      
      // Lọc bỏ trùng lặp trong cùng batch
      if (record.idempotency_key) {
        if (idempotencyMap.has(record.idempotency_key)) {
          failedItems.push({ record, reason: 'Trùng idempotency_key trong cùng batch' });
          continue; 
        }
        idempotencyMap.set(record.idempotency_key, true);
      }
      validRecords.push(record);
    }

    if (validRecords.length === 0) {
      return {
        batchId: Date.now().toString(),
        acceptedCount: records.length,
        insertedCount: 0,
        duplicatedCount: 0,
        failedItems,
        createdRecordIds: [],
        groupsSynced: 0
      };
    }

    // Insert batch records với ordered: false để bỏ qua duplicate keys
    const insertOps = validRecords.map(record => ({
      insertOne: {
        document: record
      }
    }));

    let result;
    let duplicatedCount = 0;
    try {
      result = await this.academicRecordModel.bulkWrite(insertOps as any, { ordered: false });
    } catch (err) {
      if (err.code !== 11000 && !err.message.includes('11000')) {
        throw err;
      }
      // Dù có lỗi 11000 thì các document không bị trùng vẫn được insert vì ordered: false
      result = err.result || err;
      duplicatedCount = err.writeErrors ? err.writeErrors.length : (validRecords.length - (result.insertedCount || result.nInserted || 0));
    }

    const insertedCount = result?.insertedCount || result?.nInserted || 0;
    const createdRecordIds = result?.insertedIds ? Object.values(result.insertedIds) : [];

    // Gom nhóm theo student_id + semester_id + criterion_id để sync
    const groups = new Set<string>();
    for (const record of validRecords) {
      const key = `${record.student_id}_${record.semester_id}_${record.criterion_id}`;
      groups.add(key);
    }

    // Chạy sync point cho từng nhóm, giới hạn concurrency
    const syncFuncs = Array.from(groups).map(groupKey => {
      const [studentId, semesterId, criterionId] = groupKey.split('_');
      return () => this.syncStudentCriterionScore(studentId, semesterId, criterionId);
    });
    
    const chunkSize = 10;
    for (let i = 0; i < syncFuncs.length; i += chunkSize) {
      const chunk = syncFuncs.slice(i, i + chunkSize);
      await Promise.all(chunk.map(f => f()));
    }

    return {
      batchId: Date.now().toString(),
      acceptedCount: records.length,
      insertedCount,
      duplicatedCount,
      failedItems,
      createdRecordIds,
      groupsSynced: groups.size,
    };
  }

  async findAll(requester?: any): Promise<AcademicRecord[]> {
    const filter: any = { status: 'active', is_deleted: { $ne: true } };

    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      
      // Nếu là Student, chỉ trả về các bản ghi thuộc student của user đó
      if (roleName.includes('student')) {
        const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(requester.userId) }).exec();
        if (!student) {
          return []; // Không có sinh viên liên kết, không trả về gì
        }
        filter.student_id = student._id;
      } 
      // Nếu là Teacher, chỉ trả về các bản ghi thuộc class của teacher phụ trách
      else if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id);
        
        const students = await this.studentModel.find({ class_id: { $in: classIds } }).select('_id').exec();
        const studentIds = students.map(s => s._id);
        
        filter.student_id = { $in: studentIds };
      }
      // Admin và Supervisor có quyền xem toàn bộ, không cần filter thêm
    }

    return this.academicRecordModel
      .find(filter)
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
  }

  async findDeleted(requester?: any): Promise<AcademicRecord[]> {
    const filter: any = { $or: [{ status: 'inactive' }, { is_deleted: true }] };

    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('student')) {
        const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(requester.userId) }).exec();
        if (!student) return [];
        filter.student_id = student._id;
      } else if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id);
        const students = await this.studentModel.find({ class_id: { $in: classIds } }).select('_id').exec();
        const studentIds = students.map(s => s._id);
        filter.student_id = { $in: studentIds };
      }
    }

    return this.academicRecordModel
      .find(filter)
      .populate('criterion_id')
      .populate('student_id')
      .populate('semester_id')
      .populate('daily_report_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
  }

  async findOne(id: string, requester?: any): Promise<AcademicRecord> {
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

    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('student')) {
        const studentEmail = record.student_id && typeof record.student_id === 'object' ? (record.student_id as any).email : '';
        if (!requester.email || !studentEmail || requester.email.toLowerCase() !== studentEmail.toLowerCase()) {
            throw new ForbiddenException('Bạn không có quyền truy cập ghi nhận rèn luyện của sinh viên khác.');
        }
      } else if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id.toString());
        const studentClassId = record.student_id && typeof record.student_id === 'object' ? (record.student_id as any).class_id?.toString() : null;
        if (!studentClassId || !classIds.includes(studentClassId)) {
            throw new ForbiddenException('Bạn không có quyền truy cập sinh viên ngoài lớp phụ trách.');
        }
      }
    }

    return record;
  }

  async findByStudentId(studentId: string, requester?: any): Promise<AcademicRecord[]> {
    if (!Types.ObjectId.isValid(studentId)) {
      return [];
    }

    if (requester) {
      const roleName = getRequesterRoleName(requester);
      const isRequesterStudent = roleName === 'Student';
      const isRequesterTeacher = roleName === 'Teacher';

      if (isRequesterStudent) {
        const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(requester.userId) }).exec();
        if (!student || student._id.toString() !== studentId) {
          throw new ForbiddenException('Bạn không có quyền truy cập ghi nhận rèn luyện của sinh viên khác.');
        }
      } else if (isRequesterTeacher) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id.toString());
        
        const student = await this.studentModel.findById(studentId).exec();
        if (!student || !student.class_id || !classIds.includes(student.class_id.toString())) {
          throw new ForbiddenException('Bạn không có quyền truy cập sinh viên ngoài lớp phụ trách.');
        }
      }
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

  async findByDailyReportId(dailyReportId: string, includeDeleted: boolean = false, requester?: any): Promise<AcademicRecord[]> {
    if (!Types.ObjectId.isValid(dailyReportId)) {
      return [];
    }
    const query: any = includeDeleted
      ? { daily_report_id: new Types.ObjectId(dailyReportId) }
      : { daily_report_id: new Types.ObjectId(dailyReportId), status: 'active', is_deleted: { $ne: true } };

    if (requester) {
      const roleName = (requester.roleName || '').toLowerCase();
      if (roleName.includes('student')) {
        const student = await this.studentModel.findOne({ user_id: new Types.ObjectId(requester.userId) }).exec();
        if (!student) return [];
        query.student_id = student._id;
      } else if (roleName.includes('teacher') || roleName.includes('advisor') || roleName.includes('giảng viên')) {
        const classes = await this.classModel.find({ advisor_id: requester.userId }).select('_id').exec();
        const classIds = classes.map(c => c._id);
        const students = await this.studentModel.find({ class_id: { $in: classIds } }).select('_id').exec();
        const studentIds = students.map(s => s._id);
        query.student_id = { $in: studentIds };
      }
    }

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
    requester?: any,
    bypassDailyReportCheck: boolean = false,
  ): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const oldRecord = await this.academicRecordModel.findOne({ _id: id, status: 'active', is_deleted: { $ne: true } })
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!oldRecord) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    if (oldRecord.daily_report_id && !bypassDailyReportCheck) {
      throw new BadRequestException(
        'Ghi nhận này thuộc báo cáo điểm danh ngày, không thể chỉnh sửa trực tiếp. Vui lòng chỉnh sửa qua báo cáo ngày tương ứng.',
      );
    }

    if (!bypassDailyReportCheck && requester) {
      this.checkHierarchyPermission(oldRecord, requester);
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
    await this.safeSync(oldRecord);

    // Sync new key if changed
    const oldStudent = oldRecord.student_id ? oldRecord.student_id.toString() : '';
    const oldSemester = oldRecord.semester_id ? oldRecord.semester_id.toString() : '';
    const oldCriterion = oldRecord.criterion_id ? oldRecord.criterion_id.toString() : '';
    
    const newStudent = updated.student_id ? updated.student_id.toString() : '';
    const newSemester = updated.semester_id ? updated.semester_id.toString() : '';
    const newCriterion = updated.criterion_id ? updated.criterion_id.toString() : '';

    if (oldStudent !== newStudent || oldSemester !== newSemester || oldCriterion !== newCriterion) {
      await this.safeSync(updated);
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

    if (!bypassDailyReportCheck) {
      this.checkHierarchyPermission(record, requester);
    }

    const updatePayload: any = { status: 'inactive', is_deleted: true };
    if (record.idempotency_key) {
      updatePayload.idempotency_key = `${record.idempotency_key}_deleted_${Date.now()}`;
    }

    const deleted = await this.academicRecordModel.findByIdAndUpdate(
      id,
      updatePayload,
      { returnDocument: 'after' },
    ).exec();

    if (!deleted) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    // Sync score update
    await this.safeSync(deleted);

    return deleted;
  }

  async restore(id: string, requester?: any): Promise<AcademicRecord> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    const record = await this.academicRecordModel.findOne({ _id: id, $or: [{ status: 'inactive' }, { is_deleted: true }] })
      .populate('student_id')
      .populate({ path: 'recorded_by', populate: { path: 'role' } })
      .exec();
    if (!record) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found trong thùng rác`);
    }

    if (requester) {
      this.checkHierarchyPermission(record, requester);
    }

    record.status = 'active';
    record.is_deleted = false;
    const saved = await record.save();

    // Sync score update
    await this.safeSync(saved);

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

    if (!bypassDailyReportCheck) {
      this.checkHierarchyPermission(record, requester);
    }

    const deleted = await this.academicRecordModel.findByIdAndDelete(id).exec();
    if (!deleted) {
      throw new NotFoundException(`AcademicRecord with ID ${id} not found`);
    }

    // Sync score update
    await this.safeSync(deleted);

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
