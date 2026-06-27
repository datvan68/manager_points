import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  StudentTask,
  StudentTaskDocument,
  StudentTaskStatus,
  StudentTaskPriority,
} from './schemas/student-task.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Class, ClassDocument } from '../classes/schemas/class.schema';
import { EvaluationPeriod, EvaluationPeriodDocument } from '../evaluation-periods/schemas/evaluation-period.schema';
import { CreateStudentTaskDto } from './dto/create-student-task.dto';
import { UpdateStudentTaskDto } from './dto/update-student-task.dto';
import { QueryStudentTaskDto } from './dto/query-student-task.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { StudentTaskProgressService } from '../student-task-progress/student-task-progress.service';
import { User, UserDocument } from '../auth/schemas/user.schema';
import { Role, RoleDocument } from '../auth/schemas/role.schema';

function normalizeLinkedPage(value?: string | null): string {
  const trimmed = (value || '').trim();
  if (!trimmed || trimmed === 'none') return '';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

@Injectable()
export class StudentTasksService {
  constructor(
    @InjectModel(StudentTask.name)
    private studentTaskModel: Model<StudentTaskDocument>,
    @InjectModel(Student.name)
    private studentModel: Model<StudentDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Role.name)
    private roleModel: Model<RoleDocument>,
    @InjectModel(Class.name)
    private classModel: Model<ClassDocument>,
    @InjectModel(EvaluationPeriod.name)
    private evaluationPeriodModel: Model<EvaluationPeriodDocument>,
    private notificationsService: NotificationsService,
    private studentTaskProgressService: StudentTaskProgressService,
  ) {}

  private checkObjectId(id: string, name = 'ID') {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`${name} không đúng định dạng ObjectId`);
    }
  }

  private validateObjectIdArray(ids?: string[], fieldName = 'ID') {
    if (!ids) return;
    for (const id of ids) {
      if (!Types.ObjectId.isValid(id)) {
        throw new BadRequestException(
          `Giá trị '${id}' trong danh sách ${fieldName} không đúng định dạng ObjectId`,
        );
      }
    }
  }

  private isPrivilegedRole(roleName?: string): boolean {
    const role = (roleName || '').toLowerCase();
    return (
      role.includes('admin') ||
      role.includes('teacher') ||
      role.includes('supervisor') ||
      role.includes('giáo viên') ||
      role.includes('giảng viên') ||
      role.includes('quản sinh')
    );
  }

  private isStudentRole(roleName?: string): boolean {
    const role = (roleName || '').toLowerCase();
    return role.includes('student') || role.includes('học sinh') || role.includes('sinh viên') || role.includes('hssv');
  }

  private isTeacherRole(roleName?: string): boolean {
    const role = (roleName || '').toLowerCase();
    return role.includes('teacher') || role.includes('giáo viên') || role.includes('giảng viên');
  }

  // Xây dựng điều kiện lọc theo quyền truy cập của user (async để truy vấn class của student)
  private async buildVisibilityFilter(user: any) {
    const filter: any = { deletedAt: null };
    const roleName = user.roleName || '';

    if (this.isStudentRole(roleName)) {
      // Học sinh chỉ thấy các task dành cho student
      filter.targetType = 'student';
      
      const student = await this.studentModel
        .findOne({ user_id: new Types.ObjectId(user.userId) })
        .exec();

      if (student) {
        filter.$or = [
          { targetScope: 'all' },
          {
            targetScope: 'specific',
            $or: [
              { targetStudentIds: student._id },
              { targetClassIds: student.class_id },
            ],
          },
        ];
      } else {
        // Fallback nếu tài khoản student chưa liên kết hồ sơ sinh viên: chỉ thấy scope all
        filter.targetScope = 'all';
      }
    } else if (this.isTeacherRole(roleName)) {
      // Giáo viên chỉ thấy các task dành cho teacher hoặc do chính mình tạo, và task giao cho lớp chủ nhiệm
      const teacherId = new Types.ObjectId(user.userId);
      const advisorClasses = await this.classModel.find({ advisor_id: teacherId as any }).select('_id').lean().exec();
      const advisorClassIds = advisorClasses.map(c => c._id);
      const advisorStudents = await this.studentModel.find({ class_id: { $in: advisorClassIds } }).select('_id').lean().exec();
      const advisorStudentIds = advisorStudents.map(s => s._id);

      filter.$or = [
        { createdBy: teacherId }, // Do giáo viên tạo
        {
          targetType: 'teacher',
          $or: [
            { targetScope: 'all' },
            { targetScope: 'specific', targetTeacherIds: teacherId },
          ],
        },
        {
          targetType: 'student',
          $or: [
            { targetScope: 'all' },
            { targetScope: 'specific', targetClassIds: { $in: advisorClassIds } },
            { targetScope: 'specific', targetStudentIds: { $in: advisorStudentIds } },
          ],
        },
      ];
    }
    // Admin & Supervisor nhìn thấy tất cả các tasks (chưa bị xóa)
    return filter;
  }

  async resolveLinkedTaskDeadline(linkedPage?: string): Promise<Date | null> {
    const normalized = normalizeLinkedPage(linkedPage);
    if (normalized === '/grading/score') {
      const activePeriod = await this.evaluationPeriodModel
        .findOne({ status: { $in: ['sv_phase', 'gv_phase'] } })
        .sort({ createdAt: -1 })
        .exec();
      
      if (activePeriod) {
        if (activePeriod.status === 'sv_phase') return activePeriod.sv_deadline;
        if (activePeriod.status === 'gv_phase') return activePeriod.gv_deadline;
      }
    }
    return null;
  }

  async create(
    createDto: CreateStudentTaskDto,
    creatorId: string,
  ): Promise<StudentTaskDocument> {
    this.checkObjectId(creatorId, 'Mã người tạo');

    let parsedDeadline = new Date(createDto.deadline);
    
    if (isNaN(parsedDeadline.getTime())) {
      const autoDeadline = await this.resolveLinkedTaskDeadline(createDto.linkedPage);
      if (autoDeadline) {
        parsedDeadline = autoDeadline;
      } else {
        throw new BadRequestException('Hạn chót (deadline) không hợp lệ và không thể tự động xác định.');
      }
    }

    // Validate targetScope & targetDetail
    if (createDto.targetScope === 'specific') {
      if (!createDto.targetDetail?.trim()) {
        throw new BadRequestException(
          'Khi phạm vi áp dụng là Cụ thể, cần cung cấp thông tin chi tiết đối tượng (targetDetail)',
        );
      }
      
      // Validate specific target IDs
      if (createDto.targetType === 'student') {
        const hasStudentIds = createDto.targetStudentIds && createDto.targetStudentIds.length > 0;
        const hasClassIds = createDto.targetClassIds && createDto.targetClassIds.length > 0;
        if (!hasStudentIds && !hasClassIds) {
          throw new BadRequestException(
            'Khi phạm vi áp dụng là Cụ thể cho HSSV, cần cung cấp ít nhất một học sinh hoặc một lớp học.',
          );
        }
      } else if (createDto.targetType === 'teacher') {
        const hasTeacherIds = createDto.targetTeacherIds && createDto.targetTeacherIds.length > 0;
        if (!hasTeacherIds) {
          throw new BadRequestException(
            'Khi phạm vi áp dụng là Cụ thể cho Giáo viên, cần cung cấp ít nhất một giáo viên.',
          );
        }
      } else if (createDto.targetType === 'supervisor') {
        throw new BadRequestException(
          'Không hỗ trợ phạm vi áp dụng Cụ thể cho Quản sinh.',
        );
      }
    }

    // Nếu người tạo là Teacher, giới hạn target theo lớp chủ nhiệm
    const creatorUser = await this.userModel.findById(creatorId).populate('role').exec();
    const roleName = (creatorUser?.role as any)?.role_name || '';
    const roleCode = (creatorUser?.role as any)?.role_code || '';
    
    const isTeacher = roleCode === 'TEACHER' || this.isTeacherRole(roleName);
    
    if (isTeacher) {
      if (createDto.targetType !== 'student') {
        throw new ForbiddenException('Giáo viên chỉ được tạo nhiệm vụ cho HSSV.');
      }
      if (createDto.targetScope === 'all') {
        throw new ForbiddenException('Giáo viên không được phép tạo nhiệm vụ cho toàn trường.');
      }
      
      const teacherId = new Types.ObjectId(creatorId);
      const advisorClasses = await this.classModel.find({ advisor_id: teacherId as any }).select('_id').lean().exec();
      const advisorClassIdsStr = advisorClasses.map(c => c._id.toString());
      
      if (createDto.targetClassIds && createDto.targetClassIds.length > 0) {
        for (const cid of createDto.targetClassIds) {
          if (!advisorClassIdsStr.includes(cid)) {
            throw new ForbiddenException('Bạn chỉ được phép phân công nhiệm vụ cho các lớp do bạn chủ nhiệm.');
          }
        }
      }
      
      if (createDto.targetStudentIds && createDto.targetStudentIds.length > 0) {
        const targetStudents = await this.studentModel.find({ _id: { $in: createDto.targetStudentIds } }).exec();
        for (const student of targetStudents) {
          if (!advisorClassIdsStr.includes(student.class_id?.toString() || '')) {
            throw new ForbiddenException('Bạn chỉ được phép phân công nhiệm vụ cho sinh viên thuộc các lớp do bạn chủ nhiệm.');
          }
        }
      }
    }

    // Validate ObjectIds in arrays
    this.validateObjectIdArray(createDto.targetStudentIds, 'targetStudentIds');
    this.validateObjectIdArray(createDto.targetClassIds, 'targetClassIds');
    this.validateObjectIdArray(createDto.targetTeacherIds, 'targetTeacherIds');

    const payload: any = {
      ...createDto,
      linkedPage: normalizeLinkedPage(createDto.linkedPage),
      deadline: parsedDeadline,
      createdBy: new Types.ObjectId(creatorId),
    };

    // Parse ObjectIds nếu có gửi lên
    if (createDto.targetStudentIds) {
      payload.targetStudentIds = createDto.targetStudentIds.map(
        (id) => new Types.ObjectId(id),
      );
    }
    if (createDto.targetClassIds) {
      payload.targetClassIds = createDto.targetClassIds.map(
        (id) => new Types.ObjectId(id),
      );
    }
    if (createDto.targetTeacherIds) {
      payload.targetTeacherIds = createDto.targetTeacherIds.map(
        (id) => new Types.ObjectId(id),
      );
    }

    const createdTask = new this.studentTaskModel(payload);
    const savedTask = await createdTask.save();

    // Bắn thông báo tự động (global hoặc cá nhân)
    try {
      const scopeDetail =
        createDto.targetScope === 'specific'
          ? `(${createDto.targetDetail})`
          : '(Tất cả)';
      const targetLabel =
        createDto.targetType === 'student'
          ? 'HSSV'
          : createDto.targetType === 'teacher'
            ? 'Giáo viên'
            : 'Quản sinh';

      await this.notificationsService.create(
        {
          title: 'Nhiệm vụ học tập mới',
          description: `Nhiệm vụ mới "${createDto.title}" (${createDto.type === 'project' ? 'Dự án' : createDto.type === 'assignment' ? 'Bài tập' : 'Hoạt động'}) thuộc "${createDto.subject}" đã được phân công cho ${targetLabel} ${scopeDetail}.`,
          type: 'info',
          routeUrl: createDto.linkedPage || '/students/tasks',
        },
        creatorId,
      );
      } catch (error) {
        console.error('Lỗi gửi thông báo khi tạo task:', error.message);
      }

      // Sync progress records
      try {
        await this.studentTaskProgressService.syncProgressForTask(savedTask._id.toString());
      } catch (error) {
        console.error('Lỗi đồng bộ tiến độ khi tạo task:', error.message);
      }

      return savedTask;
  }

  async findAll(query: QueryStudentTaskDto, user: any) {
    // 1. Điều kiện truy cập của user hiện tại (async)
    const baseFilter = await this.buildVisibilityFilter(user);

    // 2. Áp dụng thêm các bộ lọc từ query params
    const filter: any = { ...baseFilter };

    const roleName = user.roleName || '';
    const isStudent = this.isStudentRole(roleName);
    const isTeacher = this.isTeacherRole(roleName);
    const hasUpdatePermission =
      roleName === 'Admin' ||
      roleName.toLowerCase().includes('supervisor') ||
      roleName.toLowerCase().includes('quản sinh') ||
      (user.permissions || []).includes('UPDATE_STUDENT_TASK');

    const isAssigneeOnly = !hasUpdatePermission && (isStudent || isTeacher);

    let userProgresses: any[] = [];
    if (isAssigneeOnly) {
      userProgresses = await this.studentTaskProgressService.findProgressByUser(user.userId);
      
      // Filter out progress of tasks that are soft-deleted or do not match baseFilter
      const visibleTasks = await this.studentTaskModel.find(baseFilter, { _id: 1, priority: 1 }).exec();
      const visibleTaskIds = new Set(visibleTasks.map(t => t._id.toString()));
      userProgresses = userProgresses.filter(p => visibleTaskIds.has(p.taskId.toString()));

      const assignedTaskIds = userProgresses.map(p => p.taskId);
      filter._id = { $in: assignedTaskIds };

      if (query.status && query.status !== 'all') {
        const filteredProgresses = userProgresses.filter(p => p.status === query.status);
        const filteredTaskIds = filteredProgresses.map(p => p.taskId);
        filter._id = { $in: filteredTaskIds };
      }
    } else {
      if (query.status && query.status !== 'all') {
        filter.status = query.status;
      }
    }

    if (query.priority && query.priority !== 'all') {
      filter.priority = query.priority;
    }

    // Chỉ Admin và Supervisor mới được đổi filter targetType, vì Student/Teacher đã bị fix cứng ở base filter
    if (
      query.targetType &&
      query.targetType !== 'all' &&
      this.isPrivilegedRole(user.roleName) &&
      user.roleName !== 'Teacher'
    ) {
      filter.targetType = query.targetType;
    }

    if (query.search) {
      const escapedSearch = query.search.replace(
        /[-\/\\^$*+?.()|[\]{}]/g,
        '\\$&',
      );
      const searchRegex = { $regex: escapedSearch, $options: 'i' };
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: searchRegex },
          { subject: searchRegex },
          { targetDetail: searchRegex },
        ],
      });
    }

    // 3. Sắp xếp
    let sortObj: any = { createdAt: -1 }; // Mặc định: Mới nhất
    if (query.sort === 'deadline_asc') {
      sortObj = { deadline: 1 };
    } else if (query.sort === 'deadline_desc') {
      sortObj = { deadline: -1 };
    } else if (query.sort === 'priority_desc') {
      sortObj = { priority: 1, createdAt: -1 };
    }

    // 4. Phân trang
    const page = query.page || 1;
    const limit = query.limit || 6;
    const skip = (page - 1) * limit;

    const total = await this.studentTaskModel.countDocuments(filter).exec();
    const items = await this.studentTaskModel
      .find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limit)
      .populate('createdBy', 'user_name')
      .populate('updatedBy', 'user_name')
      .exec();

    const totalPages = Math.ceil(total / limit) || 1;

    // Lấy progress của user hiện tại cho các task này
    const taskIds = items.map(item => item._id);
    const progresses = await this.studentTaskProgressService.findProgressByUserAndTasks(user.userId, taskIds);
    const progressMap = new Map(progresses.map(p => [p.taskId.toString(), p]));

    const mappedItems = items.map(item => {
      const itemObj = item.toObject();
      const userProgress = progressMap.get(item._id.toString());
      return {
        ...itemObj,
        id: itemObj._id.toString(),
        userProgress: userProgress ? {
          id: userProgress._id.toString(),
          status: userProgress.status,
          startedAt: userProgress.startedAt,
          completedAt: userProgress.completedAt,
        } : null,
      };
    });

    // 5. Tính toán KPI dựa trên quyền truy cập của user (không bao gồm filter search/status/priority)
    let summary: any;

    if (isAssigneeOnly) {
      const totalTasks = userProgresses.length;
      const completedTasks = userProgresses.filter(p => p.status === 'completed').length;
      const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      const assignedTaskIds = userProgresses.map(p => p.taskId);
      const highPriorityTasks = await this.studentTaskModel.find({
        _id: { $in: assignedTaskIds },
        priority: 'high',
        deletedAt: null
      }, { _id: 1 }).exec();
      const highPriorityTaskIds = new Set(highPriorityTasks.map(t => t._id.toString()));

      const urgentTasks = userProgresses.filter(
        p => p.status !== 'completed' && highPriorityTaskIds.has(p.taskId.toString())
      ).length;

      summary = {
        totalTasks,
        urgentTasks,
        completedTasks,
        progressPercentage,
      };
    } else {
      const kpiFilter = { ...baseFilter };
      const allUserTasks = await this.studentTaskModel.find(kpiFilter).exec();

      const totalTasks = allUserTasks.length;
      const urgentTasks = allUserTasks.filter(
        (t) =>
          t.status !== StudentTaskStatus.COMPLETED &&
          t.priority === StudentTaskPriority.HIGH,
      ).length;
      const completedTasks = allUserTasks.filter(
        (t) => t.status === StudentTaskStatus.COMPLETED,
      ).length;
      const progressPercentage =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      summary = {
        totalTasks,
        urgentTasks,
        completedTasks,
        progressPercentage,
      };
    }

    return {
      items: mappedItems,
      total,
      page,
      limit,
      totalPages,
      summary,
    };
  }

  async findOne(id: string, user: any): Promise<StudentTaskDocument> {
    this.checkObjectId(id);

    const task = await this.studentTaskModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .exec();

    if (!task) {
      throw new NotFoundException(`Không tìm thấy nhiệm vụ với ID ${id}`);
    }

    // Kiểm tra quyền xem (visibility)
    const roleName = user.roleName || '';
    if (this.isStudentRole(roleName)) {
      if (task.targetType !== 'student') {
        throw new ForbiddenException('Bạn không có quyền xem nhiệm vụ này');
      }
      if (task.targetScope === 'specific') {
        const student = await this.studentModel
          .findOne({ user_id: new Types.ObjectId(user.userId) })
          .exec();
        if (!student) {
          throw new ForbiddenException('Bạn không có quyền xem nhiệm vụ này');
        }
        const isAssignedStudent = task.targetStudentIds?.some(
          (sid) => sid.toString() === student._id.toString(),
        );
        const isAssignedClass = task.targetClassIds?.some(
          (cid) => cid.toString() === student.class_id?.toString(),
        );
        if (!isAssignedStudent && !isAssignedClass) {
          throw new ForbiddenException('Bạn không có quyền xem nhiệm vụ này');
        }
      }
    } else if (this.isTeacherRole(roleName)) {
      const isCreator = task.createdBy.toString() === user.userId;
      const isAssignedTeacher =
        task.targetType === 'teacher' &&
        (task.targetScope === 'all' ||
          task.targetTeacherIds?.some((tid) => tid.toString() === user.userId));
      if (!isCreator && !isAssignedTeacher) {
        throw new ForbiddenException('Bạn không có quyền xem nhiệm vụ này');
      }
    }

    return task;
  }

  async update(
    id: string,
    updateDto: UpdateStudentTaskDto,
    updaterId: string,
  ): Promise<StudentTaskDocument> {
    this.checkObjectId(id);
    this.checkObjectId(updaterId, 'Mã người cập nhật');

    // Validate ObjectIds in arrays
    this.validateObjectIdArray(updateDto.targetStudentIds, 'targetStudentIds');
    this.validateObjectIdArray(updateDto.targetClassIds, 'targetClassIds');
    this.validateObjectIdArray(updateDto.targetTeacherIds, 'targetTeacherIds');

    const task = await this.studentTaskModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .exec();

    if (!task) {
      throw new NotFoundException(`Không tìm thấy nhiệm vụ với ID ${id}`);
    }

    // Validate specific target IDs on update
    const finalTargetType = updateDto.targetType !== undefined ? updateDto.targetType : task.targetType;
    const finalTargetScope = updateDto.targetScope !== undefined ? updateDto.targetScope : task.targetScope;

    if (finalTargetScope === 'specific') {
      if (finalTargetType === 'student') {
        const finalStudentIds = updateDto.targetStudentIds !== undefined ? updateDto.targetStudentIds : task.targetStudentIds;
        const finalClassIds = updateDto.targetClassIds !== undefined ? updateDto.targetClassIds : task.targetClassIds;
        if ((!finalStudentIds || finalStudentIds.length === 0) && (!finalClassIds || finalClassIds.length === 0)) {
          throw new BadRequestException(
            'Khi phạm vi áp dụng là Cụ thể cho HSSV, cần cung cấp ít nhất một học sinh hoặc một lớp học.',
          );
        }
      } else if (finalTargetType === 'teacher') {
        const finalTeacherIds = updateDto.targetTeacherIds !== undefined ? updateDto.targetTeacherIds : task.targetTeacherIds;
        if (!finalTeacherIds || finalTeacherIds.length === 0) {
          throw new BadRequestException(
            'Khi phạm vi áp dụng là Cụ thể cho Giáo viên, cần cung cấp ít nhất một giáo viên.',
          );
        }
      } else if (finalTargetType === 'supervisor') {
        throw new BadRequestException(
          'Không hỗ trợ phạm vi áp dụng Cụ thể cho Quản sinh.',
        );
      }
    }

    const previousStatus = task.status;

    // Cập nhật payload
    const payload: any = { ...updateDto };
    if (updateDto.linkedPage !== undefined) {
      payload.linkedPage = normalizeLinkedPage(updateDto.linkedPage);
    }

    // Loại bỏ các trường không cho client cập nhật
    delete payload.createdBy;
    delete payload.deletedAt;
    delete payload.status;

    if (updateDto.deadline) {
      const parsedDeadline = new Date(updateDto.deadline);
      if (isNaN(parsedDeadline.getTime())) {
        throw new BadRequestException('Hạn chót (deadline) không hợp lệ');
      }
      payload.deadline = parsedDeadline;
    }

    // Parse các ObjectId
    if (updateDto.targetStudentIds) {
      payload.targetStudentIds = updateDto.targetStudentIds.map(
        (uid) => new Types.ObjectId(uid),
      );
    }
    if (updateDto.targetClassIds) {
      payload.targetClassIds = updateDto.targetClassIds.map(
        (cid) => new Types.ObjectId(cid),
      );
    }
    if (updateDto.targetTeacherIds) {
      payload.targetTeacherIds = updateDto.targetTeacherIds.map(
        (tid) => new Types.ObjectId(tid),
      );
    }

    payload.updatedBy = new Types.ObjectId(updaterId);

    const updatedTask = await this.studentTaskModel
      .findByIdAndUpdate(id, { $set: payload }, { returnDocument: 'after' })
      .exec();

    if (!updatedTask) {
      throw new NotFoundException(`Không tìm thấy nhiệm vụ với ID ${id}`);
    }

    // Bắn thông báo nếu trạng thái đổi sang Completed
    if (
      previousStatus !== StudentTaskStatus.COMPLETED &&
      updatedTask.status === StudentTaskStatus.COMPLETED
    ) {
      try {
        await this.notificationsService.create(
          {
            title: 'Nhiệm vụ đã hoàn thành',
            description: `Nhiệm vụ "${updatedTask.title}" thuộc "${updatedTask.subject}" đã được chuyển sang trạng thái Hoàn thành xuất sắc!`,
            type: 'success',
            routeUrl: updatedTask.linkedPage || '/students/tasks',
          },
          updaterId,
        );
      } catch (error) {
        console.error('Lỗi gửi thông báo khi hoàn thành task:', error.message);
      }
    }

    // Sync progress records (because target scope/audience might have changed)
    try {
      await this.studentTaskProgressService.syncProgressForTask(updatedTask._id.toString());
    } catch (error) {
      console.error('Lỗi đồng bộ tiến độ khi cập nhật task:', error.message);
    }

    return updatedTask;
  }

  async updateStatus(
    id: string,
    status: string,
    user: any,
  ): Promise<StudentTaskDocument> {
    this.checkObjectId(id);

    if (
      status !== StudentTaskStatus.NOT_STARTED &&
      status !== StudentTaskStatus.IN_PROGRESS &&
      status !== StudentTaskStatus.COMPLETED
    ) {
      throw new BadRequestException('Trạng thái cập nhật không hợp lệ');
    }

    const task = await this.studentTaskModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .exec();

    if (!task) {
      throw new NotFoundException(`Không tìm thấy nhiệm vụ với ID ${id}`);
    }

    const roleName = user.roleName || '';
    const isStudent = this.isStudentRole(roleName);
    const isTeacher = this.isTeacherRole(roleName);
    const isCreator = task.createdBy.toString() === user.userId;
    
    const hasUpdatePermission =
      roleName === 'Admin' ||
      roleName.toLowerCase().includes('supervisor') ||
      roleName.toLowerCase().includes('quản sinh') ||
      (user.permissions || []).includes('UPDATE_STUDENT_TASK') ||
      (isTeacher && isCreator);

    // Kiểm tra quyền đổi trạng thái nhanh và chuyển hướng sang tiến độ cá nhân nếu cần:
    if (!hasUpdatePermission && (isStudent || isTeacher)) {
      if (isStudent) {
        if (task.targetType !== 'student') {
          throw new ForbiddenException(
            'Bạn không được phân công nhiệm vụ này, không thể cập nhật trạng thái',
          );
        }
        if (task.targetScope === 'specific') {
          const student = await this.studentModel
            .findOne({ user_id: new Types.ObjectId(user.userId) })
            .exec();
          if (!student) {
            throw new ForbiddenException('Không tìm thấy thông tin sinh viên của bạn');
          }
          const isAssignedStudent = task.targetStudentIds?.some(
            (sid) => sid.toString() === student._id.toString(),
          );
          const isAssignedClass = task.targetClassIds?.some(
            (cid) => cid.toString() === student.class_id?.toString(),
          );
          if (!isAssignedStudent && !isAssignedClass) {
            throw new ForbiddenException(
              'Bạn không được phân công nhiệm vụ này, không thể cập nhật trạng thái',
            );
          }
        }
      } else if (isTeacher) {
        const isAssignedTeacher =
          task.targetType === 'teacher' &&
          (task.targetScope === 'all' ||
            task.targetTeacherIds?.some((tid) => tid.toString() === user.userId));
        if (!isAssignedTeacher) {
          throw new ForbiddenException('Bạn không được phân công nhiệm vụ này, không thể cập nhật trạng thái');
        }
      }

      // Tìm và cập nhật progress
      const progress = await this.studentTaskProgressService.findProgressByUserAndTask(user.userId, id);
      if (!progress) {
        throw new ForbiddenException('Bạn không được phân công nhiệm vụ này, không thể cập nhật trạng thái');
      }
      if (!progress.isActive) {
        throw new BadRequestException('Tiến độ của nhiệm vụ này không còn hoạt động');
      }

      await this.studentTaskProgressService.updateStatus(progress._id.toString(), { status: status as any }, user);
      const updated = await this.studentTaskModel.findOne({ _id: new Types.ObjectId(id), deletedAt: null }).exec();
      if (!updated) {
        throw new NotFoundException(`Không tìm thấy nhiệm vụ với ID ${id}`);
      }
      return updated;
    }

    if (!hasUpdatePermission) {
      throw new ForbiddenException('Bạn không có quyền cập nhật trạng thái nhiệm vụ này');
    }

    const previousStatus = task.status;

    // Cascade sang toàn bộ progress active của task này
    const cascadeResult = await this.studentTaskProgressService.cascadeStatusToActiveProgresses(id, status, user.userId);
    
    if (cascadeResult.matched === 0 && status !== StudentTaskStatus.NOT_STARTED) {
      throw new BadRequestException('Nhiệm vụ chưa được phân công hoặc không có người phân công hoạt động, không thể cập nhật trạng thái');
    }

    const updatedTask = await this.studentTaskModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .exec();

    if (!updatedTask) {
      throw new NotFoundException(`Không tìm thấy nhiệm vụ với ID ${id}`);
    }

    // Bắn thông báo nếu trạng thái đổi sang Completed
    if (
      previousStatus !== StudentTaskStatus.COMPLETED &&
      updatedTask.status === StudentTaskStatus.COMPLETED
    ) {
      try {
        await this.notificationsService.create(
          {
            title: 'Nhiệm vụ đã hoàn thành',
            description: `Nhiệm vụ "${updatedTask.title}" thuộc "${updatedTask.subject}" đã được chuyển sang trạng thái Hoàn thành xuất sắc!`,
            type: 'success',
            routeUrl: updatedTask.linkedPage || '/students/tasks',
          },
          user.userId,
        );
      } catch (error) {
        console.error('Lỗi gửi thông báo khi hoàn thành task:', error.message);
      }
    }

    return updatedTask;
  }

  async remove(id: string, userId: string): Promise<StudentTaskDocument> {
    this.checkObjectId(id);
    this.checkObjectId(userId, 'Mã người xóa');

    const task = await this.studentTaskModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .exec();

    if (!task) {
      throw new NotFoundException(`Không tìm thấy nhiệm vụ với ID ${id}`);
    }

    task.deletedAt = new Date();
    task.updatedBy = new Types.ObjectId(userId);
    return task.save();
  }

  async resolveAutoLinkedTask(linkedPage: string, user: any) {
    if (!linkedPage) {
      throw new BadRequestException('Trang liên kết (linkedPage) không được để trống');
    }

    const normalizedLinkedPage = normalizeLinkedPage(linkedPage);

    // 1. Lấy baseFilter theo quyền truy cập của user hiện tại
    const baseFilter = await this.buildVisibilityFilter(user);

    // 2. Chỉ quan tâm các task auto-linked đang hoạt động
    const filter: any = {
      ...baseFilter,
      linkedPage: normalizedLinkedPage,
      status: { $in: [StudentTaskStatus.NOT_STARTED, StudentTaskStatus.IN_PROGRESS] },
    };

    const tasks = await this.studentTaskModel.find(filter).exec();

    // 3. Lọc lại theo logic "người này có thực sự được giao task hay không" 
    // vì baseFilter của Teacher có thể lỏng hơn (lấy cả task giao cho teacher hoặc student lớp chủ nhiệm)
    let validTasks = [];
    const roleName = user.roleName || '';
    const isTeacher = this.isTeacherRole(roleName);
    
    if (isTeacher) {
      const teacherId = new Types.ObjectId(user.userId);
      const advisorClasses = await this.classModel.find({ advisor_id: teacherId as any }).select('_id').lean().exec();
      const advisorClassIdsStr = advisorClasses.map(c => c._id.toString());

      validTasks = tasks.filter((task) => {
        // Teacher task
        if (task.targetType === 'teacher') {
          if (task.targetScope === 'all') return true;
          return task.targetTeacherIds?.some(tid => tid.toString() === user.userId);
        }
        
        // Student task (chỉ lấy task giao cho lớp chủ nhiệm của giáo viên)
        if (task.targetType === 'student') {
           if (task.targetScope === 'all') return true;
           const matchedClass = task.targetClassIds?.some(cid => advisorClassIdsStr.includes(cid.toString()));
           // Trong trường hợp này, việc tìm studentIds khá phức tạp, ta tạm coi nếu có matchedClass là hợp lệ.
           return matchedClass;
        }
        
        return false;
      });
    } else {
      // Với student/admin/supervisor thì baseFilter đã khá chính xác, có thể dùng luôn danh sách tasks
      validTasks = tasks;
    }

    if (validTasks.length === 1) {
      return { taskId: validTasks[0]._id.toString(), count: 1 };
    }

    return { taskId: null, count: validTasks.length };
  }

  async getTeachers() {
    const teacherRole = await this.roleModel.findOne({ role_code: 'TEACHER' }).exec();
    if (!teacherRole) return [];
    const users = await this.userModel.find({ role: teacherRole._id }).populate('role', 'role_code').exec();
    return users.map(u => ({
      id: u._id.toString(),
      user_name: u.user_name,
      email: u.email,
      role_code: (u.role as any)?.role_code || 'TEACHER'
    }));
  }

  async checkAccess(id: string, user: any) {
    this.checkObjectId(id);
    const task = await this.studentTaskModel
      .findOne({ _id: new Types.ObjectId(id), deletedAt: null })
      .exec();

    if (!task) {
      throw new NotFoundException(`Không tìm thấy nhiệm vụ với ID ${id}`);
    }

    const normalizeLinkedPage = (page?: string) => page?.split('?')[0].replace(/\/$/, '') || '';
    const AUTO_EVENT_PAGES = ['/students/record', '/grading/score'];
    const normalizedPath = normalizeLinkedPage(task.linkedPage);
    
    let mode: 'none' | 'manual' | 'auto' = 'none';
    if (normalizedPath) {
      const isAuto = AUTO_EVENT_PAGES.some((page) => normalizedPath === page || normalizedPath.startsWith(`${page}/`));
      mode = isAuto ? 'auto' : 'manual';
    }

    const roleName = user.roleName || '';
    const isTeacher = this.isTeacherRole(roleName);
    const isCreator = task.createdBy.toString() === user.userId;
    const isManager =
      roleName === 'Admin' ||
      roleName.toLowerCase().includes('supervisor') ||
      roleName.toLowerCase().includes('quản sinh') ||
      (user.permissions || []).includes('UPDATE_STUDENT_TASK') ||
      (isTeacher && isCreator);

    // Tìm progress active của user hiện tại
    const progress = await this.studentTaskProgressService.findProgressByUserAndTask(
      user.userId,
      id
    );

    let allowed = false;
    if (isManager) {
      allowed = true;
    } else {
      allowed = !!(progress && progress.isActive && mode === 'auto');
    }

    return {
      allowed,
      mode,
      linkedPage: task.linkedPage || '',
      progressId: progress && progress.isActive ? progress._id.toString() : undefined,
    };
  }
}
