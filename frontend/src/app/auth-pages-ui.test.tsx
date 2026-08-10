import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NotFound from './not-found';

const push = vi.fn();

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ checkAuth: vi.fn() }) }));
vi.mock('@/api/auth-api', () => ({
  authApi: { login: vi.fn() },
  tokenStorage: { getSavedEmail: () => '', getRemember: () => false },
}));

describe('auth and not-found pages', () => {
  it('offers a recovery link to the home page for unknown routes', () => {
    render(<NotFound />);
    expect(screen.getByRole('heading', { name: 'Không tìm thấy trang' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Về trang chủ' })).toHaveAttribute('href', '/');
  });

  it('uses lighter login typography while preserving form controls', async () => {
    const { default: LoginPage } = await import('./(auth)/login/page');
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: 'Chào mừng trở lại' })).toHaveClass('font-bold');
    expect(screen.getByText('Vui lòng nhập thông tin của bạn để tiếp tục')).toHaveClass('font-normal');
    expect(screen.getByText('Ghi nhớ đăng nhập')).toHaveClass('font-medium');
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });
});
