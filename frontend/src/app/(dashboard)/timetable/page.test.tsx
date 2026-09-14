import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TimetablePage from './page';

const authState = vi.hoisted(() => ({ user: { roleCode: 'ADMIN' } as { roleCode: string } | null }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => authState }));
vi.mock('@/components/guards/RouteGuard', () => ({ RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/timetable/TimetableLookup', () => ({ default: ({ refreshKey }: { refreshKey: number }) => <div data-testid="lookup">lookup-{refreshKey}</div> }));
vi.mock('@/components/timetable/TimetableSyncPanel', () => ({ default: ({ onSynced }: { onSynced?: () => void }) => <button type="button" onClick={onSynced}>sync complete</button> }));
vi.mock('@/components/timetable/TimetableSnapshotsPanel', () => ({ default: () => <div data-testid="snapshots">snapshots</div> }));
beforeEach(() => { authState.user = { roleCode: 'ADMIN' }; });
afterEach(() => { cleanup(); });

describe('TimetablePage', () => {
  it('shows admin tabs, switches mounted panels, and refreshes lookup after sync', () => {
    render(<TimetablePage />);
    expect(screen.queryByRole('heading', { name: 'Thời khóa biểu' })).not.toBeInTheDocument();
    expect(screen.queryByText('Tra cứu lịch học theo dữ liệu nhà trường.')).not.toBeInTheDocument();
    expect(screen.getAllByRole('tab')).toHaveLength(3);
    expect(screen.queryByText('sync complete')).not.toBeInTheDocument();
    expect(screen.queryByTestId('snapshots')).not.toBeInTheDocument();
    expect(screen.getByRole('tablist')).toHaveAttribute('aria-label', 'Điều hướng tab');
    expect(screen.getByRole('tablist').parentElement).toHaveClass('shrink-0');
    expect(screen.getByRole('tablist').parentElement).toHaveClass('overflow-x-auto');
    expect(screen.getByRole('main')).toHaveClass('p-4', 'sm:p-6');
    expect(screen.getByRole('tab', { name: 'Tra tkb' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Tra tkb' })).toHaveAttribute('aria-controls', 'timetable-lookup-panel');
    expect(document.getElementById('timetable-lookup-panel')).not.toHaveAttribute('hidden');
    fireEvent.click(screen.getByRole('tab', { name: 'Cấu hình tkb' }));
    expect(document.getElementById('timetable-settings-panel')).not.toHaveAttribute('hidden');
    expect(document.getElementById('timetable-lookup-panel')).toHaveAttribute('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'sync complete' }));
    expect(screen.getByTestId('lookup')).toHaveTextContent('lookup-1');
    fireEvent.click(screen.getByRole('tab', { name: 'Dữ liệu đã đồng bộ' }));
    expect(screen.getByTestId('snapshots')).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Dữ liệu đã đồng bộ' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Tra tkb' })).toHaveAttribute('aria-selected', 'true');
  });

  it('keeps lookup for permitted non-admin users without rendering configuration', () => {
    authState.user = { roleCode: 'TEACHER' };
    render(<TimetablePage />);
    expect(screen.getByTestId('lookup')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'sync complete' })).not.toBeInTheDocument();
    authState.user = { roleCode: 'ADMIN' };
  });
});
