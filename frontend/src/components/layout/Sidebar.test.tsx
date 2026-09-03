import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Sidebar from './Sidebar';
import { useAuth, isAdminUser } from '@/providers/auth-provider';
import { authApi } from '@/api/auth-api';
import { isStudentRole, isTeacherRole } from '@/utils/role.util';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));

// Mock @/providers/auth-provider
vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(() => ({
    user: { id: 'test_user', role: 'admin' },
    isLoading: false,
    hasPermission: vi.fn(),
    hasAnyPermission: vi.fn(),
    hasAllPermissions: vi.fn(),
  })),
  isAdminUser: vi.fn(() => true),
}));

// Mock @/utils/role.util
vi.mock('@/utils/role.util', () => ({
  isTeacherRole: vi.fn(() => false),
  isStudentRole: vi.fn(() => false),
}));

// Mock API
vi.mock('@/api/auth-api', () => ({
  authApi: {
    getRoutePermissionsPublic: vi.fn(() => Promise.resolve([])),
  },
  tokenStorage: {
    getAccessToken: vi.fn(() => ''),
  },
}));

vi.mock('@/api/student-api', () => ({
  studentApi: {
    getMyStudent: vi.fn(() => Promise.resolve({})),
    getStudents: vi.fn(() => Promise.resolve({ data: [], meta: {} })),
  },
}));

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  }
}));

