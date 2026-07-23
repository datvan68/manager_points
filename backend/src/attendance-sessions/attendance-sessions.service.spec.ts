jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid-token') }));

import { ForbiddenException } from '@nestjs/common';
import { AttendanceSessionsService } from './attendance-sessions.service';
import { attendanceEventEmitter } from '../system/attendance-event-emitter';

const activityId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';
const studentId = '507f1f77bcf86cd799439013';
const otherUserId = '507f1f77bcf86cd799439018';
const scheduleId = '507f1f77bcf86cd799439015';
const classId = '507f1f77bcf86cd799439019';

describe('AttendanceSessionsService', () => {
  let sessionModel: any;
  let checkinModel: any;
  let clubAttendanceModel: any;
  let memberModel: any;
  let scheduleModel: any;
  let studentModel: any;
  let activityAttendanceSyncService: any;
  let attendanceGrantsService: any;
  let service: AttendanceSessionsService;

  const session = {
    _id: { toString: () => '507f1f77bcf86cd799439014' },
    context_type: 'activity',
    context_id: activityId,
    status: 'active',
    method: 'qr',
    qr_token_expires_at: new Date(Date.now() + 60_000),
    checkin_count: 0,
  };

  beforeEach(() => {
    sessionModel = jest.fn();
    sessionModel.findOne = jest.fn();
    sessionModel.findById = jest.fn();
    sessionModel.findByIdAndUpdate = jest.fn();
    sessionModel.updateMany = jest.fn();
    checkinModel = jest.fn().mockImplementation((data) => {
      const checkin = { ...data, save: jest.fn() };
      checkin.save.mockResolvedValue(checkin);
      return checkin;
    });
    checkinModel.findOne = jest.fn().mockResolvedValue(null);
    clubAttendanceModel = jest.fn().mockImplementation((data) => {
      const attendance = {
        ...data,
        _id: { toString: () => '507f1f77bcf86cd799439016' },
        save: jest.fn(),
      };
      attendance.save.mockResolvedValue(attendance);
      return attendance;
    });
    clubAttendanceModel.findOne = jest.fn().mockResolvedValue(null);
    memberModel = { findOne: jest.fn() };
    scheduleModel = { findOne: jest.fn() };
    studentModel = { findOne: jest.fn() };
    studentModel.findOne.mockReturnValue({
      select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue({ _id: studentId }) }) }),
    });
    activityAttendanceSyncService = {
      syncAttendanceToAcademicRecord: jest.fn().mockResolvedValue({ synced: true }),
      enqueueAttendanceSync: jest.fn(),
    };
    attendanceGrantsService = {
      assertMethod: jest.fn().mockResolvedValue(undefined),
      assertOwnClass: jest.fn().mockResolvedValue(undefined),
    };
    service = new AttendanceSessionsService(
      sessionModel,
      checkinModel,
      clubAttendanceModel,
      memberModel,
      scheduleModel,
      studentModel,
      activityAttendanceSyncService,
      attendanceGrantsService,
    );
  });

  it('scopes duplicate detection and active manual hydration to the opener', async () => {
    scheduleModel.findOne.mockReturnValue({
      lean: () => ({ exec: jest.fn().mockResolvedValue({ start_time: new Date() }) }),
    });
    sessionModel.findOne.mockResolvedValueOnce(null);
    const saved = {
      ...session,
      method: 'manual_class',
      class_id: classId,
      schedule_id: scheduleId,
      opened_by: userId,
      save: jest.fn(),
    };
    saved.save.mockResolvedValue(saved);
    sessionModel.mockImplementationOnce(() => saved);

    await service.openSession({
      context_type: 'activity',
      context_id: activityId,
      semester_id: '507f1f77bcf86cd799439017',
      schedule_id: scheduleId,
      method: 'manual_class',
      class_id: classId,
    } as any, userId, 'TEACHER');

    expect(sessionModel.findOne).toHaveBeenCalledWith(expect.objectContaining({
      method: 'manual_class',
      class_id: expect.anything(),
      opened_by: expect.objectContaining({ toString: expect.any(Function) }),
    }));

    sessionModel.updateMany.mockResolvedValue(undefined);
    sessionModel.findOne.mockReturnValueOnce({
      populate: () => ({
        lean: () => ({ exec: jest.fn().mockResolvedValue(saved) }),
      }),
    });
    await service.getActiveSession(
      'activity',
      activityId,
      userId,
      'TEACHER',
      { method: 'manual_class', classId, scheduleId },
    );
    expect(sessionModel.findOne).toHaveBeenLastCalledWith(expect.objectContaining({
      method: 'manual_class',
      opened_by: expect.objectContaining({ toString: expect.any(Function) }),
    }));
  });

  it('rejects non-openers before they can close or mutate a manual session', async () => {
    const manualSession = {
      ...session,
      method: 'manual_class',
      class_id: classId,
      schedule_id: scheduleId,
      opened_by: userId,
    };
    sessionModel.findById.mockResolvedValue(manualSession);

    await expect(service.closeSession(
      '507f1f77bcf86cd799439014',
      otherUserId,
      'ADMIN',
    )).rejects.toBeInstanceOf(ForbiddenException);

    sessionModel.findById.mockReturnValue({
      lean: () => ({ exec: jest.fn().mockResolvedValue(manualSession) }),
    });
    await expect(service.getManualRoster(
      '507f1f77bcf86cd799439014',
      otherUserId,
      'ADMIN',
    )).rejects.toBeInstanceOf(ForbiddenException);

    sessionModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(manualSession),
    });
    await expect(service.manualCheckin(
      '507f1f77bcf86cd799439014',
      studentId,
      otherUserId,
      'ADMIN',
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(attendanceGrantsService.assertMethod).not.toHaveBeenCalled();
  });

  it('scopes manual attendance events to the opener and manual lane', async () => {
    const manualSession = {
      ...session,
      method: 'manual_class',
      class_id: { toString: () => classId },
      schedule_id: { toString: () => scheduleId },
      semester_id: '507f1f77bcf86cd799439017',
      opened_by: { toString: () => userId },
    };
    sessionModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(manualSession),
    });
    sessionModel.updateOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(undefined),
    });
    studentModel.findOne.mockReturnValue({
      select: () => ({
        lean: () => ({
          exec: jest.fn().mockResolvedValue({
            _id: { toString: () => studentId },
            class_id: classId,
          }),
        }),
      }),
    });
    const attendance = {
      _id: { toString: () => '507f1f77bcf86cd799439016' },
      student_id: studentId,
    };
    clubAttendanceModel.findOneAndUpdate = jest.fn().mockReturnValue({
      lean: () => ({ exec: jest.fn().mockResolvedValue(attendance) }),
    });
    clubAttendanceModel.countDocuments = jest.fn().mockResolvedValue(1);
    const listener = jest.fn();
    attendanceEventEmitter.once('attendance_event', listener);

    await service.manualCheckin(
      '507f1f77bcf86cd799439014',
      studentId,
      userId,
      'TEACHER',
    );

    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'attendance.checkin_created',
      method: 'manual_class',
      openedBy: userId,
      classId,
      scheduleId,
    }));
  });

  it('preserves active president attendance-manager compatibility', async () => {
    (service as any).activityModel = {
      findById: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ advisor_id: '507f1f77bcf86cd799439099' }),
      })),
    };
    studentModel.findOne.mockReturnValue({
      select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue({ _id: studentId }) }) }),
    });
    memberModel.findOne.mockResolvedValue({ role: 'president', status: 'active' });

    await expect((service as any).isManager(
      { context_type: 'activity', context_id: activityId },
      userId,
      'STUDENT',
    )).resolves.toBe(true);
    expect(memberModel.findOne).toHaveBeenCalledWith(expect.objectContaining({
      activity_id: activityId,
      status: 'active',
      role: 'president',
    }));
  });

  it.each(['club', 'activity'])('allows active student-linked members in the %s context and persists their resolved student ID', async (contextType) => {
    const contextualSession = { ...session, context_type: contextType };
    sessionModel.findOne.mockResolvedValue(contextualSession);
    memberModel.findOne.mockResolvedValue({ student_id: { toString: () => studentId } });
    sessionModel.findByIdAndUpdate.mockResolvedValue(undefined);

    await service.checkinQr({ token: 'token' } as any, userId, 'STUDENT');

    expect(memberModel.findOne).toHaveBeenCalledWith(expect.objectContaining({
      activity_id: activityId,
      status: 'active',
      $or: expect.arrayContaining([expect.objectContaining({ student_id: expect.anything() })]),
    }));
    expect(checkinModel).toHaveBeenCalledWith(expect.objectContaining({ student_id: expect.anything() }));
  });

  it('allows an active member to read an active session', async () => {
    sessionModel.updateMany.mockResolvedValue(undefined);
    sessionModel.findOne.mockReturnValue({
      populate: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(session) }) }),
    });
    memberModel.findOne.mockResolvedValue({ student_id: { toString: () => studentId } });

    await expect(service.getActiveSession('activity', activityId, userId, 'STUDENT')).resolves.toEqual(session);
  });

  it('resolves a student from an active user-only membership for check-in', async () => {
    sessionModel.findOne.mockResolvedValue(session);
    memberModel.findOne.mockResolvedValue({ user_id: userId });
    studentModel.findOne.mockReturnValue({
      select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue({ _id: studentId }) }) }),
    });
    sessionModel.findByIdAndUpdate.mockResolvedValue(undefined);

    await service.checkinQr({ token: 'token' } as any, userId, 'STUDENT');

    expect(studentModel.findOne).toHaveBeenCalledWith({ user_id: expect.anything() });
    expect(checkinModel).toHaveBeenCalledWith(expect.objectContaining({ student_id: expect.anything() }));
  });

  it('allows an active student-linked member to complete GPS proximity check-in', async () => {
    sessionModel.findById.mockResolvedValue({
      ...session,
      method: 'proximity',
      latitude: 10.762622,
      longitude: 106.660172,
      radius_meters: 50,
    });
    memberModel.findOne.mockResolvedValue({ student_id: { toString: () => studentId } });
    sessionModel.findByIdAndUpdate.mockResolvedValue(undefined);

    await service.checkinProximity({
      session_id: '507f1f77bcf86cd799439014',
      latitude: 10.762622,
      longitude: 106.660172,
    } as any, userId, 'STUDENT');

    expect(checkinModel).toHaveBeenCalledWith(expect.objectContaining({
      student_id: expect.anything(), method: 'proximity', distance_meters: 0,
    }));
  });

  it.each([
    ['qr', 'activity'],
    ['proximity', 'club'],
  ])('evaluates auto-approved %s check-ins in the %s context', async (method, contextType) => {
    const scheduledSession = {
      ...session,
      context_type: contextType,
      method,
      schedule_id: { toString: () => '507f1f77bcf86cd799439015' },
      semester_id: { toString: () => '507f1f77bcf86cd799439017' },
      auto_approve: true,
      ...(method === 'proximity' ? {
        latitude: 10.762622,
        longitude: 106.660172,
        radius_meters: 50,
      } : {}),
    };
    memberModel.findOne.mockResolvedValue({ student_id: { toString: () => studentId } });
    sessionModel.findByIdAndUpdate.mockResolvedValue(undefined);

    if (method === 'qr') {
      sessionModel.findOne.mockResolvedValue(scheduledSession);
      await service.checkinQr({ token: 'token' } as any, userId, 'STUDENT');
    } else {
      sessionModel.findById.mockResolvedValue(scheduledSession);
      await service.checkinProximity({
        session_id: '507f1f77bcf86cd799439014',
        latitude: 10.762622,
        longitude: 106.660172,
      } as any, userId, 'STUDENT');
    }

    expect(clubAttendanceModel).toHaveBeenCalledWith(expect.objectContaining({
      approval_status: 'approved',
      activity_id: activityId,
    }));
    expect(activityAttendanceSyncService.syncAttendanceToAcademicRecord).toHaveBeenCalledWith(
      '507f1f77bcf86cd799439016',
    );
  });

  it('leaves pending check-ins for the manual approval flow', async () => {
    sessionModel.findOne.mockResolvedValue({
      ...session,
      context_type: 'activity',
      schedule_id: { toString: () => '507f1f77bcf86cd799439015' },
      semester_id: { toString: () => '507f1f77bcf86cd799439017' },
      auto_approve: false,
    });
    memberModel.findOne.mockResolvedValue({ student_id: { toString: () => studentId } });
    sessionModel.findByIdAndUpdate.mockResolvedValue(undefined);

    await service.checkinQr({ token: 'token' } as any, userId, 'STUDENT');

    expect(clubAttendanceModel).toHaveBeenCalledWith(expect.objectContaining({
      approval_status: 'pending',
    }));
    expect(activityAttendanceSyncService.syncAttendanceToAcademicRecord).not.toHaveBeenCalled();
  });

  it.each(['pending', 'rejected', 'inactive', 'left', 'missing'])('rejects %s memberships before reading or writing attendance data', async (status) => {
    sessionModel.findById.mockReturnValue({ lean: () => ({ exec: jest.fn().mockResolvedValue(session) }) });
    memberModel.findOne.mockResolvedValue(null);

    await expect(service.getCheckins('507f1f77bcf86cd799439014', userId, 'STUDENT')).rejects.toBeInstanceOf(ForbiddenException);
    expect(checkinModel.find).toBeUndefined();
  });

  it('rejects an unrelated teacher but allows an administrator to read attendance data', async () => {
    sessionModel.updateMany.mockResolvedValue(undefined);
    sessionModel.findOne.mockReturnValue({ populate: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(session) }) }) });
    sessionModel.findById.mockReturnValue({ lean: () => ({ exec: jest.fn().mockResolvedValue(session) }) });
    checkinModel.find = jest.fn().mockReturnValue({ populate: () => ({ sort: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue([]) }) }) }) });

    await expect(service.getActiveSession('activity', activityId, userId, 'TEACHER')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.getCheckins('507f1f77bcf86cd799439014', userId, 'ADMIN')).resolves.toEqual([]);
    expect(memberModel.findOne).toHaveBeenCalled();
  });

  it('accepts a non-cancelled schedule belonging to the activity today', async () => {
    scheduleModel.findOne.mockReturnValue({
      lean: () => ({ exec: jest.fn().mockResolvedValue({ start_time: new Date() }) }),
    });

    await expect((service as any).ensureTodaySchedule('activity', activityId, '507f1f77bcf86cd799439015')).resolves.toBeUndefined();
    expect(scheduleModel.findOne).toHaveBeenCalledWith(expect.objectContaining({
      activity_id: expect.anything(), status: { $ne: 'cancelled' },
    }));
  });

  it('rejects a schedule outside today or cancelled for attendance opening', async () => {
    scheduleModel.findOne.mockReturnValue({
      lean: () => ({ exec: jest.fn().mockResolvedValue({ start_time: new Date('2020-01-01T00:00:00.000Z') }) }),
    });

    await expect((service as any).ensureTodaySchedule('activity', activityId, '507f1f77bcf86cd799439015')).rejects.toBeInstanceOf(Error);
  });
});
