import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './schemas/notification.schema';
import { Types } from 'mongoose';

const mockUserId = new Types.ObjectId().toString();
const mockNotificationId = new Types.ObjectId().toString();

const mockNotification = {
  _id: new Types.ObjectId(mockNotificationId),
  title: 'Test Notification',
  description: 'Test Description',
  type: 'system',
  readByUserIds: [],
  deletedAt: null,
  recipientUserId: null,
  createdBy: null,
};

describe('NotificationsService', () => {
  let service: NotificationsService;
  let model: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: getModelToken(Notification.name),
          useValue: Object.assign(
            jest.fn().mockImplementation((dto) => ({
              ...dto,
              save: jest.fn().mockResolvedValue({
                _id: new Types.ObjectId(),
                ...dto,
                readByUserIds: [],
                toObject: function() { return this; },
              }),
            })),
            {
              find: jest.fn().mockReturnValue({
                sort: jest.fn().mockReturnThis(),
                skip: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                exec: jest.fn().mockResolvedValue([
                  {
                    ...mockNotification,
                    toObject: () => ({ ...mockNotification }),
                  },
                ]),
              }),
              countDocuments: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue(1),
              }),
              findByIdAndUpdate: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue({
                  ...mockNotification,
                  toObject: () => ({ ...mockNotification }),
                }),
              }),
              findOne: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue({
                  ...mockNotification,
                  toObject: () => ({ ...mockNotification }),
                }),
              }),
              updateMany: jest.fn().mockReturnValue({
                exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
              }),
            },
          ),
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    model = module.get(getModelToken(Notification.name));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should successfully create a notification', async () => {
      const dto = {
        title: 'New Event',
        description: 'New Description',
        type: 'info' as const,
      };
      const result = await service.create(dto, mockUserId);
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException if creatorId is invalid', async () => {
      const dto = { title: 'T', description: 'D' };
      await expect(service.create(dto, 'invalid-id')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated notifications', async () => {
      const result = await service.findAll({ page: 1, limit: 10 }, mockUserId, 'Student');
      expect(result).toBeDefined();
      expect(result.items).toBeDefined();
      expect(result.total).toEqual(1);
    });
  });

  describe('getUnreadCount', () => {
    it('should return unread count for Student', async () => {
      const result = await service.getUnreadCount(mockUserId, 'Student');
      expect(result).toBeDefined();
      expect(result.count).toEqual(1);
    });

    it('should return unread count for Admin', async () => {
      const result = await service.getUnreadCount(mockUserId, 'Admin');
      expect(result).toBeDefined();
      expect(result.count).toEqual(1);
    });
  });

  describe('getCountSummary', () => {
    it('should return count summary for all types', async () => {
      const result = await service.getCountSummary(mockUserId, 'Student');
      expect(result).toBeDefined();
      expect(result.all).toEqual(1);
      expect(result.unread).toEqual(1);
    });
  });

  describe('update', () => {
    it('should update and return updated notification for privileged user', async () => {
      const result = await service.update(mockNotificationId, { title: 'Updated Title' }, mockUserId, 'Admin');
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException if user is not privileged', async () => {
      await expect(
        service.update(mockNotificationId, { title: 'Updated Title' }, mockUserId, 'Student'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if not found', async () => {
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue(null),
      });
      await expect(
        service.update(mockNotificationId, {}, mockUserId, 'Admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('markRead', () => {
    it('should mark a notification as read', async () => {
      const result = await service.markRead(mockNotificationId, mockUserId, 'Student');
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException if private notification is not for this student', async () => {
      model.findOne.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...mockNotification,
          recipientUserId: new Types.ObjectId(), // different recipient
          toObject: () => ({ ...mockNotification, recipientUserId: new Types.ObjectId() }),
        }),
      });
      await expect(
        service.markRead(mockNotificationId, mockUserId, 'Student'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAllRead', () => {
    it('should mark all unread notifications as read for Student', async () => {
      const result = await service.markAllRead(mockUserId, 'Student');
      expect(result).toBeDefined();
    });

    it('should mark all unread notifications as read for Admin', async () => {
      const result = await service.markAllRead(mockUserId, 'Admin');
      expect(result).toBeDefined();
    });
  });

  describe('remove', () => {
    it('should soft delete notification for privileged user', async () => {
      const result = await service.remove(mockNotificationId, mockUserId, 'Admin');
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException for students trying to delete', async () => {
      await expect(
        service.remove(mockNotificationId, mockUserId, 'Student'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getReaders', () => {
    it('should return readers list for privileged user', async () => {
      const result = await service.getReaders(mockNotificationId, mockUserId, 'Admin');
      expect(result).toBeDefined();
    });

    it('should throw ForbiddenException if user is student', async () => {
      await expect(
        service.getReaders(mockNotificationId, mockUserId, 'Student'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
