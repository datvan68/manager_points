import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DormitoryOverviewPage from './page';
import { dormitoryApi } from '@/api/dormitory-api';

let capturedOnInvalidate: ((event?: any) => void) | null = null;

vi.mock('@/api/dormitory-api', () => ({
  dormitoryApi: {
    reports: {
      getDashboardStats: vi.fn(),
    },
  },
}));

vi.mock('@/hooks/useDormitoryOverviewRealtime', () => ({
  useDormitoryOverviewRealtime: vi.fn((opts: any) => {
    capturedOnInvalidate = opts.onInvalidate;
    return { status: 'connected' };
  }),
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

let compactViewport = false;

describe('DormitoryOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    compactViewport = false;
    capturedOnInvalidate = null;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(() => ({ matches: compactViewport, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    });
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockResolvedValue(mockStats as any);
  });

  it('renders room totals, derived room states, and registration summary without room debt', async () => {
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
    expect(screen.queryByText('Công nợ theo phòng')).not.toBeInTheDocument();
    expect(screen.queryByText('Không có phòng nào đang có hóa đơn chưa thu.')).not.toBeInTheDocument();
    expect(screen.getByText('Tóm tắt đăng ký')).toBeInTheDocument();
    expect(screen.getByText('Đã xếp phòng')).toBeInTheDocument();
    expect(screen.getByText('Nam')).toBeInTheDocument();
    expect(screen.getByText('Nữ')).toBeInTheDocument();
    expect(screen.getAllByText('Máy lạnh').length).toBeGreaterThan(1);
  });

  it('shows concise room cards below lg', async () => {
    compactViewport = true;
    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
    expect(screen.getByText('A100', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Trống', { exact: true })).toBeInTheDocument();
    expect(screen.getAllByText((_, element) => element?.tagName === 'P' && element.textContent === 'Thường · Còn 2 chỗ')).toHaveLength(2);
    expect(screen.queryByText('Phòng A100', { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Xem thành viên phòng A101' })).toBeInTheDocument();
    expect(screen.queryByText('Công nợ theo phòng')).not.toBeInTheDocument();
  });

  it('progressively reveals mobile rooms in batches with a keyboard-operable fallback', async () => {
    compactViewport = true;
    const manyRooms = Array.from({ length: 25 }, (_, index) => ({
      ...mockStats.room_rows[0],
      room_id: `r-${index}`,
      room_code: `A${String(100 + index)}`,
      room_name: `Phòng A${String(100 + index)}`,
    }));
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockResolvedValueOnce({
      ...mockStats,
      room_rows: manyRooms,
    } as any);

    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());

    expect(screen.getByText('A100', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('A119', { exact: true })).toBeInTheDocument();
    expect(screen.queryByText('A120', { exact: true })).not.toBeInTheDocument();

    const loadMore = screen.getByRole('button', { name: 'Xem thêm phòng (5 còn lại)' });
    loadMore.focus();
    expect(loadMore).toHaveFocus();
    fireEvent.click(loadMore);

    expect(screen.getByText('A124', { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Xem thêm phòng/ })).not.toBeInTheDocument();
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

  it('performs single initial fetch and does not poll on intervals', async () => {
    let view: any;
    await act(async () => {
      view = render(<DormitoryOverviewPage />);
    });
    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());
    expect(dormitoryApi.reports.getDashboardStats).toHaveBeenCalledTimes(1);

    view.unmount();
  });

  it('reconciles on realtime invalidation without flashing skeleton, keeps search text and updates modal members', async () => {
    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());

    // Set search text
    fireEvent.change(screen.getByLabelText('Tìm phòng'), { target: { value: 'A101' } });
    expect(screen.getByText('Phòng A101')).toBeInTheDocument();

    // Open detail modal for A101
    fireEvent.click(screen.getByLabelText('Xem thành viên phòng A101'));
    expect(screen.getByText('Nguyễn Văn A')).toBeInTheDocument();

    // Mock updated stats with new member added to A101
    const updatedStats = {
      ...mockStats,
      room_rows: mockStats.room_rows.map((row) =>
        row.room_id === 'r-partial'
          ? {
              ...row,
              members: [
                ...row.members,
                { full_name: 'Sinh Viên Mới', class_name: '10C1' },
              ],
            }
          : row,
      ),
    };
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockResolvedValueOnce(updatedStats as any);

    // Trigger realtime invalidation event
    await act(async () => {
      capturedOnInvalidate?.({ type: 'dormitory_overview.invalidated', domain: 'roster' });
    });

    // Content updates seamlessly
    await waitFor(() => expect(screen.getByText('Sinh Viên Mới')).toBeInTheDocument());

    // Skeleton is NOT shown
    expect(screen.queryByLabelText('Đang tải tổng quan KTX')).not.toBeInTheDocument();

    // Search value is preserved
    expect((screen.getByLabelText('Tìm phòng') as HTMLInputElement).value).toBe('A101');

    // Dialog stays open with new member
    expect(screen.getByText('Thành viên phòng A101')).toBeInTheDocument();
    expect(screen.getByText('10C1')).toBeInTheDocument();
  });

  it('queues trailing refresh if invalidation event arrives during in-flight fetch', async () => {
    let resolveFirstFetch!: (value: any) => void;
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockImplementationOnce(
      () => new Promise((resolve) => { resolveFirstFetch = resolve; }),
    );

    render(<DormitoryOverviewPage />);

    // Invalidation arrives while 1st fetch is in-flight
    await act(async () => {
      capturedOnInvalidate?.({ type: 'dormitory_overview.invalidated', domain: 'rooms' });
    });

    // Resolve 1st fetch
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockResolvedValueOnce(mockStats as any);
    await act(async () => {
      resolveFirstFetch(mockStats);
    });

    // Should have automatically triggered 2nd queued fetch
    await waitFor(() => expect(dormitoryApi.reports.getDashboardStats).toHaveBeenCalledTimes(2));
  });

  it('shows explicit empty and total failure states', async () => {
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockResolvedValueOnce({
      ...mockStats,
      room_rows: [],
    } as any);
    const { unmount } = render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Không có phòng phù hợp với tìm kiếm.')).toBeInTheDocument());
    expect(screen.queryByText('Không có phòng nào đang có hóa đơn chưa thu.')).not.toBeInTheDocument();
    unmount();

    vi.mocked(dormitoryApi.reports.getDashboardStats).mockRejectedValueOnce(new Error('Mất kết nối'));
    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Không thể tải dữ liệu KTX')).toBeInTheDocument());
    expect(screen.getByText('Mất kết nối')).toBeInTheDocument();
  });

  it('retains stale data when background refresh fails', async () => {
    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());

    vi.mocked(dormitoryApi.reports.getDashboardStats).mockRejectedValueOnce(new Error('Lỗi máy chủ tạm thời'));

    await act(async () => {
      capturedOnInvalidate?.({ type: 'dormitory_overview.invalidated', domain: 'invoices' });
    });

    // Stale data is retained and error banner is displayed
    expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument();
    expect(screen.getByText('Phòng A100')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Dữ liệu hiển thị từ lần tải trước: Lỗi máy chủ tạm thời');
  });

  it('warns when a cached response is structurally partial', async () => {
    const partial = { ...mockStats, invoice_summary: undefined };
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockResolvedValueOnce(partial as any);

    render(<DormitoryOverviewPage />);

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Một phần báo cáo chưa có dữ liệu'));
  });
});
