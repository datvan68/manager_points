'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { attendanceSessionApi, type AttendanceSessionData, type AttendanceCheckinData, type QrData } from '@/api/activity-api';
import { useAttendanceRealtime, type AttendanceRealtimeEvent } from './useAttendanceRealtime';

interface UseAttendanceSessionOptions {
  contextType: string;
  contextId: string;
  enabled?: boolean;
  canManage?: boolean;
}

interface AttendanceSessionState {
  session: AttendanceSessionData | null;
  checkins: AttendanceCheckinData[];
  qrData: QrData | null;
  loading: boolean;
  error: string | null;
  checkinStatus: 'idle' | 'checking' | 'success' | 'error';
  checkinError: string | null;
}

export function useAttendanceSession({ contextType, contextId, enabled = true, canManage = false }: UseAttendanceSessionOptions) {
  const [state, setState] = useState<AttendanceSessionState>({
    session: null, checkins: [], qrData: null, loading: false, error: null,
    checkinStatus: 'idle', checkinError: null,
  });
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCheckins = useCallback(async (sessionId: string) => {
    try {
      const checkins = await attendanceSessionApi.getCheckins(sessionId);
      setState((previous) => ({ ...previous, checkins }));
    } catch {
      // Access controls decide whether this user receives a roster or only their own check-in.
    }
  }, []);

  const fetchActiveSession = useCallback(async () => {
    if (!contextId || !enabled) return null;
    try {
      setState((previous) => ({ ...previous, loading: !previous.session, error: null }));
      const session = await attendanceSessionApi.getActiveSession({ context_type: contextType, context_id: contextId });
      setState((previous) => ({ ...previous, session, loading: false, checkins: session ? previous.checkins : [] }));
      if (session?._id) await fetchCheckins(session._id);
      return session;
    } catch (error: any) {
      setState((previous) => ({ ...previous, loading: false, error: error.message || 'Lỗi khi tải phiên điểm danh' }));
      return null;
    }
  }, [contextId, contextType, enabled, fetchCheckins]);

  const fetchQrData = useCallback(async (sessionId: string) => {
    if (!canManage) return null;
    try {
      const qrData = await attendanceSessionApi.getQrData(sessionId);
      setState((previous) => ({ ...previous, qrData }));
      return qrData;
    } catch { return null; }
  }, [canManage]);

  const applyRealtimeEvent = useCallback((event: AttendanceRealtimeEvent) => {
    if (event.type === 'attendance.session_opened' && event.session) {
      setState((previous) => ({ ...previous, session: event.session as unknown as AttendanceSessionData, checkins: [], qrData: null }));
      return;
    }
    if (event.type === 'attendance.session_closed') {
      setState((previous) => ({ ...previous, session: event.session ? event.session as unknown as AttendanceSessionData : null, qrData: null }));
      return;
    }
    if (event.type === 'attendance.checkin_created') {
      setState((previous) => {
        const checkin = event.checkin as unknown as AttendanceCheckinData | undefined;
        const checkins = checkin && !previous.checkins.some((item) => item._id === checkin._id)
          ? [checkin, ...previous.checkins] : previous.checkins;
        return {
          ...previous,
          checkins,
          session: previous.session ? { ...previous.session, checkin_count: event.checkinCount ?? previous.session.checkin_count } : previous.session,
        };
      });
      return;
    }
    if (event.type === 'attendance.qr_rotated' && canManage && event.sessionId) fetchQrData(event.sessionId);
  }, [canManage, fetchQrData]);

  const { status: realtimeStatus } = useAttendanceRealtime({ contextType, contextId, enabled, onEvent: applyRealtimeEvent });

  useEffect(() => { void fetchActiveSession(); }, [fetchActiveSession]);
  useEffect(() => {
    if (realtimeStatus === 'connected') void fetchActiveSession();
  }, [realtimeStatus, fetchActiveSession]);

  useEffect(() => {
    if (!canManage || !state.session || state.session.method !== 'qr' || state.session.status !== 'active') return;
    const interval = Math.max(1000, ((state.session.qr_refresh_interval || 30) * 1000) - 2000);
    void fetchQrData(state.session._id);
    qrTimerRef.current = setInterval(() => { void fetchQrData(state.session!._id); }, interval);
    return () => { if (qrTimerRef.current) clearInterval(qrTimerRef.current); };
  }, [canManage, state.session?._id, state.session?.method, state.session?.status, state.session?.qr_refresh_interval, fetchQrData]);

  const openSession = useCallback(async (params: any) => {
    try {
      setState((previous) => ({ ...previous, loading: true, error: null }));
      const session = await attendanceSessionApi.openSession({ context_type: contextType, context_id: contextId, ...params });
      setState((previous) => ({ ...previous, session, loading: false, checkins: [] }));
      return session;
    } catch (error: any) {
      setState((previous) => ({ ...previous, loading: false, error: error.message || 'Không thể mở phiên điểm danh' }));
      throw error;
    }
  }, [contextId, contextType]);

  const closeSession = useCallback(async () => {
    if (!state.session) return;
    const session = await attendanceSessionApi.closeSession(state.session._id);
    setState((previous) => ({ ...previous, session: { ...session, status: 'closed' }, qrData: null, loading: false }));
  }, [state.session]);

  const checkinQr = useCallback(async (token: string) => {
    try {
      setState((previous) => ({ ...previous, checkinStatus: 'checking', checkinError: null }));
      const result = await attendanceSessionApi.checkinQr({ token });
      setState((previous) => ({ ...previous, checkinStatus: 'success', checkins: previous.checkins.some((item) => item._id === result._id) ? previous.checkins : [result, ...previous.checkins] }));
      return result;
    } catch (error: any) {
      setState((previous) => ({ ...previous, checkinStatus: 'error', checkinError: error.message || 'Điểm danh thất bại' }));
      throw error;
    }
  }, []);

  const checkinProximity = useCallback(async (latitude: number, longitude: number) => {
    if (!state.session) throw new Error('Không có phiên điểm danh');
    try {
      setState((previous) => ({ ...previous, checkinStatus: 'checking', checkinError: null }));
      const result = await attendanceSessionApi.checkinProximity({ session_id: state.session._id, latitude, longitude });
      setState((previous) => ({ ...previous, checkinStatus: 'success', checkins: previous.checkins.some((item) => item._id === result._id) ? previous.checkins : [result, ...previous.checkins] }));
      return result;
    } catch (error: any) {
      setState((previous) => ({ ...previous, checkinStatus: 'error', checkinError: error.message || 'Điểm danh thất bại' }));
      throw error;
    }
  }, [state.session]);

  const resetCheckinStatus = useCallback(() => setState((previous) => ({ ...previous, checkinStatus: 'idle', checkinError: null })), []);
  return { ...state, realtimeStatus, openSession, closeSession, checkinQr, checkinProximity, resetCheckinStatus, refreshSession: fetchActiveSession, refreshCheckins: () => state.session ? fetchCheckins(state.session._id) : Promise.resolve() };
}
