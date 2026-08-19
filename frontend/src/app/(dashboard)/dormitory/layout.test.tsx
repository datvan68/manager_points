import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DormitoryLayout from './layout';

const push = vi.fn();
let pathname = '/dormitory/roster/abc';
let mockHasPermission = vi.fn((_perm: string) => false);

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    hasPermission: mockHasPermission,
  }),
}));

vi.mock('@/components/ui/TabNavigation', () => ({
  default: ({ tabs, activeTab, onTabChange }: any) => (
    <nav data-testid="tabs" data-active={activeTab}>
      {tabs.map((tab: any) => (
        <button key={tab.id} onClick={() => onTabChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  ),
}));

describe('DormitoryLayout', () => {
  beforeEach(() => {
    push.mockReset();
    pathname = '/dormitory/roster/abc';
    mockHasPermission = vi.fn((_perm: string) => false);
  });

  it('selects the registrations tab for nested registration routes and navigates by tab id', () => {
    render(<DormitoryLayout><div>content</div></DormitoryLayout>);
    expect(screen.getByTestId('tabs')).toHaveAttribute('data-active', 'registrations');
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Tổng quan');
    expect(screen.getByRole('button', { name: 'Danh sách' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument();
    screen.getByRole('button', { name: 'Báo cáo' }).click();
    expect(push).toHaveBeenCalledWith('/dormitory/reports');
  });

  it('includes the PDF tab when user has PDF_TEMPLATE_READ permission', () => {
    mockHasPermission = vi.fn((perm: string) => perm === 'PDF_TEMPLATE_READ');
    render(<DormitoryLayout><div>content</div></DormitoryLayout>);
    const pdfTab = screen.getByRole('button', { name: 'PDF' });
    expect(pdfTab).toBeInTheDocument();
    pdfTab.click();
    expect(push).toHaveBeenCalledWith('/dormitory/pdf-template');
  });

  it('activates the pdf-template tab on /dormitory/pdf-template and its new/edit routes', () => {
    mockHasPermission = vi.fn(() => true);

    pathname = '/dormitory/pdf-template';
    const { unmount: unmount1 } = render(<DormitoryLayout><div data-testid="c1">catalog</div></DormitoryLayout>);
    expect(screen.getByTestId('tabs')).toHaveAttribute('data-active', 'pdf-template');
    expect(screen.getByTestId('c1')).toBeInTheDocument();
    unmount1();

    pathname = '/dormitory/pdf-template/new';
    const { unmount: unmount2 } = render(<DormitoryLayout><div data-testid="c2">new</div></DormitoryLayout>);
    expect(screen.getByTestId('tabs')).toHaveAttribute('data-active', 'pdf-template');
    expect(screen.getByTestId('c2')).toBeInTheDocument();
    unmount2();

    pathname = '/dormitory/pdf-template/DORMITORY_ROSTER_APPLICATION/edit';
    render(<DormitoryLayout><div data-testid="c3">edit</div></DormitoryLayout>);
    expect(screen.getByTestId('tabs')).toHaveAttribute('data-active', 'pdf-template');
    expect(screen.getByTestId('c3')).toBeInTheDocument();
  });
});
