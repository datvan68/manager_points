'use client';

import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../api/config';
import { tokenStorage } from '../api/auth-api';

export interface UseDormitoryOverviewRealtimeOptions {
  enabled: boolean;
  onInvalidate: (event?: any) => void;
  debounceMs?: number;
}

export function useDormitoryOverviewRealtime({
  enabled,
  onInvalidate,
  debounceMs = 250,
}: UseDormitoryOverviewRealtimeOptions) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const abortControllerRef = useRef<AbortController | null>(null);
  const savedHandler = useRef(onInvalidate);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    savedHandler.current = onInvalidate;
  }, [onInvalidate]);

  useEffect(() => {
    if (!enabled) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (burstTimerRef.current) {
        clearTimeout(burstTimerRef.current);
        burstTimerRef.current = null;
      }
      setStatus('disconnected');
      return;
    }

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 5;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const triggerInvalidate = (event?: any) => {
      if (burstTimerRef.current) {
        clearTimeout(burstTimerRef.current);
      }
      burstTimerRef.current = setTimeout(() => {
        if (isMounted) {
          savedHandler.current(event);
        }
      }, debounceMs);
    };

    const connect = async () => {
      if (!isMounted) return;
      try {
        setStatus('connecting');
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const token = tokenStorage.getAccessToken();
        if (!token) {
          setStatus('disconnected');
          return;
        }

        const url = `${API_BASE}/dormitory/reports/realtime`;
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }

        setStatus('connected');
        retryCount = 0;

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (reader && isMounted) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data:')) {
              const dataStr = trimmed.slice(5).trim();
              if (!dataStr) continue;
              let event: any;
              try {
                event = JSON.parse(dataStr);
              } catch {
                continue;
              }

              if (event && event.type !== 'ping' && event.type !== 'connected') {
                triggerInvalidate(event);
              }
            }
          }
        }

        if (isMounted) {
          setStatus('disconnected');
          if (retryCount < maxRetries) {
            const delay = Math.min(30000, 1000 * Math.pow(2, retryCount++) + Math.random() * 300);
            retryTimer = setTimeout(connect, delay);
          }
        }
      } catch (err: any) {
        if (err.name === 'AbortError' || !isMounted) return;

        setStatus('disconnected');
        if (retryCount < maxRetries) {
          const delay = Math.min(30000, 1000 * Math.pow(2, retryCount++) + Math.random() * 300);
          retryTimer = setTimeout(connect, delay);
        }
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (burstTimerRef.current) {
        clearTimeout(burstTimerRef.current);
        burstTimerRef.current = null;
      }
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    };
  }, [enabled, debounceMs]);

  return { status };
}
