import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ActivityScheduleActiveNotificationService } from './activity-schedule-active-notification.service';
import { ActivitySchedule } from './schemas/activity-schedule.schema';
import { ActivityMember } from '../activities/schemas/activity-member.schema';
import { Student } from '../students/schemas/student.schema';
import { NotificationsService } from '../notifications/notifications.service';

describe('ActivityScheduleActiveNotificationService', () => {
  let service: ActivityScheduleActiveNotificationService;
  let scheduleModel: any;
  let activityMemberModel: any;
  let notificationsService: any;

  const mockScheduleId = new Types.ObjectId();
  const mockActivityId = new Types.ObjectId();
  const mockSemesterId = new Types.ObjectId();
  const mockStudentId = new Types.ObjectId();
  const mockUserId = new Types.ObjectId();

  const mockActiveSchedules = [
    {
      _id: mockScheduleId,
      activity_id: mockActivityId,
      semester_id: mockSemesterId,
      title: 'Active Workout',
      location: 'Gym room',
      status: 'scheduled',
      start_time: new Date(),
      end_time: new Date(Date.now() + 60 * 60 * 1000),
    },
  ];

  const mockActivityMembers = [
    {
      _id: new Types.ObjectId(),
      activity_id: mockActivityId,
      semester_id: mockSemesterId,
      status: 'active',
      student_id: {
        _id: mockStudentId,
        user_id: mockUserId,
      },
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityScheduleActiveNotificationService,
        {
          provide: getModelToken(ActivitySchedule.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue(mockActiveSchedules),
            }),
          },
        },
        {
          provide: getModelToken(ActivityMember.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue(mockActivityMembers),
            }),
          },
        },
        {
          provide: getModelToken(Student.name),
          useValue: {},
        },
        {
          provide: NotificationsService,
          useValue: {
            createOnce: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<ActivityScheduleActiveNotificationService>(
      ActivityScheduleActiveNotificationService,
    );
    scheduleModel = module.get(getModelToken(ActivitySchedule.name));
    activityMemberModel = module.get(getModelToken(ActivityMember.name));
    notificationsService = module.get(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleCron', () => {
    it('should query active schedules and send notifications to eligible active members', async () => {
      await service.handleCron();

      expect(scheduleModel.find).toHaveBeenCalledWith({
        status: { $in: ['scheduled', 'ongoing'] },
        start_time: { $lte: expect.any(Date) },
        end_time: { $gt: expect.any(Date) },
      });

      expect(activityMemberModel.find).toHaveBeenCalledWith({
        activity_id: mockActivityId,
        semester_id: mockSemesterId,
        status: 'active',
      });

      expect(notificationsService.createOnce).toHaveBeenCalledWith(
        {
          title: 'Activity session is happening now',
          description: '"Active Workout" is happening now at Gym room.',
          type: 'info',
          routeUrl: `/activities/${mockActivityId}?tab=schedule`,
          recipientUserId: mockUserId.toString(),
          targetRole: 'student',
          source: 'club_schedule_active',
          metadata: {
            schedule_id: mockScheduleId.toString(),
            activity_id: mockActivityId.toString(),
            semester_id: mockSemesterId.toString(),
            start_time: mockActiveSchedules[0].start_time.toISOString(),
            end_time: mockActiveSchedules[0].end_time.toISOString(),
          },
        },
        `club_schedule_active:${mockScheduleId}:${mockUserId}`,
      );
    });

    it('should skip members without a linked user_id', async () => {
      activityMemberModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            activity_id: mockActivityId,
            semester_id: mockSemesterId,
            status: 'active',
            student_id: {
              _id: mockStudentId,
              user_id: null,
            },
          },
        ]),
      });

      await service.handleCron();
      expect(notificationsService.createOnce).not.toHaveBeenCalled();
    });

    it('should not query or send if no active schedules are found', async () => {
      scheduleModel.find.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.handleCron();
      expect(activityMemberModel.find).not.toHaveBeenCalled();
      expect(notificationsService.createOnce).not.toHaveBeenCalled();
    });
  });
});
