import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';

describe('ActivitiesController', () => {
  let controller: ActivitiesController;
  let service: ActivitiesService;

  const mockActivitiesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findMembers: jest.fn(),
    addMember: jest.fn(),
    joinActivity: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
    approveMember: jest.fn(),
    getActivityStats: jest.fn(),
    leaveActivity: jest.fn(),
    switchActivity: jest.fn(),
    adminTransferActivity: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        {
          provide: ActivitiesService,
          useValue: mockActivitiesService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(checkPermission(''))
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ActivitiesController>(ActivitiesController);
    service = module.get<ActivitiesService>(ActivitiesService);
  });

  describe('route-to-service requester propagation', () => {
    it('should propagate userId to joinActivity service method', async () => {
      const activityId = 'club123';
      const semesterId = 'sem123';
      const userId = 'user789';
      
      const req = { user: { userId } };
      const dto = { semester_id: semesterId };

      await controller.joinActivity(activityId, dto, req);

      expect(service.joinActivity).toHaveBeenCalledWith(activityId, userId, dto);
    });

    it('should propagate userId to leaveActivity service method', async () => {
      const activityId = 'club123';
      const semesterId = 'sem123';
      const userId = 'user789';

      const req = { user: { userId } };
      const dto = { semester_id: semesterId };

      await controller.leaveActivity(activityId, dto, req);

      expect(service.leaveActivity).toHaveBeenCalledWith(activityId, userId, dto);
    });

    it('should propagate userId to switchActivity service method', async () => {
      const targetActivityId = 'club456';
      const semesterId = 'sem123';
      const userId = 'user789';

      const req = { user: { userId } };
      const dto = { semester_id: semesterId };

      await controller.switchActivity(targetActivityId, dto, req);

      expect(service.switchActivity).toHaveBeenCalledWith(targetActivityId, userId, dto);
    });

    it('should propagate userId to adminTransferActivity service method', async () => {
      const targetActivityId = 'club456';
      const studentId = 'student123';
      const semesterId = 'sem123';
      const adminUserId = 'admin999';

      const req = { user: { userId: adminUserId } };
      const dto = { student_id: studentId, semester_id: semesterId };

      await controller.adminTransferActivity(targetActivityId, dto, req);

      expect(service.adminTransferActivity).toHaveBeenCalledWith(targetActivityId, adminUserId, dto);
    });

    it('should propagate userId to approveMember service method', async () => {
      const activityId = 'club123';
      const memberId = 'member456';
      const approverUserId = 'user789';
      
      const req = { user: { userId: approverUserId } };
      const dto = { status: 'active' };

      await controller.approveMember(activityId, memberId, dto, req);

      expect(service.approveMember).toHaveBeenCalledWith(activityId, memberId, dto, approverUserId);
    });
  });
});
