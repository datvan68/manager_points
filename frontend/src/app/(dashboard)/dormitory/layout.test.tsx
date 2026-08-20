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
    expect(screen.getByRole('button', { name: 'Phòng' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hợp đồng' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hóa đơn' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'PDF' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vi phạm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bảo trì' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Báo cáo' })).not.toBeInTheDocument();

    screen.getByRole('button', { name: 'Hóa đơn' }).click();
    expect(push).toHaveBeenCalledWith('/dormitory/invoices');
  });

  it('verifies Contracts, Violations, Maintenance, and Reports tabs are absent for any permission set (AC-01, AC-08)', () => {
    mockHasPermission = vi.fn(() => true);
    render(<DormitoryLayout><div>content</div></DormitoryLayout>);
    expect(screen.queryByRole('button', { name: 'Hợp đồng' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Vi phạm' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bảo trì' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Báo cáo' })).not.toBeInTheDocument();
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
    const { container } = render(<DormitoryLayout><div data-testid="c3">edit</div></DormitoryLayout>);
    expect(screen.getByTestId('tabs')).toHaveAttribute('data-active', 'pdf-template');
    expect(screen.getByTestId('c3')).toBeInTheDocument();

    const wrapper = container.querySelector('.flex-1.min-h-0.flex.flex-col.overflow-hidden');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toContainElement(screen.getByTestId('c3'));
  });

  it('renders direct child routes even when removed from navigation tabs (AC-02, AC-09)', () => {
    pathname = '/dormitory/contracts';
    const { unmount: unmountContracts } = render(<DormitoryLayout><div data-testid="direct-contracts">Contracts Page</div></DormitoryLayout>);
    expect(screen.getByTestId('direct-contracts')).toBeInTheDocument();
    unmountContracts();

    pathname = '/dormitory/reports';
    const { unmount: unmountReports } = render(<DormitoryLayout><div data-testid="direct-reports">Reports Page</div></DormitoryLayout>);
    expect(screen.getByTestId('direct-reports')).toBeInTheDocument();
    unmountReports();

    pathname = '/dormitory/violations';
    const { unmount: unmountViolations } = render(<DormitoryLayout><div data-testid="direct-violations">Violations Page</div></DormitoryLayout>);
    expect(screen.getByTestId('direct-violations')).toBeInTheDocument();
    unmountViolations();

    pathname = '/dormitory/maintenance';
    render(<DormitoryLayout><div data-testid="direct-maintenance">Maintenance Page</div></DormitoryLayout>);
    expect(screen.getByTestId('direct-maintenance')).toBeInTheDocument();
  });
});
