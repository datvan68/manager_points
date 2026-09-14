import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { timetableApi } from '@/api/timetable-api';
import TimetableSnapshotsPanel from './TimetableSnapshotsPanel';

vi.mock('@/api/timetable-api', async () => { const actual = await vi.importActual<typeof import('@/api/timetable-api')>('@/api/timetable-api'); return { ...actual, timetableApi: { getSnapshots: vi.fn(), getTimetable: vi.fn(), startSync: vi.fn(), getSyncStatus: vi.fn() } }; });
vi.mock('./TimetableGrid', () => ({ default: () => <div data-testid="grid">grid</div> }));
vi.mock('@/components/ui/pagination', () => ({ CustomPagination: ({ onPageChange }: { onPageChange: (page: number) => void }) => <button type="button" onClick={() => onPageChange(2)}>next page</button> }));

const row = { year: '2026', semester: '1', week: 'w1', faculty: 'f', course: 'c', className: 'a', coverageKey: 'k', syncedAt: '2026-01-01T00:00:00.000Z', jobId: 'j' };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('TimetableSnapshotsPanel', () => {
  it('loads metadata, opens detail, and retries exactly one selected coverage', async () => {
    vi.mocked(timetableApi.getSnapshots).mockResolvedValue({ data: [row], total: 1, page: 1, limit: 10, totalPages: 1 });
    vi.mocked(timetableApi.getTimetable).mockResolvedValue({ isEmpty: false, lessons: [], filters: row } as any);
    vi.mocked(timetableApi.startSync).mockResolvedValue({ id: 'job', status: 'running', total: 1 });
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ job: { id: 'job', status: 'succeeded' }, settings: { enabled: false, intervalMinutes: 60, coverage: [] }, lastSuccessfulUpdate: row.syncedAt });
    render(<TimetableSnapshotsPanel />);
    expect(await screen.findByText('2026')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Xem chi tiết' }));
    await waitFor(() => expect(timetableApi.getTimetable).toHaveBeenCalledWith({ year: '2026', semester: '1', week: 'w1', faculty: 'f', course: 'c', className: 'a' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ lại' }));
    await waitFor(() => expect(timetableApi.startSync).toHaveBeenCalledWith([{ year: '2026', semester: '1', week: 'w1', faculty: 'f', course: 'c', className: 'a' }]));
  });

  it('shows empty and error states', async () => {
    vi.mocked(timetableApi.getSnapshots).mockResolvedValueOnce({ data: [], total: 0, page: 1, limit: 10, totalPages: 0 });
    render(<TimetableSnapshotsPanel />);
    expect(await screen.findByText('Không có dữ liệu phù hợp.')).toBeInTheDocument();
    cleanup(); vi.mocked(timetableApi.getSnapshots).mockRejectedValueOnce(new Error('failed'));
    render(<TimetableSnapshotsPanel />);
    expect(await screen.findByRole('alert')).toHaveTextContent('failed');
  });
});
