import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/students/tasks',
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

describe('AuthProvider session rehydration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
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
});
