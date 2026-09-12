import { fireEvent, render, screen, waitFor, within, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TimetableSyncPanel from './TimetableSyncPanel';
import { timetableApi, type TimetableOptions } from '@/api/timetable-api';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { roleCode: 'ADMIN' } }) }));
vi.mock('@/api/timetable-api', () => ({ timetableApi: {
  getSyncStatus: vi.fn(), loadCatalog: vi.fn(), startSync: vi.fn(), updateSyncSettings: vi.fn(),
} }));
const catalog: TimetableOptions = {
  years: [{ value: 'y', label: '2026' }], semesters: [{ value: 's', label: 'Học kỳ 1' }],
  weeks: [{ value: 'w1', label: 'Tuần 1' }, { value: 'w2', label: 'Tuần 2' }],
  faculties: [{ value: 'f', label: 'Khoa A' }], courses: [{ value: 'c', label: 'Khóa A' }], classes: [{ value: 'a', label: 'Lớp A' }, { value: 'b', label: 'Lớp B' }],
};
const coverage = { year: 'y', semester: 's', week: 'w1', faculty: '', course: '', className: 'a' };
const initial = { settings: { enabled: false, intervalMinutes: 60, coverage: [] }, job: null, lastSuccessfulUpdate: null };
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(timetableApi.getSyncStatus).mockResolvedValue(initial);
  vi.mocked(timetableApi.loadCatalog).mockResolvedValue(catalog);
  vi.mocked(timetableApi.startSync).mockResolvedValue({ id: 'job-1', status: 'running', total: 2 });
  vi.mocked(timetableApi.updateSyncSettings).mockImplementation(async (settings) => settings);
});
async function chooseParent(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Tải danh mục nguồn' })).toBeEnabled());
}

describe('TimetableSyncPanel', () => {
  it('selects multiple weeks/classes, deduplicates coverage and submits the explicit selection', async () => {
    render(<TimetableSyncPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Tải danh mục nguồn' }));
    await screen.findByLabelText('Đồng bộ niên học');
    await chooseParent('Đồng bộ niên học', 'y');
    await chooseParent('Đồng bộ học kỳ', 's');
    fireEvent.change(screen.getByLabelText('Đồng bộ lớp'), { target: { value: 'a' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tuần 1' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tuần 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm phạm vi (2 tuần)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Thêm phạm vi (2 tuần)' }));
    expect(within(screen.getByRole('list', { name: 'Phạm vi đồng bộ' })).getAllByRole('listitem')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Đồng bộ lớp'), { target: { value: 'b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Thêm phạm vi (2 tuần)' }));
    expect(within(screen.getByRole('list', { name: 'Phạm vi đồng bộ' })).getAllByRole('listitem')).toHaveLength(4);
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ phạm vi 4' }));
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ ngay' }));
    await waitFor(() => expect(timetableApi.startSync).toHaveBeenCalledWith([
      coverage, { ...coverage, week: 'w2' }, { ...coverage, className: 'b' },
    ]));
    expect(timetableApi.updateSyncSettings).not.toHaveBeenCalled();
    expect(timetableApi.loadCatalog).toHaveBeenLastCalledWith(expect.objectContaining({ year: 'y', semester: 's' }));
  });

  it('retries every original coverage after interruption even if none was saved in settings', async () => {
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ ...initial, job: { id: 'old', status: 'failed', error: 'SYNC_INTERRUPTED', coverage: [coverage, { ...coverage, week: 'w2' }], failures: [{ coverage, reason: 'SOURCE_TIMEOUT' }], completed: 0, total: 2 } });
    render(<TimetableSyncPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chạy lại job gián đoạn' }));
    await waitFor(() => expect(timetableApi.startSync).toHaveBeenCalledWith([coverage, { ...coverage, week: 'w2' }]));
  });

  it('retries only failed coverage for a completed partial job', async () => {
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ ...initial, job: { id: 'partial', status: 'failed', completed: 1, total: 2, failures: [{ coverage, reason: 'SOURCE_TIMEOUT' }] } });
    render(<TimetableSyncPanel />);
    expect(await screen.findByText(/Đồng bộ thành công một phần/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại phạm vi lỗi' }));
    await waitFor(() => expect(timetableApi.startSync).toHaveBeenCalledWith([coverage]));
  });

  it('does not overwrite unsaved settings while polling and refreshes lookup when finished', async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(timetableApi.getSyncStatus)
        .mockResolvedValueOnce({ ...initial, job: { id: 'active', status: 'running' } })
        .mockResolvedValue({ ...initial, job: { id: 'active', status: 'succeeded', completed: 1, total: 1 } });
      const onSynced = vi.fn();
      render(<TimetableSyncPanel onSynced={onSynced} />);
      await act(async () => {});
      fireEvent.change(screen.getByLabelText('Khoảng đồng bộ'), { target: { value: '120' } });
      await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
      expect(screen.getByLabelText('Khoảng đồng bộ')).toHaveValue(120);
      expect(onSynced).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
});
