import { AttendanceRealtimeService } from './attendance-realtime.service';
import { attendanceEventEmitter } from '../system/attendance-event-emitter';

const activityId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';
const studentId = '507f1f77bcf86cd799439013';

describe('AttendanceRealtimeService', () => {
  it('allows an active student-linked membership to receive lifecycle events', async () => {
    const memberModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: jest.fn().mockResolvedValue({ role: 'member', student_id: studentId }) }),
      }),
    };
    const studentModel = {
      findOne: jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue({ _id: studentId }) }) }),
      }),
    };
    const service = new AttendanceRealtimeService({} as any, memberModel as any, studentModel as any);
    const stream = await service.getStream({ userId, roleCode: 'STUDENT' }, 'activity', activityId);
    const received: any[] = [];
    const subscription = stream.subscribe((event) => received.push(event.data));

    attendanceEventEmitter.emit('attendance_event', {
      type: 'attendance.session_opened', contextType: 'activity', contextId: activityId,
      sessionId: '507f1f77bcf86cd799439014', checkinCount: 0,
      session: { status: 'active' },
    });

    expect(received).toEqual([
      { type: 'connected' },
      expect.objectContaining({ type: 'attendance.session_opened', contextId: activityId }),
    ]);
    expect(memberModel.findOne).toHaveBeenCalledWith(expect.objectContaining({
      $or: expect.arrayContaining([expect.objectContaining({ student_id: expect.anything() })]),
    }));
    subscription.unsubscribe();
  });

  it('delivers manual lifecycle only to its opener while preserving shared QR lifecycle', async () => {
    const memberModel = {
      findOne: jest.fn().mockReturnValue({
        lean: () => ({ exec: jest.fn().mockResolvedValue({ role: 'member', student_id: studentId }) }),
      }),
    };
    const studentModel = {
      findOne: jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue({ _id: studentId }) }) }),
      }),
    };
    const service = new AttendanceRealtimeService({} as any, memberModel as any, studentModel as any);
    const ownerStream = await service.getStream({ userId, roleCode: 'STUDENT' }, 'activity', activityId);
    const adminStream = await service.getStream(
      { userId: '507f1f77bcf86cd799439099', roleCode: 'ADMIN' },
      'activity',
      activityId,
    );
    const ownerReceived: any[] = [];
    const adminReceived: any[] = [];
    const ownerSubscription = ownerStream.subscribe((event) => ownerReceived.push(event.data));
    const adminSubscription = adminStream.subscribe((event) => adminReceived.push(event.data));

    attendanceEventEmitter.emit('attendance_event', {
      type: 'attendance.session_opened',
      contextType: 'activity',
      contextId: activityId,
      sessionId: '507f1f77bcf86cd799439014',
      method: 'manual_class',
      openedBy: userId,
      classId: '507f1f77bcf86cd799439019',
      scheduleId: '507f1f77bcf86cd799439015',
      session: { status: 'active', opened_by: userId },
    });
    attendanceEventEmitter.emit('attendance_event', {
      type: 'attendance.session_opened',
      contextType: 'activity',
      contextId: activityId,
      sessionId: '507f1f77bcf86cd799439020',
      method: 'qr',
      openedBy: userId,
      session: { status: 'active' },
    });

    expect(ownerReceived).toEqual([
      { type: 'connected' },
      expect.objectContaining({
        type: 'attendance.session_opened',
        sessionId: '507f1f77bcf86cd799439014',
      }),
      expect.objectContaining({
        type: 'attendance.session_opened',
        sessionId: '507f1f77bcf86cd799439020',
      }),
    ]);
    expect(adminReceived).toEqual([
      { type: 'connected' },
      expect.objectContaining({
        type: 'attendance.session_opened',
        sessionId: '507f1f77bcf86cd799439020',
      }),
    ]);
    ownerSubscription.unsubscribe();
    adminSubscription.unsubscribe();
  });
});
