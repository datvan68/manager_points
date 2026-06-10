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
import { LinkedTaskProgressEventDto } from './dto/linked-task-progress-event.dto';

@Injectable()
export class StudentTaskProgressService {
  constructor(
    @InjectModel(StudentTaskProgress.name) private progressModel: Model<StudentTaskProgressDocument>,
    @InjectModel(StudentTask.name) private taskModel: Model<StudentTaskDocument>,
    @InjectModel(Student.name) private studentModel: Model<StudentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
  ) {}

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
      // Tìm các task mà teacher được phép xem (do mình tạo hoặc phân công cho mình)
      const teacherId = new Types.ObjectId(user.userId);
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
      }, { _id: 1 }).exec();
      const validTaskIds = teacherTasks.map(t => t._id);
      
      // Nếu user cung cấp taskId, phải kiểm tra xem có nằm trong validTaskIds không
      if (query.taskId) {
        const queryTaskId = new Types.ObjectId(query.taskId);
        if (!validTaskIds.some(id => id.equals(queryTaskId))) {
          // Trả về rỗng nếu không có quyền xem task này
          return { items: [], total: 0, page: query.page || 1, limit: query.limit || 10, totalPages: 0, summary: { totalAssignees: 0, notStarted: 0, inProgress: 0, completed: 0, completionRate: 0 } };
        }
        filter.taskId = queryTaskId;
      } else {
        filter.taskId = { $in: validTaskIds };
      }
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
    if (query.classId) {
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
    }));

    return {
      items: mappedItems,
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

    const progress = await this.progressModel.findOne({
      taskId: task._id,
      assigneeUserId: new Types.ObjectId(user.userId),
      isActive: true,
    }).exec();

    if (!progress) {
      throw new ForbiddenException('Bạn không được giao nhiệm vụ này hoặc tiến độ không hoạt động');
    }

    const now = new Date();
    let targetStatus = progress.status;

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
      const roleName = user.roleName || '';
      const hasManagePermission =
        roleName === 'Admin' ||
        roleName.toLowerCase().includes('supervisor') ||
        roleName.toLowerCase().includes('quản sinh') ||
        (user.permissions || []).includes('UPDATE_STUDENT_TASK');

      if (!hasManagePermission) {
        throw new ForbiddenException('Bạn không có quyền reset tiến độ nhiệm vụ');
      }
      targetStatus = StudentTaskStatus.NOT_STARTED;
      progress.startedAt = undefined;
      progress.completedAt = undefined;
    }

    progress.status = targetStatus;
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
}

