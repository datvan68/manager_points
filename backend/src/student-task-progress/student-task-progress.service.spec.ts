import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { StudentTaskProgressService } from './student-task-progress.service';
import { StudentTaskProgress } from './schemas/student-task-progress.schema';
import { StudentTask, StudentTaskStatus } from '../student-tasks/schemas/student-task.schema';
import { Student } from '../students/schemas/student.schema';
import { User } from '../auth/schemas/user.schema';
import { Role } from '../auth/schemas/role.schema';
import { Class } from '../classes/schemas/class.schema';

const mockUserId = new Types.ObjectId().toString();
const mockTaskId = new Types.ObjectId().toString();

const mockTask = {
  _id: new Types.ObjectId(mockTaskId),
  title: 'Linked Task',
  status: StudentTaskStatus.NOT_STARTED,
  linkedPage: '/students/record',
  deletedAt: null,
};

const mockProgress: {
  _id: Types.ObjectId;
  taskId: Types.ObjectId;
  assigneeUserId: Types.ObjectId;
  status: StudentTaskStatus;
  isActive: boolean;
  startedAt?: Date;
  completedAt?: Date;
  statusSource?: string;
  sourceType?: string;
  sourceId?: string;
  lastSyncedAt?: Date;
  save: jest.Mock<any>;
} = {
  _id: new Types.ObjectId(),
  taskId: new Types.ObjectId(mockTaskId),
  assigneeUserId: new Types.ObjectId(mockUserId),
  status: StudentTaskStatus.NOT_STARTED,
  isActive: true,
  startedAt: undefined,
  completedAt: undefined,
  statusSource: undefined,
  sourceType: undefined,
  sourceId: undefined,
  lastSyncedAt: undefined,
  save: jest.fn().mockImplementation(function (this: any) {
    return Promise.resolve(this);
  }),
};

