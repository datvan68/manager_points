jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid-token') }));

import { ForbiddenException } from '@nestjs/common';
import { AttendanceSessionsService } from './attendance-sessions.service';

const activityId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';
const studentId = '507f1f77bcf86cd799439013';

describe('AttendanceSessionsService', () => {
  let sessionModel: any;
  let checkinModel: any;
  let memberModel: any;
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
    sessionModel = {
      findOne: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn(), updateMany: jest.fn(),
    };
    checkinModel = jest.fn().mockImplementation((data) => ({ ...data, save: jest.fn().mockResolvedValue(data) }));
    checkinModel.findOne = jest.fn().mockResolvedValue(null);
    memberModel = { findOne: jest.fn() };
    service = new AttendanceSessionsService(sessionModel, checkinModel, {}, memberModel);
  });

  it.each(['club', 'activity'])('allows active members in the %s context and persists their resolved student ID', async (contextType) => {
    const contextualSession = { ...session, context_type: contextType };
    sessionModel.findOne.mockResolvedValue(contextualSession);
    memberModel.findOne.mockResolvedValue({ student_id: { toString: () => studentId } });
    sessionModel.findByIdAndUpdate.mockResolvedValue(undefined);

    await service.checkinQr({ token: 'token' } as any, userId, 'STUDENT');

    expect(memberModel.findOne).toHaveBeenCalledWith(expect.objectContaining({ activity_id: activityId, status: 'active' }));
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

  it.each(['pending', 'rejected', 'inactive', 'left', 'missing'])('rejects %s memberships before reading or writing attendance data', async (status) => {
    sessionModel.findById.mockReturnValue({ lean: () => ({ exec: jest.fn().mockResolvedValue(session) }) });
    memberModel.findOne.mockResolvedValue(null);

    await expect(service.getCheckins('507f1f77bcf86cd799439014', userId, 'STUDENT')).rejects.toBeInstanceOf(ForbiddenException);
    expect(checkinModel.find).toBeUndefined();
  });

  it('allows authorized staff to read session and check-in data without a membership lookup', async () => {
    sessionModel.updateMany.mockResolvedValue(undefined);
    sessionModel.findOne.mockReturnValue({ populate: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(session) }) }) });
    sessionModel.findById.mockReturnValue({ lean: () => ({ exec: jest.fn().mockResolvedValue(session) }) });
    checkinModel.find = jest.fn().mockReturnValue({ populate: () => ({ sort: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue([]) }) }) }) });

    await expect(service.getActiveSession('activity', activityId, userId, 'TEACHER')).resolves.toEqual(session);
    await expect(service.getCheckins('507f1f77bcf86cd799439014', userId, 'ADMIN')).resolves.toEqual([]);
    expect(memberModel.findOne).not.toHaveBeenCalled();
  });
});
