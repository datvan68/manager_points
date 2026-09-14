import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TimetableSyncPanel from './TimetableSyncPanel';
import { classApi } from '@/api/class-api';
import { timetableApi, type TimetableOptions } from '@/api/timetable-api';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { roleCode: 'ADMIN' } }) }));
vi.mock('@/api/class-api', () => ({ classApi: { getClasses: vi.fn() } }));
vi.mock('@/api/timetable-api', () => ({ timetableApi: { getSyncStatus: vi.fn(), getSavedClassWeekStatus: vi.fn(), loadCatalog: vi.fn(), updateSyncSettings: vi.fn(), syncSavedClassWeek: vi.fn(), syncSavedClassWeeks: vi.fn() } }));
const catalog: TimetableOptions = { years: [{ value: '2026', label: '2026' }], semesters: [{ value: '1', label: 'Học kỳ 1' }], weeks: [{ value: 'w1', label: 'Tuần 1' }], faculties: [{ value: 'f1', label: 'Khoa 1' }], courses: [{ value: 'c1', label: 'Khóa 1' }], classes: [{ value: 'A', label: '  Lớp A  ', parent: { year: '2026', semester: '1', faculty: 'f1', course: 'c1' } }, { value: 'B', label: 'Lớp B', parent: { year: '2026', semester: '1', faculty: 'f1', course: 'c1' } }] };
const settings = { enabled: false, intervalMinutes: 60, coverage: [], selectedClasses: [], classLinks: [] };
const openSourceConfig = () => fireEvent.click(screen.getByRole('button', { name: 'Mở cấu hình nâng cao' }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(classApi.getClasses).mockResolvedValue([{ _id: 'c1', class_name: 'Lớp A', class_year: '2026', dept_id: 'd1', class_type: 'Cao đẳng' }]); vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings, job: null, lastSuccessfulUpdate: null }); vi.mocked(timetableApi.loadCatalog).mockResolvedValue(catalog); vi.mocked(timetableApi.updateSyncSettings).mockImplementation(async (value) => value); vi.mocked(timetableApi.syncSavedClassWeek).mockResolvedValue({ status: 'pending', key: 'k', selection: { year: '2026', semester: '1', className: 'A', week: 'w1' } }); vi.mocked(timetableApi.syncSavedClassWeeks).mockResolvedValue({ status: 'running', id: 'job', total: 1 }); vi.mocked(timetableApi.getSavedClassWeekStatus).mockResolvedValue({ key: 'k', selection: { year: '2026', semester: '1', className: 'A', week: 'w1' }, status: 'valid', snapshotExists: true, lastSuccessfulUpdate: null, isEmpty: false }); });

const selectOption = async (label: string, text: string) => {
  const trigger = screen.getByRole('combobox', { name: label });
  fireEvent.click(trigger);
  await waitFor(() =>
    expect(
      screen
        .getAllByRole('listbox', { hidden: true })
        .some((el) => !el.className.includes('opacity-0'))
    ).toBe(true)
  );
  const openListbox = screen
    .getAllByRole('listbox', { hidden: true })
    .find((el) => !el.className.includes('opacity-0'));
  if (!openListbox) throw new Error('No open listbox');
  const option = within(openListbox).getByRole('option', { name: text, hidden: true });
  await act(async () => { fireEvent.click(option); });
};

