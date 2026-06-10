import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { StudentTasksService } from './student-tasks.service';
import { StudentTask } from './schemas/student-task.schema';
import { Student } from '../students/schemas/student.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { StudentTaskProgressService } from '../student-task-progress/student-task-progress.service';
import { Types } from 'mongoose';

const mockUserId = new Types.ObjectId().toString();
const mockTaskId = new Types.ObjectId().toString();
const mockStudentId = new Types.ObjectId();
const mockClassId = new Types.ObjectId();

const mockTask = {
  _id: new Types.ObjectId(mockTaskId),
  title: 'Test Student Task',
  type: 'assignment',
  subject: 'Test Subject',
  deadline: new Date(),
  priority: 'high',
  status: 'not_started',
  linkedPage: '/students',
  targetType: 'student',
  targetScope: 'all',
  targetStudentIds: [] as any[],
  targetClassIds: [] as any[],
  targetTeacherIds: [] as any[],
  createdBy: new Types.ObjectId(mockUserId),
  deletedAt: null,
  save: jest.fn(),
  toObject: jest.fn(function () {
    const { save, toObject, ...plain } = this;
    return plain;
  }),
};

const mockProgress = {
  _id: new Types.ObjectId(),
  taskId: new Types.ObjectId(mockTaskId),
  assigneeUserId: new Types.ObjectId(mockUserId),
  status: 'not_started',
  isActive: true,
  startedAt: undefined,
  completedAt: undefined,
};

