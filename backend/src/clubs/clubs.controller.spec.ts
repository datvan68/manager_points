import { Test, TestingModule } from '@nestjs/testing';
import { ClubsController } from './clubs.controller';
import { ClubsService } from './clubs.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';

describe('ClubsController', () => {
  let controller: ClubsController;
  let service: ClubsService;

  const mockClubsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    findMembers: jest.fn(),
    addMember: jest.fn(),
    joinClub: jest.fn(),
    updateMember: jest.fn(),
    removeMember: jest.fn(),
    approveMember: jest.fn(),
    getClubStats: jest.fn(),
    leaveClub: jest.fn(),
    switchClub: jest.fn(),
    adminTransferClub: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClubsController],
      providers: [
        {
          provide: ClubsService,
          useValue: mockClubsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(checkPermission(''))
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ClubsController>(ClubsController);
    service = module.get<ClubsService>(ClubsService);
  });

  describe('route-to-service requester propagation', () => {
    it('should propagate userId to joinClub service method', async () => {
      const clubId = 'club123';
      const semesterId = 'sem123';
      const userId = 'user789';
      
      const req = { user: { userId } };
      const dto = { semester_id: semesterId };

      await controller.joinClub(clubId, dto, req);

      expect(service.joinClub).toHaveBeenCalledWith(clubId, userId, dto);
    });

    it('should propagate userId to leaveClub service method', async () => {
      const clubId = 'club123';
      const semesterId = 'sem123';
      const userId = 'user789';

      const req = { user: { userId } };
      const dto = { semester_id: semesterId };

      await controller.leaveClub(clubId, dto, req);

      expect(service.leaveClub).toHaveBeenCalledWith(clubId, userId, dto);
    });

    it('should propagate userId to switchClub service method', async () => {
      const targetClubId = 'club456';
      const semesterId = 'sem123';
      const userId = 'user789';

      const req = { user: { userId } };
      const dto = { semester_id: semesterId };

      await controller.switchClub(targetClubId, dto, req);

      expect(service.switchClub).toHaveBeenCalledWith(targetClubId, userId, dto);
    });

    it('should propagate userId to adminTransferClub service method', async () => {
      const targetClubId = 'club456';
      const studentId = 'student123';
      const semesterId = 'sem123';
      const adminUserId = 'admin999';

      const req = { user: { userId: adminUserId } };
      const dto = { student_id: studentId, semester_id: semesterId };

      await controller.adminTransferClub(targetClubId, dto, req);

      expect(service.adminTransferClub).toHaveBeenCalledWith(targetClubId, adminUserId, dto);
    });

    it('should propagate userId to approveMember service method', async () => {
      const clubId = 'club123';
      const memberId = 'member456';
      const approverUserId = 'user789';
      
      const req = { user: { userId: approverUserId } };
      const dto = { status: 'active' };

      await controller.approveMember(clubId, memberId, dto, req);

      expect(service.approveMember).toHaveBeenCalledWith(clubId, memberId, dto, approverUserId);
    });
  });
});
