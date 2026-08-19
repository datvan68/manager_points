import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Breadcrumb from './Breadcrumb';
import * as navigation from 'next/navigation';
import * as authProvider from '@/providers/auth-provider';

vi.mock('next/navigation', () => ({
  usePathname: vi.fn(),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: vi.fn(),
}));

describe('Breadcrumb component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authProvider.useAuth).mockReturnValue({
      user: { role: 'ADMIN' },
    } as any);
  });

  it('renders nothing on root pathname', () => {
    vi.mocked(navigation.usePathname).mockReturnValue('/');
    const { container } = render(<Breadcrumb />);
    expect(container.firstChild).toBeNull();
  });

  it('renders standard route breadcrumb for /students', () => {
    vi.mocked(navigation.usePathname).mockReturnValue('/students');
    render(<Breadcrumb />);

    expect(screen.getByText('Trang chủ')).toBeInTheDocument();
    expect(screen.getByText('Quản lý sinh viên')).toBeInTheDocument();
  });

  it('renders catalog breadcrumb for /dormitory/pdf-template', () => {
    vi.mocked(navigation.usePathname).mockReturnValue('/dormitory/pdf-template');
    render(<Breadcrumb />);

    expect(screen.getByText('Trang chủ')).toBeInTheDocument();
    const ktxLink = screen.getByRole('link', { name: 'Quản lý KTX' });
    expect(ktxLink).toHaveAttribute('href', '/dormitory');
    const pdfSpan = screen.getByText('PDF');
    expect(pdfSpan.tagName).toBe('SPAN');
    expect(pdfSpan).toHaveClass('font-bold');
  });

  it('renders edit breadcrumb Quản lý KTX / PDF / Sửa mẫu for /dormitory/pdf-template/DORMITORY_ROSTER_APPLICATION/edit', () => {
    vi.mocked(navigation.usePathname).mockReturnValue(
      '/dormitory/pdf-template/DORMITORY_ROSTER_APPLICATION/edit'
    );
    render(<Breadcrumb />);

    expect(screen.getByText('Trang chủ')).toBeInTheDocument();
    
    // Quản lý KTX links to /dormitory
    const ktxLink = screen.getByRole('link', { name: 'Quản lý KTX' });
    expect(ktxLink).toHaveAttribute('href', '/dormitory');

    // PDF links back to catalog /dormitory/pdf-template
    const pdfLink = screen.getByRole('link', { name: 'PDF' });
    expect(pdfLink).toHaveAttribute('href', '/dormitory/pdf-template');

    // Current is Sửa mẫu (not raw token or collection code)
    const editSpan = screen.getByText('Sửa mẫu');
    expect(editSpan.tagName).toBe('SPAN');
    expect(editSpan).toHaveClass('font-bold');
    expect(screen.queryByText('DORMITORY_ROSTER_APPLICATION')).not.toBeInTheDocument();
    expect(screen.queryByText('edit')).not.toBeInTheDocument();
  });

  it('renders new breadcrumb Quản lý KTX / PDF / Thêm mẫu for /dormitory/pdf-template/new', () => {
    vi.mocked(navigation.usePathname).mockReturnValue('/dormitory/pdf-template/new');
    render(<Breadcrumb />);

    expect(screen.getByText('Trang chủ')).toBeInTheDocument();
    
    const ktxLink = screen.getByRole('link', { name: 'Quản lý KTX' });
    expect(ktxLink).toHaveAttribute('href', '/dormitory');

    const pdfLink = screen.getByRole('link', { name: 'PDF' });
    expect(pdfLink).toHaveAttribute('href', '/dormitory/pdf-template');

    const newSpan = screen.getByText('Thêm mẫu');
    expect(newSpan.tagName).toBe('SPAN');
    expect(newSpan).toHaveClass('font-bold');
  });
});
