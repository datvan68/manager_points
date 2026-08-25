import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { push, refresh, pathnameState, broadcastChannels } = vi.hoisted(() => {
  class TestBroadcastChannel {
    static instances: TestBroadcastChannel[] = [];
    private listeners = new Set<(event: MessageEvent) => void>();
    onmessage: ((event: MessageEvent) => void) | null = null;

    constructor() {
      TestBroadcastChannel.instances.push(this);
    }

    addEventListener(_type: string, listener: (event: MessageEvent) => void) {
      this.listeners.add(listener);
    }

    removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
      this.listeners.delete(listener);
    }

    postMessage(data: unknown) {
      for (const channel of TestBroadcastChannel.instances) {
        const event = { data } as MessageEvent;
        channel.onmessage?.(event);
        for (const listener of channel.listeners) listener(event);
      }
    }

    close() {}
  }

  globalThis.BroadcastChannel = TestBroadcastChannel as unknown as typeof BroadcastChannel;
  return {
  push: vi.fn(),
  refresh: vi.fn(),
  pathnameState: { current: '/students/tasks' },
    broadcastChannels: TestBroadcastChannel.instances,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathnameState.current,
}));

vi.mock('./../api/http-client', () => ({
  synchronizedRefreshToken: refresh,
}));

import { AuthProvider, useAuth } from './auth-provider';
import { authApi, tokenStorage } from '@/api/auth-api';

function Probe() {
  const { user, isAuthenticated, isLoading } = useAuth();
  return <output>{JSON.stringify({ user, isAuthenticated, isLoading })}</output>;
}

function LogoutProbe() {
  const { logout } = useAuth();
  return <button onClick={() => void logout()}>logout</button>;
}

