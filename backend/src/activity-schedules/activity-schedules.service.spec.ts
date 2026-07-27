import { Test, TestingModule } from '@nestjs/testing';
import { ActivitySchedulesService } from './activity-schedules.service';
import { getModelToken } from '@nestjs/mongoose';
import { ActivitySchedule } from './schemas/activity-schedule.schema';
import { ScheduleRegistration } from './schemas/schedule-registration.schema';
import { Semester } from '../semesters/schemas/semester.schema';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Types } from 'mongoose';
import { ActivityAttendance } from '../activity-attendance/schemas/activity-attendance.schema';
import { Activity } from '../activities/schemas/activity.schema';
import { Student } from '../students/schemas/student.schema';

describe('ActivitySchedulesService - Recurrence Date Range Validation', () => {
  let service: ActivitySchedulesService;
  const mockUserId = new Types.ObjectId().toString();

  class MockModel {
    _id: any;
    constructor(public obj: any) {
      Object.assign(this, obj);
      if (!this._id) {
        this._id = new Types.ObjectId();
      }
    }
    save = jest.fn().mockResolvedValue(this);
    static insertMany = jest.fn().mockImplementation((arr) => Promise.resolve(arr));
    static create = jest.fn().mockImplementation((obj) => ({
      ...obj,
      save: jest.fn().mockResolvedValue(obj),
    }));
    static findById = jest.fn().mockReturnValue({ exec: jest.fn() });
    static find = jest.fn().mockReturnValue({ exec: jest.fn() });
    static findByIdAndUpdate = jest.fn().mockReturnValue({ exec: jest.fn() });
    static updateMany = jest.fn().mockReturnValue({ exec: jest.fn() });
  }

  const mockActivityScheduleModel = MockModel as any;

  const mockScheduleRegistrationModel = {
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
  };

  const mockSemesterModel = {
    findById: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        end_date: new Date('2026-12-31T23:59:59'),
      }),
    }),
  };

  const mockActivityAttendanceModel = {
    find: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    }),
  };

  const mockActivityModel = {
    findById: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        participation_status: 'published',
      }),
    }),
  };

  const mockStudentModel = {
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivitySchedulesService,
        {
          provide: getModelToken(ActivitySchedule.name),
          useValue: mockActivityScheduleModel,
        },
        {
          provide: getModelToken(ScheduleRegistration.name),
          useValue: mockScheduleRegistrationModel,
        },
        {
          provide: getModelToken(Semester.name),
          useValue: mockSemesterModel,
        },
        {
          provide: getModelToken(ActivityAttendance.name),
          useValue: mockActivityAttendanceModel,
        },
        {
          provide: getModelToken(Activity.name),
          useValue: mockActivityModel,
        },
        {
          provide: getModelToken(Student.name),
          useValue: mockStudentModel,
        },
      ],
    }).compile();

    service = module.get<ActivitySchedulesService>(ActivitySchedulesService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw BadRequestException if end_time is before or equal to start_time', async () => {
    const dto: any = {
      activity_id: new Types.ObjectId().toString(),
      title: 'Họp Hoạt động',
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
      activity_id: new Types.ObjectId().toString(),
      title: 'Họp Hoạt động Định Kỳ',
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
      activity_id: new Types.ObjectId().toString(),
      title: 'Họp Hoạt động Định Kỳ',
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
      activity_id: new Types.ObjectId().toString(),
      title: 'Họp Hoạt động Định Kỳ',
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
      activity_id: new Types.ObjectId().toString(),
      title: 'Họp Hoạt động Định Kỳ',
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
      activity_id: new Types.ObjectId().toString(),
      title: 'Họp Hoạt động Định Kỳ',
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
    const insertedSchedules = mockActivityScheduleModel.insertMany.mock.calls[0][0];
    expect(insertedSchedules.length).toBe(3);

    expect(insertedSchedules[0].start_time.toISOString()).toBe(new Date('2026-07-06T08:00:00').toISOString());
    expect(insertedSchedules[1].start_time.toISOString()).toBe(new Date('2026-07-20T08:00:00').toISOString());
    expect(insertedSchedules[2].start_time.toISOString()).toBe(new Date('2026-07-27T08:00:00').toISOString());
  });

  describe('update monthly recurrence', () => {
    it('should preserve original monthly calendar date pattern when monthly series is updated', async () => {
      const recurrenceId = new Types.ObjectId();
      const semesterId = new Types.ObjectId();
      const existingId = new Types.ObjectId();
      const augustId = new Types.ObjectId();
      const septemberId = new Types.ObjectId();

      const existingSchedule = {
        _id: existingId,
        title: 'Họp Hoạt động Hàng Tháng',
        start_time: new Date('2026-07-15T08:00:00'), // Wednesday July 15 (midweek)
        end_time: new Date('2026-07-15T10:00:00'),
        recurrence_id: recurrenceId,
        recurrence: {
          type: 'monthly',
          day_of_week: 3,
          until: new Date('2026-10-31T23:59:59'),
          start: new Date('2026-07-13T00:00:00'),
          source_week_start_date: new Date('2026-07-13T00:00:00'),
          source_week_end_date: new Date('2026-07-19T23:59:59'),
        },
        semester_id: semesterId,
        status: 'scheduled',
      };

      const series = [
        existingSchedule,
        {
          _id: augustId,
          title: 'Họp Hoạt động Hàng Tháng',
          start_time: new Date('2026-08-15T08:00:00'), // Saturday Aug 15
          end_time: new Date('2026-08-15T10:00:00'),
          recurrence_id: recurrenceId,
          recurrence: existingSchedule.recurrence,
          status: 'scheduled',
        },
        {
          _id: septemberId,
          title: 'Họp Hoạt động Hàng Tháng',
          start_time: new Date('2026-09-15T08:00:00'), // Tuesday Sep 15
          end_time: new Date('2026-09-15T10:00:00'),
          recurrence_id: recurrenceId,
          recurrence: existingSchedule.recurrence,
          status: 'scheduled',
        },
      ];

      // Mock DB calls
      mockActivityScheduleModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(existingSchedule),
      });

      mockActivityScheduleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(series),
      });

      const updatedSchedules: any[] = [];
      mockActivityScheduleModel.findByIdAndUpdate.mockImplementation((id, update) => {
        const found = series.find(s => s._id.toString() === id.toString());
        const updatedDoc = {
          ...found,
          ...update.$set,
        };
        updatedSchedules.push(updatedDoc);
        return {
          exec: jest.fn().mockResolvedValue(updatedDoc),
        };
      });

      // Update the 2nd session (August 15) to start at 09:00 instead of 08:00
      const dto = {
        start_time: new Date('2026-08-15T09:00:00'),
        end_time: new Date('2026-08-15T11:00:00'),
      };

      mockActivityScheduleModel.findById.mockImplementation((id) => {
        if (id.toString() === augustId.toString()) {
          return {
            exec: jest.fn().mockResolvedValue(series[1]),
          };
        }
        const found = updatedSchedules.find(s => s._id.toString() === id.toString());
        return {
          exec: jest.fn().mockResolvedValue(found || existingSchedule),
        };
      });

      const result = await service.update(augustId.toString(), dto);
      expect(result).toBeDefined();

      // Check updatedSchedules:
      // Index 0: July 15 (Wednesday) updated to time pattern 09:00
      // Index 1: Aug 15 (Saturday) updated to time pattern 09:00
      // Index 2: Sep 15 (Tuesday) updated to time pattern 09:00
      expect(updatedSchedules.length).toBe(3);
      
      expect(updatedSchedules[0].start_time.toISOString()).toBe(new Date('2026-07-15T09:00:00').toISOString());
      expect(updatedSchedules[1].start_time.toISOString()).toBe(new Date('2026-08-15T09:00:00').toISOString());
      expect(updatedSchedules[2].start_time.toISOString()).toBe(new Date('2026-09-15T09:00:00').toISOString());
    });
  });

  describe('findActivityTimeline', () => {
    const activityId = new Types.ObjectId().toString();
    const mockSchedules = [
      { _id: new Types.ObjectId(), start_time: new Date('2026-07-06T10:00:00Z'), end_time: new Date('2026-07-06T12:00:00Z'), title: 'Schedule 1', status: 'scheduled' },
      { _id: new Types.ObjectId(), start_time: new Date('2026-07-07T10:00:00Z'), end_time: new Date('2026-07-07T12:00:00Z'), title: 'Schedule 2', status: 'scheduled' },
    ];

    it('should throw ForbiddenException for unsupported roles', async () => {
      const requester = { role: 'guest' };
      await expect(service.findActivityTimeline(activityId, requester)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return empty items when no schedules exist', async () => {
      mockActivityScheduleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const requester = { role: 'STUDENT' };
      const res = await service.findActivityTimeline(activityId, requester);
      expect(res.viewer_mode).toBe('student');
      expect(res.items).toEqual([]);
      expect(res.timezone).toBe('Asia/Ho_Chi_Minh');
    });

    it('should sort schedules by start_time and then _id ascending', async () => {
      mockActivityScheduleModel.find.mockReturnValue({
        sort: jest.fn().mockImplementation((sortObj) => {
          expect(sortObj).toEqual({ start_time: 1, _id: 1 });
          return {
            lean: jest.fn().mockReturnThis(),
            exec: jest.fn().mockResolvedValue(mockSchedules),
          };
        }),
      });

      mockActivityAttendanceModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const requester = { role: 'STUDENT', studentId: 'student123' };
      const res = await service.findActivityTimeline(activityId, requester);
      expect(res.items.length).toBe(2);
      expect(res.viewer_mode).toBe('student');
      expect(res.timezone).toBe('Asia/Ho_Chi_Minh');
    });

    it('should filter by student studentId/userId and return my_attendance in student mode', async () => {
      mockActivityScheduleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSchedules),
      });

      const mockAttendance = [
        {
          _id: new Types.ObjectId(),
          schedule_id: mockSchedules[0]._id,
          student_id: new Types.ObjectId(),
          status: 'present',
        },
      ];

      mockActivityAttendanceModel.find.mockImplementation((filter) => {
        expect(filter.student_id).toBeDefined();
        expect(filter.schedule_id.$in).toBeDefined();
        return {
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockAttendance),
        };
      });

      const requester = { role: 'STUDENT', studentId: 'student123' };
      const res = await service.findActivityTimeline(activityId, requester);
      expect(res.viewer_mode).toBe('student');
      expect(res.items[0].my_attendance).toBeDefined();
      expect(res.items[0].my_attendance.status).toBe('present');
      expect(res.items[0].attendance_records).toBeUndefined();
      expect(res.items[1].my_attendance).toBeNull();
    });

    it('should resolve the JWT userId to the linked student before querying attendance', async () => {
      const userId = new Types.ObjectId();
      const studentId = new Types.ObjectId();
      mockActivityScheduleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSchedules),
      });
      mockStudentModel.findOne.mockImplementation((filter) => {
        expect(filter.user_id.toString()).toBe(userId.toString());
        return {
          select: jest.fn().mockReturnThis(),
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue({ _id: studentId }),
        };
      });
      mockActivityAttendanceModel.find.mockImplementation((filter) => {
        expect(filter.student_id.toString()).toBe(studentId.toString());
        return {
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([{
            _id: new Types.ObjectId(),
            schedule_id: mockSchedules[0]._id,
            student_id: studentId,
            status: 'present',
          }]),
        };
      });

      const result = await service.findActivityTimeline(activityId, {
        roleCode: 'STUDENT',
        roleName: 'Student',
        userId: userId.toString(),
      });

      expect(result.items[0].my_attendance.status).toBe('present');
    });

    it('should return attendance_records containing student full_name and student_code, excluding email in staff mode', async () => {
      mockActivityScheduleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSchedules),
      });

      const mockAttendance = [
        {
          _id: new Types.ObjectId(),
          schedule_id: mockSchedules[0]._id,
          student_id: {
            _id: new Types.ObjectId(),
            full_name: 'John Doe',
            student_code: 'SV123',
            email: 'john@example.com',
          },
          status: 'present',
          check_in_time: new Date(),
          approval_status: 'approved',
          note: 'Ok',
        },
      ];

      mockActivityAttendanceModel.find.mockImplementation((filter) => {
        expect(filter.student_id).toBeUndefined();
        const query: any = {
          populate: jest.fn().mockImplementation((options, fields) => {
            if (typeof options === 'object') {
              expect(options).toEqual({
                path: 'student_id',
                select: 'full_name student_code class_id',
                populate: { path: 'class_id', select: 'class_name' },
              });
            } else {
              expect(options).toBe('class_id');
              expect(fields).toBe('class_name');
            }
            return query;
          }),
          lean: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue(mockAttendance),
        };
        return {
          ...query,
        };
      });

      const requester = { role: 'ADMIN' };
      const res = await service.findActivityTimeline(activityId, requester);
      expect(res.viewer_mode).toBe('staff');
      expect(res.items[0].my_attendance).toBeUndefined();
      expect(res.items[0].attendance_records.length).toBe(1);
      const rec = res.items[0].attendance_records[0];
      expect(rec.student_id.full_name).toBe('John Doe');
      expect(rec.student_id.student_code).toBe('SV123');
      expect(rec.student_id.email).toBeUndefined();
      expect(rec.status).toBe('present');
      expect(rec.approval_status).toBe('approved');
      expect(rec.note).toBe('Ok');
    });

    it('should assert the exact allowed and omitted fields for student, advisor/teacher, and admin timeline payloads', async () => {
      mockActivityScheduleModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockSchedules),
      });

      const mockAttendance = [
        {
          _id: new Types.ObjectId(),
          schedule_id: mockSchedules[0]._id,
          student_id: {
            _id: new Types.ObjectId(),
            full_name: 'John Doe',
            student_code: 'SV123',
            email: 'john@example.com',
          },
          status: 'present',
          check_in_time: new Date(),
          approval_status: 'approved',
          note: 'Ok',
        },
      ];

      mockActivityAttendanceModel.find.mockImplementation(() => ({
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockAttendance),
      }));

      // Test student
      const studentRequester = { role: 'STUDENT', studentId: 'student123' };
      const studentRes = await service.findActivityTimeline(activityId, studentRequester);
      expect(studentRes.viewer_mode).toBe('student');
      expect(studentRes.items[0].my_attendance).toBeDefined();
      expect(studentRes.items[0].attendance_records).toBeUndefined();

      // Test advisor/teacher
      const teacherUserId = new Types.ObjectId();
      mockActivityModel.findById.mockReturnValueOnce({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(activityId),
          advisor_id: teacherUserId,
        }),
      });
      const teacherRequester = {
        role: 'TEACHER',
        userId: teacherUserId.toString(),
      };
      const teacherRes = await service.findActivityTimeline(activityId, teacherRequester);
      expect(teacherRes.viewer_mode).toBe('staff');
      expect(teacherRes.items[0].my_attendance).toBeUndefined();
      expect(teacherRes.items[0].attendance_records).toBeDefined();
      expect(teacherRes.items[0].attendance_records[0].status).toBe('present');

      // Test admin
      const adminRequester = { role: 'ADMIN' };
      const adminRes = await service.findActivityTimeline(activityId, adminRequester);
      expect(adminRes.viewer_mode).toBe('staff');
      expect(adminRes.items[0].my_attendance).toBeUndefined();
      expect(adminRes.items[0].attendance_records).toBeDefined();
      expect(adminRes.items[0].attendance_records[0].status).toBe('present');
      expect(adminRes.items[0].attendance_records[0].approval_status).toBe('approved');
    });


    it('should query all arranged weeks, exclude cancelled, and enrich details correctly', async () => {
      const today = new Date();
      const mockSchedulesWithCancelled = [
        // Past schedule (10 days ago)
        { _id: new Types.ObjectId(), start_time: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000), end_time: new Date(today.getTime() - 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), title: 'Past Schedule', status: 'scheduled' },
        // Today schedule 1
        { _id: new Types.ObjectId(), start_time: new Date(today), end_time: new Date(today.getTime() + 2 * 60 * 60 * 1000), title: 'Today Schedule 1', status: 'scheduled' },
        // Today schedule 2
        { _id: new Types.ObjectId(), start_time: new Date(today.getTime() + 15 * 60 * 1000), end_time: new Date(today.getTime() + 2 * 60 * 60 * 1000 + 15 * 60 * 1000), title: 'Today Schedule 2', status: 'scheduled' },
        // Future schedule (10 days later)
        { _id: new Types.ObjectId(), start_time: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000), end_time: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000), title: 'Future Schedule', status: 'scheduled' },
      ];

      mockActivityScheduleModel.find.mockImplementation((query) => {
        expect(query.activity_id).toBeDefined();
        expect(query.start_time).toBeUndefined(); // no start_time filter
        expect(query.status.$ne).toBe('cancelled'); // status filter present
        return {
          sort: jest.fn().mockImplementation((sortObj) => {
            expect(sortObj).toEqual({ start_time: 1, _id: 1 });
            return {
              lean: jest.fn().mockReturnThis(),
              exec: jest.fn().mockResolvedValue(mockSchedulesWithCancelled),
            };
          }),
        };
      });

      mockActivityAttendanceModel.find.mockReturnValue({
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      const requester = { role: 'STUDENT', studentId: 'student123' };
      const res = await service.findActivityTimeline(activityId, requester);
      expect(res.items.length).toBe(4);
      expect(res.items[0].is_today).toBe(false);
      expect(res.items[1].is_today).toBe(true);
      expect(res.items[2].is_today).toBe(true);
      expect(res.items[3].is_today).toBe(false);
      expect(res.items[0].is_active).toBeDefined();
      expect(res.items[0].my_attendance).toBeNull();
    });
  });

  describe('cancelEntireRecurrence', () => {
    it('cancels repeated cards across the source week group and preserves source cards', async () => {
      const recurrenceId = new Types.ObjectId();
      const secondRecurrenceId = new Types.ObjectId();
      const activityId = new Types.ObjectId();
      const semesterId = new Types.ObjectId();
      const sourceWeekStart = new Date('2026-07-13T00:00:00.000Z');
      const sourceWeekEnd = new Date('2026-07-19T23:59:59.999Z');
      const selectedSchedule = {
        _id: new Types.ObjectId(),
        activity_id: activityId,
        semester_id: semesterId,
        recurrence_id: recurrenceId,
        recurrence: { source_week_start_date: sourceWeekStart, source_week_end_date: sourceWeekEnd },
        start_time: new Date('2026-07-14T09:00:00.000Z'),
        status: 'scheduled',
      };
      const seriesSchedules = [
        selectedSchedule,
        {
          _id: new Types.ObjectId(),
          activity_id: activityId,
          semester_id: semesterId,
          recurrence_id: recurrenceId,
          recurrence: { source_week_start_date: sourceWeekStart, source_week_end_date: sourceWeekEnd },
          start_time: new Date('2026-07-21T09:00:00.000Z'),
          status: 'scheduled',
        },
        {
          _id: new Types.ObjectId(),
          activity_id: activityId,
          semester_id: semesterId,
          recurrence_id: secondRecurrenceId,
          recurrence: { source_week_start_date: sourceWeekStart, source_week_end_date: sourceWeekEnd },
          start_time: new Date('2026-07-22T09:00:00.000Z'),
          status: 'scheduled',
        },
      ];

      mockActivityScheduleModel.findById.mockResolvedValue(selectedSchedule);
      mockActivityScheduleModel.find.mockReturnValue({
        exec: jest.fn().mockResolvedValue(seriesSchedules),
      });
      mockScheduleRegistrationModel.updateMany.mockResolvedValue({ modifiedCount: 2 });
      mockActivityScheduleModel.updateMany.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 2 }),
      });

      const result = await service.cancelEntireRecurrence(selectedSchedule._id.toString());

      expect(mockActivityScheduleModel.find).toHaveBeenCalledWith({
        semester_id: semesterId,
        recurrence_id: { $exists: true },
        'recurrence.source_week_start_date': sourceWeekStart,
        'recurrence.source_week_end_date': sourceWeekEnd,
        status: { $ne: 'cancelled' },
      });
      expect(mockScheduleRegistrationModel.updateMany).toHaveBeenCalledWith(
        { schedule_id: { $in: seriesSchedules.slice(1).map((schedule) => schedule._id) }, status: 'registered' },
        { $set: { status: 'cancelled', cancelled_at: expect.any(Date) } },
      );
      expect(mockActivityScheduleModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: seriesSchedules.slice(1).map((schedule) => schedule._id) }, status: { $ne: 'cancelled' } },
        { $set: { status: 'cancelled' } },
      );
      expect(mockActivityScheduleModel.updateMany).toHaveBeenCalledWith(
        { _id: { $in: [selectedSchedule._id] } },
        { $unset: { recurrence: '', recurrence_id: '' } },
      );
      expect(result.cancelledSchedules).toBe(2);
    });

    it('rejects a schedule without recurrence metadata before bulk updates', async () => {
      const selectedSchedule = {
        _id: new Types.ObjectId(),
        activity_id: new Types.ObjectId(),
        status: 'scheduled',
      };

      mockActivityScheduleModel.findById.mockResolvedValue(selectedSchedule);

      await expect(service.cancelEntireRecurrence(selectedSchedule._id.toString())).rejects.toBeInstanceOf(BadRequestException);
      expect(mockScheduleRegistrationModel.updateMany).not.toHaveBeenCalled();
      expect(mockActivityScheduleModel.updateMany).not.toHaveBeenCalled();
    });
  });
});
