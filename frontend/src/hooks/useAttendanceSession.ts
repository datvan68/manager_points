'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  activityAttendanceGrantApi,
  attendanceSessionApi,
  type ActivityAttendance,
  type ActivityAttendanceCapabilities,
  type AttendanceCheckinData,
  type AttendanceSessionData,
  type ManualAttendanceRoster,
  type QrData,
} from '@/api/activity-api';
import { useAttendanceRealtime, type AttendanceRealtimeEvent } from './useAttendanceRealtime';

interface UseAttendanceSessionOptions {
  contextType: string;
  contextId: string;
  enabled?: boolean;
  canManage?: boolean;
  activityId?: string;
  currentUserId?: string;
  manualScheduleId?: string;
}

export interface ManualAttendanceLane {
  session: AttendanceSessionData | null;
  roster: ManualAttendanceRoster | null;
  loading: boolean;
  error: string | null;
  pending: Record<string, boolean>;
  errors: Record<string, string>;
}

interface AttendanceSessionState {
  session: AttendanceSessionData | null;
  checkins: AttendanceCheckinData[];
  qrData: QrData | null;
  loading: boolean;
  error: string | null;
  checkinStatus: 'idle' | 'checking' | 'success' | 'error';
  checkinError: string | null;
  capabilities: ActivityAttendanceCapabilities | null;
  manualLanes: Record<string, ManualAttendanceLane>;
}

const emptyManualLane = (): ManualAttendanceLane => ({
  session: null,
  roster: null,
  loading: false,
  error: null,
  pending: {},
  errors: {},
});

const entityId = (value: unknown): string => {
  if (value && typeof value === 'object') {
    const record = value as { _id?: unknown; id?: unknown };
    return String(record._id || record.id || '');
  }
  return value == null ? '' : String(value);
};

