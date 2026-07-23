'use client';

import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '@/api/config';
import { tokenStorage } from '@/api/auth-api';

export interface AttendanceRealtimeEvent {
  type: string;
  sessionId?: string;
  checkinCount?: number;
  openedBy?: string;
  method?: string;
  classId?: string;
  scheduleId?: string;
  studentId?: string;
  session?: Record<string, unknown>;
  checkin?: Record<string, unknown>;
  attendance?: Record<string, unknown>;
}

interface Options {
  contextType: string;
  contextId: string;
  enabled: boolean;
  onEvent: (event: AttendanceRealtimeEvent) => void;
}

export function useAttendanceRealtime({ contextType, contextId, enabled, onEvent }: Options) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const callbackRef = useRef(onEvent);

  useEffect(() => { callbackRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled || !contextType || !contextId) {
      setStatus('disconnected');
      return;
    }

    let mounted = true;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retries = 0;
    let controller: AbortController | null = null;

    const connect = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        setStatus('connecting');
        const params = new URLSearchParams({ context_type: contextType, context_id: contextId });
        const response = await fetch(`${API_BASE}/attendance-sessions/realtime?${params.toString()}`, {
          headers: { Authorization: `Bearer ${tokenStorage.getAccessToken()}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Attendance realtime failed: ${response.status}`);
        retries = 0;
        setStatus('connected');
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (mounted && reader) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6)) as AttendanceRealtimeEvent;
              if (event.type !== 'connected' && event.type !== 'ping') callbackRef.current(event);
            } catch {
              // Ignore malformed events and keep the authenticated stream alive.
            }
          }
        }
      } catch (error: any) {
        if (error?.name === 'AbortError') return;
      }
      if (mounted) {
        setStatus('disconnected');
        retryTimer = setTimeout(connect, Math.min(15000, 1000 * 2 ** retries));
        retries += 1;
      }
    };

    connect();
    return () => {
      mounted = false;
      controller?.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [contextType, contextId, enabled]);

  return { status };
}
