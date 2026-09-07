import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ list: vi.fn(), revoke: vi.fn(), others: vi.fn(), logout: vi.fn(), user: { id: 'u1' } as any }));
vi.mock('@/api/auth-api', () => ({ authApi: { listSessions: mocks.list, revokeSession: mocks.revoke, revokeOtherSessions: mocks.others } }));
vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: mocks.user, logout: mocks.logout }) }));
import { ActiveSessionsSection } from './ActiveSessionsSection';
const rows = [{ id: 'one', current: true, device_label: 'Chrome - máy tính', created_at: '2026-09-07', last_active_at: '2026-09-07' },
  { id: 'two', current: false, device_label: 'Safari - di động', created_at: '2026-09-07', last_active_at: '2026-09-07' }];
beforeEach(() => { vi.clearAllMocks(); mocks.user = { id: 'u1' }; mocks.list.mockResolvedValue(rows); mocks.revoke.mockResolvedValue(undefined); });
describe('Active session management', () => {
  it('shows current device and revokes only selected other device', async () => {
    render(<ActiveSessionsSection />); await screen.findByText('Safari - di động');
    mocks.list.mockResolvedValue([rows[0]]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Kết thúc phiên' })[1]);
    await waitFor(() => expect(mocks.revoke).toHaveBeenCalledWith('two'));
    await waitFor(() => expect(screen.queryByText('Safari - di động')).not.toBeInTheDocument());
    expect(mocks.logout).not.toHaveBeenCalled();
  });
  it('logs out when the current session is revoked', async () => {
    render(<ActiveSessionsSection />); await screen.findByText('Safari - di động');
    fireEvent.click(screen.getAllByRole('button', { name: 'Kết thúc phiên' })[0]);
    await waitFor(() => expect(mocks.logout).toHaveBeenCalledTimes(1));
  });
  it('does not expose subject device management to impersonated callers', () => {
    mocks.user = { id: 'u1', impersonation: { id: 'child' } }; const { container } = render(<ActiveSessionsSection />);
    expect(container).toBeEmptyDOMElement(); expect(mocks.list).not.toHaveBeenCalled();
  });
  it('keeps failure visible without claiming revocation succeeded', async () => {
    mocks.revoke.mockRejectedValue(new Error('offline')); render(<ActiveSessionsSection />);
    await screen.findByText('Safari - di động'); fireEvent.click(screen.getAllByRole('button', { name: 'Kết thúc phiên' })[1]);
    await screen.findByRole('alert'); expect(mocks.logout).not.toHaveBeenCalled();
  });
});