export function useAttendanceSession({
  contextType,
  contextId,
  enabled = true,
  canManage = false,
  activityId = contextId,
  currentUserId = '',
  manualScheduleId,
}: UseAttendanceSessionOptions) {
  const [state, setState] = useState<AttendanceSessionState>({
    session: null,
    checkins: [],
    qrData: null,
    loading: false,
    error: null,
    checkinStatus: 'idle',
    checkinError: null,
    capabilities: null,
    manualLanes: {},
  });
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const updateManualLane = useCallback((
    classId: string,
    update: (lane: ManualAttendanceLane) => ManualAttendanceLane,
  ) => {
    setState((previous) => ({
      ...previous,
      manualLanes: {
        ...previous.manualLanes,
        [classId]: update(previous.manualLanes[classId] || emptyManualLane()),
      },
    }));
  }, []);

  const fetchCheckins = useCallback(async (sessionId: string) => {
    try {
      const checkins = await attendanceSessionApi.getCheckins(sessionId);
      setState((previous) => ({ ...previous, checkins }));
    } catch {
      // Access controls decide whether this user receives a roster or only their own check-in.
    }
  }, []);

  // This lane remains the shared QR/proximity lane for backwards compatibility.
  const fetchActiveSession = useCallback(async () => {
    if (!contextId || !enabled) return null;
    try {
      setState((previous) => ({ ...previous, loading: !previous.session, error: null }));
      const session = await attendanceSessionApi.getActiveSession({
        context_type: contextType,
        context_id: contextId,
      });
      setState((previous) => ({
        ...previous,
        session,
        loading: false,
        checkins: session ? previous.checkins : [],
      }));
      if (session?._id) await fetchCheckins(session._id);
      return session;
    } catch (error: any) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: error.message || 'Unable to load attendance session',
      }));
      return null;
    }
  }, [contextId, contextType, enabled, fetchCheckins]);

  const fetchCapabilities = useCallback(async () => {
    if (!enabled || !activityId) return null;
    try {
      const capabilities = await activityAttendanceGrantApi.getCapabilities(activityId);
      setState((previous) => ({ ...previous, capabilities }));
      return capabilities;
    } catch {
      setState((previous) => ({ ...previous, capabilities: null }));
      return null;
    }
  }, [activityId, enabled]);

  const fetchManualRoster = useCallback(async (classId: string, sessionId: string) => {
    try {
      const roster = await attendanceSessionApi.getManualRoster(sessionId);
      updateManualLane(classId, (lane) => ({ ...lane, roster, error: null }));
      return roster;
    } catch (error: any) {
      updateManualLane(classId, (lane) => ({
        ...lane,
        error: error.message || 'Unable to load class roster',
      }));
      return null;
    }
  }, [updateManualLane]);

  const fetchManualLane = useCallback(async (classId: string) => {
    if (!contextId || !enabled || !manualScheduleId) return null;
    updateManualLane(classId, (lane) => ({ ...lane, loading: true, error: null }));
    try {
      const session = await attendanceSessionApi.getActiveSession({
        context_type: contextType,
        context_id: contextId,
        method: 'manual_class',
        class_id: classId,
        schedule_id: manualScheduleId,
      });
      updateManualLane(classId, (lane) => ({
        ...lane,
        session,
        roster: session ? lane.roster : null,
        loading: false,
      }));
      if (session?._id) await fetchManualRoster(classId, session._id);
      return session;
    } catch (error: any) {
      updateManualLane(classId, (lane) => ({
        ...lane,
        loading: false,
        error: error.message || 'Unable to load class attendance session',
      }));
      return null;
    }
  }, [contextId, contextType, enabled, fetchManualRoster, manualScheduleId, updateManualLane]);

  const fetchQrData = useCallback(async (sessionId: string) => {
    if (!canManage) return null;
    try {
      const qrData = await attendanceSessionApi.getQrData(sessionId);
      setState((previous) => ({ ...previous, qrData }));
      return qrData;
    } catch {
      return null;
    }
  }, [canManage]);

  const applyRealtimeEvent = useCallback((event: AttendanceRealtimeEvent) => {
    const method = event.method || String(event.session?.method || '');
    if (method === 'manual_class') {
      const classId = event.classId || entityId(event.session?.class_id);
      const scheduleId = event.scheduleId || entityId(event.session?.schedule_id);
      const openedBy = event.openedBy || entityId(event.session?.opened_by);
      if (!classId || !manualScheduleId || scheduleId !== manualScheduleId || openedBy !== currentUserId) return;

      setState((previous) => {
        const lane = previous.manualLanes[classId];
        if (!lane) return previous;
        if (event.type === 'attendance.session_opened' && event.session) {
          return {
            ...previous,
            manualLanes: {
              ...previous.manualLanes,
              [classId]: {
                ...lane,
                session: event.session as unknown as AttendanceSessionData,
                roster: null,
                error: null,
              },
            },
          };
        }
        if (event.type === 'attendance.session_closed') {
          if (lane.session?._id !== event.sessionId) return previous;
          return {
            ...previous,
            manualLanes: {
              ...previous.manualLanes,
              [classId]: {
                ...lane,
                session: event.session
                  ? event.session as unknown as AttendanceSessionData
                  : lane.session && { ...lane.session, status: 'closed' },
              },
            },
          };
        }
        if (
          event.type === 'attendance.checkin_created'
          && lane.session?._id === event.sessionId
          && lane.roster
          && event.attendance
        ) {
          return {
            ...previous,
            manualLanes: {
              ...previous.manualLanes,
              [classId]: {
                ...lane,
                roster: {
                  ...lane.roster,
                  students: lane.roster.students.map((student) =>
                    student._id === event.studentId
                      ? { ...student, attendance: event.attendance as unknown as ActivityAttendance }
                      : student,
                  ),
                },
              },
            },
          };
        }
        return previous;
      });
      if (event.type === 'attendance.session_opened' && event.session) {
        void fetchManualRoster(classId, event.session._id as string);
      }
      return;
    }

    if (event.type === 'attendance.session_opened' && event.session) {
      setState((previous) => ({
        ...previous,
        session: event.session as unknown as AttendanceSessionData,
        checkins: [],
        qrData: null,
      }));
      return;
    }
    if (event.type === 'attendance.session_closed') {
      setState((previous) => {
        if (previous.session?._id !== event.sessionId) return previous;
        return {
          ...previous,
          session: event.session
            ? event.session as unknown as AttendanceSessionData
            : previous.session && { ...previous.session, status: 'closed' },
          qrData: null,
        };
      });
      return;
    }
    if (event.type === 'attendance.checkin_created') {
      if (canManage && event.sessionId) void fetchCheckins(event.sessionId);
      setState((previous) => {
        if (previous.session?._id !== event.sessionId) return previous;
        const checkin = event.checkin as unknown as AttendanceCheckinData | undefined;
        const checkins = !canManage && checkin && !previous.checkins.some((item) => item._id === checkin._id)
          ? [checkin, ...previous.checkins]
          : previous.checkins;
        return {
          ...previous,
          checkins,
          session: {
            ...previous.session,
            checkin_count: event.checkinCount ?? previous.session.checkin_count,
          },
        };
      });
      return;
    }
    if (event.type === 'attendance.qr_rotated' && canManage && event.sessionId) {
      setState((previous) => {
        if (previous.session?._id === event.sessionId) void fetchQrData(event.sessionId!);
        return previous;
      });
    }
  }, [
    canManage,
    currentUserId,
    fetchCheckins,
    fetchManualRoster,
    fetchQrData,
    manualScheduleId,
  ]);

  const { status: realtimeStatus } = useAttendanceRealtime({
    contextType,
    contextId,
    enabled,
    onEvent: applyRealtimeEvent,
  });

  useEffect(() => {
    void fetchActiveSession();
    void fetchCapabilities();
  }, [fetchActiveSession, fetchCapabilities]);

  const manualClassIds = useMemo(
    () => state.capabilities?.effective_methods.includes('manual_class')
      ? state.capabilities.classes.map((item) => item._id)
      : [],
    [state.capabilities],
  );
  const manualClassKey = manualClassIds.join('|');

  useEffect(() => {
    if (!manualScheduleId) return;
    for (const classId of manualClassIds) void fetchManualLane(classId);
  // The joined key avoids rehydrating every lane when an unrelated state field changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchManualLane, manualClassKey, manualScheduleId]);

  useEffect(() => {
    if (realtimeStatus !== 'connected') return;
    void fetchActiveSession();
    for (const classId of manualClassIds) void fetchManualLane(classId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeStatus]);

  useEffect(() => {
    if (!canManage || !state.session || state.session.method !== 'qr' || state.session.status !== 'active') return;
    const interval = Math.max(1000, ((state.session.qr_refresh_interval || 30) * 1000) - 2000);
    void fetchQrData(state.session._id);
    qrTimerRef.current = setInterval(() => { void fetchQrData(state.session!._id); }, interval);
    return () => {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };
  }, [
    canManage,
    state.session?._id,
    state.session?.method,
    state.session?.status,
    state.session?.qr_refresh_interval,
    fetchQrData,
  ]);

  const openSelfServiceSession = useCallback(async (params: any) => {
    try {
      setState((previous) => ({ ...previous, loading: true, error: null }));
      const session = await attendanceSessionApi.openSession({
        context_type: contextType,
        context_id: contextId,
        ...params,
      });
      setState((previous) => ({
        ...previous,
        session,
        loading: false,
        checkins: [],
      }));
      return session;
    } catch (error: any) {
      setState((previous) => ({
        ...previous,
        loading: false,
        error: error.message || 'Unable to open attendance session',
      }));
      throw error;
    }
  }, [contextId, contextType]);

  const openManualSession = useCallback(async (classId: string, params: any) => {
    updateManualLane(classId, (lane) => ({ ...lane, loading: true, error: null }));
    try {
      const session = await attendanceSessionApi.openSession({
        context_type: contextType,
        context_id: contextId,
        ...params,
        method: 'manual_class',
        class_id: classId,
      });
      updateManualLane(classId, (lane) => ({
        ...lane,
        session,
        roster: null,
        loading: false,
      }));
      await fetchManualRoster(classId, session._id);
      return session;
    } catch (error: any) {
      // A duplicate request from this opener is recoverable: hydrate their existing lane.
      const existing = await fetchManualLane(classId);
      if (existing) return existing;
      updateManualLane(classId, (lane) => ({
        ...lane,
        loading: false,
        error: error.message || 'Unable to open class attendance session',
      }));
      throw error;
    }
  }, [contextId, contextType, fetchManualLane, fetchManualRoster, updateManualLane]);

  const openSession = useCallback(async (params: any) => {
    if (params.method === 'manual_class' && params.class_id) {
      return openManualSession(params.class_id, params);
    }
    return openSelfServiceSession(params);
  }, [openManualSession, openSelfServiceSession]);

  const closeSession = useCallback(async () => {
    if (!state.session) return;
    const session = await attendanceSessionApi.closeSession(state.session._id);
    setState((previous) => ({
      ...previous,
      session: { ...session, status: 'closed' },
      qrData: null,
      loading: false,
    }));
  }, [state.session]);

  const closeManualSession = useCallback(async (classId: string) => {
    const active = state.manualLanes[classId]?.session;
    if (!active) return;
    updateManualLane(classId, (lane) => ({ ...lane, loading: true, error: null }));
    try {
      const session = await attendanceSessionApi.closeSession(active._id);
      updateManualLane(classId, (lane) => ({
        ...lane,
        session: { ...session, status: 'closed' },
        loading: false,
      }));
    } catch (error: any) {
      updateManualLane(classId, (lane) => ({
        ...lane,
        loading: false,
        error: error.message || 'Unable to close class attendance session',
      }));
      throw error;
    }
  }, [state.manualLanes, updateManualLane]);

  const checkinQr = useCallback(async (token: string) => {
    try {
      setState((previous) => ({ ...previous, checkinStatus: 'checking', checkinError: null }));
      const result = await attendanceSessionApi.checkinQr({ token });
      setState((previous) => ({
        ...previous,
        checkinStatus: 'success',
        checkins: previous.checkins.some((item) => item._id === result._id)
          ? previous.checkins
          : [result, ...previous.checkins],
      }));
      return result;
    } catch (error: any) {
      setState((previous) => ({
        ...previous,
        checkinStatus: 'error',
        checkinError: error.message || 'Attendance check-in failed',
      }));
      throw error;
    }
  }, []);

  const checkinProximity = useCallback(async (latitude: number, longitude: number) => {
    if (!state.session) throw new Error('No active attendance session');
    try {
      setState((previous) => ({ ...previous, checkinStatus: 'checking', checkinError: null }));
      const result = await attendanceSessionApi.checkinProximity({
        session_id: state.session._id,
        latitude,
        longitude,
      });
      setState((previous) => ({
        ...previous,
        checkinStatus: 'success',
        checkins: previous.checkins.some((item) => item._id === result._id)
          ? previous.checkins
          : [result, ...previous.checkins],
      }));
      return result;
    } catch (error: any) {
      setState((previous) => ({
        ...previous,
        checkinStatus: 'error',
        checkinError: error.message || 'Attendance check-in failed',
      }));
      throw error;
    }
  }, [state.session]);

  const manualCheckin = useCallback(async (classId: string, studentId: string) => {
    const active = state.manualLanes[classId]?.session;
    if (!active) throw new Error('No active class attendance session');
    updateManualLane(classId, (lane) => ({
      ...lane,
      pending: { ...lane.pending, [studentId]: true },
      errors: { ...lane.errors, [studentId]: '' },
      roster: lane.roster ? {
        ...lane.roster,
        students: lane.roster.students.map((student) =>
          student._id === studentId
            ? {
                ...student,
                attendance: student.attendance || ({
                  _id: `optimistic-${studentId}`,
                  student_id: studentId,
                  schedule_id: active.schedule_id,
                  status: 'present',
                  approval_status: 'approved',
                } as ActivityAttendance),
              }
            : student,
        ),
      } : null,
    }));
    try {
      const attendance = await attendanceSessionApi.manualCheckin(active._id, studentId);
      updateManualLane(classId, (lane) => ({
        ...lane,
        pending: { ...lane.pending, [studentId]: false },
        roster: lane.roster ? {
          ...lane.roster,
          students: lane.roster.students.map((student) =>
            student._id === studentId ? { ...student, attendance } : student,
          ),
        } : null,
      }));
      return attendance;
    } catch (error: any) {
      updateManualLane(classId, (lane) => ({
        ...lane,
        pending: { ...lane.pending, [studentId]: false },
        errors: { ...lane.errors, [studentId]: error.message || 'Attendance check-in failed' },
        roster: lane.roster ? {
          ...lane.roster,
          students: lane.roster.students.map((student) =>
            student._id === studentId && student.attendance?._id === `optimistic-${studentId}`
              ? { ...student, attendance: null }
              : student,
          ),
        } : null,
      }));
      throw error;
    }
  }, [state.manualLanes, updateManualLane]);

  const resetCheckinStatus = useCallback(() => {
    setState((previous) => ({ ...previous, checkinStatus: 'idle', checkinError: null }));
  }, []);

  return {
    ...state,
    realtimeStatus,
    openSession,
    openManualSession,
    closeSession,
    closeManualSession,
    checkinQr,
    checkinProximity,
    manualCheckin,
    resetCheckinStatus,
    refreshCapabilities: fetchCapabilities,
    refreshManualLane: fetchManualLane,
    refreshSession: fetchActiveSession,
    refreshCheckins: () => state.session ? fetchCheckins(state.session._id) : Promise.resolve(),
  };
}
