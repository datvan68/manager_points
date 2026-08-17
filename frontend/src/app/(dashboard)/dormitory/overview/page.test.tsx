import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    { room_id: 'r-empty', room_code: 'A100', room_name: 'Phòng A100', building_id: 'b1', building_code: 'A', building_name: 'Tòa A', room_type: 'Thường', total_beds: 2, occupied_beds: 0, free_beds: 2, state: 'Trống' },
    { room_id: 'r-partial', room_code: 'A101', room_name: 'Phòng A101', building_id: 'b1', building_code: 'A', building_name: 'Tòa A', room_type: 'Thường', total_beds: 4, occupied_beds: 2, free_beds: 2, state: 'Còn chỗ' },
    { room_id: 'r-full', room_code: 'B201', room_name: 'Phòng B201', building_id: 'b2', building_code: 'B', building_name: 'Tòa B', room_type: 'Máy lạnh', total_beds: 0, occupied_beds: 0, free_beds: 0, state: 'Chưa cấu hình' },
    { room_id: 'r-unknown', room_code: 'B202', room_name: 'Phòng B202', building_id: 'b2', building_code: 'B', building_name: 'Tòa B', room_type: 'Máy lạnh', total_beds: 0, occupied_beds: 0, free_beds: 0, state: 'Đầy' },
  ],
  registration_summary: {
    total: 5,
    pending_confirmation: 1,
    pending_approval: 2,
    approved_unassigned: 1,
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
    expect(screen.getByText('Phòng A100')).toBeInTheDocument();
    expect(screen.getAllByText('Trống').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Còn chỗ').length).toBeGreaterThan(1);
    expect(screen.getByText('Công nợ theo phòng')).toBeInTheDocument();
    expect(screen.getAllByText((content) => content.includes('350.000')).length).toBe(2);
    expect(screen.getByText('Tóm tắt đăng ký')).toBeInTheDocument();
    expect(screen.getByText('Chờ xác nhận')).toBeInTheDocument();
  });

  it('filters named rooms by building and operational state', async () => {
    render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Lọc theo tòa nhà'), { target: { value: 'Tòa B' } });
    fireEvent.change(screen.getByLabelText('Lọc theo trạng thái'), { target: { value: 'Đầy' } });

    expect(screen.getByText('Phòng B202')).toBeInTheDocument();
    expect(screen.queryByText('Phòng A100')).not.toBeInTheDocument();
  });

  it('shows explicit empty and total failure states', async () => {
    vi.mocked(dormitoryApi.reports.getDashboardStats).mockResolvedValueOnce({
      ...mockStats,
      room_rows: [],
      invoice_summary: { ...mockStats.invoice_summary, rows: [], outstanding_invoice_count: 0, total_outstanding_amount: 0 },
    } as any);
    const { unmount } = render(<DormitoryOverviewPage />);
    await waitFor(() => expect(screen.getByText('Không có phòng phù hợp với bộ lọc.')).toBeInTheDocument());
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
