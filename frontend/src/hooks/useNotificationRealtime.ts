'use client';
import { useEffect } from 'react';
import { API_BASE } from '@/api/config';
import { tokenStorage } from '@/api/auth-api';

export function useNotificationRealtime(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let controller: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retry = 0;
    const connect = async () => {
      if (stopped) return;
      const token = tokenStorage.getAccessToken();
      if (!token) return;
      controller = new AbortController();
      try {
        const response = await fetch(`${API_BASE}/notifications/realtime`, { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal });
        if (!response.ok || !response.body) throw new Error('Notification stream unavailable');
        retry = 0;
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split('\n\n'); buffer = events.pop() || '';
          for (const event of events) {
            const line = event.split('\n').find((item) => item.startsWith('data:'));
            if (line?.includes('notification.created')) window.dispatchEvent(new Event('notifications-updated'));
          }
        }
      } catch (error: any) { if (error?.name === 'AbortError' || stopped) return; }
      if (!stopped) retryTimer = setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
    };
    connect();
    return () => { stopped = true; controller?.abort(); if (retryTimer) clearTimeout(retryTimer); };
  }, [enabled]);
}
