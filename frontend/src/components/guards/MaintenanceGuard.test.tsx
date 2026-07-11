import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MaintenanceGuard } from './MaintenanceGuard';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { usePathname, useRouter } from 'next/navigation';
import { getModuleIdByPath, getMaintenanceStatesWithCache } from '@/utils/module-maintenance.util';

// Mock dependencies
vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(),
  isAdminUser: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
  useRouter: () => ({
    replace: vi.fn(),
  }),
}));

vi.mock('@/utils/module-maintenance.util', () => ({
  getModuleIdByPath: vi.fn(),
  subscribeModuleMaintenanceUpdates: vi.fn(() => () => {}),
  getMaintenanceStatesWithCache: vi.fn(),
}));

describe('MaintenanceGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderGuard = () => {
    return render(
      <MaintenanceGuard>
        <div data-testid="children">Protected Content</div>
      </MaintenanceGuard>
    );
  };

  it('should show loading spinner if loading auth state is true', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      isLoading: true,
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
    });

    const { container } = renderGuard();
    expect(screen.queryByTestId('children')).toBeNull();
    // Should show spinner
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('should render children if user is an admin', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { role: 'Admin' },
      isLoading: false,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    });
    vi.mocked(isAdminUser).mockReturnValue(true);
    vi.mocked(usePathname).mockReturnValue('/students/tasks');
    vi.mocked(getModuleIdByPath).mockReturnValue('events');

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId('children')).toBeDefined();
      expect(screen.queryByText('Phân hệ đang bảo trì')).toBeNull();
    });
  });

  it('should render children if current route does not map to any module', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { role: 'Teacher' },
      isLoading: false,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    });
    vi.mocked(isAdminUser).mockReturnValue(false);
    vi.mocked(usePathname).mockReturnValue('/unguarded-path');
    vi.mocked(getModuleIdByPath).mockReturnValue(null);

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId('children')).toBeDefined();
    });
  });

  it('should block navigation and render maintenance screen if route is under maintenance and user is not admin', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { role: 'Teacher' },
      isLoading: false,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    });
    vi.mocked(isAdminUser).mockReturnValue(false);
    vi.mocked(usePathname).mockReturnValue('/students/tasks');
    vi.mocked(getModuleIdByPath).mockReturnValue('events');
    vi.mocked(getMaintenanceStatesWithCache).mockResolvedValue({
      events: true,
      attendance: false,
    });

    renderGuard();

    await waitFor(() => {
      expect(screen.queryByTestId('children')).toBeNull();
      expect(screen.getByText('Phân hệ đang bảo trì')).toBeDefined();
      expect(screen.getByText('Hệ thống đang tiến hành nâng cấp kỹ thuật cho phân hệ này. Vui lòng quay lại sau ít phút.')).toBeDefined();
    });
  });

  it('should render children if route is not under maintenance and user is not admin', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { role: 'Teacher' },
      isLoading: false,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
    });
    vi.mocked(isAdminUser).mockReturnValue(false);
    vi.mocked(usePathname).mockReturnValue('/students/tasks');
    vi.mocked(getModuleIdByPath).mockReturnValue('events');
    vi.mocked(getMaintenanceStatesWithCache).mockResolvedValue({
      events: false,
      attendance: true,
    });

    renderGuard();

    await waitFor(() => {
      expect(screen.getByTestId('children')).toBeDefined();
      expect(screen.queryByText('Phân hệ đang bảo trì')).toBeNull();
    });
  });
});
