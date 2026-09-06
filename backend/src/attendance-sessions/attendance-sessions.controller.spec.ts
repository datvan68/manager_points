jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid-token') }));

import { AttendanceSessionsController } from './attendance-sessions.controller';
import { ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const guardsFor = (method: string) =>
  (Reflect.getMetadata('__guards__', AttendanceSessionsController.prototype[method]) || []) as any[];

describe('AttendanceSessionsController', () => {
  const sessionsService = {
    getActiveSession: jest.fn(),
    getCheckins: jest.fn(),
    checkinQr: jest.fn(),
    checkinProximity: jest.fn(),
  };
  const controller = new AttendanceSessionsController(
    sessionsService as any,
    {} as any,
  );
  const req = {
    user: { userId: 'user-1', roleCode: 'STUDENT' },
    headers: { 'user-agent': 'jest' },
  };

  beforeEach(() => jest.clearAllMocks());

  it('propagates verified JWT requester fields to attendance service calls', () => {
    const qrDto = { token: 'qr-token' } as any;
    const proximityDto = { session_id: 'session-1', latitude: 1, longitude: 2 } as any;

    controller.getActiveSession('activity', 'activity-1', req);
    controller.getCheckins('session-1', req);
    controller.checkinQr(qrDto, req);
    controller.checkinProximity(proximityDto, req);

    expect(sessionsService.getActiveSession).toHaveBeenCalledWith('activity', 'activity-1', 'user-1', 'STUDENT');
    expect(sessionsService.getCheckins).toHaveBeenCalledWith('session-1', 'user-1', 'STUDENT');
    expect(sessionsService.checkinQr).toHaveBeenCalledWith(qrDto, 'user-1', 'STUDENT', 'jest');
    expect(sessionsService.checkinProximity).toHaveBeenCalledWith(proximityDto, 'user-1', 'STUDENT', 'jest');
  });

  it('passes manual session identity filters while retaining the authenticated owner', () => {
    const manualReq = {
      ...req,
      query: {
        method: 'manual_class',
        class_id: 'class-1',
        schedule_id: 'schedule-1',
      },
    };

    controller.getActiveSession('activity', 'activity-1', manualReq);

    expect(sessionsService.getActiveSession).toHaveBeenCalledWith(
      'activity',
      'activity-1',
      'user-1',
      'STUDENT',
      {
        method: 'manual_class',
        classId: 'class-1',
        scheduleId: 'schedule-1',
      },
    );
  });

  it('does not let a read-only session permission create a check-in', async () => {
    const original = JwtAuthGuard.prototype.canActivate;
    jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true);
    const Guard = guardsFor('checkinQr')[0];
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ user: { roleCode: 'TEACHER', permissions: ['ATTENDANCE_SESSION_READ'] } }),
      }),
    } as any;

    await expect(new Guard().canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
    JwtAuthGuard.prototype.canActivate = original;
  });
});
