jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid-token') }));

import { AttendanceSessionsController } from './attendance-sessions.controller';

describe('AttendanceSessionsController', () => {
  const sessionsService = {
    getActiveSession: jest.fn(),
    getCheckins: jest.fn(),
    checkinQr: jest.fn(),
    checkinProximity: jest.fn(),
  };
  const controller = new AttendanceSessionsController(sessionsService as any);
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
});
