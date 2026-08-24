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
    cancelImpersonation: vi.fn(),
    terminateImpersonation: vi.fn(),
    logout: vi.fn(),
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
    apiMocks.cancelImpersonation.mockResolvedValue({ cancelled: true });
    apiMocks.logout.mockResolvedValue({ message: 'ok' });
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
    const accessButtons = await screen.findAllByRole('button', { name: /Truy cập tài khoản/ });
    expect(accessButtons.length).toBeGreaterThan(0);
    expect(accessButtons[0]).not.toHaveTextContent('Truy cập');
    unmount();

    authState.current = { id: 'teacher-1', roleCode: 'TEACHER', permissions: [] };
    render(<PermissionsPage />);
    await waitFor(() => expect(apiMocks.getUsers).toHaveBeenCalled());
    expect(screen.queryAllByRole('button', { name: /Truy cập tài khoản/ })).toHaveLength(0);
  });

  it('marks the active impersonation target red and other targets blue', async () => {
    apiMocks.getUsers.mockResolvedValueOnce([
      { _id: 'target-1', user_name: 'active-target', status: 'active', is_under_impersonation: true },
      { _id: 'target-2', user_name: 'other-target', status: 'active', is_under_impersonation: false },
    ]);
    render(<PermissionsPage />);

    const activeButton = (await screen.findAllByRole('button', { name: /Kết thúc truy cập active-target/ }))
      .find((button) => button.classList.contains('text-red-700'))!;
    const otherButton = (await screen.findAllByRole('button', { name: /Truy cập tài khoản other-target/ }))
      .find((button) => button.classList.contains('text-blue-700'))!;
    expect(activeButton).toHaveClass('text-red-700');
    expect(activeButton).toHaveAttribute('title', 'Kết thúc truy cập');
    expect(activeButton).toHaveAccessibleName('Kết thúc truy cập active-target');
    expect(otherButton).toHaveClass('text-blue-700');
  });

  it('confirms before terminating an active impersonation and refreshes users', async () => {
    apiMocks.getUsers.mockResolvedValueOnce([
      { _id: 'target-1', user_name: 'active-target', status: 'active', is_under_impersonation: true },
    ]);
    apiMocks.terminateImpersonation.mockResolvedValue({ terminated: true });
    render(<PermissionsPage />);

    const button = (await screen.findAllByRole('button', { name: /Kết thúc truy cập active-target/ }))[0];
    fireEvent.click(button);
    expect(apiMocks.terminateImpersonation).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Kết thúc truy cập' }));
    await waitFor(() => expect(apiMocks.terminateImpersonation).toHaveBeenCalledWith('target-1', 'admin-token'));
    expect(apiMocks.getUsers).toHaveBeenCalledTimes(2);
    expect(toastMocks.success).toHaveBeenCalled();
  });

  it('hides the action when ADMIN_FULL is present without the persisted ADMIN role code', async () => {
    authState.current = { id: 'permission-only', permissions: ['ADMIN_FULL'] };
    render(<PermissionsPage />);

    await waitFor(() => expect(apiMocks.getUsers).toHaveBeenCalled());
    expect(screen.queryAllByRole('button', { name: /Truy cập tài khoản/ })).toHaveLength(0);
  });

  it('opens synchronously and requests the backend only after the child is ready', async () => {
    render(<PermissionsPage />);
    fireEvent.click((await screen.findAllByRole('button', { name: /Truy cập tài khoản/ }))[0]);

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
    expect(apiMocks.cancelImpersonation).not.toHaveBeenCalled();
  });

  it('best-effort cancels a child session when the create response arrives after timeout', async () => {
    render(<PermissionsPage />);
    const button = (await screen.findAllByRole('button', { name: /Truy cập tài khoản/ }))[0];
    let resolveCreate: (value: unknown) => void = () => undefined;
    apiMocks.createImpersonation.mockImplementationOnce(() => new Promise((resolve) => {
      resolveCreate = resolve;
    }));

    vi.useFakeTimers();
    try {
      fireEvent.click(button);
      const channel = FakeBroadcastChannel.instances[0];
      await act(async () => {
        channel.emit({ type: 'READY', sessionId: 'child-session-1234567890' });
        await Promise.resolve();
      });

      act(() => {
        vi.advanceTimersByTime(15_000);
      });
      expect(toastMocks.error).toHaveBeenCalledWith(
        'Không thể kết nối cửa sổ truy cập. Hãy cho phép cửa sổ bật lên và thử lại.',
      );
      expect(apiMocks.cancelImpersonation).toHaveBeenCalledWith(
        'child-session-1234567890',
        'admin-token',
      );

      await act(async () => {
        resolveCreate({
          access_token: 'late-child-token',
          user: { id: 'target-1', username: 'student-1' },
          impersonation: { id: 'late-imp-1', expires_at: '2026-08-22T12:00:00.000Z' },
        });
        await Promise.resolve();
      });

      expect(apiMocks.cancelImpersonation).toHaveBeenCalledWith(
        'child-session-1234567890',
        'admin-token',
      );
      expect(channel.posted).not.toContainEqual(expect.objectContaining({ type: 'SUCCESS' }));
    } finally {
      vi.useRealTimers();
    }
  });

  it.each([
    ['limit', { status: 409, code: 'IMPERSONATION_LIMIT_REACHED', message: 'internal limit' }, 'Bạn đang truy cập tối đa 5 tài khoản. Hãy kết thúc một phiên trước khi tiếp tục.'],
    ['duplicate target', { status: 409, code: 'IMPERSONATION_TARGET_ALREADY_ACTIVE', message: 'internal duplicate' }, 'Tài khoản này đang có một phiên truy cập khác.'],
    ['inactive target', { status: 409, code: 'IMPERSONATION_TARGET_INACTIVE', message: 'internal inactive' }, 'Tài khoản đích hiện không hoạt động.'],
    ['self target', { status: 400, code: 'IMPERSONATION_SELF_NOT_ALLOWED', message: 'internal self' }, 'Bạn không thể truy cập chính tài khoản của mình.'],
    ['admin target', { status: 403, code: 'IMPERSONATION_ADMIN_TARGET_NOT_ALLOWED', message: 'internal admin' }, 'Không thể mở phiên truy cập vào tài khoản quản trị.'],
    ['missing target', { status: 400, code: 'IMPERSONATION_TARGET_NOT_FOUND', message: 'internal missing' }, 'Tài khoản đích không tồn tại.'],
    ['expired admin auth', { status: 401, message: 'internal auth' }, 'Phiên quản trị đã hết hạn. Vui lòng đăng nhập lại.'],
    ['unknown error', { status: 500, message: 'database stack trace' }, 'Không thể mở phiên truy cập tài khoản.'],
  ] as const)('maps %s to safe user-facing copy', async (_name, error, expectedMessage) => {
    render(<PermissionsPage />);
    fireEvent.click((await screen.findAllByRole('button', { name: /Truy cập tài khoản/ }))[0]);
    const channel = FakeBroadcastChannel.instances[0];
    apiMocks.createImpersonation.mockRejectedValueOnce(error);

    await act(async () => {
      channel.emit({ type: 'READY', sessionId: 'child-session-1234567890' });
    });

    await waitFor(() => expect(toastMocks.error).toHaveBeenCalledWith(expectedMessage));
    expect(apiMocks.cancelImpersonation).toHaveBeenCalledWith(
      'child-session-1234567890',
      'admin-token',
    );
    expect(toastMocks.error).not.toHaveBeenCalledWith(expect.stringContaining('internal'));
  });
});
