import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TimetableSyncPanel from './TimetableSyncPanel';
import { classApi } from '@/api/class-api';
import { timetableApi, type TimetableOptions } from '@/api/timetable-api';

vi.mock('@/providers/auth-provider', () => ({ useAuth: () => ({ user: { roleCode: 'ADMIN' } }) }));
vi.mock('@/api/class-api', () => ({ classApi: { getClasses: vi.fn() } }));
vi.mock('@/api/timetable-api', () => ({ timetableApi: { getSyncStatus: vi.fn(), loadCatalog: vi.fn(), updateSyncSettings: vi.fn(), syncSavedClassWeek: vi.fn() } }));
const catalog: TimetableOptions = { years: [{ value: '2026', label: '2026' }], semesters: [{ value: '1', label: 'Học kỳ 1' }], weeks: [{ value: 'w1', label: 'Tuần 1' }], faculties: [], courses: [], classes: [{ value: 'A', label: '  Lớp A  ' }, { value: 'B', label: 'Lớp B' }] };
const settings = { enabled: false, intervalMinutes: 60, coverage: [], selectedClasses: [], classLinks: [] };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(classApi.getClasses).mockResolvedValue([{ _id: 'c1', class_name: 'Lớp A', class_year: '2026', dept_id: 'd1', class_type: 'Cao đẳng' }]); vi.mocked(timetableApi.getSyncStatus).mockResolvedValue({ settings, job: null, lastSuccessfulUpdate: null }); vi.mocked(timetableApi.loadCatalog).mockResolvedValue(catalog); vi.mocked(timetableApi.updateSyncSettings).mockImplementation(async (value) => value); vi.mocked(timetableApi.syncSavedClassWeek).mockResolvedValue({ status: 'pending', key: 'k', selection: { year: '2026', semester: '1', className: 'A', week: 'w1' } }); });

describe('TimetableSyncPanel', () => {
  it('renders every system class and creates a normalized unique draft link without fetching schedules', async () => {
    render(<TimetableSyncPanel />);
    expect((await screen.findAllByText('Lớp A')).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('year'), { target: { value: '2026' } }); fireEvent.change(screen.getByLabelText('semester'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Đối chiếu lớp' }));
    await waitFor(() => expect(screen.getByText('Tự động (unique)')).toBeInTheDocument());
    expect(timetableApi.syncSavedClassWeek).not.toHaveBeenCalled();
  });
  it('keeps ambiguous/unmatched rows visible and saves additive links', async () => {
    vi.mocked(classApi.getClasses).mockResolvedValue([{ _id: 'c1', class_name: 'Lớp C', class_year: '2026', dept_id: 'd1', class_type: 'Cao đẳng' }]);
    render(<TimetableSyncPanel />); await screen.findByText('Lớp C');
    fireEvent.change(screen.getByLabelText('year'), { target: { value: '2026' } }); fireEvent.change(screen.getByLabelText('semester'), { target: { value: '1' } }); fireEvent.click(screen.getByRole('button', { name: 'Lưu liên kết' }));
    await waitFor(() => expect(timetableApi.updateSyncSettings).toHaveBeenCalledWith(expect.objectContaining({ classLinks: [] })));
    expect(screen.getByText('Unverified')).toBeInTheDocument();
  });
  it('supports source-only view and retains draft after a failed save', async () => {
    vi.mocked(timetableApi.updateSyncSettings).mockRejectedValue(new Error('Lưu lỗi'));
    render(<TimetableSyncPanel />); await screen.findAllByText('Lớp A'); fireEvent.change(screen.getByLabelText('year'), { target: { value: '2026' } }); fireEvent.change(screen.getByLabelText('semester'), { target: { value: '1' } }); fireEvent.click(screen.getByRole('button', { name: 'Đối chiếu lớp' })); await waitFor(() => expect(screen.getByText('Tự động (unique)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Lưu liên kết' })); await screen.findByRole('alert'); expect(screen.getByRole('combobox', { name: 'Nguồn cho Lớp A' })).toHaveValue('A');
    fireEvent.change(screen.getByLabelText('Kiểu hiển thị'), { target: { value: 'source' } }); expect(within(screen.getByRole('table')).getByText('Source-only')).toBeInTheDocument();
  });
});
