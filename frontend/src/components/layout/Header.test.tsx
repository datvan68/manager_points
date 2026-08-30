import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Header from './Header';
import { useAuth } from '@/providers/auth-provider';

const headerSource = readFileSync(resolve(__dirname, 'Header.tsx'), 'utf8');

vi.mock('next/navigation', () => ({
  usePathname: () => '/students',
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(),
  isAdminUser: vi.fn((user) => user?.role === 'admin'),
}));

vi.mock('@/hooks/useLocationPermission', () => ({
  useLocationPermission: () => ({
    permission: 'idle',
    granted: false,
    requesting: false,
    requestPermission: vi.fn(),
  }),
}));

vi.mock('@/hooks/useNotificationRealtime', () => ({
  useNotificationRealtime: vi.fn(),
}));

vi.mock('@/api/notification-api', () => ({
  notificationApi: {
    getUnreadCount: vi.fn(() => Promise.resolve({ count: 0 })),
    getNotifications: vi.fn(() => Promise.resolve({ items: [] })),
  },
}));

vi.mock('./StudentCongratsModalGate', () => ({
  default: () => null,
}));

vi.mock('@/components/popups/SubsystemPopup', () => ({
  default: () => null,
}));

vi.mock('@/components/popups/NotificationPopup', () => ({
  default: () => null,
}));

describe('Header responsive shell contract', () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'admin-1', role: 'admin', display_name: 'Admin User' },
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
  });

  it('uses a sticky, safe-area-aware header without shrinking', () => {
    expect(headerSource).toContain('dashboard-header sticky top-0');
    expect(headerSource).toContain('pt-[env(safe-area-inset-top,0px)]');
    expect(headerSource).toContain('shrink-0');
    expect(headerSource).toContain('min-w-0 w-full');
  });

  it('keeps touched icon actions accessible and keyboard-focusable', () => {
    expect(headerSource).toContain('aria-label="Tìm kiếm"');
    expect(headerSource).toContain('aria-label={`Thông báo');
    expect(headerSource).toContain('aria-label="Quản lý phân hệ"');
    expect(headerSource).toContain('focus-visible:ring-2');
  });

  it('uses valid Vietnamese text for the location success toast', () => {
    expect(headerSource).toContain("toast.success('Đã bật chia sẻ vị trí cho điểm danh.')");
  });

  it('removes the impersonation banner while keeping the menu exit action', () => {
    expect(headerSource).not.toContain('Đang truy cập với tư cách');
    expect(headerSource).toContain("user?.impersonation ? 'Kết thúc truy cập' : 'Đăng xuất'");
    expect(headerSource).toContain('logout();');
  });

  it('guides denied location permissions to browser or iOS settings', () => {
    expect(headerSource).toContain("if (permission === 'denied')");
    expect(headerSource).toContain('Cài đặt > Safari > Vị trí');
  });

  it('declares mobile zoom and vertical shell scroll behavior in the global styles', () => {
    const globalStyles = readFileSync(resolve(__dirname, '../../globals.css'), 'utf8');

    expect(globalStyles).toContain('font-size: 16px !important');
    expect(globalStyles).toContain('overscroll-behavior: contain');
    expect(globalStyles).toContain('overscroll-behavior-y: contain');
    expect(globalStyles).toContain('-webkit-overflow-scrolling: touch');
    expect(globalStyles).toContain('position: fixed');
    expect(globalStyles).toContain('bottom: calc(var(--safe-area-bottom) + 0.25rem)');
    expect(globalStyles).toContain('width: min(calc(100vw - 1rem), 340px)');
    expect(globalStyles).toContain('height: 54px');
    expect(globalStyles).toContain('touch-action: pan-y');
    expect(globalStyles).toContain('touch-action: pan-x pan-y');
    expect(globalStyles).not.toContain('touch-action: none');
  });

  it('renders desktop search trigger for authorized users and opens search surface', () => {
    render(<Header />);
    const searchBtn = screen.getByRole('button', { name: 'Tìm kiếm' });
    expect(searchBtn).toBeInTheDocument();

    fireEvent.click(searchBtn);
    expect(screen.getByPlaceholderText('Tìm kiếm sinh viên...')).toBeInTheDocument();
  });

  it('hides desktop search trigger when user has no student-read scope', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: 'guest-1', role: 'guest' },
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

    render(<Header />);
    expect(screen.queryByRole('button', { name: 'Tìm kiếm' })).not.toBeInTheDocument();
  });

  it('enables viewport portal for desktop search to avoid header clipping', () => {
    expect(headerSource).toContain('usePortal={true}');
    expect(headerSource).toContain("target.closest('[data-student-preview]')");
  });
});
