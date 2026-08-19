import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DormitoryOverviewPage from './page';
import { dormitoryApi } from '@/api/dormitory-api';

vi.mock('@/api/dormitory-api', () => ({
  dormitoryApi: {
    reports: {
      getDashboardStats: vi.fn(),
    },
  },
}));

const mockStats = {
  total_rooms: 4,
  available_rooms: 2,
  active_contracts: 2,
  pending_registrations: 1,
  unpaid_invoices: 3,
  pending_maintenance: 1,
  rooms: { occupied: 2, available: 2, air_conditioned: 2, standard: 2 },
  beds: { used: 2, free: 4 },
  students: { registered: 3, residing: 2 },
  dormitory_fees: { paid: 0, unpaid: 0 },
  utilities: { paid: 0, unpaid: 0 },
  monthly: [],
  room_summary: {
    total_rooms: 4,
    total_beds: 6,
    occupied_beds: 2,
    free_beds: 4,
    by_type: { thuong: 2, may_lanh: 2, unknown: 0 },
    by_state: { trong: 1, con_cho: 1, day: 1, bao_tri: 0, khoa: 0, chua_cau_hinh: 1 },
  },
  room_rows: [
    {
      room_id: 'r-empty',
      room_code: 'A100',
      room_name: 'Phòng A100',
      building_id: 'b1',
      building_code: 'A',
      building_name: 'Tòa A',
      room_type: 'Thường',
      total_beds: 2,
      occupied_beds: 0,
      free_beds: 2,
      state: 'Trống',
      members: [],
    },
    {
      room_id: 'r-partial',
      room_code: 'A101',
      room_name: 'Phòng A101',
      building_id: 'b1',
      building_code: 'A',
      building_name: 'Tòa A',
      room_type: 'Thường',
      total_beds: 4,
      occupied_beds: 2,
      free_beds: 2,
      state: 'Còn chỗ',
      members: [
        { full_name: 'Nguyễn Văn A', class_name: '12A1' },
        { full_name: 'Trần Thị B', class_name: 'Chưa cập nhật' },
      ],
    },
    {
      room_id: 'r-full',
      room_code: 'B201',
      room_name: 'Phòng B201',
      building_id: 'b2',
      building_code: 'B',
      building_name: 'Tòa B',
      room_type: 'Máy lạnh',
      total_beds: 0,
      occupied_beds: 0,
      free_beds: 0,
      state: 'Chưa cấu hình',
      members: [],
    },
    {
      room_id: 'r-unknown',
      room_code: 'B202',
      room_name: 'Phòng B202',
      building_id: 'b2',
      building_code: 'B',
      building_name: 'Tòa B',
      room_type: 'Máy lạnh',
      total_beds: 2,
      occupied_beds: 2,
      free_beds: 0,
      state: 'Đầy',
      members: [
        { full_name: 'Lê Văn C', class_name: '11B3' },
        { full_name: 'Phạm Thị D', class_name: '11B3' },
      ],
    },
  ],
  registration_summary: {
    total: 5,
    assigned: 2,
    male: 2,
    female: 2,
    unlinked: 1,
    unassigned: 2,
    requested_room_type: { thuong: 3, may_lanh: 2, unknown: 0 },
  },
  invoice_summary: {
    outstanding_invoice_count: 3,
    unpaid_count: 2,
    overdue_count: 1,
    total_outstanding_amount: 350000,
    anomaly_amount: 100000,
    anomaly_count: 1,
    rows: [
      { room_id: 'r-partial', room_code: 'A101', room_name: 'Phòng A101', building_name: 'Tòa A', debtor_count: 2, unpaid_count: 2, overdue_count: 1, total_outstanding_amount: 350000 },
    ],
  },
};

