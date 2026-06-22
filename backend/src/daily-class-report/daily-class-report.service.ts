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

  async findAll(
    query?: {
      page?: number;
      limit?: number;
      classId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
    requester?: any,
  ): Promise<any> {
    let page: number | undefined;
    let limit: number | undefined;
    let classId: string | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;
    let search: string | undefined;
    let actualRequester = requester;

    if (query && ('roleName' in query || 'userId' in query || 'role' in query || 'username' in query)) {
      actualRequester = query;
    } else if (query) {
      page = query.page;
      limit = query.limit;
      classId = query.classId;
      startDate = query.startDate;
      endDate = query.endDate;
      search = query.search;
    }

    const scopeFilter = await this.getScopeFilter(actualRequester);
    const filter: any = { is_delete: { $ne: true }, ...scopeFilter };

    if (classId && Types.ObjectId.isValid(classId)) {
      filter.class_id = new Types.ObjectId(classId);
    }

    if (startDate || endDate) {
      filter.report_date = {};
      if (startDate) {
        filter.report_date.$gte = new Date(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        filter.report_date.$lte = new Date(`${endDate}T23:59:59.999Z`);
      }
    }

    if (search) {
      filter.$or = [
        { teacher_name: { $regex: search, $options: 'i' } },
        { class_notes: { $regex: search, $options: 'i' } }
      ];
    }

    const isPaginationRequested = page !== undefined || limit !== undefined;

    const academicRecordModel = this.dailyClassReportModel.db.model('AcademicRecord');

    if (isPaginationRequested) {
      const p = page || 1;
      const l = limit || 10;

      const [reports, total] = await Promise.all([
        this.dailyClassReportModel
          .find(filter)
          .populate('class_id')
          .populate('reported_by', 'user_name email')
          .skip((p - 1) * l)
          .limit(l)
          .sort({ report_date: -1 })
          .exec(),
        this.dailyClassReportModel.countDocuments(filter).exec()
      ]);

      const reportIds = reports.map(r => r._id);
      const counts = await academicRecordModel.aggregate([
        {
          $match: {
            daily_report_id: { $in: reportIds },
            status: 'active',
            is_deleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: { daily_report_id: '$daily_report_id', student_id: '$student_id' }
          }
        },
        {
          $group: {
            _id: '$_id.daily_report_id',
            recordedStudentsCount: { $sum: 1 }
          }
        }
      ]);
      const countMap = new Map(counts.map(c => [c._id.toString(), c.recordedStudentsCount]));
      const reportsWithCount = reports.map(r => {
        const robj = (r.toObject ? r.toObject() : r) as any;
        robj.recordedStudentsCount = countMap.get(r._id.toString()) || 0;
        return robj;
      });

      return {
        data: reportsWithCount,
        meta: {
          total,
          page: p,
          limit: l,
          totalPages: Math.ceil(total / l)
        }
      };
    } else {
      const reports = await this.dailyClassReportModel
        .find(filter)
        .populate('class_id')
        .populate('reported_by', 'user_name email')
        .sort({ report_date: -1 })
        .exec();

      const reportIds = reports.map(r => r._id);
      const counts = await academicRecordModel.aggregate([
        {
          $match: {
            daily_report_id: { $in: reportIds },
            status: 'active',
            is_deleted: { $ne: true }
          }
        },
        {
          $group: {
            _id: { daily_report_id: '$daily_report_id', student_id: '$student_id' }
          }
        },
        {
          $group: {
            _id: '$_id.daily_report_id',
            recordedStudentsCount: { $sum: 1 }
          }
        }
      ]);
      const countMap = new Map(counts.map(c => [c._id.toString(), c.recordedStudentsCount]));
      
      return reports.map(r => {
        const robj = (r.toObject ? r.toObject() : r) as any;
        robj.recordedStudentsCount = countMap.get(r._id.toString()) || 0;
        return robj;
      });
    }
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

  async importClassRecords(
    rows: any[],
    requester: any,
    commit: boolean = false,
  ): Promise<any> {
    const classModel = this.dailyClassReportModel.db.model('Class');
    const studentModel = this.dailyClassReportModel.db.model('Student');
    const criterionModel = this.dailyClassReportModel.db.model('Criterion');
    const semesterModel = this.dailyClassReportModel.db.model('Semester');
    const summaryPointModel = this.dailyClassReportModel.db.model('SummaryPoint');
    const evaluationDetailModel = this.dailyClassReportModel.db.model('EvaluationDetail');
    const academicRecordModel = this.dailyClassReportModel.db.model('AcademicRecord');

    const normalizeText = (value: unknown) =>
      (value ?? '')
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ');

    const getObjectId = (value: any): string => {
      if (!value) return '';
      if (typeof value === 'string') return value;
      return value._id || value.id || '';
    };

    const getDateKey = (value: string) => value.split('T')[0];

    const isAbsentCriterion = (criterion: any) =>
      normalizeText(criterion?.criterion_name).includes('vang');

    // 1. Gather all class codes, student codes
    const classCodes = Array.from(new Set(rows.map(r => {
      const code = r['Ma lop'] || r['Mã lớp'] || r['class_code'];
      return code ? code.toString().trim() : '';
    }).filter(Boolean)));

    const studentCodes = Array.from(new Set(rows.map(r => {
      const code = r['Ma sinh vien'] || r['Mã SV'] || r['student_code'];
      return code ? code.toString().trim() : '';
    }).filter(Boolean)));

    // 2. Query references
    const classes = (await classModel.find({
      $or: [
        { class_code: { $in: classCodes } },
        { class_name: { $in: classCodes } }
      ]
    }).lean().exec()) as any[];
    const classMap = new Map();
    classes.forEach(c => {
      classMap.set(c._id.toString(), c);
      classMap.set(normalizeText(c.class_code), c);
      classMap.set(normalizeText(c.class_name), c);
    });

    const students = (await studentModel.find({ student_code: { $in: studentCodes } }).lean().exec()) as any[];
    const studentMap = new Map(students.map(s => [normalizeText(s.student_code), s]));

    const criteria = (await criterionModel.find().lean().exec()) as any[];
    const criteriaMap = new Map();
    criteria.forEach(c => {
      criteriaMap.set(c._id.toString(), c);
      criteriaMap.set(normalizeText(c.criterion_code), c);
      criteriaMap.set(normalizeText(c.criterion_name), c);
    });

    const semesters = (await semesterModel.find().lean().exec()) as any[];
    const activeSem = semesters.find((ss: any) => ss.status === 'active');
    if (!activeSem) {
      return { success: false, errors: [{ row: 0, reason: 'Không có học kỳ active. Vui lòng cấu hình học kỳ active trước khi import.' }], count: 0 };
    }

    const currentUserId = requester ? requester.userId : null;
    if (!currentUserId) {
      return { success: false, errors: [{ row: 0, reason: 'Không xác định được người dùng đăng nhập để tạo báo cáo' }], count: 0 };
    }

    // Existing daily reports for the classes in the file
    const classIds = classes.map(c => c._id);
    const existingReports = await this.dailyClassReportModel.find({ class_id: { $in: classIds } } as any).lean().exec();
    const existingReportKeys = new Set(
      existingReports.map((report: any) => `${getObjectId(report.class_id)}||${getDateKey(report.report_date.toISOString())}`)
    );

    const errors: any[] = [];
    const seenRecordKeys = new Map<string, number>();
    const groups = new Map<string, { rows: any[]; classObj: any; reportDate: string; teacherName: string }>();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2;
      const classCode = (row['Ma lop'] || row['Mã lớp'] || row['class_code'] || '').toString().trim();
      const dateRaw = row['Ngay bao cao'] || row['Ngày báo cáo'] || row['report_date'];
      const teacher = (row['Giang vien ghi nhan'] || row['Giảng viên'] || row['teacher'] || '').toString().trim();
      const studentCode = (row['Ma sinh vien'] || row['Mã SV'] || row['student_code'] || '').toString().trim();
      const criterionRaw = row['Tieu chi'] || row['Tiêu chí'] || row['criterion'] || '';
      const noteClass = row['Ghi chu lop'] || row['Ghi chú lớp'] || row['class_note'] || '';
      const noteRecord = row['Ghi chu ghi nhan'] || row['Ghi chú ghi nhận'] || row['record_note'] || '';
      const statusRaw = row['Trang thai'] || row['Trạng thái'] || row['status'];

      if (!classCode) { errors.push({ row: rowNumber, reason: 'Thiếu Mã lớp' }); continue; }
      if (!teacher) { errors.push({ row: rowNumber, reason: 'Thiếu Giảng viên' }); continue; }
      if (!studentCode) { errors.push({ row: rowNumber, reason: 'Thiếu Mã sinh viên' }); continue; }
      if (!criterionRaw) { errors.push({ row: rowNumber, studentCode, reason: 'Thiếu Tiêu chí' }); continue; }
      if (dateRaw === undefined || dateRaw === null || dateRaw === '') { errors.push({ row: rowNumber, studentCode, reason: 'Thiếu Ngày báo cáo' }); continue; }

      // resolve class
      const foundClass = classMap.get(normalizeText(classCode)) || classMap.get(classCode);
      if (!foundClass) { errors.push({ row: rowNumber, studentCode, reason: `Không tìm thấy lớp: ${classCode}` }); continue; }

      // resolve student
      const foundStudent = studentMap.get(normalizeText(studentCode));
      if (!foundStudent) { errors.push({ row: rowNumber, studentCode, reason: `Không tìm thấy sinh viên: ${studentCode}` }); continue; }

      // student must be Studying
      if (foundStudent.status !== 'Studying') {
        errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Sinh viên không ở trạng thái "Đang học" (Trạng thái hiện tại: ${foundStudent.status})` });
        continue;
      }

      // student must belong to class
      const studentClassId = getObjectId(foundStudent.class_id);
      if (studentClassId !== foundClass._id.toString()) {
        errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Sinh viên không thuộc lớp ${classCode}` });
        continue;
      }

      // resolve criterion
      const critName = criterionRaw.toString().trim();
      const foundCriterion = criteriaMap.get(normalizeText(critName)) || criteriaMap.get(critName);
      if (!foundCriterion) { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Không tìm thấy tiêu chí: ${critName}` }); continue; }

      // parse report date
      let reportDateIso = '';
      if (typeof dateRaw === 'number') {
        const js = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
        if (isNaN(js.getTime())) { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Ngày báo cáo không hợp lệ: ${dateRaw}` }); continue; }
        reportDateIso = js.toISOString();
      } else {
        const s = dateRaw.toString().trim();
        const dmy = /^([0-9]{1,2})[\/\-]([0-9]{1,2})[\/\-]([0-9]{4})$/;
        const m = s.match(dmy);
        if (m) {
          const day = parseInt(m[1],10), month = parseInt(m[2],10)-1, year = parseInt(m[3],10);
          const parsed = new Date(year, month, day);
          if (isNaN(parsed.getTime()) || parsed.getDate() !== day) { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Ngày báo cáo không tồn tại: ${s}` }); continue; }
          reportDateIso = parsed.toISOString();
        } else {
          const parsed = new Date(s);
          if (isNaN(parsed.getTime())) { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Ngày báo cáo không hợp lệ: ${s}` }); continue; }
          reportDateIso = parsed.toISOString();
        }
      }

      // validate status
      const status = statusRaw ? statusRaw.toString().trim().toLowerCase() : 'active';
      if (status && status !== 'active' && status !== 'inactive') { errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Trạng thái không hợp lệ: ${statusRaw}` }); continue; }

      const reportDateKey = getDateKey(reportDateIso);
      const recordKey = `${foundClass._id.toString()}||${reportDateKey}||${foundStudent._id.toString()}||${foundCriterion._id.toString()}`;
      const firstDuplicateRow = seenRecordKeys.get(recordKey);
      if (firstDuplicateRow) {
        errors.push({ row: rowNumber, studentCode, fullName: foundStudent.full_name, reason: `Trùng ghi nhận với dòng ${firstDuplicateRow}` });
        continue;
      }
      seenRecordKeys.set(recordKey, rowNumber);

      // group key
      const key = `${foundClass._id.toString()}||${reportDateKey}`;
      const entry = groups.get(key) || { rows: [] as any[], classObj: foundClass, reportDate: reportDateIso, teacherName: teacher };
      entry.rows.push({ rowNumber, student: foundStudent, criterion: foundCriterion, noteClass, noteRecord, status });
      groups.set(key, entry);
    }

    // Check existing reports
    for (const [key, group] of groups.entries()) {
      if (existingReportKeys.has(key)) {
        group.rows.forEach(r => errors.push({ row: r.rowNumber, studentCode: r.student.student_code, fullName: r.student.full_name, reason: 'Báo cáo lớp đã tồn tại cho lớp và ngày này' }));
      }
    }

    if (errors.length > 0) {
      return { success: false, errors, count: 0 };
    }

    let reportsCreated = 0;
    let recordsCreated = 0;

    if (commit && groups.size > 0) {
      // 1. Preload student summaries
      const studentIds = students.map(s => s._id);
      const summaries = await summaryPointModel.find({
        student_id: { $in: studentIds },
        semester_id: activeSem._id,
        period_id: null
      }).exec();
      const summaryMap = new Map<string, any>(summaries.map(s => [s.student_id.toString(), s]));

      // 2. Identify students without summaries and bulk insert them first
      const newSummaries: any[] = [];
      for (const [_, group] of groups.entries()) {
        for (const r of group.rows) {
          const sId = r.student._id.toString();
          if (!summaryMap.has(sId)) {
            const newSummary = new summaryPointModel({
              student_id: r.student._id,
              semester_id: activeSem._id,
              total_score: 100,
              grading: 'Xuất sắc',
              status: 'draft'
            });
            summaryMap.set(sId, newSummary);
            newSummaries.push(newSummary);
          }
        }
      }
      if (newSummaries.length > 0) {
        await summaryPointModel.insertMany(newSummaries);
      }

      // 3. Preload all EvaluationDetails for these summaries
      const summaryIds = Array.from(summaryMap.values()).map(s => s._id);
      const existingEvalDetails = await evaluationDetailModel.find({
        summary_id: { $in: summaryIds }
      }).exec();
      const evalDetailMap = new Map<string, any>();
      existingEvalDetails.forEach(ed => {
        evalDetailMap.set(`${ed.summary_id.toString()}_${ed.criterion_id.toString()}`, ed);
      });

      // 4. Preload class students map to avoid DB queries in loop
      const classIdsInFile = Array.from(new Set(Array.from(groups.values()).map(g => g.classObj._id.toString())));
      const classStudentsAll = await studentModel.find({ class_id: { $in: classIdsInFile.map(id => new Types.ObjectId(id)) } }).lean().exec();
      const classStudentsMap = new Map<string, any[]>();
      classStudentsAll.forEach(s => {
        const cid = (s as any).class_id.toString();
        if (!classStudentsMap.has(cid)) classStudentsMap.set(cid, []);
        classStudentsMap.get(cid)!.push(s);
      });

      const recordsToCreate: any[] = [];
      const allSyncRecords: any[] = [];
      const updatedEvalDetails = new Map<string, any>();
      const newEvalDetailsToCreate: any[] = [];

      for (const [key, group] of groups.entries()) {
        const classStudents = classStudentsMap.get(group.classObj._id.toString()) || [];
        const absentStudentIds = new Set<string>();
        group.rows.forEach(r => {
          if (isAbsentCriterion(r.criterion)) {
            absentStudentIds.add(r.student._id.toString());
          }
        });
        const safeAbsentCount = absentStudentIds.size;
        const safeTotalPresent = Math.max(0, classStudents.length - safeAbsentCount);

        const reportDto = {
          class_id: group.classObj._id,
          reported_by: new Types.ObjectId(currentUserId),
          report_date: new Date(group.reportDate),
          teacher_name: group.teacherName,
          total_present: safeTotalPresent,
          total_absent: safeAbsentCount,
          class_notes: group.rows[0]?.noteClass || ''
        };

        const createdReport = await this.dailyClassReportModel.create(reportDto as any);
        reportsCreated++;

        for (const r of group.rows) {
          const summary = summaryMap.get(r.student._id.toString())!;
          const evalDetailKey = `${summary._id.toString()}_${r.criterion._id.toString()}`;
          
          let evalDetail = evalDetailMap.get(evalDetailKey);
          const pointsPerUnit = r.criterion.score_per_unit || 0;

          if (!evalDetail) {
            evalDetail = {
              summary_id: summary._id,
              criterion_id: r.criterion._id,
              current_count: 1,
              system_score: pointsPerUnit,
              sv_score: pointsPerUnit,
              gv_score: pointsPerUnit,
              final_score: pointsPerUnit,
              status: 'draft',
              log: [{
                count: 1,
                score_before: 0,
                score_after: pointsPerUnit,
                updated_by: new Types.ObjectId(currentUserId),
                role: (requester.roleName || 'Teacher').toLowerCase(),
                updated_at: new Date()
              }]
            };
            evalDetailMap.set(evalDetailKey, evalDetail);
            newEvalDetailsToCreate.push(evalDetail);
          } else {
            const before = evalDetail.final_score || 0;
            const after = before + pointsPerUnit;
            evalDetail.current_count = (evalDetail.current_count || 0) + 1;
            evalDetail.system_score = after;
            evalDetail.sv_score = after;
            evalDetail.gv_score = after;
            evalDetail.final_score = after;
            
            if (!evalDetail.log) evalDetail.log = [];
            evalDetail.log.push({
              count: 1,
              score_before: before,
              score_after: after,
              updated_by: new Types.ObjectId(currentUserId),
              role: (requester.roleName || 'Teacher').toLowerCase(),
              updated_at: new Date()
            });
            updatedEvalDetails.set(evalDetailKey, evalDetail);
          }

          const recordDto = {
            student_id: r.student._id,
            criterion_id: r.criterion._id,
            semester_id: activeSem._id,
            daily_report_id: (createdReport as any)._id,
            record_title: r.criterion.criterion_name,
            description: r.noteRecord || 'Imported via daily class report',
            points_effect: pointsPerUnit,
            recorded_by: new Types.ObjectId(currentUserId),
            recorded_at: new Date(group.reportDate),
            status: r.status || 'active'
          };
          recordsToCreate.push(recordDto);
          
          allSyncRecords.push({
            student_id: r.student._id,
            semester_id: activeSem._id,
            criterion_id: r.criterion._id
          });
        }
      }

      // Bulk write evaluation detail creations and updates
      if (newEvalDetailsToCreate.length > 0) {
        await evaluationDetailModel.insertMany(newEvalDetailsToCreate);
      }
      if (updatedEvalDetails.size > 0) {
        const bulkOps = Array.from(updatedEvalDetails.values()).map(ed => ({
          updateOne: {
            filter: { _id: ed._id },
            update: {
              $set: {
                current_count: ed.current_count,
                system_score: ed.system_score,
                sv_score: ed.sv_score,
                gv_score: ed.gv_score,
                final_score: ed.final_score,
                log: ed.log
              }
            }
          }
        }));
        await evaluationDetailModel.bulkWrite(bulkOps);
      }

      // Bulk insert Academic Records
      if (recordsToCreate.length > 0) {
        await academicRecordModel.insertMany(recordsToCreate);
        recordsCreated = recordsToCreate.length;
      }

      // Bulk sync summary scores
      this.academicRecordService.syncMultipleStudentCriterionScores(allSyncRecords).catch((e: any) => 
        console.error('Failed to sync student summaries in importClassRecords:', e)
      );
    }

    return {
      success: true,
      errors: [],
      reportsCreated,
      recordsCreated,
      count: groups.size
    };
  }
}
