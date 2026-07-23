import { EventEmitter } from 'events';

export type AttendanceRealtimeEventType =
  | 'attendance.session_opened'
  | 'attendance.session_closed'
  | 'attendance.qr_rotated'
  | 'attendance.checkin_created';

export interface AttendanceRealtimeEvent {
  type: AttendanceRealtimeEventType;
  contextType: string;
  contextId: string;
  sessionId: string;
  checkinCount?: number;
  session?: Record<string, unknown>;
  checkin?: {
    _id: string;
    student_id: string;
    method: string;
    status: string;
    checked_in_at: Date;
    distance_meters?: number;
  };
  activityId?: string;
  scheduleId?: string;
  classId?: string;
  openedBy?: string;
  method?: string;
  studentId?: string;
  attendance?: Record<string, unknown>;
}

export const attendanceEventEmitter = new EventEmitter();
