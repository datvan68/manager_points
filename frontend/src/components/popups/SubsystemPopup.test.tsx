import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SubsystemPopup from './SubsystemPopup';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { authApi } from '@/api/auth-api';
import { systemApi } from '@/api/system-api';

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }));
let mockDormPage = true;

// Mock auth-provider
vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(),
  isAdminUser: vi.fn(),
}));

vi.mock('@/components/guards/RouteGuard', () => ({
  RouteGuard: ({ children, requiredPermission }: any) =>
    requiredPermission === 'DORM_PAGE' && !mockDormPage ? null : <>{children}</>,
}));

// Mock auth-api
vi.mock('@/api/auth-api', () => {
  return {
    authApi: {
      getRoutePermissionsPublic: vi.fn(),
    },
    tokenStorage: {
      getAccessToken: vi.fn(),
    },
  };
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock system-api
vi.mock('@/api/system-api', () => ({
  systemApi: {
    getModuleMaintenanceStates: vi.fn().mockResolvedValue({ states: {} }),
  },
}));

// Mock module-maintenance.util
vi.mock('@/utils/module-maintenance.util', () => ({
  applyModuleMaintenanceStates: vi.fn((modules) => modules),
  notifyModuleMaintenanceUpdated: vi.fn(),
  subscribeModuleMaintenanceUpdates: vi.fn(() => () => {}),
}));

describe('SubsystemPopup', () => {
  let mockConsoleError: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDormPage = true;
    mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default mock auth values
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'test-advisor-id', role: 'Adviser', username: 'advisor' },
      isLoading: false,
      hasPermission: () => true,
      hasAnyPermission: () => true,
      hasAllPermissions: () => true,
      isAuthenticated: true,
      permissions: [],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(isAdminUser).mockReturnValue(false);
    vi.mocked(systemApi.getModuleMaintenanceStates).mockResolvedValue({ states: {} });
  });

  afterEach(() => {
    mockConsoleError.mockRestore();
  });

  it('should fetch route permissions public and render modules', async () => {
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValueOnce([
      { route_path: '/students', is_active: true, permissions: [] }
    ]);

    const { unmount } = render(<SubsystemPopup isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(authApi.getRoutePermissionsPublic).toHaveBeenCalled();
    });

    unmount();
  });

  it('should abort request and suppress console.error when aborted', async () => {
    let abortSignal: AbortSignal | undefined;
    
    vi.mocked(authApi.getRoutePermissionsPublic).mockImplementationOnce(async (token, signal) => {
      abortSignal = signal;
      return new Promise((resolve, reject) => {
        if (signal) {
          signal.addEventListener('abort', () => {
            const err = new Error('The user aborted a request.');
            err.name = 'AbortError';
            reject(err);
          });
        }
      });
    });

    const { unmount } = render(<SubsystemPopup isOpen={true} onClose={() => {}} />);

    // Wait a brief tick to let the effect run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(abortSignal).toBeDefined();
    expect(abortSignal?.aborted).toBe(false);

    // Unmount triggers abort
    unmount();

    expect(abortSignal?.aborted).toBe(true);

    // Wait to ensure Promise rejection has processed
    await new Promise((resolve) => setTimeout(resolve, 10));

    // verify console.error was not called for abort
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it('shows Activities to a student despite a restrictive dynamic route mapping', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'test-student-id', roleCode: 'STUDENT', username: 'student' },
      isLoading: false,
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
      isAuthenticated: true,
      permissions: [],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValueOnce([
      { route_path: '/activities', is_active: true, permissions: ['ACTIVITY_MANAGE'] },
    ]);

    render(<SubsystemPopup isOpen={true} onClose={() => {}} />);

    const activityCard = await screen.findByText('Hoạt động');
    fireEvent.click(activityCard);

    expect(mockPush).toHaveBeenCalledWith('/activities');
  });

  it('shows storage management to an admin and navigates to its route', async () => {
    vi.mocked(isAdminUser).mockReturnValue(true);
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValueOnce([]);

    const onClose = vi.fn();
    render(<SubsystemPopup isOpen={true} onClose={onClose} />);

    const storageCard = await screen.findByText('Quản lý lưu trữ');
    fireEvent.click(storageCard);

    expect(mockPush).toHaveBeenCalledWith('/system/storage');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('hides storage management from a non-admin despite a permissive dynamic mapping', async () => {
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValueOnce([
      {
        route_path: '/system/storage',
        is_active: true,
        permissions: ['STORAGE_MANAGE'],
        check_type: 'any',
      },
    ]);

    render(<SubsystemPopup isOpen={true} onClose={() => {}} />);

    await waitFor(() => {
      expect(authApi.getRoutePermissionsPublic).toHaveBeenCalled();
    });

    expect(screen.queryByText('Quản lý lưu trữ')).not.toBeInTheDocument();
  });

  it('hides KTX when the route mapping is missing or empty', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'supervisor-1', role: 'Supervisor', username: 'supervisor' },
      isLoading: false,
      hasPermission: () => false,
      hasAnyPermission: () => false,
      hasAllPermissions: () => false,
      isAuthenticated: true,
      permissions: [],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValueOnce([]);

    render(<SubsystemPopup isOpen={true} onClose={() => {}} />);

    await waitFor(() => expect(authApi.getRoutePermissionsPublic).toHaveBeenCalled());
    expect(screen.queryByText('Quản lý KTX')).not.toBeInTheDocument();
  });

  it('shows KTX only when the mapping grants DORM_PAGE', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'supervisor-1', role: 'Supervisor', username: 'supervisor' },
      isLoading: false,
      hasPermission: (permission) => permission === 'DORM_PAGE',
      hasAnyPermission: (...permissions) => permissions.includes('DORM_PAGE'),
      hasAllPermissions: (...permissions) => permissions.every((permission) => permission === 'DORM_PAGE'),
      isAuthenticated: true,
      permissions: ['DORM_PAGE'],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValueOnce([
      { route_path: '/dormitory', is_active: true, permissions: ['DORM_PAGE'], check_type: 'any' },
    ]);

    render(<SubsystemPopup isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText('Quản lý KTX')).toBeInTheDocument();
  });

  it('shows the student-record module for a custom role with READ_STUDENT_RECORD', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'reviewer-1', role: 'Records Reviewer', username: 'reviewer' },
      isLoading: false,
      hasPermission: (permission) => permission === 'READ_STUDENT_RECORD',
      hasAnyPermission: (...permissions) => permissions.includes('READ_STUDENT_RECORD'),
      hasAllPermissions: (...permissions) => permissions.every((permission) => permission === 'READ_STUDENT_RECORD'),
      isAuthenticated: true,
      permissions: ['READ_STUDENT_RECORD'],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValueOnce([]);

    render(<SubsystemPopup isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText('Theo dõi chuyên cần')).toBeInTheDocument();
  });

  it('keeps the record module visible when a legacy mapping still requires STUDENT_PAGE', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'reviewer-1', role: 'Records Reviewer', username: 'reviewer' },
      isLoading: false,
      hasPermission: (permission) => permission === 'READ_STUDENT_RECORD',
      hasAnyPermission: (...permissions) => permissions.includes('READ_STUDENT_RECORD'),
      hasAllPermissions: (...permissions) => permissions.every((permission) => permission === 'READ_STUDENT_RECORD'),
      isAuthenticated: true,
      permissions: ['READ_STUDENT_RECORD'],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValueOnce([
      { route_path: '/students/record', is_active: true, check_type: 'any', permissions: [{ code: 'STUDENT_PAGE' }] },
    ]);

    render(<SubsystemPopup isOpen={true} onClose={() => {}} />);

    expect(await screen.findByText('Theo dõi chuyên cần')).toBeInTheDocument();
  });
});
