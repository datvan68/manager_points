import { ForbiddenException, Injectable, MessageEvent, Optional } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Observable } from 'rxjs';
import {
  AttendanceRealtimeEvent,
  attendanceEventEmitter,
} from '../system/attendance-event-emitter';
import { isAdminUser, isTeacher } from '../auth/utils/role.util';
import { AttendanceSession, AttendanceSessionDocument } from './schemas/attendance-session.schema';
import { ActivityMember, ActivityMemberDocument } from '../activities/schemas/activity-member.schema';
import { Student, StudentDocument } from '../students/schemas/student.schema';
import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';

@Injectable()
export class AttendanceRealtimeService {
  constructor(
    @InjectModel(AttendanceSession.name)
    private readonly sessionModel: Model<AttendanceSessionDocument>,
    @InjectModel(ActivityMember.name)
    private readonly memberModel: Model<ActivityMemberDocument>,
    @InjectModel(Student.name)
    private readonly studentModel: Model<StudentDocument>,
    @Optional()
    @InjectModel(Activity.name)
    private readonly activityModel?: Model<ActivityDocument>,
  ) {}

  async getStream(
    requester: any,
    contextType: string,
    contextId: string,
  ): Promise<Observable<MessageEvent>> {
    const access = await this.resolveAccess(requester, contextType, contextId);

    return new Observable((subscriber) => {
      subscriber.next({ data: { type: 'connected' } });
      const heartbeat = setInterval(() => subscriber.next({ data: { type: 'ping' } }), 30000);

      const listener = (event: AttendanceRealtimeEvent) => {
        if (event.contextType !== contextType || event.contextId !== contextId) return;

        if (
          event.method === 'manual_class'
          && ['attendance.session_opened', 'attendance.session_closed'].includes(event.type)
          && event.openedBy !== access.userId
        ) {
          return;
        }

        if (event.type === 'attendance.checkin_created') {
          if (access.manager) {
            subscriber.next({ data: event });
          } else if (access.studentId && event.checkin?.student_id === access.studentId) {
            subscriber.next({
              data: { ...event, checkin: event.checkin },
            });
          }
          return;
        }

        subscriber.next({
          data: {
            type: event.type,
            contextType: event.contextType,
            contextId: event.contextId,
            sessionId: event.sessionId,
            checkinCount: event.checkinCount,
            session: event.session,
            method: event.method,
            scheduleId: event.scheduleId,
            classId: event.classId,
            openedBy: event.openedBy,
          },
        });
      };

      attendanceEventEmitter.on('attendance_event', listener);
      return () => {
        clearInterval(heartbeat);
        attendanceEventEmitter.off('attendance_event', listener);
      };
    });
  }

  private async resolveAccess(requester: any, contextType: string, contextId: string) {
    if (!['club', 'activity'].includes(contextType)) {
      throw new ForbiddenException('Attendance realtime is not available for this context.');
    }
    if (!Types.ObjectId.isValid(contextId)) {
      throw new ForbiddenException('Invalid attendance context.');
    }
    const userId = requester?.userId || requester?._id || requester?.id;
    if (!userId || !Types.ObjectId.isValid(userId)) {
      throw new ForbiddenException('An active activity membership is required.');
    }
    const normalizedUserId = userId.toString();
    if (isAdminUser(requester)) {
      return { manager: true, studentId: '', userId: normalizedUserId };
    }
    const requesterId = new Types.ObjectId(userId);
    const activity = this.activityModel
      ? await this.activityModel.findById(contextId).select('advisor_id').lean().exec()
      : null;
    const assignedTeacher = isTeacher(requester) && activity?.advisor_id?.toString() === requesterId.toString();
    if (assignedTeacher) {
      return { manager: true, studentId: '', userId: normalizedUserId };
    }
    const student = await this.studentModel
      .findOne({ user_id: requesterId })
      .select('_id')
      .lean()
      .exec();
    const studentId = student?._id?.toString() || '';
    const membershipOwners: Array<{ user_id?: Types.ObjectId; student_id?: Types.ObjectId }> = [{ user_id: requesterId }];
    if (studentId) membershipOwners.push({ student_id: new Types.ObjectId(studentId) });
    const member = await this.memberModel.findOne({
      activity_id: new Types.ObjectId(contextId),
      status: 'active',
      $or: membershipOwners,
    }).lean().exec();
    if (!member) {
      throw new ForbiddenException('An active activity membership is required.');
    }
    return {
      manager: assignedTeacher || member.role === 'president',
      studentId: member.student_id?.toString() || studentId,
      userId: normalizedUserId,
    };
  }
}
