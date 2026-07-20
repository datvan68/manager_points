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
});
