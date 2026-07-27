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
      hasPermission: vi.fn(),
      hasAnyPermission: vi.fn(),
      hasAllPermissions: vi.fn(),
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

  it('opens on click of a menu item and sets a 60-second timer to close', async () => {
    render(<Sidebar />);
    await ensureCollapsed();
    await waitForSidebarItems();

    const sidebar = getSidebarElement();
    expect(sidebar?.classList.contains('w-20')).toBe(true);
    
    // Find the 'Trang chủ' link, since we are mocking admin, it should be visible
    // In collapsed mode, the link has a title="Trang chủ"
    const homeLink = screen.getAllByTitle('Trang chủ')[0];
    
    // Click on the menu item
    fireEvent.click(homeLink);
    
    // Should be expanded now
    expect(sidebar?.classList.contains('w-64')).toBe(true);
    expect(sidebar?.classList.contains('w-20')).toBe(false);
    
    // Fast-forward 59 seconds
    act(() => {
      vi.advanceTimersByTime(59000);
    });
    // Should still be expanded
    expect(sidebar?.classList.contains('w-64')).toBe(true);
    
    // Fast-forward 1 more second to reach 60 seconds
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    
    // Should be collapsed after 60 seconds
    expect(sidebar?.classList.contains('w-20')).toBe(true);
  });

  it('resets the 60-second timer if a menu item is clicked again before it expires', async () => {
    render(<Sidebar />);
    await ensureCollapsed();
    await waitForSidebarItems();

    const sidebar = getSidebarElement();
    const homeLink = screen.getAllByTitle('Trang chủ')[0];
    
    // First click
    fireEvent.click(homeLink);
    expect(sidebar?.classList.contains('w-64')).toBe(true);
    
    // Wait 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    expect(sidebar?.classList.contains('w-64')).toBe(true);
    
    // Second click (should reset timer)
    fireEvent.click(homeLink);
    
    // Wait another 40 seconds (total 70s from first click)
    act(() => {
      vi.advanceTimersByTime(40000);
    });
    
    // Should still be expanded because the timer was reset
    expect(sidebar?.classList.contains('w-64')).toBe(true);
    
    // Wait 20 more seconds to reach 60s from the second click
    act(() => {
      vi.advanceTimersByTime(20000);
    });
    
    // Now it should be collapsed
    expect(sidebar?.classList.contains('w-20')).toBe(true);
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

  it('keeps Activities visible for a student with a restrictive route mapping', async () => {
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
    vi.mocked(authApi.getRoutePermissionsPublic).mockResolvedValueOnce([
      { route_path: '/activities', is_active: true, type: 'page', permissions: ['ACTIVITY_MANAGE'] },
    ]);

    render(<Sidebar />);
    await waitForSidebarItems();

    expect(screen.getAllByTitle('Hoạt động')).not.toHaveLength(0);
  });

  it('keeps Activities visible for a student when route mappings fail to load', async () => {
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
    vi.mocked(authApi.getRoutePermissionsPublic).mockRejectedValueOnce(new Error('network unavailable'));

    render(<Sidebar />);
    await waitForSidebarItems();

    expect(screen.getAllByTitle('Hoạt động')).not.toHaveLength(0);
  });
});
