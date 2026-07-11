'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  attendanceSessionApi,
  type AttendanceSessionData,
  type AttendanceCheckinData,
  type QrData,
} from '@/api/activity-api';

interface UseAttendanceSessionOptions {
  contextType: string;
  contextId: string;
  pollInterval?: number; // ms, default 5000
  enabled?: boolean;
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

export function useAttendanceSession(options: UseAttendanceSessionOptions) {
  const {
    contextType,
    contextId,
    pollInterval = 5000,
    enabled = true,
  } = options;

  const [state, setState] = useState<AttendanceSessionState>({
    session: null,
    checkins: [],
    qrData: null,
    loading: false,
    error: null,
    checkinStatus: 'idle',
    checkinError: null,
  });

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch active session ──
  const fetchActiveSession = useCallback(async () => {
    if (!contextId || !enabled) return;

    try {
      setState((prev) => ({ ...prev, loading: !prev.session, error: null }));
      const session = await attendanceSessionApi.getActiveSession({
        context_type: contextType,
        context_id: contextId,
      });
      setState((prev) => ({ ...prev, session, loading: false }));
      return session;
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Lỗi khi tải phiên điểm danh',
      }));
      return null;
    }
  }, [contextType, contextId, enabled]);

  // ── Fetch checkins ──
  const fetchCheckins = useCallback(async (sessionId: string) => {
    try {
      const checkins = await attendanceSessionApi.getCheckins(sessionId);
      setState((prev) => ({ ...prev, checkins }));
    } catch {
      // Silent fail for checkin list
    }
  }, []);

  // ── Fetch QR data (admin) ──
  const fetchQrData = useCallback(async (sessionId: string) => {
    try {
      const qrData = await attendanceSessionApi.getQrData(sessionId);
      setState((prev) => ({ ...prev, qrData }));
      return qrData;
    } catch {
      return null;
    }
  }, []);

  // ── Open session ──
  const openSession = useCallback(
    async (params: {
      method: 'qr' | 'proximity';
      schedule_id?: string;
      semester_id: string;
      latitude?: number;
      longitude?: number;
      radius_meters?: number;
      qr_refresh_interval?: number;
      title?: string;
      auto_close_at?: string;
    }) => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: null }));
        const session = await attendanceSessionApi.openSession({
          context_type: contextType,
          context_id: contextId,
          ...params,
        });
        setState((prev) => ({
          ...prev,
          session,
          loading: false,
          checkins: [],
        }));
        return session;
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err.message || 'Không thể mở phiên điểm danh',
        }));
        throw err;
      }
    },
    [contextType, contextId],
  );

  // ── Close session ──
  const closeSession = useCallback(async () => {
    if (!state.session) return;
    try {
      setState((prev) => ({ ...prev, loading: true }));
      const session = await attendanceSessionApi.closeSession(state.session._id);
      setState((prev) => ({
        ...prev,
        session: { ...session, status: 'closed' },
        loading: false,
        qrData: null,
      }));
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || 'Không thể đóng phiên',
      }));
    }
  }, [state.session]);

  // ── QR Check-in ──
  const checkinQr = useCallback(async (token: string) => {
    try {
      setState((prev) => ({
        ...prev,
        checkinStatus: 'checking',
        checkinError: null,
      }));
      const result = await attendanceSessionApi.checkinQr({ token });
      setState((prev) => ({
        ...prev,
        checkinStatus: 'success',
        checkins: [result, ...prev.checkins],
      }));
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Điểm danh thất bại';
      setState((prev) => ({
        ...prev,
        checkinStatus: 'error',
        checkinError: errorMsg,
      }));
      throw err;
    }
  }, []);

  // ── Proximity Check-in ──
  const checkinProximity = useCallback(
    async (latitude: number, longitude: number) => {
      if (!state.session) throw new Error('Không có phiên điểm danh');
      try {
        setState((prev) => ({
          ...prev,
          checkinStatus: 'checking',
          checkinError: null,
        }));
        const result = await attendanceSessionApi.checkinProximity({
          session_id: state.session._id,
          latitude,
          longitude,
        });
        setState((prev) => ({
          ...prev,
          checkinStatus: 'success',
          checkins: [result, ...prev.checkins],
        }));
        return result;
      } catch (err: any) {
        const errorMsg = err.message || 'Điểm danh thất bại';
        setState((prev) => ({
          ...prev,
          checkinStatus: 'error',
          checkinError: errorMsg,
        }));
        throw err;
      }
    },
    [state.session],
  );

  // ── Reset checkin status ──
  const resetCheckinStatus = useCallback(() => {
    setState((prev) => ({
      ...prev,
      checkinStatus: 'idle',
      checkinError: null,
    }));
  }, []);

  // ── Polling: active session + checkins ──
  useEffect(() => {
    if (!enabled || !contextId) return;

    fetchActiveSession();

    pollTimerRef.current = setInterval(async () => {
      const session = await fetchActiveSession();
      if (session?._id) {
        fetchCheckins(session._id);
      }
    }, pollInterval);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [enabled, contextId, pollInterval, fetchActiveSession, fetchCheckins]);

  // ── QR polling (faster interval for admin) ──
  useEffect(() => {
    if (!state.session || state.session.method !== 'qr' || state.session.status !== 'active') {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
      return;
    }

    const qrInterval = (state.session.qr_refresh_interval || 30) * 1000;
    fetchQrData(state.session._id);

    qrTimerRef.current = setInterval(() => {
      fetchQrData(state.session!._id);
    }, Math.min(qrInterval - 2000, 5000)); // Poll slightly before expiry

    return () => {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };
  }, [state.session?._id, state.session?.method, state.session?.status, fetchQrData]);

  return {
    ...state,
    openSession,
    closeSession,
    checkinQr,
    checkinProximity,
    resetCheckinStatus,
    refreshSession: fetchActiveSession,
    refreshCheckins: () =>
      state.session ? fetchCheckins(state.session._id) : Promise.resolve(),
  };
}