describe('Sidebar Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'test_user', role: 'admin' },
      isLoading: false,
      hasPermission: vi.fn(() => true),
      hasAnyPermission: vi.fn(() => true),
      hasAllPermissions: vi.fn(() => true),
      isAuthenticated: true,
      permissions: [],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(isAdminUser).mockReturnValue(true);
    vi.mocked(isStudentRole).mockReturnValue(false);
    vi.mocked(isTeacherRole).mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  // Helper function to get the sidebar container
  const getSidebarElement = () => {
    const desktopSidebar = document.querySelector('.hidden.md\\:flex');
    return desktopSidebar;
  };

  const ensureCollapsed = async () => {
    const sidebar = getSidebarElement();
    if (sidebar?.classList.contains('w-64')) {
      const compactBtn = document.querySelector('[data-id="btn/Compact"]');
      if (compactBtn) {
        fireEvent.click(compactBtn);
      }
    }
  };

  const waitForSidebarItems = async () => {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  };

  it('renders correctly', () => {
    render(<Sidebar />);
    expect(getSidebarElement()).toBeTruthy();
    const mobileNav = document.querySelector('.mobile-bottom-nav');
    expect(mobileNav).toBeTruthy();
    expect(mobileNav?.classList.contains('md:hidden')).toBe(true);
    expect(mobileNav?.classList.contains('fixed')).toBe(true);
  });

  it('opens student management on Ghi nhận by default while keeping the list route available', async () => {
    render(<Sidebar />);
    await waitForSidebarItems();

    const studentLink = screen.getAllByTitle('Học sinh sinh viên')[0];
    expect(studentLink).toHaveAttribute('href', '/students/record');
  });

  it('marks the active mobile destination for assistive technology', async () => {
    render(<Sidebar />);
    await waitForSidebarItems();

    const activeLinks = document.querySelectorAll('.mobile-bottom-nav a[aria-current="page"]');
    expect(activeLinks.length).toBeGreaterThan(0);
  });

  it('uses icon-only actions with accessible names in the mobile navigation', async () => {
    render(<Sidebar />);
    await waitForSidebarItems();

    const mobileNav = document.querySelector('.mobile-bottom-nav');
    expect(mobileNav?.tagName).toBe('NAV');
    expect(mobileNav).toHaveAttribute('aria-label', 'Điều hướng chính');
    expect(within(mobileNav as HTMLElement).getByRole('link', { name: 'Trang chủ' })).toBeTruthy();
    expect(mobileNav?.textContent).not.toContain('Trang chủ');
  });

  it('replaces the primary Activities entry with KTX on desktop and mobile', async () => {
    render(<Sidebar />);
    await waitForSidebarItems();

    expect(screen.queryByTitle('Thông báo')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Báo cáo')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Quản trị hệ thống')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Hoạt động')).not.toBeInTheDocument();
    expect(screen.getAllByTitle('KTX')).not.toHaveLength(0);
    screen.getAllByTitle('KTX').forEach((link) => {
      expect(link).toHaveAttribute('href', '/dormitory');
    });
    expect(within(document.querySelector('.mobile-bottom-nav') as HTMLElement).getByRole('link', { name: 'KTX' })).toHaveAttribute('href', '/dormitory');
    expect(within(document.querySelector('.mobile-bottom-nav') as HTMLElement).queryByRole('link', { name: 'Thông báo' })).not.toBeInTheDocument();
  });

  it('does not open or close on hover', async () => {
    render(<Sidebar />);
    await ensureCollapsed();

    const sidebar = getSidebarElement();
    expect(sidebar).toBeTruthy();
    
    // Initially collapsed
    expect(sidebar?.classList.contains('w-20')).toBe(true);
    expect(sidebar?.classList.contains('w-64')).toBe(false);
    
    // Simulate hover enter
    fireEvent.mouseEnter(sidebar as Element);
    expect(sidebar?.classList.contains('w-20')).toBe(true); // Should remain collapsed
    
    // Simulate hover leave
    fireEvent.mouseLeave(sidebar as Element);
    expect(sidebar?.classList.contains('w-20')).toBe(true); // Should remain collapsed
  });

  it('does not expand on click of a menu item', async () => {
    render(<Sidebar />);
    await ensureCollapsed();
    await waitForSidebarItems();

    const sidebar = getSidebarElement();
    expect(sidebar?.classList.contains('w-20')).toBe(true);
    
    // Find the 'Trang chủ' link
    const homeLink = screen.getAllByTitle('Trang chủ')[0];
    
    // Click on the menu item
    fireEvent.click(homeLink);
    
    // Should remain collapsed
    expect(sidebar?.classList.contains('w-20')).toBe(true);
    expect(sidebar?.classList.contains('w-64')).toBe(false);
  });

  it('toggles state when clicking the compact button', async () => {
    render(<Sidebar />);
    await ensureCollapsed();

    const sidebar = getSidebarElement();
    expect(sidebar?.classList.contains('w-20')).toBe(true);
    
    let compactBtn = document.querySelector('[data-id="btn/Compact"]');
    expect(compactBtn).toBeTruthy();
    
    // Expand by clicking the compact button
    fireEvent.click(compactBtn as Element);
    expect(sidebar?.classList.contains('w-64')).toBe(true);
    
    // Re-query the button from DOM because the element is replaced during React render
    compactBtn = document.querySelector('[data-id="btn/Compact"]');
    // Collapse by clicking the compact button again
    fireEvent.click(compactBtn as Element);
    expect(sidebar?.classList.contains('w-20')).toBe(true);
  });

  it('hides KTX for a non-admin without an active mapped permission', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'student-id', roleCode: 'STUDENT' },
      isLoading: false,
      hasPermission: vi.fn(() => false),
      hasAnyPermission: vi.fn(() => false),
      hasAllPermissions: vi.fn(() => false),
      isAuthenticated: true,
      permissions: [],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(isAdminUser).mockReturnValue(false);
    vi.mocked(isStudentRole).mockReturnValue(true);
    vi.mocked(isTeacherRole).mockReturnValue(false);
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValueOnce([]);

    render(<Sidebar />);
    await waitForSidebarItems();

    expect(screen.queryByTitle('KTX')).not.toBeInTheDocument();
  });

  it('shows KTX only when the non-admin satisfies its active mapping', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'student-id', roleCode: 'STUDENT' },
      isLoading: false,
      hasPermission: vi.fn(() => false),
      hasAnyPermission: vi.fn(() => false),
      hasAllPermissions: vi.fn(() => false),
      isAuthenticated: true,
      permissions: [],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(isAdminUser).mockReturnValue(false);
    vi.mocked(isStudentRole).mockReturnValue(true);
    vi.mocked(isTeacherRole).mockReturnValue(false);
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValue([
      { route_path: '/dormitory', is_active: true, type: 'page', check_type: 'any', permissions: ['DORMITORY_READ'] },
    ]);

    const { unmount } = render(<Sidebar />);
    await waitForSidebarItems();
    await act(async () => {
      window.dispatchEvent(new Event('route-permissions-updated'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.queryByTitle('KTX')).not.toBeInTheDocument();

    unmount();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'student-id', roleCode: 'STUDENT' },
      isLoading: false,
      hasPermission: vi.fn(() => false),
      hasAnyPermission: vi.fn((permission) => permission === 'DORMITORY_READ'),
      hasAllPermissions: vi.fn(() => false),
      isAuthenticated: true,
      permissions: [],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    render(<Sidebar />);
    await waitForSidebarItems();

    expect(screen.getAllByTitle('KTX')).not.toHaveLength(0);
  });

  it('shows KTX when the non-admin satisfies an all mapping', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'teacher-id', roleCode: 'TEACHER' },
      isLoading: false,
      hasPermission: vi.fn(() => false),
      hasAnyPermission: vi.fn(() => false),
      hasAllPermissions: vi.fn((...permissions) =>
        permissions.includes('DORMITORY_READ') && permissions.includes('DORMITORY_MANAGE'),
      ),
      isAuthenticated: true,
      permissions: [],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(isAdminUser).mockReturnValue(false);
    vi.mocked(isStudentRole).mockReturnValue(false);
    vi.mocked(isTeacherRole).mockReturnValue(true);
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValue([
      {
        route_path: '/dormitory',
        is_active: true,
        type: 'page',
        check_type: 'all',
        permissions: ['DORMITORY_READ', 'DORMITORY_MANAGE'],
      },
    ]);

    render(<Sidebar />);
    await waitForSidebarItems();
    await act(async () => {
      window.dispatchEvent(new Event('route-permissions-updated'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getAllByTitle('KTX')).not.toHaveLength(0);
  });

  it('places search trigger at the visual center of mobile navigation for admin', async () => {
    render(<Sidebar />);
    await waitForSidebarItems();

    const mobileNav = document.querySelector('.mobile-bottom-nav');
    expect(mobileNav).toBeTruthy();
    const children = Array.from(mobileNav?.children || []).filter(el => !el.classList.contains('mobile-bottom-nav-skeleton'));
    expect(children).toHaveLength(5);

    // Center index (index 2 in 0-4) is the search button
    const centerItem = children[2];
    expect(centerItem.tagName).toBe('BUTTON');
    expect(centerItem).toHaveAttribute('aria-label', 'Tìm kiếm sinh viên');

    // Click opens mobile search surface
    fireEvent.click(centerItem);
    const searchInput = screen.getByPlaceholderText('Tìm kiếm sinh viên...');
    expect(searchInput).toBeInTheDocument();
    expect(searchInput).toHaveFocus();
    expect(centerItem).toHaveClass('mobile-bottom-nav-item-active');

    const surface = searchInput.closest('.fixed');
    expect(surface).toHaveClass('md:hidden', 'justify-start', 'z-[100]');
    expect(surface).toHaveClass('pt-[calc(var(--safe-area-top)+1rem)]');
    expect(surface).toHaveClass('pb-[calc(var(--safe-area-bottom)+1rem)]');
    const searchWrapper = surface?.querySelector('.max-w-md');
    expect(searchWrapper).toHaveClass('relative', 'z-[101]');
    expect(searchWrapper).not.toHaveClass(
      'overflow-y-auto',
      'rounded-2xl',
      'border',
      'bg-white/90',
      'p-2',
      'shadow-xl',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đóng tìm kiếm' }));
    expect(screen.queryByPlaceholderText('Tìm kiếm sinh viên...')).not.toBeInTheDocument();

    fireEvent.click(centerItem);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Tìm kiếm sinh viên...')).not.toBeInTheDocument();

    fireEvent.click(centerItem);
    const reopenedSurface = screen.getByPlaceholderText('Tìm kiếm sinh viên...').closest('.fixed');
    fireEvent.click(reopenedSurface as Element);
    expect(screen.queryByPlaceholderText('Tìm kiếm sinh viên...')).not.toBeInTheDocument();

    fireEvent.click(centerItem);
    const inputInsideSurface = screen.getByPlaceholderText('Tìm kiếm sinh viên...');
    fireEvent.mouseDown(inputInsideSurface);
    expect(screen.getByPlaceholderText('Tìm kiếm sinh viên...')).toBeInTheDocument();
  });

  it('omits mobile search trigger when user has no student-read scope', async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'guest-id', role: 'guest' },
      isLoading: false,
      hasPermission: vi.fn(() => false),
      hasAnyPermission: vi.fn(() => false),
      hasAllPermissions: vi.fn(() => false),
      isAuthenticated: true,
      permissions: [],
      logout: vi.fn(),
      checkAuth: vi.fn(),
      forceLogoutAfterRestore: vi.fn(),
    });
    vi.mocked(isAdminUser).mockReturnValue(false);
    vi.mocked(isStudentRole).mockReturnValue(false);
    vi.mocked(isTeacherRole).mockReturnValue(false);

    render(<Sidebar />);
    await waitForSidebarItems();

    expect(screen.queryByRole('button', { name: 'Tìm kiếm sinh viên' })).not.toBeInTheDocument();
  });
});
