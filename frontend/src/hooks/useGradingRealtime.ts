import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../api/config';
import { tokenStorage } from '../api/auth-api';

interface UseGradingRealtimeOptions {
  classId?: string;
  semesterId?: string;
  enabled: boolean;
  onEvent: (event: any) => void;
}

export function useGradingRealtime({ classId, semesterId, enabled, onEvent }: UseGradingRealtimeOptions) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const abortControllerRef = useRef<AbortController | null>(null);
  // Dùng ref để lưu handler mới nhất, tránh trigger lại useEffect khi handler thay đổi
  const savedHandler = useRef(onEvent);

  useEffect(() => {
    savedHandler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setStatus('disconnected');
      return;
    }

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 5;

    const connect = async () => {
      try {
        setStatus('connecting');
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        const token = tokenStorage.getAccessToken();
        let url = `${API_BASE}/summaries-points/realtime`;
        const params = new URLSearchParams();
        if (classId && classId !== 'all') params.append('classId', classId);
        if (semesterId) params.append('semesterId', semesterId);
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'text/event-stream',
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
            if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              try {
                const event = JSON.parse(dataStr);
                if (event.type !== 'ping' && event.type !== 'connected') {
                  savedHandler.current(event);
                }
              } catch (e) {
                console.error('Failed to parse SSE data', e);
              }
            }
          }
        }
        
        // Reconnect if stream ends normally
        if (isMounted) {
           setStatus('disconnected');
           setTimeout(connect, 3000);
        }
      } catch (err: any) {
        if (err.name === 'AbortError') return;
        
        if (isMounted) {
          setStatus('disconnected');
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(connect, 3000 * retryCount); // Backoff
          }
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
    };
  }, [classId, semesterId, enabled]);

  return { status };
}
