import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { StudentTaskProgress, StudentTaskProgressDocument, AssigneeType } from './schemas/student-task-progress.schema';
import { StudentTask, StudentTaskDocument, StudentTaskStatus } from '../student-tasks/schemas/student-task.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Role, RoleDocument } from '../auth/schemas/role.schema';
import { GetProgressOverviewDto } from './dto/get-progress-overview.dto';
import { UpdateProgressStatusDto } from './dto/update-progress-status.dto';
import { LinkedTaskProgressEventDto, BulkLinkedTaskProgressEventDto, BulkLinkedTaskProgressEventItemDto } from './dto/linked-task-progress-event.dto';
import { Class, ClassDocument } from '../classes/schemas/class.schema';
import { SummaryPoint, SummaryPointDocument } from '../summaries-point/schemas/summary-point.schema';

@Injectable()
export class StudentTaskProgressService {
  constructor(
    @InjectModel(StudentTaskProgress.name) private progressModel: Model<StudentTaskProgressDocument>,
    @InjectModel(StudentTask.name) private taskModel: Model<StudentTaskDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Class.name) private classModel: Model<ClassDocument>,
    @InjectModel(SummaryPoint.name) private summaryPointModel: Model<SummaryPointDocument>,
  ) {}

  private isSummarySaved(summary: any): boolean {
    if (!summary) return false;
    if (summary.total_score !== null && summary.total_score !== undefined) return true;
    if (summary.details && summary.details.length > 0) {
      for (const d of summary.details) {
        if ((d.log && d.log.length > 0) || d.sv_score !== null || d.gv_score !== null || d.final_score !== null || d.gv_reviewed_at !== null) {
          return true;
        }
      }
    }
    return false;
  }

  async syncProgressForTask(taskId: string): Promise<{
    created: number;
    reactivated: number;
    inactivated: number;
    skipped: number;
  }> {
    const task = await this.taskModel.findById(taskId).exec();
    if (!task) return { created: 0, reactivated: 0, inactivated: 0, skipped: 0 };

    let assigneeUserIds: { userId: Types.ObjectId; studentId?: Types.ObjectId; classId?: Types.ObjectId }[] = [];
    let assigneeType: AssigneeType = AssigneeType.STUDENT;

    if (task.targetType === 'student') {
      assigneeType = AssigneeType.STUDENT;
      let students: any[] = [];
      if (task.targetScope === 'all') {
        students = await this.studentModel.find({ user_id: { $ne: null }, status: 'Studying' }).exec();
      } else {
        const orConditions: any[] = [];
        if (task.targetStudentIds && task.targetStudentIds.length > 0) {
          orConditions.push({ _id: { $in: task.targetStudentIds } });
        }
        if (task.targetClassIds && task.targetClassIds.length > 0) {
          orConditions.push({ class_id: { $in: task.targetClassIds } });
        }
        if (orConditions.length > 0) {
          students = await this.studentModel.find({ $or: orConditions, user_id: { $ne: null }, status: 'Studying' }).exec();
        }
      }
      assigneeUserIds = students.map(s => ({
        userId: s.user_id,
        studentId: s._id,
        classId: s.class_id,
      }));
    } else if (task.targetType === 'teacher') {
      assigneeType = AssigneeType.TEACHER;
      if (task.targetScope === 'all') {
        const teacherRole = await this.roleModel.findOne({ role_code: 'TEACHER' }).exec();
        if (teacherRole) {
          const users = await this.userModel.find({ role: teacherRole._id }).exec();
          assigneeUserIds = users.map(u => ({ userId: u._id }));
        }
      } else {
        if (task.targetTeacherIds && task.targetTeacherIds.length > 0) {
          const users = await this.userModel.find({ _id: { $in: task.targetTeacherIds } }).exec();
          assigneeUserIds = users.map(u => ({ userId: u._id }));
        }
      }
    } else if (task.targetType === 'supervisor') {
      assigneeType = AssigneeType.SUPERVISOR;
      const supervisorRole = await this.roleModel.findOne({ role_code: 'SUPERVISOR' }).exec();
      if (supervisorRole) {
        const users = await this.userModel.find({ role: supervisorRole._id }).exec();
        assigneeUserIds = users.map(u => ({ userId: u._id }));
      }
    }

    // Lọc trùng lặp assigneeUserIds
    const uniqueMap = new Map();
    assigneeUserIds.forEach(a => {
      uniqueMap.set(a.userId.toString(), a);
    });
    const uniqueAssignees = Array.from(uniqueMap.values());

    const existingProgresses = await this.progressModel.find({ taskId: task._id }).exec();
    const existingProgressMap = new Map(existingProgresses.map(p => [p.assigneeUserId.toString(), p]));

    let created = 0;
    let reactivated = 0;
    let skipped = 0;
    let inactivated = 0;

    const operations: any[] = [];
    uniqueAssignees.forEach(assignee => {
      const existing = existingProgressMap.get(assignee.userId.toString());
      if (!existing) {
        created++;
      } else if (!existing.isActive) {
        reactivated++;
      } else {
        skipped++;
      }

      operations.push({
        updateOne: {
          filter: { taskId: task._id, assigneeUserId: assignee.userId },
          update: {
            $set: {
              isActive: true,
              removedAt: null,
              removedReason: null,
              studentId: assignee.studentId,
              classId: assignee.classId,
            },
            $setOnInsert: {
              taskId: task._id,
              assigneeUserId: assignee.userId,
              assigneeType,
              status: StudentTaskStatus.NOT_STARTED,
            }
          },
          upsert: true,
        }
      });
    });

    if (operations.length > 0) {
      await this.progressModel.bulkWrite(operations);
    }

    // Đánh dấu isActive = false cho những assignee không còn nằm trong danh sách mới
    const validUserIds = uniqueAssignees.map(a => a.userId);
    const toInactivate = existingProgresses.filter(p => p.isActive && !validUserIds.some(uid => uid.equals(p.assigneeUserId)));
    inactivated = toInactivate.length;

    if (inactivated > 0) {
      const inactivateUserIds = toInactivate.map(p => p.assigneeUserId);
      await this.progressModel.updateMany(
        {
          taskId: task._id,
          assigneeUserId: { $in: inactivateUserIds },
          isActive: true,
        },
        {
          $set: {
            isActive: false,
            removedAt: new Date(),
            removedReason: 'Loại khỏi phạm vi nhiệm vụ',
          }
        }
      );
    }

    // Đồng bộ lại status tổng hợp của Task sau khi đồng bộ progress
    await this.recalculateTaskAggregateStatus(taskId);

    return { created, reactivated, inactivated, skipped };
  }

  async getOverview(query: GetProgressOverviewDto, user: any) {
    if (query.taskId && !Types.ObjectId.isValid(query.taskId)) {
      throw new BadRequestException('Mã nhiệm vụ không hợp lệ');
    }
    if (query.classId && !Types.ObjectId.isValid(query.classId)) {
      throw new BadRequestException('Mã lớp không hợp lệ');
    }

    const filter: any = {};
    
    // 1. Phân quyền dữ liệu
    const roleName = user.roleName || '';
    const isStudent = roleName.toLowerCase().includes('student') || roleName.toLowerCase().includes('học sinh') || roleName.toLowerCase().includes('sinh viên');
    const isTeacher = roleName.toLowerCase().includes('teacher') || roleName.toLowerCase().includes('giáo viên') || roleName.toLowerCase().includes('giảng viên');
    const hasAdminAccess = roleName === 'Admin' || roleName.toLowerCase().includes('supervisor') || roleName.toLowerCase().includes('quản sinh');
    const hasUpdatePermission = 
      roleName === 'Admin' || 
      roleName.toLowerCase().includes('supervisor') || 
      roleName.toLowerCase().includes('quản sinh') || 
      (user.permissions || []).includes('UPDATE_STUDENT_TASK');

    if (isStudent) {
      filter.assigneeUserId = new Types.ObjectId(user.userId);
    } else if (isTeacher && !hasAdminAccess) {
      const teacherId = new Types.ObjectId(user.userId);
      const advisorClasses = await this.classModel.find({ advisor_id: teacherId as any }).select('_id').lean().exec();
      const advisorClassIds = advisorClasses.map(c => c._id);

      const teacherTasks = await this.taskModel.find({
        deletedAt: null,
        $or: [
          { createdBy: teacherId },
          {
            targetType: 'teacher',
            $or: [
              { targetScope: 'all' },
              { targetScope: 'specific', targetTeacherIds: teacherId },
            ],
          },
        ]
      }, { _id: 1, createdBy: 1 }).exec();
      const validTaskIdsFromTeacherRole = teacherTasks.map(t => t._id);

      if (query.taskId) {
        filter.taskId = new Types.ObjectId(query.taskId);
      }

      if (query.classId) {
        filter.classId = new Types.ObjectId(query.classId);
      }

      filter.$or = [
        { taskId: { $in: validTaskIdsFromTeacherRole } },
        { classId: { $in: advisorClassIds } }
      ];
    } else {
      // Admin/Supervisor
      if (query.taskId) {
        filter.taskId = new Types.ObjectId(query.taskId);
      }
    }

    // 2. Các filter khác
    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    if (query.assigneeType && query.assigneeType !== 'all') {
      filter.assigneeType = query.assigneeType;
    }
    if (query.classId && !filter.classId) {
      filter.classId = new Types.ObjectId(query.classId);
    }
    if (query.includeInactive && hasUpdatePermission) {
      // Cho phép lấy cả inactive
    } else {
      filter.isActive = true;
    }

    const matchStage: any = { $match: filter };

    // Lookup to Task
    const lookupTask = {
      $lookup: {
        from: 'studenttasks', // Mongoose tự động tạo lowercase plural (nếu collection chưa định nghĩa tên cứng)
        localField: 'taskId',
        foreignField: '_id',
        as: 'task',
      }
    };
    const unwindTask = { $unwind: '$task' };
    const filterDeletedTask = { $match: { 'task.deletedAt': null } };

    // Lookup User
    const lookupUser = {
      $lookup: {
        from: 'users',
        localField: 'assigneeUserId',
        foreignField: '_id',
        as: 'user',
      }
    };
    const unwindUser = { $unwind: '$user' };

    // Lookup Class
    const lookupClass = {
      $lookup: {
        from: 'classes',
        localField: 'classId',
        foreignField: '_id',
        as: 'class',
      }
    };
    const unwindClass = { $unwind: { path: '$class', preserveNullAndEmptyArrays: true } };
    
    const lookupUpdater = {
      $lookup: {
        from: 'users',
        localField: 'updatedBy',
        foreignField: '_id',
        as: 'updater',
      }
    };
    const unwindUpdater = { $unwind: { path: '$updater', preserveNullAndEmptyArrays: true } };

    const pipeline = [
      matchStage,
      lookupTask,
      unwindTask,
      filterDeletedTask,
      lookupUser,
      unwindUser,
      lookupClass,
      unwindClass,
      lookupUpdater,
      unwindUpdater,
    ];

    const postLookupMatch: any = {};

    if (query.search) {
      const searchRegex = new RegExp(query.search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
      postLookupMatch.$or = [
        { 'user.user_name': searchRegex },
        { 'task.title': searchRegex },
      ];
    }

    if (query.deadlineFrom || query.deadlineTo) {
      postLookupMatch['task.deadline'] = {};
      if (query.deadlineFrom) {
        postLookupMatch['task.deadline'].$gte = new Date(query.deadlineFrom);
      }
      if (query.deadlineTo) {
        postLookupMatch['task.deadline'].$lte = new Date(query.deadlineTo);
      }
    }

    if (Object.keys(postLookupMatch).length > 0) {
      pipeline.push({ $match: postLookupMatch });
    }

    // Sort
    let sortObj: any = { updatedAt: -1 };
    if (query.sort === 'deadline_asc') {
      sortObj = { 'task.deadline': 1 };
    } else if (query.sort === 'deadline_desc') {
      sortObj = { 'task.deadline': -1 };
    } else if (query.sort === 'status') {
      sortObj = { status: 1 };
    }
    pipeline.push({ $sort: sortObj });

    // Summary Pipeline
    const summaryPipeline = [...pipeline];
    summaryPipeline.push({
      $group: {
        _id: null,
        totalAssignees: { $sum: 1 },
        notStarted: { $sum: { $cond: [{ $eq: ['$status', 'not_started'] }, 1, 0] } },
        inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
        completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
      }
    });

    const summaryResult = await this.progressModel.aggregate(summaryPipeline).exec();
    const summary = summaryResult[0] || {
      totalAssignees: 0,
      notStarted: 0,
      inProgress: 0,
      completed: 0,
    };
    const completionRate = summary.totalAssignees > 0 
      ? Math.round((summary.completed / summary.totalAssignees) * 100) 
      : 0;

    // Pagination
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const dataPipeline = [...pipeline];
    dataPipeline.push({ $skip: skip });
    dataPipeline.push({ $limit: limit });

    const results = await this.progressModel.aggregate(dataPipeline).exec();

    // Teacher Summaries Pipeline
    const teacherSummaryPipeline = [...pipeline];
    const teacherSummaryFilter = { ...filter, assigneeType: 'student' };
    teacherSummaryPipeline[0] = { $match: teacherSummaryFilter };
    
    teacherSummaryPipeline.push(
      { $match: { 'class.advisor_id': { $ne: null, $exists: true } } },
      {
        $group: {
          _id: '$class.advisor_id',
          classIds: { $addToSet: '$classId' },
          classNames: { $addToSet: '$class.class_name' },
          totalStudents: { $sum: 1 },
          notStartedStudents: { $sum: { $cond: [{ $eq: ['$status', 'not_started'] }, 1, 0] } },
          inProgressStudents: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
          completedStudents: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'advisor'
        }
      },
      { $unwind: { path: '$advisor', preserveNullAndEmptyArrays: true } }
    );

    const teacherSummariesRaw = await this.progressModel.aggregate(teacherSummaryPipeline).exec();
    const teacherSummaries = teacherSummariesRaw.map(t => {
      const tr = t.totalStudents > 0 ? Math.round((t.completedStudents / t.totalStudents) * 100) : 0;
      let status = 'not_started';
      if (t.totalStudents === 0) status = 'no_data';
      else if (t.completedStudents === t.totalStudents && t.totalStudents > 0) status = 'completed';
      else if (t.completedStudents > 0 || t.inProgressStudents > 0) status = 'in_progress';
      
      return {
        teacherId: t._id?.toString(),
        teacherName: t.advisor?.user_name || 'N/A',
        classIds: t.classIds.map((id: any) => id?.toString()).filter(Boolean),
        classNames: t.classNames.filter(Boolean),
        totalStudents: t.totalStudents,
        notStartedStudents: t.notStartedStudents,
        inProgressStudents: t.inProgressStudents,
        completedStudents: t.completedStudents,
        completionRate: tr,
        status
      };
    });

    const mappedItems = results.map(item => ({
      id: item._id.toString(),
      taskId: item.taskId.toString(),
      taskTitle: item.task?.title,
      taskType: item.task?.type,
      subject: item.task?.subject,
      deadline: item.task?.deadline,
      linkedPage: item.task?.linkedPage,
      assigneeUserId: item.assigneeUserId.toString(),
      assigneeName: item.user?.user_name,
      assigneeType: item.assigneeType,
      studentId: item.studentId?.toString(),
      classId: item.classId?.toString(),
      className: item.class?.class_name,
      status: item.status,
      startedAt: item.startedAt,
      completedAt: item.completedAt,
      lastActivityAt: item.lastActivityAt,
      updatedBy: item.updater ? { id: item.updater._id.toString(), name: item.updater.user_name } : null,
      updatedAt: item.updatedAt,
      statusSource: item.statusSource,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      lastSyncedAt: item.lastSyncedAt,
      criteriaProgress: item.criteriaProgress,
      teacherProgress: item.teacherProgress,
    }));

    return {
      items: mappedItems,
      teacherSummaries,
      total: summary.totalAssignees,
      page,
      limit,
      totalPages: Math.ceil(summary.totalAssignees / limit) || 1,
      summary: {
        ...summary,
        completionRate,
      }
    };
  }

  async updateStatus(id: string, dto: UpdateProgressStatusDto, user: any) {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('ID không hợp lệ');
    }

    const progress = await this.progressModel.findById(id).exec();
    if (!progress) {
      throw new NotFoundException('Không tìm thấy bản ghi tiến độ');
    }

    if (progress.isActive === false) {
      throw new BadRequestException('Không thể cập nhật tiến độ của nhiệm vụ đã bị hủy áp dụng');
    }

    const roleName = user.roleName || '';
    const isStudent = roleName.toLowerCase().includes('student') || roleName.toLowerCase().includes('học sinh') || roleName.toLowerCase().includes('sinh viên');
    const hasManagePermission = 
      roleName === 'Admin' || 
      roleName.toLowerCase().includes('supervisor') || 
      roleName.toLowerCase().includes('quản sinh') || 
      (user.permissions || []).includes('UPDATE_STUDENT_TASK');

    if (isStudent && progress.assigneeUserId.toString() !== user.userId) {
      throw new ForbiddenException('Bạn chỉ có thể cập nhật tiến độ của chính mình');
    }

    if (!isStudent && progress.assigneeUserId.toString() !== user.userId && !hasManagePermission) {
      throw new ForbiddenException('Bạn không có quyền cập nhật tiến độ của người khác');
    }

    const now = new Date();
    progress.status = dto.status;
    progress.updatedBy = new Types.ObjectId(user.userId);
    progress.lastActivityAt = now;

    if (dto.status === StudentTaskStatus.IN_PROGRESS) {
      if (!progress.startedAt) progress.startedAt = now;
      progress.completedAt = undefined;
    } else if (dto.status === StudentTaskStatus.COMPLETED) {
      if (!progress.startedAt) progress.startedAt = now;
      progress.completedAt = now;
    } else if (dto.status === StudentTaskStatus.NOT_STARTED) {
      progress.startedAt = undefined;
      progress.completedAt = undefined;
    }

    progress.statusSource = 'manual';
    progress.sourceType = undefined;
    progress.sourceId = undefined;
    progress.lastSyncedAt = undefined;

    await progress.save();

    // Đồng bộ lại status tổng hợp của Task
    await this.recalculateTaskAggregateStatus(progress.taskId.toString());

    return progress;
  }

  async recalculateTaskAggregateStatus(taskId: string) {
    const activeProgresses = await this.progressModel.find({
      taskId: new Types.ObjectId(taskId),
      isActive: true,
    }).exec();

    let newStatus = StudentTaskStatus.NOT_STARTED;

    if (activeProgresses.length > 0) {
      const allNotStarted = activeProgresses.every(p => p.status === StudentTaskStatus.NOT_STARTED);
      const allCompleted = activeProgresses.every(p => p.status === StudentTaskStatus.COMPLETED);

      if (allCompleted) {
        newStatus = StudentTaskStatus.COMPLETED;
      } else if (!allNotStarted) {
        // Có ít nhất 1 người đang làm hoặc đã làm xong (nhưng chưa phải tất cả)
        newStatus = StudentTaskStatus.IN_PROGRESS;
      }
    }

    await this.taskModel.updateOne(
      { _id: new Types.ObjectId(taskId) },
      { $set: { status: newStatus } }
    );
  }

  async backfillAllTasks() {
    const tasks = await this.taskModel.find({ deletedAt: null }).exec();
    let tasksProcessed = 0;
    let progressCreated = 0;
    let progressReactivated = 0;
    let progressInactivated = 0;
    let skipped = 0;
    const errors: Array<{ taskId: string; message: string }> = [];

    for (const task of tasks) {
      try {
        const stats = await this.syncProgressForTask(task._id.toString());
        tasksProcessed++;
        progressCreated += stats.created;
        progressReactivated += stats.reactivated;
        progressInactivated += stats.inactivated;
        skipped += stats.skipped;
      } catch (error) {
        errors.push({
          taskId: task._id.toString(),
          message: error.message || 'Lỗi không xác định',
        });
      }
    }

    return {
      success: true,
      tasksProcessed,
      progressCreated,
      progressReactivated,
      progressInactivated,
      skipped,
      errors,
    };
  }

  async findProgressByUserAndTasks(userId: string, taskIds: Types.ObjectId[]): Promise<StudentTaskProgressDocument[]> {
    return this.progressModel.find({
      assigneeUserId: new Types.ObjectId(userId),
      taskId: { $in: taskIds },
      isActive: true,
    }).exec();
  }

  async findProgressByUserAndTask(userId: string, taskId: string): Promise<StudentTaskProgressDocument | null> {
    return this.progressModel.findOne({
      assigneeUserId: new Types.ObjectId(userId),
      taskId: new Types.ObjectId(taskId),
    }).exec();
  }

  async findProgressByUser(userId: string): Promise<StudentTaskProgressDocument[]> {
    return this.progressModel.find({
      assigneeUserId: new Types.ObjectId(userId),
      isActive: true,
    }).exec();
  }

  async updateProgressFromLinkedEvent(dto: LinkedTaskProgressEventDto, user: any): Promise<StudentTaskProgressDocument> {
    if (!Types.ObjectId.isValid(dto.taskId)) {
      throw new BadRequestException('Mã nhiệm vụ không hợp lệ');
    }

    const task = await this.taskModel.findOne({ _id: new Types.ObjectId(dto.taskId), deletedAt: null }).exec();
    if (!task) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ hoặc nhiệm vụ đã bị xóa');
    }

    const AUTO_EVENT_PAGES = ['/students/record', '/grading/score'];
    const cleanPath = (url?: string | null) => {
      let p = (url || '').split('?')[0].trim();
      if (!p) return '';
      if (!p.startsWith('/')) {
        p = '/' + p;
      }
      return p;
    };

    const normalizedTaskPage = cleanPath(task.linkedPage);
    if (!normalizedTaskPage || !AUTO_EVENT_PAGES.includes(normalizedTaskPage)) {
      throw new BadRequestException('Nhiệm vụ này không hỗ trợ tự động đồng bộ tiến độ');
    }

    if (dto.linkedPage) {
      if (cleanPath(dto.linkedPage) !== normalizedTaskPage) {
        throw new BadRequestException('Trang liên kết không khớp với cấu hình nhiệm vụ');
      }
    }

    const roleName = user.roleName || '';
    const isStudent = roleName.toLowerCase().includes('student') || roleName.toLowerCase().includes('học sinh') || roleName.toLowerCase().includes('sinh viên');
    const hasManagePermission =
      roleName === 'Admin' ||
      roleName.toLowerCase().includes('supervisor') ||
      roleName.toLowerCase().includes('quản sinh') ||
      (user.permissions || []).includes('UPDATE_STUDENT_TASK');

    let progressQuery: any = {
      taskId: task._id,
      isActive: true,
    };

    if (task.targetType === 'teacher') {
      if (dto.assigneeStudentId && hasManagePermission && !isStudent) {
        let studentObj;
        if (Types.ObjectId.isValid(dto.assigneeStudentId)) {
          studentObj = await this.studentModel.findById(dto.assigneeStudentId).select('class_id').lean().exec();
        } else {
          studentObj = await this.studentModel.findOne({ student_code: dto.assigneeStudentId }).select('class_id').lean().exec();
        }
        
        let advisorId = user.userId;
        if (studentObj && studentObj.class_id) {
          const classObj = await this.classModel.findById(studentObj.class_id).select('advisor_id').lean().exec();
          if (classObj && classObj.advisor_id) {
            advisorId = classObj.advisor_id.toString();
          }
        }
        progressQuery.assigneeUserId = new Types.ObjectId(advisorId);
      } else {
        progressQuery.assigneeUserId = new Types.ObjectId(user.userId);
      }
    } else if (task.targetType === 'student') {
      if (dto.assigneeStudentId) {
        if (isStudent) {
          throw new ForbiddenException('Bạn không có quyền cập nhật tiến độ của người khác');
        }
        if (Types.ObjectId.isValid(dto.assigneeStudentId)) {
          progressQuery.studentId = new Types.ObjectId(dto.assigneeStudentId);
        } else {
          const student = await this.studentModel.findOne({ student_code: dto.assigneeStudentId }).select('_id').lean().exec();
          if (!student) {
            throw new NotFoundException(`Không tìm thấy sinh viên có mã ${dto.assigneeStudentId}`);
          }
          progressQuery.studentId = student._id as Types.ObjectId;
        }
      } else {
        progressQuery.assigneeUserId = new Types.ObjectId(user.userId);
      }
    } else {
      progressQuery.assigneeUserId = new Types.ObjectId(user.userId);
    }

    const progress = await this.progressModel.findOne(progressQuery).exec();

    if (!progress) {
      throw new ForbiddenException('Bạn không được giao nhiệm vụ này hoặc tiến độ không hoạt động');
    }

    const isUpdatingStudentProgress = task.targetType !== 'teacher' && Boolean(dto.assigneeStudentId);

    if (isUpdatingStudentProgress && !hasManagePermission) {
      const isCreator = task.createdBy && task.createdBy.toString() === user.userId;
      let isAdvisor = false;
      if (progress.classId) {
        const studentClass = await this.classModel.findById(progress.classId).lean().exec();
        if (studentClass && studentClass.advisor_id && studentClass.advisor_id.toString() === user.userId) {
          isAdvisor = true;
        }
      }
      if (!isCreator && !isAdvisor) {
        // Admin or supervisor could update with hasManagePermission
        // Do not throw ForbiddenException if hasManagePermission is true
        if (!hasManagePermission) {
          throw new ForbiddenException('Bạn không có quyền cập nhật tiến độ của sinh viên này');
        }
      }
    }

    const now = new Date();
    let targetStatus = progress.status;
    let newCriteriaProgress = progress.criteriaProgress;
    let newTeacherProgress = progress.teacherProgress;

    if (task.targetType === 'teacher') {
      if (dto.sourceId && Types.ObjectId.isValid(dto.sourceId) && dto.sourceType === 'grading_score') {
        const sourceSummary = await this.summaryPointModel.findById(dto.sourceId).select('semester_id').exec();
        if (sourceSummary && sourceSummary.semester_id) {
          const teacherId = user.userId;
          const advisorClasses = await this.classModel.find({ advisor_id: new Types.ObjectId(teacherId) as any }).select('_id class_name').exec();
          const classIds = advisorClasses.map(c => c._id);
          const classNames = advisorClasses.map(c => c.class_name);

          if (classIds.length > 0) {
            const students = await this.studentModel.find({ class_id: { $in: classIds as any }, status: 'Studying' }).select('_id').exec();
            const studentIds = students.map(s => s._id);

            const totalStudents = studentIds.length;

            const summaries = await this.summaryPointModel.find({
              semester_id: sourceSummary.semester_id,
              student_id: { $in: studentIds as any }
            }).populate('details.criterion_id', 'is_locked').exec();

            let completedStudents = 0;
            let inProgressStudents = 0;
            let notStartedStudents = 0;

            summaries.forEach(s => {
              if (this.isSummarySaved(s)) {
                completedStudents++;
              } else {
                notStartedStudents++;
              }
            });
            
            notStartedStudents += (totalStudents - summaries.length);

            const totalRequiredItems = totalStudents;
            const completedTeacherItems = completedStudents;
            const completionRate = totalRequiredItems === 0 ? 0 : Math.round((completedTeacherItems / totalRequiredItems) * 100);

            let statusStr = 'not_started';
            if (totalRequiredItems === 0) statusStr = 'no_data';
            else if (completionRate === 100) statusStr = 'completed';
            else if (completedTeacherItems > 0) statusStr = 'in_progress';

            newTeacherProgress = {
              teacherId: teacherId.toString(),
              teacherName: user.user_name || user.username || 'Giáo viên',
              classIds: classIds.map(id => id.toString()),
              classNames,
              totalStudents,
              completedStudents,
              inProgressStudents,
              notStartedStudents,
              totalRequiredItems,
              completedTeacherItems,
              completionRate,
              status: statusStr
            };

            if (statusStr === 'completed') {
              targetStatus = StudentTaskStatus.COMPLETED;
              if (!progress.startedAt) progress.startedAt = now;
              if (!progress.completedAt) progress.completedAt = now;
            } else if (statusStr === 'in_progress') {
              targetStatus = StudentTaskStatus.IN_PROGRESS;
              if (!progress.startedAt) progress.startedAt = now;
              progress.completedAt = undefined;
            } else {
              targetStatus = StudentTaskStatus.NOT_STARTED;
              progress.startedAt = undefined;
              progress.completedAt = undefined;
            }
          }
        }
      }
    } else {
      if (dto.sourceId && Types.ObjectId.isValid(dto.sourceId) && dto.sourceType === 'grading_score') {
        const summary = await this.summaryPointModel.findById(dto.sourceId).populate('details.criterion_id', 'is_locked').exec();
        if (summary) {
          const isSaved = this.isSummarySaved(summary);
          const totalCriteria = 1;
          const completedCriteria = isSaved ? 1 : 0;
          const completionRate = isSaved ? 100 : 0;
          
          let statusStr = isSaved ? 'completed' : 'not_started';

          newCriteriaProgress = {
            totalCriteria,
            completedCriteria,
            completionRate,
            status: statusStr,
            lastCalculatedAt: now,
          };

          if (!isSaved) {
            targetStatus = StudentTaskStatus.NOT_STARTED;
            progress.startedAt = undefined;
            progress.completedAt = undefined;
          } else {
            targetStatus = StudentTaskStatus.COMPLETED;
            if (!progress.startedAt) progress.startedAt = now;
            if (!progress.completedAt) progress.completedAt = now;
          }
        }
      } else {
        // Fallback for other events
        if (dto.event === 'started') {
          if (progress.status === StudentTaskStatus.NOT_STARTED) {
            targetStatus = StudentTaskStatus.IN_PROGRESS;
          }
          if (!progress.startedAt) {
            progress.startedAt = now;
          }
        } else if (dto.event === 'completed') {
          targetStatus = StudentTaskStatus.COMPLETED;
          if (!progress.startedAt) {
            progress.startedAt = now;
          }
          if (!progress.completedAt) {
            progress.completedAt = now;
          }
        } else if (dto.event === 'reset') {
          if (!hasManagePermission) {
            throw new ForbiddenException('Bạn không có quyền reset tiến độ nhiệm vụ');
          }
          targetStatus = StudentTaskStatus.NOT_STARTED;
          progress.startedAt = undefined;
          progress.completedAt = undefined;
        }
      }
    }

    progress.status = targetStatus;
    progress.criteriaProgress = newCriteriaProgress;
    progress.teacherProgress = newTeacherProgress;
    progress.lastActivityAt = now;
    progress.updatedBy = new Types.ObjectId(user.userId);
    progress.statusSource = 'linked_event';
    progress.sourceType = dto.sourceType || undefined;
    progress.sourceId = dto.sourceId || undefined;
    progress.lastSyncedAt = now;

    await progress.save();

    // Đồng bộ lại status tổng hợp của Task
    await this.recalculateTaskAggregateStatus(task._id.toString());

    return progress;
  }

  async bulkUpdateProgressFromLinkedEvent(dto: BulkLinkedTaskProgressEventDto, user: any): Promise<{ updated: number, skipped: number, errors: string[] }> {
    if (!Types.ObjectId.isValid(dto.taskId)) {
      throw new BadRequestException('Mã nhiệm vụ không hợp lệ');
    }

    const task = await this.taskModel.findOne({ _id: new Types.ObjectId(dto.taskId), deletedAt: null }).exec();
    if (!task) {
      throw new NotFoundException('Không tìm thấy nhiệm vụ hoặc nhiệm vụ đã bị xóa');
    }

    const AUTO_EVENT_PAGES = ['/students/record', '/grading/score'];
    const cleanPath = (url?: string | null) => {
      let p = (url || '').split('?')[0].trim();
      if (!p) return '';
      if (!p.startsWith('/')) {
        p = '/' + p;
      }
      return p;
    };

    const normalizedTaskPage = cleanPath(task.linkedPage);
    if (!normalizedTaskPage || !AUTO_EVENT_PAGES.includes(normalizedTaskPage)) {
      throw new BadRequestException('Nhiệm vụ này không hỗ trợ tự động đồng bộ tiến độ');
    }

    if (dto.linkedPage) {
      if (cleanPath(dto.linkedPage) !== normalizedTaskPage) {
        throw new BadRequestException('Trang liên kết không khớp với cấu hình nhiệm vụ');
      }
    }

    const roleName = user.roleName || '';
    const isStudent = roleName.toLowerCase().includes('student') || roleName.toLowerCase().includes('học sinh') || roleName.toLowerCase().includes('sinh viên');
    const hasManagePermission =
      roleName === 'Admin' ||
      roleName.toLowerCase().includes('supervisor') ||
      roleName.toLowerCase().includes('quản sinh') ||
      (user.permissions || []).includes('UPDATE_STUDENT_TASK');

    const isCreator = task.createdBy && task.createdBy.toString() === user.userId;

    let updated = 0;
    let skipped = 0;
    let errors: string[] = [];

    const now = new Date();

    for (const item of dto.items) {
      try {
        let progressQuery: any = {
          taskId: task._id,
          isActive: true,
        };

        if (item.assigneeStudentId) {
          if (isStudent) {
            throw new ForbiddenException('Bạn không có quyền cập nhật tiến độ của người khác');
          }
          if (Types.ObjectId.isValid(item.assigneeStudentId)) {
            progressQuery.studentId = new Types.ObjectId(item.assigneeStudentId);
          } else {
            const student = await this.studentModel.findOne({ student_code: item.assigneeStudentId }).select('_id').lean().exec();
            if (!student) {
              throw new ForbiddenException(`Không tìm thấy sinh viên có mã ${item.assigneeStudentId}`);
            }
            progressQuery.studentId = student._id as Types.ObjectId;
          }
        } else {
          progressQuery.assigneeUserId = new Types.ObjectId(user.userId);
        }

        const progress = await this.progressModel.findOne(progressQuery).exec();

        if (!progress) {
          throw new ForbiddenException(`Không tìm thấy tiến độ hợp lệ cho studentId ${item.assigneeStudentId || user.userId}`);
        }

        if (item.assigneeStudentId && !hasManagePermission) {
          let isAdvisor = false;
          if (progress.classId) {
            const studentClass = await this.classModel.findById(progress.classId).lean().exec();
            if (studentClass && studentClass.advisor_id && studentClass.advisor_id.toString() === user.userId) {
              isAdvisor = true;
            }
          }
          if (!isCreator && !isAdvisor) {
            if (!hasManagePermission) {
              throw new ForbiddenException(`Không có quyền cập nhật tiến độ của sinh viên ${item.assigneeStudentId}`);
            }
          }
        }

        let targetStatus = progress.status;
        let newCriteriaProgress = progress.criteriaProgress;

        if (item.sourceId && Types.ObjectId.isValid(item.sourceId) && dto.sourceType === 'grading_score') {
          const summary = await this.summaryPointModel.findById(item.sourceId).populate('details.criterion_id', 'is_locked').exec();
          if (summary) {
            const isSaved = this.isSummarySaved(summary);
            const totalCriteria = 1;
            const completedCriteria = isSaved ? 1 : 0;
            const completionRate = isSaved ? 100 : 0;
            
            let statusStr = isSaved ? 'completed' : 'not_started';

            newCriteriaProgress = {
              totalCriteria,
              completedCriteria,
              completionRate,
              status: statusStr,
              lastCalculatedAt: now,
            };

            if (!isSaved) {
              targetStatus = StudentTaskStatus.NOT_STARTED;
              progress.startedAt = undefined;
              progress.completedAt = undefined;
            } else {
              targetStatus = StudentTaskStatus.COMPLETED;
              if (!progress.startedAt) progress.startedAt = now;
              if (!progress.completedAt) progress.completedAt = now;
            }
          }
        } else {
          // Fallback logic
          if (dto.event === 'started') {
            if (progress.status === StudentTaskStatus.NOT_STARTED) {
              targetStatus = StudentTaskStatus.IN_PROGRESS;
            }
            if (!progress.startedAt) {
              progress.startedAt = now;
            }
          } else if (dto.event === 'completed') {
            targetStatus = StudentTaskStatus.COMPLETED;
            if (!progress.startedAt) {
              progress.startedAt = now;
            }
            if (!progress.completedAt) {
              progress.completedAt = now;
            }
          } else if (dto.event === 'reset') {
            if (!hasManagePermission) {
              throw new ForbiddenException('Bạn không có quyền reset tiến độ nhiệm vụ');
            }
            targetStatus = StudentTaskStatus.NOT_STARTED;
            progress.startedAt = undefined;
            progress.completedAt = undefined;
          }
        }

        progress.status = targetStatus;
        progress.criteriaProgress = newCriteriaProgress;
        progress.lastActivityAt = now;
        progress.updatedBy = new Types.ObjectId(user.userId);
        progress.statusSource = 'linked_event';
        progress.sourceType = dto.sourceType || undefined;
        progress.sourceId = item.sourceId || undefined;
        progress.lastSyncedAt = now;

        await progress.save();
        updated++;
      } catch (err: any) {
        errors.push(err.message || 'Lỗi không xác định');
        skipped++;
      }
    }

    if (updated > 0) {
      await this.recalculateTaskAggregateStatus(task._id.toString());
    }

    return { updated, skipped, errors };
  }

  async cascadeStatusToActiveProgresses(taskId: string, status: string, userId: string): Promise<{ matched: number; modified: number }> {
    const now = new Date();
    const baseUpdate: any = {
      status,
      updatedBy: new Types.ObjectId(userId),
      lastActivityAt: now,
      statusSource: 'manual',
      sourceType: null,
      sourceId: null,
      lastSyncedAt: null,
    };

    let matched = 0;
    let modified = 0;

    // Tìm xem có bao nhiêu progress active
    const activeProgresses = await this.progressModel.find({
      taskId: new Types.ObjectId(taskId),
      isActive: true,
    }).exec();

    matched = activeProgresses.length;

    if (matched > 0) {
      if (status === 'completed') {
        // 1. Update những progress chưa có startedAt: set startedAt = now, completedAt = now
        const res1 = await this.progressModel.updateMany(
          { taskId: new Types.ObjectId(taskId), isActive: true, startedAt: null },
          { $set: { ...baseUpdate, startedAt: now, completedAt: now } }
        );
        // 2. Update những progress đã có startedAt: set completedAt = now
        const res2 = await this.progressModel.updateMany(
          { taskId: new Types.ObjectId(taskId), isActive: true, startedAt: { $ne: null } },
          { $set: { ...baseUpdate, completedAt: now } }
        );
        modified = (res1.modifiedCount || 0) + (res2.modifiedCount || 0);
      } else if (status === 'in_progress') {
        // 1. Update những progress chưa có startedAt: set startedAt = now, clear completedAt
        const res1 = await this.progressModel.updateMany(
          { taskId: new Types.ObjectId(taskId), isActive: true, startedAt: null },
          { $set: { ...baseUpdate, startedAt: now }, $unset: { completedAt: 1 } }
        );
        // 2. Update những progress đã có startedAt: clear completedAt
        const res2 = await this.progressModel.updateMany(
          { taskId: new Types.ObjectId(taskId), isActive: true, startedAt: { $ne: null } },
          { $set: baseUpdate, $unset: { completedAt: 1 } }
        );
        modified = (res1.modifiedCount || 0) + (res2.modifiedCount || 0);
      } else if (status === 'not_started') {
        const res = await this.progressModel.updateMany(
          { taskId: new Types.ObjectId(taskId), isActive: true },
          { $set: baseUpdate, $unset: { startedAt: 1, completedAt: 1 } }
        );
        modified = res.modifiedCount || 0;
      }

  // Tự động gọi recalculateTaskAggregateStatus sau khi cascade
      await this.recalculateTaskAggregateStatus(taskId);
    }

    return { matched, modified };
  }

  async getTeacherProgressDetail(progressId: string, user: any) {
    if (!Types.ObjectId.isValid(progressId)) {
      throw new BadRequestException('Mã tiến độ không hợp lệ');
    }

    const progress = await this.progressModel.findById(progressId).populate('taskId').exec();
    if (!progress || progress.assigneeType !== AssigneeType.TEACHER) {
      throw new NotFoundException('Không tìm thấy tiến độ của giáo viên');
    }

    const roleName = user.roleName || '';
    const hasAdminAccess = roleName === 'Admin' || roleName.toLowerCase().includes('supervisor') || roleName.toLowerCase().includes('quản sinh');
    
    const teacherId = progress.assigneeUserId.toString();
    
    // Check permissions
    if (!hasAdminAccess && user.userId !== teacherId) {
      const isAdvisorOfSomeClasses = await this.classModel.exists({ advisor_id: new Types.ObjectId(user.userId) as any });
      if (!isAdvisorOfSomeClasses) {
         throw new ForbiddenException('Bạn không có quyền xem chi tiết này');
      }
    }

    const advisorClasses = await this.classModel.find({ advisor_id: new Types.ObjectId(teacherId) as any }).select('_id class_name').lean().exec();
    
    let allowedClassIds = advisorClasses.map(c => c._id.toString());
    if (!hasAdminAccess && user.userId !== teacherId) {
      const userClasses = await this.classModel.find({ advisor_id: new Types.ObjectId(user.userId) as any }).select('_id').lean().exec();
      const userClassIds = userClasses.map(c => c._id.toString());
      allowedClassIds = allowedClassIds.filter(id => userClassIds.includes(id));
      if (allowedClassIds.length === 0) {
        throw new ForbiddenException('Bạn không có quyền xem dữ liệu của các lớp này');
      }
    }

    const filteredClasses = advisorClasses.filter(c => allowedClassIds.includes(c._id.toString()));
    const classIds = filteredClasses.map(c => c._id);

    const students = await this.studentModel.find({ class_id: { $in: classIds as any }, status: 'Studying' }).select('_id student_code full_name class_id').lean().exec();
    
    const task = progress.taskId as any;
    let semesterId: Types.ObjectId | undefined;
    let periodId: Types.ObjectId | undefined;
    let contextSource: 'progress_source' | 'latest_summary' | 'none' = 'none';

    if (progress.sourceType === 'grading_score' && progress.sourceId && Types.ObjectId.isValid(progress.sourceId.toString())) {
       const summary = await this.summaryPointModel.findById(progress.sourceId).select('semester_id period_id').lean().exec();
       if (summary) {
         semesterId = summary.semester_id as any;
         periodId = summary.period_id as any;
         contextSource = 'progress_source';
       }
    }

    if (!semesterId) {
       const filterLatest: any = {
         student_id: { $in: students.map(s => s._id) }
       };
       const latestSummary = await this.summaryPointModel.findOne(filterLatest).sort({ updatedAt: -1 }).select('semester_id period_id').lean().exec();

       if (latestSummary) {
         semesterId = latestSummary.semester_id as any;
         periodId = latestSummary.period_id as any;
         contextSource = 'latest_summary';
       }
    }

    let summaries: any[] = [];
    if (semesterId) {
       const query: any = {
         semester_id: semesterId,
         student_id: { $in: students.map(s => s._id) }
       };
       if (periodId) {
         query.period_id = periodId;
       } else {
         query.$or = [{ period_id: null }, { period_id: { $exists: false } }];
       }
       summaries = await this.summaryPointModel.find(query).populate('details.criterion_id', 'criterion_code criterion_name is_locked').lean().exec();
    }

    const summaryMap = new Map();
    // Sort summaries to ensure latest comes last and overwrites
    summaries.sort((a, b) => {
      const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return dateA - dateB;
    });
    summaries.forEach(s => summaryMap.set(s.student_id.toString(), s));

    const resultClasses: any[] = [];
    let totalCompletedTeacherItems = 0;
    let totalRequiredItemsTotal = 0;
    let totalStudentsTotal = 0;

    for (const cls of filteredClasses) {
       const classStudents = students.filter(s => s.class_id?.toString() === cls._id.toString());
       const studentDetails: any[] = [];
       
       let classCompletedTeacherItems = 0;
       let classTotalRequiredItems = classStudents.length;

       for (const student of classStudents) {
         const summary = summaryMap.get(student._id.toString());
         
         const criteria: any[] = [];
         let totalCriteria = 1;
         let completedCriteria = 0;
         let status: 'not_started' | 'in_progress' | 'completed' | 'no_data' = 'no_data';

         if (summary) {
            const isSaved = this.isSummarySaved(summary);
            if (isSaved) {
                completedCriteria = 1;
                status = 'completed';
                classCompletedTeacherItems++;
            } else {
                status = 'not_started';
            }

            if (summary.details) {
                for (const d of summary.details) {
                   const criterion = d.criterion_id as any;
                   const isLocked = criterion?.is_locked === true;
                   const countedInProgress = !isLocked;

                   const isTeacherHandled = (d.gv_score !== null && d.gv_score !== undefined) || (d.final_score !== null && d.final_score !== undefined) || (d.gv_reviewed_at !== null && d.gv_reviewed_at !== undefined);
                   
                   let score = null;
                   if (d.final_score !== null && d.final_score !== undefined) score = d.final_score;
                   else if (d.gv_score !== null && d.gv_score !== undefined) score = d.gv_score;
                   else if (d.sv_score !== null && d.sv_score !== undefined) score = d.sv_score;
                   else if (d.system_score !== null && d.system_score !== undefined) score = d.system_score;

                   const criterionCode = criterion?.criterion_code || criterion?.criterion_name || d.criterion_code || '--';

                   criteria.push({
                     criterionId: criterion?._id?.toString() || (typeof d.criterion_id === 'string' ? d.criterion_id : d.criterion_id?.toString()),
                     criterionCode: criterionCode,
                     score: score,
                     svScore: d.sv_score ?? null,
                     gvScore: d.gv_score ?? null,
                     finalScore: d.final_score ?? null,
                     isTeacherHandled,
                     isLocked,
                     countedInProgress
                   });
                }

                const collator = new Intl.Collator('vi', {
                  numeric: true,
                  sensitivity: 'base',
                });

                criteria.sort((a, b) =>
                  collator.compare(a.criterionCode || '', b.criterionCode || '')
                );
            }
         }

         const completionRate = completedCriteria === 1 ? 100 : 0;

         studentDetails.push({
           studentId: student._id.toString(),
           studentCode: student.student_code || '--',
           fullName: student.full_name || '--',
           summaryId: summary?._id?.toString(),
           totalCriteria,
           completedCriteria,
           completionRate,
           status,
           criteria
         });
       }

       const classCompletionRate = classTotalRequiredItems === 0 ? 0 : Math.round((classCompletedTeacherItems / classTotalRequiredItems) * 100);

       resultClasses.push({
         classId: cls._id.toString(),
         className: cls.class_name,
         totals: {
           studentCount: classStudents.length,
           completedTeacherItems: classCompletedTeacherItems,
           totalRequiredItems: classTotalRequiredItems,
           completionRate: classCompletionRate,
         },
         students: studentDetails,
       });

       totalStudentsTotal += classStudents.length;
       totalCompletedTeacherItems += classCompletedTeacherItems;
       totalRequiredItemsTotal += classTotalRequiredItems;
    }

    const teacherObj = progress.assigneeUserId ? await this.userModel.findById(progress.assigneeUserId).select('user_name').lean().exec() : null;
    const teacherName = teacherObj ? teacherObj.user_name : 'Giáo viên';

    const overallCompletionRate = totalRequiredItemsTotal === 0 ? 0 : Math.round((totalCompletedTeacherItems / totalRequiredItemsTotal) * 100);

    return {
      progressId: progress._id.toString(),
      taskId: progress.taskId.toString(),
      teacherId: teacherId,
      teacherName: teacherName,
      semesterId: semesterId?.toString(),
      periodId: periodId?.toString(),
      context: {
        source: contextSource,
        semesterId: semesterId?.toString(),
        periodId: periodId?.toString(),
        summariesFound: summaries.length,
      },
      totals: {
        classCount: filteredClasses.length,
        studentCount: totalStudentsTotal,
        completedTeacherItems: totalCompletedTeacherItems,
        totalRequiredItems: totalRequiredItemsTotal,
        completionRate: overallCompletionRate,
      },
      classes: resultClasses,
    };
  }
}

