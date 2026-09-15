import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TimetableSyncPanel from './TimetableSyncPanel';
import { classApi } from '@/api/class-api';
import { timetableApi, type TimetableOptions } from '@/api/timetable-api';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { roleCode: 'ADMIN' }, hasPermission: () => true }) }));
vi.mock('@/api/class-api', () => ({ classApi: { getClasses: vi.fn() } }));
vi.mock('@/api/timetable-api', () => ({ timetableApi: { getSyncStatus: vi.fn(), getSyncSettings: vi.fn(), getSavedClassWeekStatus: vi.fn(), getSavedClassWeeksStatus: vi.fn(), loadCatalog: vi.fn(), updateSyncSettings: vi.fn(), syncSavedClassWeek: vi.fn(), syncSavedClassWeeks: vi.fn() } }));
const catalog: TimetableOptions = { years: [{ value: '2026', label: '2026' }], semesters: [{ value: '1', label: 'Học kỳ 1' }], weeks: [{ value: 'w1', label: 'Tuần 1' }], faculties: [{ value: 'f1', label: 'Khoa 1' }], courses: [{ value: 'c1', label: 'Khóa 1' }], classes: [{ value: 'A', label: '  Lớp A  ', parent: { year: '2026', semester: '1', faculty: 'f1', course: 'c1' } }, { value: 'B', label: 'Lớp B', parent: { year: '2026', semester: '1', faculty: 'f1', course: 'c1' } }] };
const settings = { enabled: false, intervalMinutes: 60, coverage: [], selectedClasses: [], classLinks: [] };
const openSourceConfig = () => fireEvent.click(screen.getByRole('button', { name: 'Mở cấu hình nâng cao' }));
beforeEach(() => { vi.clearAllMocks(); vi.mocked(classApi.getClasses).mockResolvedValue([{ _id: 'c1', class_name: 'Lớp A', class_year: '2026', dept_id: 'd1', class_type: 'Cao đẳng' }]); vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings, job: null, lastSuccessfulUpdate: null }); vi.mocked(timetableApi.loadCatalog).mockResolvedValue(catalog); vi.mocked(timetableApi.updateSyncSettings).mockImplementation(async (value) => value); vi.mocked(timetableApi.syncSavedClassWeek).mockResolvedValue({ status: 'pending', key: 'k', selection: { year: '2026', semester: '1', className: 'A', week: 'w1' } }); vi.mocked(timetableApi.syncSavedClassWeeks).mockResolvedValue({ status: 'running', id: 'job', total: 1 }); vi.mocked(timetableApi.getSavedClassWeeksStatus).mockResolvedValue({ snapshotAt: 'now', items: [] }); vi.mocked(timetableApi.getSavedClassWeekStatus).mockResolvedValue({ key: 'k', selection: { year: '2026', semester: '1', className: 'A', week: 'w1' }, status: 'valid', snapshotExists: true, lastSuccessfulUpdate: null, isEmpty: false }); });

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
    await selectOption('Tuần cho Lớp A', 'Tuần 2 · Đã đồng bộ');
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tuần' }));
    await waitFor(() => expect(timetableApi.syncSavedClassWeek).toHaveBeenCalledWith(expect.objectContaining({ systemClassId: 'c1', className: 'A', week: 'w2' }), 'sync'));
  });

  it('opens the single progress dialog before the request resolves and keeps it at 0%', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'missing', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'missing' }] }] });
    vi.mocked(timetableApi.syncSavedClassWeek).mockReturnValue(new Promise(() => {}));
    render(<TimetableSyncPanel />);
    await screen.findByRole('combobox', { name: 'Tuần cho Lớp A' });
    await selectOption('Tuần cho Lớp A', 'Tuần 1 · Chưa đồng bộ');
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tuần' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Lớp hệ thống: Lớp A · Lớp nguồn: Lớp A · Tuần 1');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows 100% and invokes onSynced only after a new valid snapshot', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    const onSynced = vi.fn();
    const initialStatus = { settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'missing', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'missing' }] }] };
    const refreshedStatus = { ...initialStatus, classStatuses: [{ ...initialStatus.classStatuses[0], status: 'valid', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'valid', lastSuccessfulUpdate: 'new' }] }] };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValueOnce(initialStatus).mockResolvedValue(refreshedStatus);
    vi.mocked(timetableApi.getSavedClassWeekStatus).mockResolvedValue({ key: 'k', selection: { ...link, week: 'w1' }, status: 'valid', snapshotExists: true, lastSuccessfulUpdate: 'new', isEmpty: false });
    render(<TimetableSyncPanel onSynced={onSynced} />);
    await screen.findByRole('combobox', { name: 'Tuần cho Lớp A' });
    await selectOption('Tuần cho Lớp A', 'Tuần 1 · Chưa đồng bộ');
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tuần' }));
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100'));
    expect(onSynced).toHaveBeenCalledTimes(1);
    expect(within(screen.getByRole('row', { name: /Lớp A/u, hidden: true })).getByText('Đã đồng bộ')).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('keeps the row badge failed when single-week polling returns a terminal failure', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    const initial = { settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'missing', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'missing' }] }] };
    const failed = { ...initial, classStatuses: [{ ...initial.classStatuses[0], status: 'failed', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'failed', failure: 'SYNC_FAILED' }] }] };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValueOnce(initial).mockResolvedValueOnce(failed);
    vi.mocked(timetableApi.getSavedClassWeekStatus).mockResolvedValue({ key: 'k', selection: { ...link, week: 'w1' }, status: 'failed', snapshotExists: false, lastSuccessfulUpdate: null, isEmpty: false, failure: 'SOURCE_INVALID_SELECTION' });
    const onSynced = vi.fn();
    render(<TimetableSyncPanel onSynced={onSynced} />);
    await screen.findByRole('combobox', { name: 'Tuần cho Lớp A' });
    await selectOption('Tuần cho Lớp A', 'Tuần 1 · Chưa đồng bộ');
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tuần' }));
    await waitFor(() => expect(screen.getByText('Đồng bộ thất bại')).toBeInTheDocument());
    expect(screen.getByText(/Lớp hệ thống: Lớp A · Lớp nguồn: Lớp A · Tuần 1/u)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Lựa chọn lớp nguồn đã lưu không còn hợp lệ');
    expect(screen.getByRole('alert')).toHaveTextContent('SOURCE_INVALID_SELECTION');
    expect(within(screen.getByRole('row', { name: /Lớp A/u, hidden: true })).getByText('Lỗi')).toBeInTheDocument();
    expect(onSynced).not.toHaveBeenCalled();
  });

  it('shows every week status while keeping the selected trigger compact', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    const weeks = [
      { week: 'w1', label: 'Tuần 1', status: 'valid' },
      { week: 'w2', label: 'Tuần 2', status: 'missing' },
      { week: 'w3', label: 'Tuần 3', status: 'pending' },
      { week: 'w4', label: 'Tuần 4', status: 'running' },
      { week: 'w5', label: 'Tuần 5', status: 'failed' },
    ];
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({
      settings: { ...settings, classLinks: [link] },
      job: null,
      lastSuccessfulUpdate: null,
      classStatuses: [{ classSelection: link, weekCount: weeks.length, targetWeeks: weeks.map(({ week }) => week), status: 'failed', weeks }],
    });

    render(<TimetableSyncPanel />);
    const trigger = await screen.findByRole('combobox', { name: 'Tuần cho Lớp A' });
    fireEvent.click(trigger);
    const listbox = await waitFor(() => {
      const openListbox = screen.getAllByRole('listbox', { hidden: true }).find((el) => !el.className.includes('opacity-0'));
      if (!openListbox) throw new Error('No open listbox');
      return openListbox;
    });
    expect(within(listbox).getByRole('option', { name: 'Tuần 1 · Đã đồng bộ', hidden: true })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'Tuần 2 · Chưa đồng bộ', hidden: true })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'Tuần 3 · Đang chờ', hidden: true })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'Tuần 4 · Đang chạy', hidden: true })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: 'Tuần 5 · Lỗi', hidden: true })).toBeInTheDocument();

    await act(async () => { fireEvent.click(within(listbox).getByRole('option', { name: 'Tuần 3 · Đang chờ', hidden: true })); });
    expect(trigger).toHaveValue('Tuần 3');
  });

  it('reflects refreshed week status when the selector is reopened', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    const initial = { week: 'w1', label: 'Tuần 1', status: 'pending' };
    const refreshed = { week: 'w1', label: 'Tuần 1', status: 'valid' };
    vi.mocked(timetableApi.getSyncStatus)
      .mockResolvedValueOnce({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'pending', weeks: [initial] }] })
      .mockResolvedValueOnce({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'valid', weeks: [refreshed] }] });
    vi.mocked(timetableApi.updateSyncSettings).mockResolvedValue({ ...settings, classLinks: [link] });

    render(<TimetableSyncPanel />);
    await screen.findByRole('combobox', { name: 'Tuần cho Lớp A' });
    openSourceConfig();
    fireEvent.click(screen.getByRole('button', { name: 'Lưu liên kết' }));
    await waitFor(() => expect(timetableApi.getSyncStatus).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('combobox', { name: 'Tuần cho Lớp A' }));
    const listbox = await waitFor(() => {
      const openListbox = screen.getAllByRole('listbox', { hidden: true }).find((el) => !el.className.includes('opacity-0'));
      if (!openListbox) throw new Error('No open listbox');
      return openListbox;
    });
    expect(within(listbox).getByRole('option', { name: 'Tuần 1 · Đã đồng bộ', hidden: true })).toBeInTheDocument();
    expect(within(listbox).queryByRole('option', { name: 'Tuần 1 · Đang chờ', hidden: true })).not.toBeInTheDocument();
  });

  it('shows request failures in the dialog and reports no completion', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    const onSynced = vi.fn();
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'missing', weeks: [{ week: 'w1', status: 'missing' }] }] });
    vi.mocked(timetableApi.syncSavedClassWeek).mockRejectedValue(new Error('Mất kết nối'));
    render(<TimetableSyncPanel onSynced={onSynced} />);
    await screen.findByRole('combobox', { name: 'Tuần cho Lớp A' });
    await selectOption('Tuần cho Lớp A', 'w1 · Chưa đồng bộ');
    fireEvent.click(screen.getByRole('button', { name: 'Đồng bộ tuần' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('Mất kết nối');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
    expect(onSynced).not.toHaveBeenCalled();
  });

  it('shows tracking failures in the dialog and prevents duplicate requests while open', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'missing', weeks: [{ week: 'w1', status: 'missing' }] }] });
    vi.mocked(timetableApi.getSavedClassWeekStatus).mockRejectedValue(new Error('Lỗi theo dõi'));
    render(<TimetableSyncPanel />);
    await screen.findByRole('combobox', { name: 'Tuần cho Lớp A' });
    await selectOption('Tuần cho Lớp A', 'w1 · Chưa đồng bộ');
    const syncButton = screen.getByRole('button', { name: 'Đồng bộ tuần' });
    fireEvent.click(syncButton);
    fireEvent.click(syncButton);
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('Lỗi theo dõi');
    expect(timetableApi.syncSavedClassWeek).toHaveBeenCalledTimes(1);
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
    const initialStatus = { settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'missing', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'missing' }] }] };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValueOnce(initialStatus).mockResolvedValue({ ...initialStatus, classStatuses: [{ ...initialStatus.classStatuses[0], status: 'valid', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'valid', lastSuccessfulUpdate: 'new' }] }] });
    vi.mocked(timetableApi.getSavedClassWeeksStatus).mockResolvedValue({ snapshotAt: 'new', items: [{ key: 'server-key', selection: { ...link, week: 'w1' }, status: 'valid', snapshotAt: 'new', lastSuccessfulUpdate: 'new', snapshotExists: true, isEmpty: false }] });
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
    expect(screen.getAllByRole('status').some((element) => element.textContent === 'Bỏ qua')).toBe(true);
    expect(screen.getByText('Đã xử lý, nhưng có cặp bị bỏ qua.')).toBeInTheDocument();
    expect(timetableApi.getSavedClassWeekStatus).not.toHaveBeenCalled();
  });

  it('does not count an unchanged valid snapshot as new progress', async () => {
    const link = { systemClassId: 'c1', year: '2026', semester: '1', className: 'A', sourceLabel: 'Lớp A', matchMethod: 'manual' as const };
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'valid', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'valid', lastSuccessfulUpdate: 'old' }] }] });
    vi.mocked(timetableApi.syncSavedClassWeeks).mockResolvedValue({ status: 'pending', total: 1, outcomes: [{ key: 'server-key', selection: { ...link, week: 'w1' }, status: 'accepted' }] });
    vi.mocked(timetableApi.getSavedClassWeeksStatus).mockResolvedValue({ snapshotAt: 'old', items: [{ key: 'server-key', selection: { ...link, week: 'w1' }, status: 'valid', snapshotAt: 'old', lastSuccessfulUpdate: 'old', snapshotExists: true, isEmpty: false }] });
    vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings: { ...settings, classLinks: [link] }, job: null, lastSuccessfulUpdate: null, classStatuses: [{ classSelection: link, weekCount: 1, targetWeeks: ['w1'], status: 'valid', weeks: [{ week: 'w1', label: 'Tuần 1', status: 'valid', lastSuccessfulUpdate: 'old' }] }] });
    render(<TimetableSyncPanel />);
    await screen.findByRole('checkbox', { name: 'Chọn lớp Lớp A' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn lớp Lớp A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chọn tuần đồng bộ' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Các tuần có thể đồng bộ' })).getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đồng bộ' }));
    await waitFor(() => expect(timetableApi.getSavedClassWeeksStatus).toHaveBeenCalledTimes(1));
    expect(screen.getByText('0/1 cặp đã xử lý')).toBeInTheDocument();
  });

  it('polls 68 accepted pairs with one aggregate status request per cycle', async () => {
    const links = Array.from({ length: 68 }, (_, index) => ({ systemClassId: `c${index}`, year: '2026', semester: '1', className: `A${index}`, sourceLabel: `Lớp ${index}`, matchMethod: 'manual' as const }));
    const classes = links.map((link) => ({ _id: link.systemClassId, class_name: link.className, class_year: '2026', dept_id: 'd1', class_type: 'Cao đẳng' }));
    const makeStatuses = (phase: 'initial' | 'pending' | 'partial' | 'final') => links.map((link, index) => ({
      classSelection: link,
      weekCount: 1,
      targetWeeks: ['w1'],
      status: phase === 'final' || (phase === 'partial' && index < 34) ? (phase === 'final' && index >= 58 ? 'failed' : 'valid') : phase === 'pending' ? 'pending' : 'missing',
      weeks: [{ week: 'w1', status: phase === 'final' && index >= 58 ? 'failed' : phase === 'final' || (phase === 'partial' && index < 34) ? 'valid' : phase === 'pending' ? 'pending' : 'missing', ...(phase === 'final' && index < 58 || phase === 'partial' && index < 34 ? { lastSuccessfulUpdate: 'new' } : {}), ...(phase === 'final' && index >= 58 ? { failure: 'SYNC_FAILED' } : {}) }],
    }));
    let statusPoll = 0;
    vi.mocked(classApi.getClasses).mockResolvedValue(classes);
    vi.mocked(timetableApi.getSyncStatus).mockImplementation(async () => {
      statusPoll += 1;
      const phase = statusPoll === 1 ? 'initial' : statusPoll === 2 ? 'pending' : 'final';
      return { settings: { ...settings, classLinks: links }, job: null, lastSuccessfulUpdate: null, classStatuses: makeStatuses(phase) };
    });
    let bulkStatusPoll = 0;
    vi.mocked(timetableApi.getSavedClassWeeksStatus).mockImplementation(async (pairs) => {
      bulkStatusPoll += 1;
      const done = bulkStatusPoll > 1;
      return { snapshotAt: done ? 'new' : 'pending', items: pairs.map((pair, index) => ({ key: `${pair.className}|${pair.week}`, selection: pair, status: done ? (index >= 58 ? 'failed' : 'valid') : 'pending', snapshotAt: done ? 'new' : null, lastSuccessfulUpdate: done ? 'new' : null, snapshotExists: done, isEmpty: false, ...(done && index >= 58 ? { failure: 'SYNC_FAILED' } : {}) })) };
    });
    vi.mocked(timetableApi.syncSavedClassWeeks).mockResolvedValue({ status: 'pending', total: 68, outcomes: links.map((link) => ({ key: `${link.className}|w1`, selection: { ...link, week: 'w1' }, status: 'accepted' as const })) });
    const { unmount } = render(<TimetableSyncPanel />);
    try {
      await screen.findByRole('checkbox', { name: 'Chọn lớp A0' });
      const pageSize = screen.getAllByRole('combobox').at(-1)!;
      fireEvent.click(pageSize);
      fireEvent.click(await screen.findByRole('option', { name: '50', hidden: true }));
      fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả lớp trên trang' }));
      fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));
      await selectOption('Tuần cho A50', 'w1 · Chưa đồng bộ');
      await selectOption('Tuần cho A67', 'w1 · Chưa đồng bộ');
      fireEvent.click(screen.getByRole('checkbox', { name: 'Chọn tất cả lớp trên trang' }));
      fireEvent.click(screen.getByRole('button', { name: 'Chọn tuần đồng bộ' }));
      fireEvent.click(within(screen.getByRole('group', { name: 'Các tuần có thể đồng bộ' })).getByRole('checkbox'));
      fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đồng bộ' }));
      await waitFor(() => expect(timetableApi.syncSavedClassWeeks).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ systemClassId: 'c67', week: 'w1' })])));
      expect(timetableApi.getSavedClassWeekStatus).not.toHaveBeenCalled();
      expect(timetableApi.getSavedClassWeeksStatus).toHaveBeenCalledTimes(1);
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 2100)); });
      expect(timetableApi.getSavedClassWeeksStatus).toHaveBeenCalledTimes(2);
      expect(screen.getByText('68/68 cặp đã xử lý')).toBeInTheDocument();
      expect(screen.getByLabelText('Kết quả từng cặp lớp-tuần')).toHaveClass('max-h-64', 'overflow-y-auto');
      expect(screen.getByLabelText('Kết quả từng cặp lớp-tuần')).toHaveTextContent('A50');
      expect(within(screen.getByLabelText('Kết quả từng cặp lớp-tuần')).getAllByRole('status')).toHaveLength(68);
      expect(within(screen.getByRole('row', { name: /A50/u, hidden: true })).getByText('Đã đồng bộ')).toBeInTheDocument();
      expect(within(screen.getByRole('row', { name: /A67/u, hidden: true })).getByText('Lỗi')).toBeInTheDocument();
      expect(screen.getAllByText('58').some((element) => element.tagName === 'STRONG')).toBe(true);
      expect(screen.getAllByText('10').some((element) => element.tagName === 'STRONG')).toBe(true);
    } finally {
      unmount();
    }
  });
});