describe('AuthProvider session rehydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    pathnameState.current = '/students/tasks';
    refresh.mockResolvedValue({ access_token: 'fresh-access-token' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'user-1',
      user_name: 'student-1',
      display_name: 'Student One',
      roleName: 'Admin',
      roleCode: 'ADMIN',
      permissions: ['TASK_READ'],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
  });

  it('rehydrates user state from refresh and /auth/me without session user', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(tokenStorage.getUser()).toEqual(expect.objectContaining({ id: 'user-1' })));

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(tokenStorage.getAccessToken()).toBe('fresh-access-token');
    expect(tokenStorage.getUser()).toEqual(expect.objectContaining({ id: 'user-1' }));
    expect(push).not.toHaveBeenCalledWith('/login');
  });

  it('redirects an unauthenticated protected route once after auth loading completes', async () => {
    refresh.mockRejectedValue({ status: 401 });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));

    expect(push).toHaveBeenCalledTimes(1);
  });

  it('renders an authenticated protected route after hydration without redirecting', async () => {
    tokenStorage.setAccessToken('stored-access-token');
    tokenStorage.setUser({ id: 'user-1', roleCode: 'ADMIN', permissions: ['TASK_READ'] });

    const { getByText } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText(/"isLoading":false/)).toBeInTheDocument());

    expect(getByText(/"isAuthenticated":true/)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('refreshes effective permissions after a rejected authorization response', async () => {
    tokenStorage.setAccessToken('stored-access-token');
    tokenStorage.setUser({ id: 'user-1', roleCode: 'USER', permissions: ['CLASS_UPDATE'] });
    const fetchMock = vi.mocked(fetch);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      id: 'user-1',
      user_name: 'student-1',
      roleName: 'User',
      roleCode: 'USER',
      permissions: ['CLASS_READ'],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    window.dispatchEvent(new CustomEvent('authorization-denied'));

    await waitFor(() => expect(tokenStorage.getUser()?.permissions).toEqual(['CLASS_READ']));
  });

  it('does not refresh or hydrate the normal session on the access bootstrap route', async () => {
    pathnameState.current = '/access';

    const { getByText } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText(/"isLoading":false/)).toBeInTheDocument());
    expect(refresh).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('rehydrates auth state after navigating away from the initial access bootstrap route', async () => {
    pathnameState.current = '/access';

    const { getByText, rerender } = render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByText(/"isLoading":false/)).toBeInTheDocument());
    expect(refresh).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();

    tokenStorage.setAccessToken('child-access-token');
    tokenStorage.setUser({ id: 'child-user', roleCode: 'STUDENT', permissions: [] });
    pathnameState.current = '/students/tasks';
    rerender(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(tokenStorage.getUser()).toEqual(expect.objectContaining({ id: 'user-1' })));
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({ headers: { Authorization: 'Bearer child-access-token' } }),
    );

    pathnameState.current = '/students/grades';
    rerender(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('preserves the child tab session id across impersonated logout', async () => {
    localStorage.setItem('auth_session_id', 'admin-session');
    tokenStorage.setTabSessionId('child-session-1234567890');
    tokenStorage.setAccessToken('child-access-token');
    tokenStorage.setUser({
      id: 'child-user',
      roleCode: 'STUDENT',
      permissions: [],
      impersonation: { id: 'imp-1', expires_at: '2026-08-22T12:00:00.000Z' },
    });

    const { getByRole } = render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByRole('button', { name: 'logout' })).toBeInTheDocument());
    fireEvent.click(getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));

    expect(sessionStorage.getItem('auth_session_id')).toBe('child-session-1234567890');
    expect(localStorage.getItem('auth_session_id')).toBe('admin-session');
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/logout'),
      expect.objectContaining({
        headers: { 'X-Auth-Session-Id': 'child-session-1234567890' },
      }),
    );
  });

  it('keeps ordinary logout storage behavior unchanged', async () => {
    sessionStorage.setItem('auth_session_id', 'admin-session');
    localStorage.setItem('auth_session_id', 'admin-session');
    tokenStorage.setAccessToken('admin-access-token');
    tokenStorage.setUser({ id: 'admin-user', roleCode: 'ADMIN', permissions: [] });

    const { getByRole } = render(
      <AuthProvider>
        <LogoutProbe />
      </AuthProvider>,
    );

    await waitFor(() => expect(getByRole('button', { name: 'logout' })).toBeInTheDocument());
    fireEvent.click(getByRole('button', { name: 'logout' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));

    expect(sessionStorage.getItem('access_token')).toBeNull();
    expect(sessionStorage.getItem('auth_session_id')).toBe('admin-session');
    expect(localStorage.getItem('auth_session_id')).toBe('admin-session');
  });

  it('does not fork an impersonation tab when duplicate presence is detected', async () => {
    const forkSession = vi.spyOn(authApi, 'forkSession').mockResolvedValue({
      access_token: 'forked-token',
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    sessionStorage.setItem('auth_session_id', 'child-session');
    tokenStorage.setAccessToken('child-access-token');
    tokenStorage.setUser({
      id: 'child-user',
      roleCode: 'STUDENT',
      permissions: [],
      impersonation: { id: 'imp-1', expires_at: '2099-01-01T00:00:00.000Z' },
    });

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.anything(),
    ));
    expect(forkSession).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalledWith(
      'Failed to isolate duplicated auth tab:',
      expect.anything(),
    );
  });

  it('still forks a duplicated ordinary session', async () => {
    const forkSession = vi.spyOn(authApi, 'forkSession').mockResolvedValue({
      access_token: 'forked-token',
    });
    sessionStorage.setItem('auth_session_id', 'admin-session');
    tokenStorage.setAccessToken('admin-access-token');
    tokenStorage.setUser({ id: 'admin-user', roleCode: 'ADMIN', permissions: [] });
    const duplicateTab = new BroadcastChannel('auth_tab_presence');
    duplicateTab.onmessage = (event) => {
      if (event.data?.type === 'TAB_HELLO') {
        duplicateTab.postMessage({
          type: 'TAB_PRESENT',
          sessionId: event.data.sessionId,
          tabId: 'other-tab',
        });
      }
    };

    render(<AuthProvider><Probe /></AuthProvider>);

    await waitFor(() => expect(forkSession).toHaveBeenCalledWith(
      expect.any(String),
      false,
    ));
    expect(tokenStorage.getAccessToken()).toBe('forked-token');
  });
});
