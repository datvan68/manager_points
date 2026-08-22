import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { replaceWindowLocation } = vi.hoisted(() => ({ replaceWindowLocation: vi.fn() }));

vi.mock('@/lib/impersonation-channel', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/impersonation-channel')>()),
  replaceWindowLocation,
}));

import AccessPage from './page';
import { IMPERSONATION_HANDOFF_TIMEOUT_MS } from '@/lib/impersonation-channel';

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  readonly name: string;
  readonly posted: unknown[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  closed = false;

  constructor(name: string) {
    this.name = name;
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  emit(message: unknown) {
    this.onmessage?.({ data: message } as MessageEvent);
  }

  close() {
    this.closed = true;
  }
}

describe('AccessPage impersonation bootstrap', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    vi.stubGlobal('crypto', {
      randomUUID: vi.fn().mockReturnValue('child-session-1234567890'),
    });
    window.history.replaceState({}, '', '/access#channel=handoff-nonce-1234567890');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState({}, '', '/');
  });

  it('stores the child credentials only after a valid success handoff', async () => {
    localStorage.setItem('auth_session_id', 'admin-session');
    render(<AccessPage />);

    const channel = FakeBroadcastChannel.instances[0];
    expect(channel.posted).toContainEqual({
      type: 'READY',
      sessionId: 'child-session-1234567890',
    });
    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('auth_session_id')).toBe('admin-session');

    act(() => {
      channel.emit({
        type: 'SUCCESS',
        payload: {
          access_token: 'impersonated-token',
          user: { id: 'target-1', username: 'student-1', roleCode: 'STUDENT' },
          impersonation: { id: 'imp-1', expires_at: '2026-08-22T12:00:00.000Z' },
        },
      });
    });

    await waitFor(() => expect(sessionStorage.getItem('access_token')).toBe('impersonated-token'));
    expect(JSON.parse(sessionStorage.getItem('user') || '{}')).toMatchObject({
      id: 'target-1',
      impersonation: { id: 'imp-1' },
    });
    expect(localStorage.getItem('auth_session_id')).toBe('admin-session');
    expect(channel.posted).toContainEqual({ type: 'ACK' });
    expect(replaceWindowLocation).toHaveBeenCalledWith('/students/tasks');

    act(() => {
      channel.emit({ type: 'ERROR', message: 'late error' });
      channel.emit({ type: 'READY', sessionId: 'late-session' });
    });

    expect(sessionStorage.getItem('access_token')).toBe('impersonated-token');
    expect(screen.queryByText('late error')).not.toBeInTheDocument();
  });

  it('clears the tab auth state and shows a backend error', async () => {
    render(<AccessPage />);
    const channel = FakeBroadcastChannel.instances[0];

    act(() => {
      channel.emit({ type: 'ERROR', message: 'Bạn đang truy cập tối đa 5 tài khoản.' });
    });

    expect(await screen.findByText('Bạn đang truy cập tối đa 5 tài khoản.')).toBeInTheDocument();
    expect(sessionStorage.getItem('auth_session_id')).toBeNull();
    expect(channel.posted).toContainEqual({ type: 'ACK' });

    act(() => {
      channel.emit({
        type: 'SUCCESS',
        payload: {
          access_token: 'late-token',
          user: { id: 'target-1', username: 'student-1', roleCode: 'STUDENT' },
          impersonation: { id: 'late-imp-1', expires_at: '2026-08-22T12:00:00.000Z' },
        },
      });
    });

    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(replaceWindowLocation).not.toHaveBeenCalled();
  });

  it('clears copied tab auth before invalid bootstrap returns', () => {
    window.history.replaceState({}, '', '/access#channel=invalid');
    localStorage.setItem('auth_session_id', 'admin-session');
    sessionStorage.setItem('auth_session_id', 'copied-admin-session');
    sessionStorage.setItem('access_token', 'copied-token');
    sessionStorage.setItem('user', JSON.stringify({ id: 'admin-1' }));

    render(<AccessPage />);

    expect(sessionStorage.getItem('auth_session_id')).toBeNull();
    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('auth_session_id')).toBe('admin-session');
  });

  it('enters a terminal timeout state and ignores a later success', () => {
    vi.useFakeTimers();
    try {
      render(<AccessPage />);
      const channel = FakeBroadcastChannel.instances[0];

      act(() => {
        vi.advanceTimersByTime(IMPERSONATION_HANDOFF_TIMEOUT_MS + 1_000);
      });
      expect(screen.getByText('Phiên kết nối đã hết thời gian chờ. Vui lòng đóng cửa sổ và thử lại.')).toBeInTheDocument();

      act(() => {
        channel.emit({
          type: 'SUCCESS',
          payload: {
            access_token: 'late-token',
            user: { id: 'target-1', username: 'student-1', roleCode: 'STUDENT' },
            impersonation: { id: 'late-imp-1', expires_at: '2026-08-22T12:00:00.000Z' },
          },
        });
        channel.emit({ type: 'ERROR', message: 'late error' });
        channel.emit({ type: 'READY', sessionId: 'late-session' });
      });

      expect(sessionStorage.getItem('access_token')).toBeNull();
      expect(replaceWindowLocation).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears copied tab auth before an unsupported browser can return', () => {
    vi.stubGlobal('BroadcastChannel', undefined);
    localStorage.setItem('auth_session_id', 'admin-session');
    sessionStorage.setItem('auth_session_id', 'copied-admin-session');
    sessionStorage.setItem('access_token', 'copied-token');

    render(<AccessPage />);

    expect(screen.getByText('Trình duyệt không hỗ trợ mở phiên truy cập an toàn.')).toBeInTheDocument();
    expect(sessionStorage.getItem('auth_session_id')).toBeNull();
    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('auth_session_id')).toBe('admin-session');
  });
});
