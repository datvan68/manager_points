import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InvoicesPage from './page';
import { dormitoryApi } from '@/api/dormitory-api';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/api/dormitory-api', () => ({
  dormitoryApi: {
    rooms: {
      getAll: vi.fn(),
    },
    invoices: {
      getAll: vi.fn(),
      getOne: vi.fn(),
      createMonthly: vi.fn(),
      updateMonthly: vi.fn(),
      getRoomInfo: vi.fn(),
      uploadProof: vi.fn(),
      pay: vi.fn(),
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      getMeterReadings: vi.fn(),
      saveBulkMeterReadings: vi.fn(),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

const mockRooms = [
  {
    _id: 'room-1',
    room_code: 'P101',
    room_name: 'Phòng 101',
    building_id: { _id: 'b-1', name: 'Tòa A', building_code: 'A' },
  },
];

const mockInvoices = [
  {
    _id: 'inv-unpaid',
    invoice_code: 'INV-UNPAID',
    room_id: {
      _id: 'room-1',
      room_code: 'P101',
      room_name: 'Phòng 101',
      building_id: { name: 'Tòa A' },
    },
    billing_month: '2026-03',
    reading_date: '2026-03-25',
    occupant_count: 2,
    electricity: {
      previous_reading: 100,
      current_reading: 150,
      consumption: 50,
      quota_per_person: 15,
      quota_total: 30,
      excess_consumption: 20,
      unit_price: 2500,
      amount: 50000,
    },
    water: {
      previous_reading: 10,
      current_reading: 20,
      consumption: 10,
      quota_per_person: 4,
      quota_total: 8,
      excess_consumption: 2,
      unit_price: 10000,
      amount: 20000,
    },
    total_amount: 70000,
    status: 'Chưa thu',
    due_date: '2026-04-05',
  },
  {
    _id: 'inv-paid',
    invoice_code: 'INV-PAID',
    room_id: {
      _id: 'room-1',
      room_code: 'P101',
      room_name: 'Phòng 101',
      building_id: { name: 'Tòa A' },
    },
    billing_month: '2026-02',
    reading_date: '2026-02-25',
    occupant_count: 2,
    electricity: { amount: 30000, consumption: 40 },
    water: { amount: 10000, consumption: 9 },
    total_amount: 40000,
    status: 'Đã thu',
    due_date: '2026-03-05',
    paid_at: '2026-03-01T10:00:00.000Z',
    payment_method: 'Chuyển khoản',
    payment_proof: {
      url: '/uploads/proof-paid.png',
      file_name: 'proof-paid.png',
      mime_type: 'image/png',
      size: 102400,
    },
    confirmed_by_id: {
      user_name: 'admin',
      full_name: 'Quản trị viên',
    },
    notes: 'Đã thanh toán đúng hạn',
  },
];

describe('Dormitory Invoices Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dormitoryApi.rooms.getAll as any).mockResolvedValue({ data: mockRooms, meta: { total: 1 } });
    (dormitoryApi.invoices.getAll as any).mockResolvedValue({
      data: mockInvoices,
      meta: { total: 2, page: 1, limit: 50, totalPages: 1 },
    });
    (dormitoryApi.invoices.getRoomInfo as any).mockResolvedValue({
      room: mockRooms[0],
      occupant_count: 2,
      occupants: [],
      last_readings: { electricity: 150, water: 20 },
    });
    (dormitoryApi.invoices.getConfig as any).mockResolvedValue({
      electricity: { quota_per_person: 15, unit_price: 2500, unit: 'kWh' },
      water: { quota_per_person: 4, unit_price: 10000, unit: 'm³' },
      configured_collection_days: 10,
    });
  });

  it('renders the 7 standard table columns (AC-08)', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Phòng 101 (Tòa A)').length).toBe(2);
    });

    // Check table headers
    expect(screen.getByText('Phòng')).toBeDefined();
    expect(screen.getByText('Kỳ thu')).toBeDefined();
    expect(screen.getByText('Tiền điện')).toBeDefined();
    expect(screen.getByText('Tiền nước')).toBeDefined();
    expect(screen.getByText('Tổng tiền')).toBeDefined();
    expect(screen.getByText('Trạng thái')).toBeDefined();
    expect(screen.getByText('Thao tác')).toBeDefined();
  });

  it('displays exactly two business statuses: Chưa thu and Đã thu', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Chưa thu').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Đã thu').length).toBeGreaterThan(0);
    });
  });

  it('does not have text button "Lập đợt thu", has Advanced icon button and "Ghi điện nước" button (AC-01, AC-02)', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ghi điện nước/i })).toBeDefined();
    });

    // Verify text button "Lập đợt thu" is gone
    expect(screen.queryByRole('button', { name: /^Lập đợt thu$/i })).toBeNull();

    // Verify Advanced icon button exists with accessible name
    const configBtn = screen.getByRole('button', { name: /Cấu hình định mức & đơn giá/i });
    expect(configBtn).toBeDefined();
  });

  it('opens Utility Config modal on clicking Advanced icon button (AC-01)', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cấu hình định mức & đơn giá/i })).toBeDefined();
    });

    const configBtn = screen.getByRole('button', { name: /Cấu hình định mức & đơn giá/i });
    fireEvent.click(configBtn);

    await waitFor(() => {
      expect(screen.getByText('Cấu hình định mức & đơn giá điện - nước')).toBeDefined();
      expect(screen.getByText(/Số ngày thu tự động/i)).toBeDefined();
    });
  });

  it('navigates to /dormitory/invoices/meter-readings on clicking "Ghi điện nước" (AC-02)', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ghi điện nước/i })).toBeDefined();
    });

    const meterReadingsBtn = screen.getByRole('button', { name: /Ghi điện nước/i });
    fireEvent.click(meterReadingsBtn);

    expect(mockPush).toHaveBeenCalledWith('/dormitory/invoices/meter-readings');
  });

  it('opens Pay Modal on clicking Thu tiền', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Thu tiền/i })).toBeDefined();
    });

    const payBtn = screen.getByRole('button', { name: /Thu tiền/i });
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(screen.getByText('Xác nhận thu tiền')).toBeDefined();
      expect(screen.getByText('Phương thức thanh toán')).toBeDefined();
    });
  });

  it('opens Proof Modal on clicking Đã thu badge', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đã thu/i })).toBeDefined();
    });

    const paidBadge = screen.getByRole('button', { name: /Đã thu/i });
    fireEvent.click(paidBadge);

    await waitFor(() => {
      expect(screen.getByText('Chi tiết chứng từ thanh toán')).toBeDefined();
      expect(screen.getByText('Đã thanh toán đúng hạn')).toBeDefined();
    });
  });

  it('renders CustomPagination with total items and allows switching to Card View', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Phòng 101 (Tòa A)').length).toBe(2);
    });

    // Check pagination summary
    expect(screen.getByText(/Hiển thị 1-2 trên tổng số 2 hóa đơn/i)).toBeDefined();

    // Toggle to Card View
    const cardViewBtn = screen.getByRole('button', { name: /Xem dạng thẻ/i });
    fireEvent.click(cardViewBtn);

    // In card view, room name and invoices are still displayed
    await waitFor(() => {
      expect(screen.getAllByText('Phòng 101 (Tòa A)').length).toBe(2);
      expect(screen.getAllByText('Tiền điện').length).toBe(2);
      expect(screen.getAllByText('Tiền nước').length).toBe(2);
    });

    // Toggle back to Table View
    const tableViewBtn = screen.getByRole('button', { name: /Xem dạng bảng/i });
    fireEvent.click(tableViewBtn);

    expect(screen.getByText('Phòng')).toBeDefined();
    expect(screen.getByText('Tổng tiền')).toBeDefined();
  });

  it('opens CustomCalendar popover when clicking the calendar filter button', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Lọc theo kỳ thu/i })).toBeDefined();
    });

    const calendarBtn = screen.getByRole('button', { name: /Lọc theo kỳ thu/i });
    fireEvent.click(calendarBtn);

    // Calendar weekdays or month header should be visible
    await waitFor(() => {
      expect(screen.getByText('T2')).toBeDefined();
      expect(screen.getByText('CN')).toBeDefined();
    });
  });
});