describe('DormitoryOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockResolvedValue(mockStats as any);
  });

  it('renders room totals, derived room states, debt rows and registration summary', async () => {
    render(<DormitoryOverviewPage />);

    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());

    expect(screen.getByText('Phòng Thường')).toBeInTheDocument();
    expect(screen.getByText('Phòng Máy lạnh')).toBeInTheDocument();
    expect(screen.getByText('Tổng danh sách KTX')).toBeInTheDocument();
    expect(screen.getByText('Còn trống: 4 giường')).toBeInTheDocument();
    expect(screen.getByText('Còn trống: 0 giường')).toBeInTheDocument();
    expect(screen.getByText('Phòng A100')).toBeInTheDocument();
    expect(screen.getByLabelText('Trống, 0% đã sử dụng')).toBeInTheDocument();
    expect(screen.getByLabelText('Còn chỗ, 50% đã sử dụng')).toBeInTheDocument();
    expect(screen.getByText('Công nợ theo phòng')).toBeInTheDocument();
    expect(screen.getAllByText((content) => content.includes('350.000')).length).toBe(2);
    expect(screen.getByText('Tóm tắt đăng ký')).toBeInTheDocument();
    expect(screen.getByText('Đã xếp phòng')).toBeInTheDocument();
    expect(screen.getByText('Nam')).toBeInTheDocument();
    expect(screen.getByText('Nữ')).toBeInTheDocument();
    expect(screen.getAllByText('Máy lạnh').length).toBeGreaterThan(1);
  });

  it('searches room names and puts empty rooms first', async () => {
    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());

    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('A100');
    expect(rows[1]).toHaveTextContent('0%');
    expect(rows[1]).toHaveAttribute('class', expect.stringContaining('hover:bg-slate-50'));

    fireEvent.change(screen.getByLabelText('Tìm phòng'), { target: { value: 'B202' } });
    expect(screen.getByText('Phòng B202')).toBeInTheDocument();
    expect(screen.queryByText('Phòng A100')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Lọc theo tòa nhà')).not.toBeInTheDocument();
    expect(screen.queryByText('Tòa nhà')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Đầy, 100% đã sử dụng')).toBeInTheDocument();
  });

  it('renders room members column with accessible Chi tiết buttons', async () => {
    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());

    expect(screen.getByRole('columnheader', { name: 'Thành viên' })).toBeInTheDocument();
    expect(screen.getByLabelText('Xem thành viên phòng A100')).toBeInTheDocument();
    expect(screen.getByLabelText('Xem thành viên phòng A101')).toBeInTheDocument();
  });

  it('opens member modal with full_name, class_name, handles fallback and closes properly', async () => {
    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());

    // Click Chi tiết for room A101 (has 2 members, one with missing class)
    fireEvent.click(screen.getByLabelText('Xem thành viên phòng A101'));

    expect(screen.getByText('Thành viên phòng A101')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Họ tên' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Lớp' })).toBeInTheDocument();
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();
    expect(screen.getByText('12A1')).toBeInTheDocument();
    expect(screen.getByText('Trần Thị B')).toBeInTheDocument();
    expect(screen.getByText('Chưa cập nhật')).toBeInTheDocument();

    // Close via close button
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }));
    await waitFor(() => expect(screen.queryByText('Thành viên phòng A101')).not.toBeInTheDocument());
  });

  it('shows empty state when room has no members and closes on Escape', async () => {
    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());

    // Click Chi tiết for empty room A100
    fireEvent.click(screen.getByLabelText('Xem thành viên phòng A100'));

    expect(screen.getByText('Thành viên phòng A100')).toBeInTheDocument();
    expect(screen.getByText('Chưa có thành viên nào trong phòng này.')).toBeInTheDocument();

    // Close via Escape key
    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    await waitFor(() => expect(screen.queryByText('Thành viên phòng A100')).not.toBeInTheDocument());
  });

  it('refreshes visible data on an interval without overlapping requests', async () => {
    vi.useFakeTimers();
    try {
      const view = render(<DormitoryOverviewPage />);
      await vi.waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());
      expect(dormitoryApi.reports.getDashboardStats).toHaveBeenCalledTimes(1);

      let resolveRefresh!: (value: any) => void;
      vi.mocked(dormitoryApi.reports.getDashboardStats).mockImplementationOnce(
        () => new Promise((resolve) => { resolveRefresh = resolve; }),
      );
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(dormitoryApi.reports.getDashboardStats).toHaveBeenCalledTimes(2);
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(dormitoryApi.reports.getDashboardStats).toHaveBeenCalledTimes(2);
      await act(async () => { resolveRefresh(mockStats); });
      view.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows explicit empty and total failure states', async () => {
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockResolvedValueOnce({
      ...mockStats,
      room_rows: [],
      invoice_summary: { ...mockStats.invoice_summary, rows: [], outstanding_invoice_count: 0, total_outstanding_amount: 0 },
    } as any);
    const { unmount } = render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Không có phòng phù hợp với tìm kiếm.')).toBeInTheDocument());
    expect(screen.getByText('Không có phòng nào đang có hóa đơn chưa thu.')).toBeInTheDocument();
    unmount();

    vi.mocked(dormitoryApi.reports.getDashboardStats).mockRejectedValueOnce(new Error('Mất kết nối'));
    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Không thể tải dữ liệu KTX')).toBeInTheDocument());
    expect(screen.getByText('Mất kết nối')).toBeInTheDocument();
  });

  it('warns when a cached response is structurally partial', async () => {
    const partial = { ...mockStats, invoice_summary: undefined };
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockResolvedValueOnce(partial as any);

    render(<DormitoryOverviewPage />);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Một phần báo cáo chưa có dữ liệu'));
  });
});
