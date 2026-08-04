import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DormitoryLayout from './layout';

const push = vi.fn();
let pathname = '/dormitory/registrations/abc';

vi.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push }),
}));

vi.mock('@/components/ui/TabNavigation', () => ({
  default: ({ tabs, activeTab, onTabChange }: any) => (
    <nav data-testid="tabs" data-active={activeTab}>
      {tabs.map((tab: any) => <button key={tab.id} onClick={() => onTabChange(tab.id)}>{tab.label}</button>)}
    </nav>
  ),
}));

describe('DormitoryLayout', () => {
  beforeEach(() => { push.mockReset(); pathname = '/dormitory/registrations/abc'; });

  it('selects the registrations tab for nested registration routes and navigates by tab id', () => {
    render(<DormitoryLayout><div>content</div></DormitoryLayout>);
    expect(screen.getByTestId('tabs')).toHaveAttribute('data-active', 'registrations');
    expect(screen.getAllByRole('button')[0]).toHaveTextContent('Đăng ký');
    screen.getByRole('button', { name: 'Báo cáo' }).click();
    expect(push).toHaveBeenCalledWith('/dormitory/reports');
  });
});
