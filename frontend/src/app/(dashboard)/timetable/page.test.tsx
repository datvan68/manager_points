import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TimetablePage from './page';

const authState = vi.hoisted(() => ({ user: { roleCode: 'ADMIN' } as { roleCode: string } | null }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => authState }));
vi.mock('@/components/guards/RouteGuard', () => ({ RouteGuard: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock('@/components/timetable/TimetableLookup', () => ({ default: ({ refreshKey }: { refreshKey: number }) => <div data-testid="lookup">lookup-{refreshKey}</div> }));
vi.mock('@/components/timetable/TimetableSyncPanel', () => ({ default: ({ onSynced }: { onSynced?: () => void }) => <button type="button" onClick={onSynced}>sync complete</button> }));
beforeEach(() => { authState.user = { roleCode: 'ADMIN' }; });
afterEach(() => { cleanup(); });

describe('TimetablePage', () => {
  it('shows admin tabs, switches mounted panels, and refreshes lookup after sync', () => {
    render(<TimetablePage />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
    expect(screen.getByRole('tab', { name: 'Tra tkb' })).toHaveAttribute('aria-selected', 'true');
    expect(document.getElementById('timetable-lookup-panel')).not.toHaveAttribute('hidden');
    fireEvent.click(screen.getByRole('tab', { name: 'Cấu hình tkb' }));
    expect(document.getElementById('timetable-settings-panel')).not.toHaveAttribute('hidden');
    expect(document.getElementById('timetable-lookup-panel')).toHaveAttribute('hidden');
    fireEvent.click(screen.getByRole('button', { name: 'sync complete' }));
    expect(screen.getByTestId('lookup')).toHaveTextContent('lookup-1');
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
