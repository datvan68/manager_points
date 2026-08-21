import { Test, TestingModule } from '@nestjs/testing';
import { ActivitiesController } from './activities.controller';
import { ActivitiesService } from './activities.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { checkPermission } from '../auth/guards/check-permission.guard';
import { ActivitiesRealtimeService } from './activities-realtime.service';
import { StorageService } from '../core/storage/storage.service';
import { ImageProcessorService } from '../core/storage/image-processor.service';

describe('ActivitiesController', () => {
  let controller: ActivitiesController;
  let service: ActivitiesService;
  let storageService: StorageService;
  let imageProcessor: ImageProcessorService;

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

  const mockStorageService = {
    saveBuffer: jest.fn().mockResolvedValue({
      key: 'public/activities/covers/cover-123.webp',
      url: '/api/media/public/activities/covers/cover-123.webp',
      filename: 'cover-123.webp',
      mime_type: 'image/webp',
      size: 1024,
    }),
  };

  const mockImageProcessor = {
    processImage: jest.fn().mockResolvedValue({
      buffer: Buffer.from('processed-image-bytes'),
      mime_type: 'image/webp',
      extension: 'webp',
      width: 1200,
      height: 600,
      size: 1024,
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ActivitiesController],
      providers: [
        {
          provide: ActivitiesService,
          useValue: mockActivitiesService,
        },
        {
          provide: ActivitiesRealtimeService,
          useValue: { connect: jest.fn() },
        },
        {
          provide: StorageService,
          useValue: mockStorageService,
        },
        {
          provide: ImageProcessorService,
          useValue: mockImageProcessor,
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
    storageService = module.get<StorageService>(StorageService);
    imageProcessor = module.get<ImageProcessorService>(ImageProcessorService);
  });

  describe('uploadMedia', () => {
    it('should process image through ImageProcessorService and save to StorageService', async () => {
      const mockFile = {
        buffer: Buffer.from('raw-image-bytes'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
        size: 2048,
      } as Express.Multer.File;

      const result = await controller.uploadMedia(mockFile, 'cover');

      expect(imageProcessor.processImage).toHaveBeenCalledWith(mockFile.buffer, 'activity_cover');
      expect(storageService.saveBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          namespace: 'activities',
          subfolder: 'covers',
          visibility: 'public',
        }),
      );
      expect(result.url).toBe('/api/media/public/activities/covers/cover-123.webp');
      expect(result.kind).toBe('cover');
    });
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
