import { Test, TestingModule } from '@nestjs/testing';
import { StudentTasksController } from './student-tasks.controller';
import { StudentTasksService } from './student-tasks.service';
import { CreateStudentTaskDto } from './dto/create-student-task.dto';
import { UpdateStudentTaskDto } from './dto/update-student-task.dto';

describe('StudentTasksController', () => {
  let controller: StudentTasksController;
  let service: StudentTasksService;

  const mockTask = {
    _id: 'task-123',
    title: 'Test Controller Task',
    type: 'assignment',
    subject: 'Math',
    status: 'not_started',
    priority: 'medium',
    targetType: 'student',
    targetScope: 'all',
  };

  const mockStudentTasksService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StudentTasksController],
      providers: [
        {
          provide: StudentTasksService,
          useValue: mockStudentTasksService,
        },
      ],
    }).compile();

    controller = module.get<StudentTasksController>(StudentTasksController);
    service = module.get<StudentTasksService>(StudentTasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should call service.create with dto and creatorId', async () => {
      const dto: CreateStudentTaskDto = {
        title: 'New Task',
        type: 'assignment',
        subject: 'Math',
        deadline: '2026-12-31',
        priority: 'medium',
        status: 'not_started',
        linkedPage: '/students',
        targetType: 'student',
        targetScope: 'all',
      };
      const req = { user: { userId: 'user-creator' } };
      mockStudentTasksService.create.mockResolvedValue({ ...mockTask, ...dto });

      const result = await controller.create(dto, req);

      expect(service.create).toHaveBeenCalledWith(dto, 'user-creator');
      expect(result.title).toEqual('New Task');
    });
  });

  describe('findAll', () => {
    it('should call service.findAll with query and user context', async () => {
      const query = { page: 1, limit: 10 };
      const req = { user: { userId: 'user-123', roleName: 'Student' } };
      const mockList = { items: [mockTask], total: 1 };
      mockStudentTasksService.findAll.mockResolvedValue(mockList);

      const result = await controller.findAll(query, req);

      expect(service.findAll).toHaveBeenCalledWith(query, req.user);
      expect(result).toEqual(mockList);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id and user context', async () => {
      const req = { user: { userId: 'user-123', roleName: 'Student' } };
      mockStudentTasksService.findOne.mockResolvedValue(mockTask);

      const result = await controller.findOne('task-123', req);

      expect(service.findOne).toHaveBeenCalledWith('task-123', req.user);
      expect(result).toEqual(mockTask);
    });
  });

  describe('update', () => {
    it('should call service.update with id, dto, and updaterId', async () => {
      const dto: UpdateStudentTaskDto = { title: 'Updated Title' };
      const req = { user: { userId: 'user-updater' } };
      mockStudentTasksService.update.mockResolvedValue({ ...mockTask, title: 'Updated Title' });

      const result = await controller.update('task-123', dto, req);

      expect(service.update).toHaveBeenCalledWith('task-123', dto, 'user-updater');
      expect(result.title).toEqual('Updated Title');
    });
  });

  describe('updateStatus', () => {
    it('should call service.updateStatus with id, status, and user context', async () => {
      const req = { user: { userId: 'student-456', roleName: 'Student' } };
      const updatedMockTask = { ...mockTask, status: 'completed' };
      mockStudentTasksService.updateStatus.mockResolvedValue(updatedMockTask);

      const result = await controller.updateStatus('task-123', 'completed', req);

      expect(service.updateStatus).toHaveBeenCalledWith('task-123', 'completed', req.user);
      expect(result.status).toEqual('completed');
    });
  });

  describe('remove', () => {
    it('should call service.remove with id and deleterId', async () => {
      const req = { user: { userId: 'admin-789' } };
      mockStudentTasksService.remove.mockResolvedValue({ ...mockTask, deletedAt: new Date() });

      const result = await controller.remove('task-123', req);

      expect(service.remove).toHaveBeenCalledWith('task-123', 'admin-789');
      expect(result.deletedAt).toBeDefined();
    });
  });
});
