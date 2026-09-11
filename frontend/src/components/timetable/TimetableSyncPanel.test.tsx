import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TimetableSyncPanel from './TimetableSyncPanel';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { roleCode: 'ADMIN' } }) }));
vi.mock('../../api/timetable-api', () => ({ timetableApi: { getSyncStatus: () => Promise.resolve({ settings: { enabled: false, intervalMinutes: 60, coverage: [] }, job: null }), loadCatalog: () => Promise.resolve({ years: [], semesters: [], weeks: [], faculties: [], courses: [], classes: [] }), startSync: () => Promise.resolve({ id: 'job-1', status: 'running', total: 1 }), updateSyncSettings: (value: any) => Promise.resolve(value) } }));

describe('TimetableSyncPanel', () => {
  it('shows synchronization controls to canonical administrators', async () => {
    render(<TimetableSyncPanel />);
    expect(await screen.findByRole('button', { name: 'Tải danh mục nguồn' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Bật định kỳ/i })).toBeInTheDocument();
  });
});