describe('StudentTaskProgressService (Unit)', () => {
  let service: StudentTaskProgressService;
  let progressModel: any;
  let taskModel: any;

  beforeEach(async () => {
    mockProgress.status = StudentTaskStatus.NOT_STARTED;
    mockProgress.startedAt = undefined;
    mockProgress.completedAt = undefined;
    mockProgress.isActive = true;
    mockProgress.save.mockClear();

    mockTask.status = StudentTaskStatus.NOT_STARTED;
    mockTask.deletedAt = null;
    mockTask.linkedPage = '/students/record';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StudentTaskProgressService,
        {
          provide: getModelToken(StudentTaskProgress.name),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockProgress),
            }),
            findById: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockProgress),
            }),
            find: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockProgress]),
            }),
            updateOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ nModified: 1 }),
            }),
            updateMany: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ nModified: 1 }),
            }),
          },
        },
        {
          provide: getModelToken(StudentTask.name),
          useValue: {
            findOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockTask),
            }),
            findById: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue(mockTask),
            }),
            find: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue([mockTask]),
            }),
            updateOne: jest.fn().mockReturnValue({
              exec: jest.fn().mockResolvedValue({ nModified: 1 }),
            }),
          },
        },
        {
          provide: getModelToken(Student.name),
          useValue: {
            find: jest.fn(),
          },
        },
        {
          provide: getModelToken(User.name),
          useValue: {},
        },
        {
          provide: getModelToken(Role.name),
          useValue: {},
        },
        {
          provide: getModelToken(Class.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
          },
        },
        {
          provide: getModelToken('SummaryPoint'),
          useValue: {
            findById: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue(null),
            }),
            find: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue([]),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StudentTaskProgressService>(StudentTaskProgressService);
    progressModel = module.get(getModelToken(StudentTaskProgress.name));
    taskModel = module.get(getModelToken(StudentTask.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateProgressFromLinkedEvent', () => {
    it('should successfully update status to in_progress on started event', async () => {
      const dto = {
        taskId: mockTaskId,
        event: 'started' as const,
        linkedPage: '/students/record',
        sourceType: 'student_record',
        sourceId: 'record123',
      };
      const user = { userId: mockUserId, roleName: 'Student' };

      const result = await service.updateProgressFromLinkedEvent(dto, user);

      expect(result.status).toEqual(StudentTaskStatus.IN_PROGRESS);
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeUndefined();
      expect(mockProgress.save).toHaveBeenCalled();
    });

    it('should successfully update status to in_progress on completed event (save no longer completes)', async () => {
      const dto = {
        taskId: mockTaskId,
        event: 'completed' as const,
        linkedPage: '/students/record',
        sourceType: 'student_record',
        sourceId: 'record123',
      };
      const user = { userId: mockUserId, roleName: 'Student' };

      const result = await service.updateProgressFromLinkedEvent(dto, user);

      expect(result.status).toEqual(StudentTaskStatus.IN_PROGRESS);
      expect(result.startedAt).toBeDefined();
      expect(result.completedAt).toBeUndefined();
      expect(mockProgress.save).toHaveBeenCalled();
    });

    it('should be idempotent: subsequent started events do not overwrite startedAt', async () => {
      const originalStartedAt = new Date(Date.now() - 5000);
      mockProgress.startedAt = originalStartedAt;
      mockProgress.status = StudentTaskStatus.IN_PROGRESS;

      const dto = {
        taskId: mockTaskId,
        event: 'started' as const,
        linkedPage: '/students/record',
      };
      const user = { userId: mockUserId, roleName: 'Student' };

      const result = await service.updateProgressFromLinkedEvent(dto, user);

      expect(result.startedAt).toEqual(originalStartedAt);
    });

    it('should clear old sourceType and sourceId if the new event does not provide them', async () => {
      mockProgress.sourceType = 'student_record';
      mockProgress.sourceId = 'record123';

      const dto = {
        taskId: mockTaskId,
        event: 'started' as const,
        linkedPage: '/students/record',
      };
      const user = { userId: mockUserId, roleName: 'Student' };

      const result = await service.updateProgressFromLinkedEvent(dto, user);

      expect(result.sourceType).toBeUndefined();
      expect(result.sourceId).toBeUndefined();
    });

    it('should throw ForbiddenException if user has no active progress for the task', async () => {
      progressModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      const dto = {
        taskId: mockTaskId,
        event: 'started' as const,
        linkedPage: '/students/record',
      };
      const user = { userId: mockUserId, roleName: 'Student' };

      await expect(service.updateProgressFromLinkedEvent(dto, user)).rejects.toThrow(ForbiddenException);
    });

    it('should allow Admin to reset task progress', async () => {
      mockProgress.status = StudentTaskStatus.COMPLETED;
      mockProgress.startedAt = new Date();
      mockProgress.completedAt = new Date();

      const dto = {
        taskId: mockTaskId,
        event: 'reset' as const,
        linkedPage: '/students/record',
      };
      const user = { userId: mockUserId, roleName: 'Admin' };

      const result = await service.updateProgressFromLinkedEvent(dto, user);

      expect(result.status).toEqual(StudentTaskStatus.NOT_STARTED);
      expect(result.startedAt).toBeUndefined();
      expect(result.completedAt).toBeUndefined();
    });

    it('should calculate teacherProgress if targetType is teacher', async () => {
      taskModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...mockTask,
          targetType: 'teacher',
        }),
      });

      const mockSourceSummary = {
        semester_id: new Types.ObjectId(),
      };
      
      const summaryPointModel = (service as any).summaryPointModel;
      summaryPointModel.findById.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue(mockSourceSummary),
        }),
      });

      const classModel = (service as any).classModel;
      classModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId(), class_name: 'Lớp 1' }]),
        }),
      });

      const studentModel = (service as any).studentModel;
      studentModel.find.mockReturnValueOnce({
        select: jest.fn().mockReturnValueOnce({
          exec: jest.fn().mockResolvedValue([{ _id: new Types.ObjectId() }]),
        }),
      });

      summaryPointModel.find = jest.fn().mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            details: [{ sv_score: 10, gv_score: 10 }] // completed
          }
        ]),
      });

      const dto = {
        taskId: mockTaskId,
        event: 'completed' as const,
        linkedPage: '/students/record',
        sourceType: 'grading_score',
        sourceId: new Types.ObjectId().toString(),
      };
      const user = { userId: mockUserId, roleName: 'Teacher', user_name: 'Nguyen Van A' };

      const result = await service.updateProgressFromLinkedEvent(dto, user);

      expect(result.teacherProgress).toBeDefined();
      expect(result.teacherProgress?.completionRate).toEqual(100);
      expect(result.status).toEqual(StudentTaskStatus.IN_PROGRESS);
    });

    it('should calculate criteriaProgress if targetType is student and event from grading_score', async () => {
      taskModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...mockTask,
          targetType: 'student',
          createdBy: new Types.ObjectId(mockUserId), // to pass permission check
        }),
      });

      const mockStudentProgress = {
        ...mockProgress,
        studentId: new Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true),
      };

      progressModel.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(mockStudentProgress),
      });

      const summaryPointModel = (service as any).summaryPointModel;
      summaryPointModel.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          details: [
            { gv_score: 10, sv_score: 10 } // 1 completed criteria
          ]
        }),
      });

      const dto = {
        taskId: mockTaskId,
        event: 'completed' as const,
        linkedPage: '/students/record',
        sourceType: 'grading_score',
        sourceId: new Types.ObjectId().toString(),
        assigneeStudentId: new Types.ObjectId().toString(),
      };
      const user = { userId: mockUserId, roleName: 'Teacher' };

      const result = await service.updateProgressFromLinkedEvent(dto, user);

      expect(result.criteriaProgress).toBeDefined();
      expect(result.criteriaProgress?.completionRate).toEqual(100);
      expect(result.statusSource).toEqual('linked_event');
      expect(result.sourceType).toEqual('grading_score');
      expect(result.sourceId).toEqual(dto.sourceId);
      expect(result.status).toEqual(StudentTaskStatus.IN_PROGRESS);
    });

    it('should deny non-admin to reset task progress', async () => {
      const dto = {
        taskId: mockTaskId,
        event: 'reset' as const,
        linkedPage: '/students/record',
      };
      const user = { userId: mockUserId, roleName: 'Student', permissions: [] };

      await expect(service.updateProgressFromLinkedEvent(dto, user)).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if linkedPage is mismatched', async () => {
      const dto = {
        taskId: mockTaskId,
        event: 'started' as const,
        linkedPage: '/wrong-page',
      };
      const user = { userId: mockUserId, roleName: 'Student' };

      await expect(service.updateProgressFromLinkedEvent(dto, user)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if task.linkedPage is empty', async () => {
      mockTask.linkedPage = '';
      const dto = {
        taskId: mockTaskId,
        event: 'started' as const,
        linkedPage: '/students/record',
      };
      const user = { userId: mockUserId, roleName: 'Student' };

      await expect(service.updateProgressFromLinkedEvent(dto, user)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if task.linkedPage is not in whitelist', async () => {
      mockTask.linkedPage = '/students';
      const dto = {
        taskId: mockTaskId,
        event: 'started' as const,
        linkedPage: '/students',
      };
      const user = { userId: mockUserId, roleName: 'Student' };

      await expect(service.updateProgressFromLinkedEvent(dto, user)).rejects.toThrow(BadRequestException);
    });
  });

  describe('recalculateTaskAggregateStatus', () => {
    it('should set task to not_started if all progress are not_started', async () => {
      progressModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { status: StudentTaskStatus.NOT_STARTED, isActive: true },
          { status: StudentTaskStatus.NOT_STARTED, isActive: true },
        ]),
      });

      await service.recalculateTaskAggregateStatus(mockTaskId);

      expect(taskModel.updateOne).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(mockTaskId) },
        { $set: { status: StudentTaskStatus.NOT_STARTED } }
      );
    });

    it('should set task to in_progress if at least one progress is in_progress', async () => {
      progressModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { status: StudentTaskStatus.NOT_STARTED, isActive: true },
          { status: StudentTaskStatus.IN_PROGRESS, isActive: true },
        ]),
      });

      await service.recalculateTaskAggregateStatus(mockTaskId);

      expect(taskModel.updateOne).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(mockTaskId) },
        { $set: { status: StudentTaskStatus.IN_PROGRESS } }
      );
    });

    it('should set task to completed if all progress are completed', async () => {
      progressModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { status: StudentTaskStatus.COMPLETED, isActive: true },
          { status: StudentTaskStatus.COMPLETED, isActive: true },
        ]),
      });

      await service.recalculateTaskAggregateStatus(mockTaskId);

      expect(taskModel.updateOne).toHaveBeenCalledWith(
        { _id: new Types.ObjectId(mockTaskId) },
        { $set: { status: StudentTaskStatus.COMPLETED } }
      );
    });
  });

  describe('updateStatus', () => {
    it('should successfully update status, set statusSource to manual, and clear audit source fields', async () => {
      mockProgress.statusSource = 'linked_event';
      mockProgress.sourceType = 'student_record';
      mockProgress.sourceId = '123';
      mockProgress.lastSyncedAt = new Date();

      const id = mockProgress._id.toString();
      const dto = { status: StudentTaskStatus.IN_PROGRESS };
      const user = { userId: mockUserId, roleName: 'Student' };

      const result = await service.updateStatus(id, dto, user);

      expect(result.status).toEqual(StudentTaskStatus.IN_PROGRESS);
      expect(result.statusSource).toEqual('manual');
      expect(result.sourceType).toBeUndefined();
      expect(result.sourceId).toBeUndefined();
      expect(result.lastSyncedAt).toBeUndefined();
      expect(mockProgress.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if progress record is not found', async () => {
      progressModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });

      const id = new Types.ObjectId().toString();
      const dto = { status: StudentTaskStatus.IN_PROGRESS };
      const user = { userId: mockUserId, roleName: 'Student' };

      await expect(service.updateStatus(id, dto, user)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProgressFromLinkedEvent additional checks', () => {
    it('should not call recalculateTaskAggregateStatus to complete if completed event received', async () => {
      const dto = {
        taskId: mockTaskId,
        event: 'completed' as const,
        linkedPage: '/students/record',
      };
      const user = { userId: mockUserId, roleName: 'Student' };

      const spy = jest.spyOn(service, 'recalculateTaskAggregateStatus');

      await service.updateProgressFromLinkedEvent(dto, user);

      expect(spy).toHaveBeenCalledWith(mockTaskId);
      spy.mockRestore();
    });
  });

  describe('LinkedTaskProgressEventDto Validation', () => {
    const { validate } = require('class-validator');
    const { LinkedTaskProgressEventDto } = require('./dto/linked-task-progress-event.dto');

    it('should fail validation with invalid taskId, invalid event, or invalid linkedPage', async () => {
      const dto = new LinkedTaskProgressEventDto();
      dto.taskId = 'invalid-mongo-id';
      dto.event = 'invalid_event' as any;
      dto.linkedPage = 'invalid-page-no-slash';

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      const taskIdError = errors.find((e: any) => e.property === 'taskId');
      const eventError = errors.find((e: any) => e.property === 'event');
      const pageError = errors.find((e: any) => e.property === 'linkedPage');

      expect(taskIdError).toBeDefined();
      expect(eventError).toBeDefined();
      expect(pageError).toBeDefined();
    });

    it('should pass validation with valid properties', async () => {
      const dto = new LinkedTaskProgressEventDto();
      dto.taskId = new Types.ObjectId().toString();
      dto.event = 'completed';
      dto.linkedPage = '/students/record';

      const errors = await validate(dto);
      expect(errors.length).toEqual(0);
    });
  });

  describe('cascadeStatusToActiveProgresses', () => {
    it('should successfully cascade status and call updateMany for active progress records', async () => {
      progressModel.updateMany = jest.fn().mockResolvedValue({ modifiedCount: 1 });
      const taskId = mockTaskId;
      const status = StudentTaskStatus.COMPLETED;
      const userId = mockUserId;

      const result = await service.cascadeStatusToActiveProgresses(taskId, status, userId);

      expect(progressModel.updateMany).toHaveBeenCalled();
      expect(result).toEqual({ matched: 1, modified: 2 });
    });
  });

  describe('finalizeExpiredTaskProgress', () => {
    it('should complete progress rows that started before or on deadline', async () => {
      const now = new Date('2026-06-28T00:00:00Z');
      const mockDeadline = new Date('2026-06-27T00:00:00Z');
      const mockStartedAt = new Date('2026-06-26T00:00:00Z');

      taskModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: new Types.ObjectId(mockTaskId), deadline: mockDeadline }
        ])
      });

      const activeProgress = {
        _id: new Types.ObjectId(),
        taskId: new Types.ObjectId(mockTaskId),
        status: StudentTaskStatus.IN_PROGRESS,
        startedAt: mockStartedAt,
        save: jest.fn().mockResolvedValue(true)
      };

      progressModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([activeProgress])
      });

      const spy = jest.spyOn(service, 'recalculateTaskAggregateStatus');
      spy.mockResolvedValue(undefined as any);

      const result = await service.finalizeExpiredTaskProgress(now);

      expect(result.tasksProcessed).toBe(1);
      expect(result.updatedRowsCount).toBe(1);
      expect(activeProgress.status).toBe(StudentTaskStatus.COMPLETED);
      expect(activeProgress.completedAt).toBe(mockDeadline);
      expect(activeProgress.statusSource).toBe('system');
      expect(activeProgress.sourceType).toBe('deadline_finalizer');
      expect(activeProgress.save).toHaveBeenCalled();
      expect(spy).toHaveBeenCalledWith(activeProgress.taskId.toString());

      spy.mockRestore();
    });

    it('should leave progress rows without startedAt incomplete', async () => {
      const now = new Date('2026-06-28T00:00:00Z');
      const mockDeadline = new Date('2026-06-27T00:00:00Z');

      taskModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([
          { _id: new Types.ObjectId(mockTaskId), deadline: mockDeadline }
        ])
      });

      const activeProgress = {
        _id: new Types.ObjectId(),
        taskId: new Types.ObjectId(mockTaskId),
        status: StudentTaskStatus.NOT_STARTED,
        startedAt: undefined,
        save: jest.fn()
      };

      progressModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([activeProgress])
      });

      const spy = jest.spyOn(service, 'recalculateTaskAggregateStatus');
      spy.mockResolvedValue(undefined as any);

      const result = await service.finalizeExpiredTaskProgress(now);

      expect(result.tasksProcessed).toBe(1);
      expect(result.updatedRowsCount).toBe(0);
      expect(activeProgress.save).not.toHaveBeenCalled();
      
      spy.mockRestore();
    });
  });
});
