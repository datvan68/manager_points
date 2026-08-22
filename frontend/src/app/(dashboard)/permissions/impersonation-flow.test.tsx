import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { apiMocks, authState, push, toastMocks } = vi.hoisted(() => ({
  apiMocks: {
    getUsers: vi.fn(),
    getRoles: vi.fn(),
    getPermissions: vi.fn(),
    getPermissionGroups: vi.fn(),
    getRoutePermissions: vi.fn(),
    getPagePermissionScopes: vi.fn(),
    createImpersonation: vi.fn(),
    getClasses: vi.fn(),
    getAccessToken: vi.fn(),
  },
  authState: {
    current: { id: 'admin-1', roleCode: 'ADMIN', permissions: ['ADMIN_FULL'] } as any,
  },
  push: vi.fn(),
  toastMocks: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/permissions',
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: authState.current,
    isLoading: false,
    logout: vi.fn(),
  }),
  isAdminUser: (user: any) => user?.roleCode === 'ADMIN' || user?.permissions?.includes('ADMIN_FULL'),
}));

vi.mock('@/components/guards/RouteGuard', () => ({
  RouteGuard: ({ children }: { children: React.ReactNode }) => children,
  invalidateRoutePermissionCache: vi.fn(),
  usePermission: () => ({}),
}));

vi.mock('@/api/auth-api', () => ({
  authApi: apiMocks,
  tokenStorage: {
    getAccessToken: apiMocks.getAccessToken,
  },
}));

vi.mock('@/api/class-api', () => ({
  classApi: { getClasses: apiMocks.getClasses },
}));

vi.mock('@/api/system-api', () => ({ systemApi: {} }));
vi.mock('sonner', () => ({ toast: toastMocks }));
vi.mock('@/components/permissions/PermissionFlowDiagram', () => ({ default: () => null }));

import PermissionsPage from './page';

class FakeBroadcastChannel {
  static instances: FakeBroadcastChannel[] = [];
  readonly posted: unknown[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(readonly name: string) {
    FakeBroadcastChannel.instances.push(this);
  }

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  emit(message: unknown) {
    this.onmessage?.({ data: message } as MessageEvent);
  }

  close() {}
}

describe('permissions user impersonation action', () => {
  beforeEach(() => {
    authState.current = { id: 'admin-1', roleCode: 'ADMIN', permissions: ['ADMIN_FULL'] };
    apiMocks.getUsers.mockResolvedValue([
      { _id: 'target-1', user_name: 'student-1', email: 'student@example.com', status: 'active' },
    ]);
    apiMocks.getRoles.mockResolvedValue([]);
    apiMocks.getPermissions.mockResolvedValue([]);
    apiMocks.getPermissionGroups.mockResolvedValue([]);
    apiMocks.getRoutePermissions.mockResolvedValue([]);
    apiMocks.getPagePermissionScopes.mockResolvedValue([]);
    apiMocks.getClasses.mockResolvedValue([]);
    apiMocks.getAccessToken.mockReturnValue('admin-token');
    apiMocks.createImpersonation.mockResolvedValue({
      access_token: 'child-token',
      user: { id: 'target-1', username: 'student-1' },
      impersonation: { id: 'imp-1', expires_at: '2026-08-22T12:00:00.000Z' },
    });
    FakeBroadcastChannel.instances = [];
    vi.stubGlobal('BroadcastChannel', FakeBroadcastChannel);
    vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue('handoff-nonce-1234567890') });
    vi.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the action only for an admin', async () => {
    const { unmount } = render(<PermissionsPage />);
    await waitFor(() => expect(apiMocks.getUsers).toHaveBeenCalled());
    expect(toastMocks.error).not.toHaveBeenCalled();
    expect((await screen.findAllByRole('button', { name: 'Truy cập' })).length).toBeGreaterThan(0);
    unmount();

    authState.current = { id: 'teacher-1', roleCode: 'TEACHER', permissions: [] };
    render(<PermissionsPage />);
    await waitFor(() => expect(apiMocks.getUsers).toHaveBeenCalled());
    expect(screen.queryAllByRole('button', { name: 'Truy cập' })).toHaveLength(0);
  });

  it('opens synchronously and requests the backend only after the child is ready', async () => {
    render(<PermissionsPage />);
    fireEvent.click((await screen.findAllByRole('button', { name: 'Truy cập' }))[0]);

    expect(window.open).toHaveBeenCalledWith(
      '/access#channel=handoff-nonce-1234567890',
      '_blank',
      'noopener,noreferrer',
    );
    expect(apiMocks.createImpersonation).not.toHaveBeenCalled();

    const channel = FakeBroadcastChannel.instances[0];
    await act(async () => {
      channel.emit({ type: 'READY', sessionId: 'child-session-1234567890' });
    });

    await waitFor(() => expect(apiMocks.createImpersonation).toHaveBeenCalledWith(
      'target-1',
      'child-session-1234567890',
      'admin-token',
    ));
    expect(channel.posted).toContainEqual(expect.objectContaining({ type: 'SUCCESS' }));
    act(() => channel.emit({ type: 'ACK' }));
  });
});
