import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import AccessDeniedPage from './page';

describe('AccessDeniedPage', () => {
  it('renders the authenticated access-denied message and a safe home action', () => {
    render(<AccessDeniedPage />);

    expect(screen.getByRole('heading', { name: 'Không được truy cập' })).toBeInTheDocument();
    expect(screen.getByText('Bạn không thuộc KTX')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Về trang chủ/ })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button', { name: /Đăng xuất|Đóng cửa sổ/ })).not.toBeInTheDocument();
  });
});