describe('StudentTasksService', () => {
  let service: StudentTasksService;
  let model: any;
  let studentModel: any;
  let notificationsService: any;
  let studentTaskProgressService: any;

  beforeEach(async () => {
    mockTask.save.mockReset();
    mockTask.targetType = 'student';
    mockTask.targetScope = 'all';
    mockTask.targetStudentIds = [];
    mockTask.targetClassIds = [];

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentTasksService,
        {
          provide: StudentTaskProgressService,
          useValue: {
            syncProgressForTask: jest.fn().mockResolvedValue(undefined),
            findProgressByUser: jest.fn().mockResolvedValue([mockProgress]),
            findProgressByUserAndTasks: jest.fn().mockResolvedValue([mockProgress]),
            findProgressByUserAndTask: jest.fn().mockResolvedValue(mockProgress),
            updateStatus: jest.fn().mockResolvedValue({ ...mockProgress, status: 'completed' }),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: getModelToken(Student.name),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({
                _id: mockStudentId,
                class_id: mockClassId,
                user_id: new Types.ObjectId(mockUserId),
              }),
            }),
          },
        },
        {
          provide: getModelToken(StudentTask.name),
          useValue: Object.assign(
            jest.fn().mockImplementation((dto) => ({
              ...dto,
              save: jest.fn().mockResolvedValue({
                _id: new Types.ObjectId(),
                ...dto,
                save: jest.fn(),
              }),
            })),
            {
              find: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                populate: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([mockTask]),
              }),
              countDocuments: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(1),
              }),
              findByIdAndUpdate: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockTask),
              }),
              findOne: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(mockTask),
              }),
            },
          ),
        },
      ],
    }).compile();

    service = module.get<StudentTasksService>(StudentTasksService);
    model = module.get(getModelToken(StudentTask.name));
    studentModel = module.get(getModelToken(Student.name));
    notificationsService = module.get<NotificationsService>(NotificationsService);
    studentTaskProgressService = module.get<StudentTaskProgressService>(StudentTaskProgressService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a task', async () => {
      const dto = {
        title: 'New Student Task',
        type: 'assignment',
        subject: 'Math',
        deadline: '2026-10-25',
        priority: 'high',
        status: 'not_started',
        linkedPage: '/students',
        targetType: 'student',
        targetScope: 'all',
      };
      const result = await service.create(dto, mockUserId);
      expect(result).toBeDefined();
      expect(notificationsService.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException if deadline is invalid', async () => {
      const dto = {
        title: 'New Student Task',
        type: 'assignment',
        subject: 'Math',
        deadline: 'invalid-date',
        priority: 'high',
        status: 'not_started',
        linkedPage: '/students',
        targetType: 'student',
        targetScope: 'all',
      };
      await expect(service.create(dto, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if targetScope is specific and no targetDetail', async () => {
      const dto = {
        title: 'New Student Task',
        type: 'assignment',
        subject: 'Math',
        deadline: '2026-10-25',
        priority: 'high',
        status: 'not_started',
        linkedPage: '/students',
        targetType: 'student',
        targetScope: 'specific',
      };
      await expect(service.create(dto, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if targetStudentIds contain invalid ObjectId', async () => {
      const dto = {
        title: 'New Student Task',
        type: 'assignment',
        subject: 'Math',
        deadline: '2026-10-25',
        priority: 'high',
        status: 'not_started',
        linkedPage: '/students',
        targetType: 'student',
        targetScope: 'all',
        targetStudentIds: ['invalid-id'],
      };
      await expect(service.create(dto, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if targetScope is specific, targetType is student and no student/class IDs provided', async () => {
      const dto = {
        title: 'New Student Task',
        type: 'assignment',
        subject: 'Math',
        deadline: '2026-10-25',
        priority: 'high',
        status: 'not_started',
        linkedPage: '/students',
        targetType: 'student',
        targetScope: 'specific',
        targetDetail: 'Some class',
        targetStudentIds: [],
        targetClassIds: [],
      };
      await expect(service.create(dto, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if targetScope is specific, targetType is teacher and no teacher IDs provided', async () => {
      const dto = {
        title: 'New Student Task',
        type: 'assignment',
        subject: 'Math',
        deadline: '2026-10-25',
        priority: 'high',
        status: 'not_started',
        linkedPage: '/students',
        targetType: 'teacher',
        targetScope: 'specific',
        targetDetail: 'Some teacher',
        targetTeacherIds: [],
      };
      await expect(service.create(dto, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if targetScope is specific and targetType is supervisor', async () => {
      const dto = {
        title: 'New Student Task',
        type: 'assignment',
        subject: 'Math',
        deadline: '2026-10-25',
        priority: 'high',
        status: 'not_started',
        linkedPage: '/students',
        targetType: 'supervisor',
        targetScope: 'specific',
        targetDetail: 'Some supervisor',
      };
      await expect(service.create(dto, mockUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should query list and compute KPI summaries for Admin', async () => {
      const query = { page: 1, limit: 6 };
      const user = { userId: mockUserId, roleName: 'Admin' };
      const result = await service.findAll(query, user);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.summary).toBeDefined();
      expect(result.summary.totalTasks).toEqual(1);
    });

    it('should filter task for Student and fetch student details', async () => {
      const query = { page: 1, limit: 6 };
      const user = { userId: mockUserId, roleName: 'Student' };
      const result = await service.findAll(query, user);

      expect(result).toBeDefined();
      expect(studentModel.findOne).toHaveBeenCalled();
    });

    it('should compute KPI summaries and filter items based on userProgress status for Student role', async () => {
      // Mock student progress có status completed
      studentTaskProgressService.findProgressByUser.mockResolvedValueOnce([
        { ...mockProgress, taskId: mockTask._id, status: 'completed' }
      ]);
      studentTaskProgressService.findProgressByUserAndTasks.mockResolvedValueOnce([
        { ...mockProgress, taskId: mockTask._id, status: 'completed' }
      ]);
      
      const query = { page: 1, limit: 6, status: 'completed' };
      const user = { userId: mockUserId, roleName: 'Student' };

      // Mock find cho student tasks
      // Lần 1 gọi find() cho visibleTasks, lần 2 gọi find() cho items. Cả 2 lần đều trả về mockTask.
      model.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([mockTask]),
      }).mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockTask]),
      });

      const result = await service.findAll(query, user);

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(1);
      expect(result.summary).toBeDefined();
      // completedTasks KPI phải bằng 1 dựa trên progress, thay vì 0 dựa trên mockTask.status = 'not_started'
      expect(result.summary.completedTasks).toEqual(1);
      expect(result.summary.progressPercentage).toEqual(100);
    });

    it('should exclude progress of soft-deleted tasks from KPI calculations for Student role', async () => {
      const mockTaskId1 = new Types.ObjectId();
      const mockTaskId2 = new Types.ObjectId();
      
      const mockProgress1 = {
        _id: new Types.ObjectId(),
        taskId: mockTaskId1,
        assigneeUserId: new Types.ObjectId(mockUserId),
        status: 'not_started',
        isActive: true,
      };
      
      const mockProgress2 = {
        _id: new Types.ObjectId(),
        taskId: mockTaskId2,
        assigneeUserId: new Types.ObjectId(mockUserId),
        status: 'completed',
        isActive: true,
      };

      // Mock findProgressByUser trả về cả 2 progress
      studentTaskProgressService.findProgressByUser.mockResolvedValueOnce([
        mockProgress1,
        mockProgress2,
      ]);

      // Mock studentTaskModel.find cho lấy visible tasks: chỉ trả về Task 1
      const mockActiveTask = {
        _id: mockTaskId1,
        title: 'Active Task',
        priority: 'high',
        deletedAt: null,
        toObject: jest.fn().mockReturnValue({ _id: mockTaskId1, title: 'Active Task' }),
      };

      // Lần 1: visibleTasks, Lần 2: items
      model.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([mockActiveTask]),
      }).mockReturnValueOnce({
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([mockActiveTask]),
      });

      studentTaskProgressService.findProgressByUserAndTasks.mockResolvedValueOnce([mockProgress1]);

      const query = { page: 1, limit: 6 };
      const user = { userId: mockUserId, roleName: 'Student' };
      
      const result = await service.findAll(query, user);
      
      expect(result).toBeDefined();
      expect(result.summary.totalTasks).toEqual(1); // Chỉ tính mockProgress1 vì mockProgress2 thuộc task 2 đã bị soft deleted
      expect(result.summary.completedTasks).toEqual(0);
    });
  });

  describe('findOne', () => {
    it('should return details for authorized users', async () => {
      const user = { userId: mockUserId, roleName: 'Admin' };
      const result = await service.findOne(mockTaskId, user);
      expect(result).toBeDefined();
    });

    it('should allow student if task is scope all', async () => {
      const user = { userId: mockUserId, roleName: 'Student' };
      const result = await service.findOne(mockTaskId, user);
      expect(result).toBeDefined();
    });

    it('should deny student if task is scope specific and student is not assigned', async () => {
      mockTask.targetScope = 'specific';
      mockTask.targetStudentIds = [new Types.ObjectId() as any];
      mockTask.targetClassIds = [new Types.ObjectId() as any];
      
      const user = { userId: mockUserId, roleName: 'Student' };
      await expect(service.findOne(mockTaskId, user)).rejects.toThrow(ForbiddenException);
    });

    it('should allow student if task is scope specific and student is assigned', async () => {
      mockTask.targetScope = 'specific';
      mockTask.targetStudentIds = [mockStudentId as any];
      
      const user = { userId: mockUserId, roleName: 'Student' };
      const result = await service.findOne(mockTaskId, user);
      expect(result).toBeDefined();
    });

    it('should allow teacher if targetType is teacher and scope is specific and assigned', async () => {
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...mockTask,
          targetType: 'teacher',
          targetScope: 'specific',
          targetTeacherIds: [new Types.ObjectId(mockUserId)],
          createdBy: new Types.ObjectId(),
        }),
      });
      const user = { userId: mockUserId, roleName: 'Teacher' };
      const result = await service.findOne(mockTaskId, user);
      expect(result).toBeDefined();
    });

    it('should deny teacher if targetType is teacher and scope is specific and not assigned', async () => {
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...mockTask,
          targetType: 'teacher',
          targetScope: 'specific',
          targetTeacherIds: [new Types.ObjectId()],
          createdBy: new Types.ObjectId(),
        }),
      });
      const user = { userId: mockUserId, roleName: 'Teacher' };
      await expect(service.findOne(mockTaskId, user)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if task does not exist', async () => {
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      const user = { userId: mockUserId, roleName: 'Admin' };
      await expect(service.findOne(mockTaskId, user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should allow student to update status of scope all task (updates progress)', async () => {
      const user = { userId: mockUserId, roleName: 'Student' };
      
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockTask),
      }).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockTask),
      });

      const result = await service.updateStatus(mockTaskId, 'completed', user);
      expect(result).toBeDefined();
      expect(studentTaskProgressService.updateStatus).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if student progress not found', async () => {
      const user = { userId: mockUserId, roleName: 'Student' };
      studentTaskProgressService.findProgressByUserAndTask.mockResolvedValueOnce(null);

      await expect(service.updateStatus(mockTaskId, 'completed', user)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if student progress is inactive', async () => {
      const user = { userId: mockUserId, roleName: 'Student' };
      studentTaskProgressService.findProgressByUserAndTask.mockResolvedValueOnce({
        ...mockProgress,
        isActive: false,
      });

      await expect(service.updateStatus(mockTaskId, 'completed', user)).rejects.toThrow(BadRequestException);
    });

    it('should deny student to update status of non-assigned specific task', async () => {
      mockTask.targetScope = 'specific';
      mockTask.targetStudentIds = [new Types.ObjectId() as any];
      
      const user = { userId: mockUserId, roleName: 'Student' };
      await expect(service.updateStatus(mockTaskId, 'completed', user)).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if student attempts to update teacher task', async () => {
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...mockTask,
          targetType: 'teacher',
        }),
      });
      const user = { userId: mockUserId, roleName: 'Student' };
      await expect(service.updateStatus(mockTaskId, 'completed', user)).rejects.toThrow(ForbiddenException);
    });

    it('should allow teacher if they are the creator (updates progress if no manage permission)', async () => {
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...mockTask,
          targetType: 'teacher',
          createdBy: new Types.ObjectId(mockUserId),
        }),
      }).mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockTask),
      });
      const user = { userId: mockUserId, roleName: 'Teacher' };
      const result = await service.updateStatus(mockTaskId, 'completed', user);
      expect(result).toBeDefined();
      expect(studentTaskProgressService.updateStatus).toHaveBeenCalled();
    });

    it('should deny teacher if they are not creator and not assigned', async () => {
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...mockTask,
          targetType: 'teacher',
          targetScope: 'specific',
          targetTeacherIds: [new Types.ObjectId()],
          createdBy: new Types.ObjectId(),
        }),
      });
      const user = { userId: mockUserId, roleName: 'Teacher', permissions: [] };
      await expect(service.updateStatus(mockTaskId, 'completed', user)).rejects.toThrow(ForbiddenException);
    });

    it('should allow teacher if they have UPDATE_STUDENT_TASK permission even if not creator/assigned', async () => {
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...mockTask,
          targetType: 'teacher',
          targetScope: 'specific',
          targetTeacherIds: [new Types.ObjectId()],
          createdBy: new Types.ObjectId(),
        }),
      });
      const user = { userId: mockUserId, roleName: 'Teacher', permissions: ['UPDATE_STUDENT_TASK'] };
      mockTask.save.mockResolvedValueOnce({ ...mockTask, status: 'completed' });
      const result = await service.updateStatus(mockTaskId, 'completed', user);
      expect(result).toBeDefined();
      expect(mockTask.save).toHaveBeenCalled();
    });

    it('should deny other roles (e.g. Guest) without UPDATE_STUDENT_TASK permission', async () => {
      const user = { userId: mockUserId, roleName: 'Guest', permissions: [] };
      await expect(service.updateStatus(mockTaskId, 'completed', user)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('should successfully update a task', async () => {
      const dto = { title: 'Updated Title' };
      const result = await service.update(mockTaskId, dto, mockUserId);
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if update violates specific student target validation', async () => {
      const dto = {
        targetScope: 'specific',
        targetStudentIds: [],
        targetClassIds: [],
      };
      await expect(service.update(mockTaskId, dto, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if update violates specific teacher target validation', async () => {
      const dto = {
        targetType: 'teacher',
        targetScope: 'specific',
        targetTeacherIds: [],
      };
      await expect(service.update(mockTaskId, dto, mockUserId)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if update sets supervisor specific', async () => {
      const dto = {
        targetType: 'supervisor',
        targetScope: 'specific',
      };
      await expect(service.update(mockTaskId, dto, mockUserId)).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should soft delete and set deletedAt', async () => {
      mockTask.save.mockResolvedValueOnce({ ...mockTask, deletedAt: new Date() });
      const result = await service.remove(mockTaskId, mockUserId);
      expect(result).toBeDefined();
    });
  });
});