describe('TimetableSyncPanel', () => {
  it('keeps classes searchable while the source catalog is pending', async () => {
    vi.mocked(timetableApi.loadCatalog).mockReturnValue(new Promise(() => {}));
    render(<TimetableSyncPanel />);
    await screen.findByText('Lớp A');
    fireEvent.change(screen.getByLabelText('Tìm lớp'), { target: { value: 'missing' } });
    expect(screen.queryByText('Lớp A')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Tìm lớp'), { target: { value: 'Lớp A' } });
    expect(screen.getByText('Lớp A')).toBeInTheDocument();
  });

  it('retains system classes when the source catalog fails', async () => {
    vi.mocked(timetableApi.loadCatalog).mockRejectedValue(new Error('Source timeout'));
    render(<TimetableSyncPanel />);
    await screen.findByText('Lớp A');
    expect(await screen.findByRole('alert')).toHaveTextContent('Source timeout');
  });

  it('keeps the filter bar responsive and the table footer outside the scroll area', async () => {
    render(<TimetableSyncPanel />);
    await screen.findAllByText('Lớp A');
    const panel = screen.getByRole('region', { name: 'Quản trị đồng bộ thời khóa biểu' });
    expect(panel).toHaveClass('flex', 'min-h-0', 'overflow-hidden');
    expect(screen.getByLabelText('Tìm lớp')).toBeInTheDocument();
    expect(screen.getByLabelText('Khoa hệ thống')).toBeInTheDocument();
    expect(screen.getByLabelText('Trạng thái liên kết')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Kiểu hiển thị' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mở cấu hình nâng cao' })).toBeInTheDocument();
    expect(screen.getByRole('table').querySelector('thead')).toHaveClass('sticky', 'top-0');
    expect(screen.getByText(/Hiển thị 1-1 trên tổng số 1 lớp/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trang sau' })).toBeInTheDocument();
  });

  it('opens and closes advanced source configuration from the menu', async () => {
    render(<TimetableSyncPanel />);
    await screen.findAllByText('Lớp A');
    expect(screen.queryByLabelText('year')).not.toBeInTheDocument();
    openSourceConfig();
    expect(screen.getByLabelText('year')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByLabelText('year')).not.toBeInTheDocument();
  });

  it('renders every system class and creates a normalized unique draft link without fetching schedules', async () => {
    render(<TimetableSyncPanel />);
    expect((await screen.findAllByText('Lớp A')).length).toBeGreaterThan(0);
    openSourceConfig();
    await selectOption('year', '2026');
    await selectOption('semester', 'Học kỳ 1');
    fireEvent.click(screen.getByRole('button', { name: 'Đối chiếu lớp' }));
    await waitFor(() => expect(screen.getByText('Tự động (unique)')).toBeInTheDocument());
    expect(timetableApi.syncSavedClassWeek).not.toHaveBeenCalled();
  });

  it('keeps ambiguous/unmatched rows visible and saves additive links', async () => {
    vi.mocked(classApi.getClasses).mockResolvedValue([{ _id: 'c1', class_name: 'Lớp C', class_year: '2026', dept_id: 'd1', class_type: 'Cao đẳng' }]);
    render(<TimetableSyncPanel />);
    await screen.findByText('Lớp C');
    openSourceConfig();
    await selectOption('year', '2026');
    await selectOption('semester', 'Học kỳ 1');
    fireEvent.click(screen.getByRole('button', { name: 'Lưu liên kết' }));
    await waitFor(() => expect(timetableApi.updateSyncSettings).toHaveBeenCalledWith(expect.objectContaining({ classLinks: [] })));
    expect(screen.getByText('Unverified')).toBeInTheDocument();
  });

  it('supports source-only view and retains draft after a failed save', async () => {
    vi.mocked(timetableApi.updateSyncSettings).mockRejectedValue(new Error('Lưu lỗi'));
    render(<TimetableSyncPanel />);
    await screen.findAllByText('Lớp A');
    openSourceConfig();
    await selectOption('year', '2026');
    await selectOption('semester', 'Học kỳ 1');
    fireEvent.click(screen.getByRole('button', { name: 'Đối chiếu lớp' }));
    await waitFor(() => expect(screen.getByText('Tự động (unique)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Lưu liên kết' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('combobox', { name: 'Nguồn cho Lớp A' })).toHaveValue('  Lớp A  ');
    fireEvent.click(screen.getByRole('button', { name: 'Lớp nguồn' }));
    expect(within(screen.getByRole('table')).getAllByText('Source-only')).toHaveLength(2);
  });

  it('requires an explicit saved-link week and sends that exact week', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 2, targetWeeks: ['w1', 'w2'], status: 'missing', weeks: [{ week: 'w1', label: 'Tuần 1', startDate: '2026-01-01', endDate: '2026-01-07', status: 'missing' }, { week: 'w2', label: 'Tuần 2', status: 'valid' }] }] });
    render(<TimetableSyncPanel />);
    await screen.findByRole('combobox', { name: 'Tuần cho Lớp A' });
    expect(screen.getByRole('button', { name: 'Đồng bộ tuần' })).toBeDisabled();
    await selectOption('Tuần cho Lớp A', 'Tuần 2');
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tuần' }));
    await waitFor(() => expect(timetableApi.syncSavedClassWeek).toHaveBeenCalledWith(expect.objectContaining({ systemClassId: 'c1', className: 'A', week: 'w2' }), 'sync'));
  });

  it('shows request failures and reports observed completion', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    const onSynced = vi.fn();
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'missing', weeks: [{ week: 'w1', status: 'missing' }] }] });
    vi.mocked(timetableApi.syncSavedClassWeek).mockRejectedValue(new Error('Mất kết nối'));
    render(<TimetableSyncPanel onSynced={onSynced} />);
    await screen.findByRole('combobox', { name: 'Tuần cho Lớp A' });
    await selectOption('Tuần cho Lớp A', 'w1');
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tuần' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('Mất kết nối');
    expect(onSynced).not.toHaveBeenCalled();
  });

  it('selects saved rows and sends one bulk request for the common week', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'missing', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'missing' }] }] });
    render(<TimetableSyncPanel />);
    await screen.findByRole('checkbox', { name: 'Chọn lớp Lớp A' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn lớp Lớp A' }));
    await selectOption('Tuần đồng bộ chung', 'w1');
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ đã chọn' }));
    await waitFor(() => expect(timetableApi.syncSavedClassWeeks).toHaveBeenCalledWith([expect.objectContaining({ systemClassId: 'c1', week: 'w1' })]));
  });

  it('opens real progress before the bulk request resolves and completes from pair status', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'missing', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'missing' }] }] });
    let resolveRequest!: (value: { status: string; total: number; outcomes: Array<{ key: string; selection: typeof link & { week: string }; status: 'accepted' }> }) => void;
    vi.mocked(timetableApi.syncSavedClassWeeks).mockReturnValue(new Promise((resolve) => { resolveRequest = resolve; }));
    render(<TimetableSyncPanel />);
    await screen.findByRole('checkbox', { name: 'Chọn lớp Lớp A' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn lớp Lớp A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chọn tuần đồng bộ' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Các tuần có thể đồng bộ' })).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đồng bộ' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('0/1 cặp đã xử lý')).toBeInTheDocument();
    expect(screen.queryByText(/Đã tiếp nhận/u)).not.toBeInTheDocument();
    resolveRequest({ status: 'pending', total: 1, outcomes: [{ key: 'server-key', selection: { ...link, week: 'w1' }, status: 'accepted' }] });
    await waitFor(() => expect(screen.getByText('1/1 cặp đã xử lý')).toBeInTheDocument());
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('counts cooldown/coalesced outcomes as skipped instead of success', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'missing', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'missing' }] }] });
    vi.mocked(timetableApi.syncSavedClassWeeks).mockResolvedValue({ status: 'coalesced', total: 1, outcomes: [{ key: 'server-key', selection: { ...link, week: 'w1' }, status: 'cooldown' }] });
    render(<TimetableSyncPanel />);
    await screen.findByRole('checkbox', { name: 'Chọn lớp Lớp A' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn lớp Lớp A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chọn tuần đồng bộ' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Các tuần có thể đồng bộ' })).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đồng bộ' }));
    await waitFor(() => expect(screen.getByText('1/1 cặp đã xử lý')).toBeInTheDocument());
    expect(screen.getByText('Bỏ qua')).toBeInTheDocument();
    expect(timetableApi.getSavedClassWeekStatus).not.toHaveBeenCalled();
  });

  it('does not count an unchanged valid snapshot as new progress', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'valid', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'valid', lastSuccessfulUpdate: 'old' }] }] });
    vi.mocked(timetableApi.syncSavedClassWeeks).mockResolvedValue({ status: 'pending', total: 1, outcomes: [{ key: 'server-key', selection: { ...link, week: 'w1' }, status: 'accepted' }] });
    vi.mocked(timetableApi.getSavedClassWeekStatus).mockResolvedValue({ key: 'server-key', selection: { ...link, week: 'w1' }, status: 'valid', snapshotExists: true, lastSuccessfulUpdate: 'old', isEmpty: false });
    render(<TimetableSyncPanel />);
    await screen.findByRole('checkbox', { name: 'Chọn lớp Lớp A' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn lớp Lớp A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chọn tuần đồng bộ' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Các tuần có thể đồng bộ' })).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đồng bộ' }));
    await waitFor(() => expect(timetableApi.getSavedClassWeekStatus).toHaveBeenCalled());
    expect(screen.getByText('0/1 cặp đã xử lý')).toBeInTheDocument();
  });
});
