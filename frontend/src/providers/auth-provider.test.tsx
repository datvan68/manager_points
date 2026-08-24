import { fireEvent, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { push, refresh, pathnameState } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  pathnameState: { current: '/students/tasks' },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathnameState.current,
}));

vi.mock('./../api/http-client', () => ({
  synchronizedRefreshToken: refresh,
}));

import { AuthProvider, useAuth } from './auth-provider';
import { tokenStorage } from '@/api/auth-api';

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
});
