import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ClubScheduleActiveNotificationService } from './club-schedule-active-notification.service';
import { ClubSchedule } from './schemas/club-schedule.schema';
import { ClubMember } from '../clubs/schemas/club-member.schema';
import { Student } from '../students/schemas/student.schema';
import { NotificationsService } from '../notifications/notifications.service';

describe('ClubScheduleActiveNotificationService', () => {
  let service: ClubScheduleActiveNotificationService;
  let scheduleModel: any;
  let clubMemberModel: any;
  let notificationsService: any;

  const mockScheduleId = new Types.ObjectId();
  const mockClubId = new Types.ObjectId();
  const mockSemesterId = new Types.ObjectId();
  const mockStudentId = new Types.ObjectId();
  const mockUserId = new Types.ObjectId();

  const mockActiveSchedules = [
    {
      _id: mockScheduleId,
      club_id: mockClubId,
      semester_id: mockSemesterId,
      title: 'Active Workout',
      location: 'Gym room',
      status: 'scheduled',
      start_time: new Date(),
      end_time: new Date(Date.now() + 60 * 60 * 1000),
    },
  ];

  const mockClubMembers = [
    {
      _id: new Types.ObjectId(),
      club_id: mockClubId,
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
        ClubScheduleActiveNotificationService,
        {
          provide: getModelToken(ClubSchedule.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue(mockActiveSchedules),
            }),
          },
        },
        {
          provide: getModelToken(ClubMember.name),
          useValue: {
            find: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue(mockClubMembers),
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

    service = module.get<ClubScheduleActiveNotificationService>(
      ClubScheduleActiveNotificationService,
    );
    scheduleModel = module.get(getModelToken(ClubSchedule.name));
    clubMemberModel = module.get(getModelToken(ClubMember.name));
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

      expect(clubMemberModel.find).toHaveBeenCalledWith({
        club_id: mockClubId,
        semester_id: mockSemesterId,
        status: 'active',
      });

      expect(notificationsService.createOnce).toHaveBeenCalledWith(
        {
          title: 'Club session is happening now',
          description: '"Active Workout" is happening now at Gym room.',
          type: 'info',
          routeUrl: `/activities/${mockClubId}?tab=schedule`,
          recipientUserId: mockUserId.toString(),
          targetRole: 'student',
          source: 'club_schedule_active',
          metadata: {
            schedule_id: mockScheduleId.toString(),
            club_id: mockClubId.toString(),
            semester_id: mockSemesterId.toString(),
            start_time: mockActiveSchedules[0].start_time.toISOString(),
            end_time: mockActiveSchedules[0].end_time.toISOString(),
          },
        },
        `club_schedule_active:${mockScheduleId}:${mockUserId}`,
      );
    });

    it('should skip members without a linked user_id', async () => {
      clubMemberModel.find.mockReturnValueOnce({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            club_id: mockClubId,
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
      expect(clubMemberModel.find).not.toHaveBeenCalled();
      expect(notificationsService.createOnce).not.toHaveBeenCalled();
    });
  });
});
