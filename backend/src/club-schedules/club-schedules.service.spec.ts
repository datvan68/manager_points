import { Test, TestingModule } from '@nestjs/testing';
import { ClubSchedulesService } from './club-schedules.service';
import { getModelToken } from '@nestjs/mongoose';
import { ClubSchedule } from './schemas/club-schedule.schema';
import { ScheduleRegistration } from './schemas/schedule-registration.schema';
import { Semester } from '../semesters/schemas/semester.schema';
import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('ClubSchedulesService - Recurrence Date Range Validation', () => {
  let service: ClubSchedulesService;
  const mockUserId = new Types.ObjectId().toString();

  const mockClubScheduleModel = {
    insertMany: jest.fn().mockImplementation((arr) => Promise.resolve(arr)),
    create: jest.fn().mockImplementation((obj) => ({
      ...obj,
      save: jest.fn().mockResolvedValue(obj),
    })),
    findById: jest.fn(),
  };

  const mockScheduleRegistrationModel = {
    countDocuments: jest.fn(),
  };

  const mockSemesterModel = {
    findById: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        end_date: new Date('2026-12-31T23:59:59'),
      }),
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClubSchedulesService,
        {
          provide: getModelToken(ClubSchedule.name),
          useValue: mockClubScheduleModel,
        },
        {
          provide: getModelToken(ScheduleRegistration.name),
          useValue: mockScheduleRegistrationModel,
        },
        {
          provide: getModelToken(Semester.name),
          useValue: mockSemesterModel,
        },
      ],
    }).compile();

    service = module.get<ClubSchedulesService>(ClubSchedulesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequestException if end_time is before or equal to start_time', async () => {
    const dto: any = {
      club_id: new Types.ObjectId().toString(),
      title: 'Họp CLB',
      semester_id: new Types.ObjectId().toString(),
      start_time: new Date('2026-07-06T10:00:00'),
      end_time: new Date('2026-07-06T09:00:00'),
    };

    await expect(service.create(dto, mockUserId)).rejects.toThrow(
      new BadRequestException('Thời gian kết thúc phải sau thời gian bắt đầu'),
    );
  });

  it('should throw BadRequestException if recurrence until is before first activity start_time', async () => {
    const dto: any = {
      club_id: new Types.ObjectId().toString(),
      title: 'Họp CLB Định Kỳ',
      semester_id: new Types.ObjectId().toString(),
      start_time: new Date('2026-07-06T08:00:00'),
      end_time: new Date('2026-07-06T10:00:00'),
      recurrence: {
        type: 'weekly',
        until: new Date('2026-07-05T23:59:59'),
      },
    };

    await expect(service.create(dto, mockUserId)).rejects.toThrow(
      new BadRequestException(
        'Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên',
      ),
    );
  });

  it('should throw BadRequestException if recurrence until is before the arranged week Monday', async () => {
    const dto: any = {
      club_id: new Types.ObjectId().toString(),
      title: 'Họp CLB Định Kỳ',
      semester_id: new Types.ObjectId().toString(),
      start_time: new Date('2026-07-06T08:00:00'), // Arranged Monday
      end_time: new Date('2026-07-06T10:00:00'),
      recurrence: {
        type: 'weekly',
        until: new Date('2026-07-04T12:00:00'), // Previous Saturday
      },
    };

    await expect(service.create(dto, mockUserId)).rejects.toThrow(
      new BadRequestException(
        'Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu buổi sinh hoạt đầu tiên',
      ),
    );
  });

  it('should throw BadRequestException if repeat start date is before the arranged week Monday', async () => {
    const dto: any = {
      club_id: new Types.ObjectId().toString(),
      title: 'Họp CLB Định Kỳ',
      semester_id: new Types.ObjectId().toString(),
      start_time: new Date('2026-07-06T08:00:00'), // Arranged Monday
      end_time: new Date('2026-07-06T10:00:00'),
      recurrence: {
        type: 'weekly',
        start: new Date('2026-07-04T12:00:00'), // Previous Saturday
        until: new Date('2026-08-31T23:59:59'),
      },
    };

    await expect(service.create(dto, mockUserId)).rejects.toThrow(
      new BadRequestException('Ngày bắt đầu lặp lại không được trước tuần xếp lịch'),
    );
  });
  it('should throw BadRequestException if recurrence until is before repeat start date', async () => {
    const dto: any = {
      club_id: new Types.ObjectId().toString(),
      title: 'Họp CLB Định Kỳ',
      semester_id: new Types.ObjectId().toString(),
      start_time: new Date('2026-07-06T08:00:00'), // Arranged Monday
      end_time: new Date('2026-07-06T10:00:00'),
      recurrence: {
        type: 'weekly',
        start: new Date('2026-07-13T00:00:00'), // Week 2 Mon
        until: new Date('2026-07-12T23:59:59'), // Day before start date
      },
    };

    await expect(service.create(dto, mockUserId)).rejects.toThrow(
      new BadRequestException('Ngày kết thúc lặp lại phải bằng hoặc sau ngày bắt đầu lặp'),
    );
  });

  it('should generate recurrence sessions correctly, skipping those before repeat start date', async () => {
    const dto: any = {
      club_id: new Types.ObjectId().toString(),
      title: 'Họp CLB Định Kỳ',
      semester_id: new Types.ObjectId().toString(),
      start_time: new Date('2026-07-06T08:00:00'), // Week 1 Mon
      end_time: new Date('2026-07-06T10:00:00'),
      recurrence: {
        type: 'weekly',
        start: new Date('2026-07-20T00:00:00'), // Week 3 Mon
        until: new Date('2026-07-27T23:59:59'), // Week 4 Mon
      },
    };

    const res = await service.create(dto, mockUserId);
    expect(res).toBeDefined();

    // Verify insertMany was called with 3 sessions:
    // 1. The anchor session (i = 0): 2026-07-06
    // 2. The session on 2026-07-20 (i = 2)
    // 3. The session on 2026-07-27 (i = 3)
    // (i = 1: 2026-07-13 is skipped because it's before start date 2026-07-20)
    const insertedSchedules = mockClubScheduleModel.insertMany.mock.calls[0][0];
    expect(insertedSchedules.length).toBe(3);

    expect(insertedSchedules[0].start_time.toISOString()).toBe(new Date('2026-07-06T08:00:00').toISOString());
    expect(insertedSchedules[1].start_time.toISOString()).toBe(new Date('2026-07-20T08:00:00').toISOString());
    expect(insertedSchedules[2].start_time.toISOString()).toBe(new Date('2026-07-27T08:00:00').toISOString());
  });
});
