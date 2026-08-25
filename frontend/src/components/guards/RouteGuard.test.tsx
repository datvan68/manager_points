import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { RouteGuard } from './RouteGuard';
import { useAuth } from '@/providers/auth-provider';
import { getMaintenanceStatesWithCache } from '@/utils/module-maintenance.util';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/students/record',
}));
vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(),
  isAdminUser: () => false,
}));
vi.mock('@/api/auth-api', () => ({ authApi: { getRoutePermissionsPublic: vi.fn() }, tokenStorage: { getAccessToken: () => '' } }));
vi.mock('@/utils/module-maintenance.util', () => ({
  getModuleIdByPath: () => 'students',
  getMaintenanceStatesWithCache: vi.fn(),
  subscribeModuleMaintenanceUpdates: () => () => undefined,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

describe('RouteGuard maintenance revalidation', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'user-1', role: 'teacher' } as any,
      isLoading: false,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    } as any);
    vi.mocked(getMaintenanceStatesWithCache).mockResolvedValue({ students: false });
  });

  it('keeps children mounted while focus revalidation runs', async () => {
    render(<RouteGuard><input aria-label="draft" defaultValue="in progress" /></RouteGuard>);
    const input = await screen.findByLabelText('draft');
    fireEvent.change(input, { target: { value: 'edited draft' } });
    fireEvent.focus(window);
    await waitFor(() => expect(getMaintenanceStatesWithCache).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText('draft')).toHaveValue('edited draft');
  });

  it('switches to maintenance screen when background revalidation returns true', async () => {
    vi.mocked(getMaintenanceStatesWithCache)
      .mockResolvedValueOnce({ students: false })
      .mockResolvedValueOnce({ students: true });
    render(<RouteGuard><div>child</div></RouteGuard>);
    await screen.findByText('child');
    fireEvent.focus(window);
    await screen.findByText('Phân hệ đang bảo trì');
  });
});
