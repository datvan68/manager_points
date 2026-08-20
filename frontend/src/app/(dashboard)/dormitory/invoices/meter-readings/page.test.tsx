import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MeterReadingsPage from './page';
import { dormitoryApi } from '@/api/dormitory-api';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

vi.mock('@/api/dormitory-api', () => ({
  dormitoryApi: {
    invoices: {
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

const mockConfig = {
  electricity: { quota_per_person: 15, unit_price: 2500, unit: 'kWh' },
  water: { quota_per_person: 4, unit_price: 10000, unit: 'm³' },
  configured_collection_days: 10,
};

const mockRoomsData = [
  {
    room_id: 'room-1',
    room: {
      _id: 'room-1',
      room_code: 'P101',
      room_name: 'Phòng 101',
      building_id: { _id: 'b-1', name: 'Tòa A', building_code: 'A' },
    },
    occupant_count: 2,
    status: 'unrecorded',
    previous_readings: {
      electricity: 100,
      water: 20,
    },
  },
  {
    room_id: 'room-2',
    room: {
      _id: 'room-2',
      room_code: 'P102',
      room_name: 'Phòng 102',
      building_id: { _id: 'b-1', name: 'Tòa A', building_code: 'A' },
    },
    occupant_count: 3,
    status: 'recorded',
    invoice_id: 'inv-2',
    invoice_code: 'INV-002',
    invoice_status: 'Chưa thu',
    previous_readings: {
      electricity: 200,
      water: 30,
    },
    current_readings: {
      electricity: 260,
      water: 45,
    },
    total_amount: 85000,
  },
  {
    room_id: 'room-3',
    room: {
      _id: 'room-3',
      room_code: 'P103',
      room_name: 'Phòng 103',
      building_id: { _id: 'b-1', name: 'Tòa A', building_code: 'A' },
    },
    occupant_count: 0,
    status: 'unrecorded',
    previous_readings: {
      electricity: 0,
      water: 0,
    },
  },
];

describe('Dormitory Meter Readings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dormitoryApi.invoices.getMeterReadings as any).mockResolvedValue({
      config: mockConfig,
      billing_month: '2026-03',
      rooms: mockRoomsData,
    });
    (dormitoryApi.invoices.saveBulkMeterReadings as any).mockResolvedValue({
      results: [
        {
          room_id: 'room-1',
          success: true,
          invoice: {
            _id: 'new-inv-1',
            invoice_code: 'INV-NEW-1',
            status: 'Chưa thu',
            total_amount: 50000,
          },
        },
      ],
    });
  });

  it('renders all rooms as vertical cards without building name or occupant count badge (Requirement 1)', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/Phòng 101/i)).toBeDefined();
      expect(screen.getByText(/Phòng 102/i)).toBeDefined();
      expect(screen.getByText(/Phòng 103/i)).toBeDefined();
    });

    // Check that there is no <table> in the room cards area
    expect(screen.queryByRole('table')).toBeNull();

    // Check presence of room cards by test id
    expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    expect(screen.getByTestId('room-card-room-2')).toBeDefined();
    expect(screen.getByTestId('room-card-room-3')).toBeDefined();

    // Requirement 1: no '(Tòa A)' or 'người ở' badge
    const card1 = screen.getByTestId('room-card-room-1');
    expect(card1.textContent).not.toContain('người ở');
    expect(card1.textContent).not.toContain('(Tòa A)');
  });

  it('does not render search input, filter select, or "Cấu hình áp dụng" block (AC-04, AC-05)', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    });

    // Verify search input is not in the DOM
    expect(screen.queryByPlaceholderText(/Tìm theo tên phòng/i)).toBeNull();

    // Verify filter select is not in the DOM
    expect(screen.queryByRole('combobox')).toBeNull();

    // Verify "Cấu hình áp dụng" block is not rendered
    expect(screen.queryByText(/Cấu hình áp dụng:/i)).toBeNull();
  });

  it('displays status as "Đã lưu" / "Chưa lưu" and does not display consumption/quota/excess boxes (Requirements 2, 4)', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    });

    const card1 = screen.getByTestId('room-card-room-1');
    const card2 = screen.getByTestId('room-card-room-2');

    // Requirement 2: 'Chưa lưu' / 'Đã lưu'
    expect(card1.textContent).toContain('Chưa lưu');
    expect(card2.textContent).toContain('Đã lưu');

    // Requirement 4: Bỏ Tiêu thụ / Định mức / Vượt
    expect(card1.textContent).not.toContain('Tiêu thụ:');
    expect(card1.textContent).not.toContain('Định mức:');
    expect(card1.textContent).not.toContain('Vượt:');

    // Check previous readings in disabled inputs
    const disabledInputs = card1.querySelectorAll('input[disabled]');
    expect((disabledInputs[0] as HTMLInputElement).value).toBe('100');
    expect((disabledInputs[1] as HTMLInputElement).value).toBe('20');

    // Check exactly 2 inputs for new readings
    const elecInput = screen.getByLabelText(/Số điện mới Phòng 101/i);
    const waterInput = screen.getByLabelText(/Số nước mới Phòng 101/i);
    expect(elecInput).toBeDefined();
    expect(waterInput).toBeDefined();
  });

  it('shows inline error on card when new reading is smaller than previous reading', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    });

    const elecInput = screen.getByLabelText(/Số điện mới Phòng 101/i);
    // Previous electricity is 100, entering 90 should be invalid
    fireEvent.change(elecInput, { target: { value: '90' } });

    await waitFor(() => {
      expect(screen.getByText(/Chỉ số mới không được nhỏ hơn chỉ số cũ \(100\)/i)).toBeDefined();
    });
  });

  it('calculates progress accurately based on all rooms', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    });

    // 1 recorded out of 3 total rooms = 33%
    expect(screen.getByText(/Tiến độ: 1 \/ 3 phòng \(33%\)/i)).toBeDefined();
  });

  it('automatically saves card data on input blur when both readings are valid (Requirement 3)', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    });

    const elecInput = screen.getByLabelText(/Số điện mới Phòng 101/i);
    const waterInput = screen.getByLabelText(/Số nước mới Phòng 101/i);

    fireEvent.change(elecInput, { target: { value: '150' } });
    fireEvent.change(waterInput, { target: { value: '30' } });
    fireEvent.blur(waterInput);

    await waitFor(() => {
      expect(dormitoryApi.invoices.saveBulkMeterReadings).toHaveBeenCalledWith({
        billing_month: expect.any(String),
        readings: [
          {
            room_id: 'room-1',
            electricity_reading: 150,
            water_reading: 30,
            is_exempt: false,
            notes: '',
          },
        ],
      });
    });

    // Verify status updates
    await waitFor(() => {
      const card1 = screen.getByTestId('room-card-room-1');
      expect(card1.textContent).toContain('Đã lưu');
    });
  });

  it('does not render manual update button or "Lưu tất cả hợp lệ" button (Requirements 3, 5)', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    });

    // No 'Lưu tất cả hợp lệ' button
    expect(screen.queryByRole('button', { name: /Lưu tất cả hợp lệ/i })).toBeNull();
    // No manual 'Cập nhật' or 'Lưu phòng này' button inside card
    expect(screen.queryByRole('button', { name: /Cập nhật/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Lưu phòng này/i })).toBeNull();
  });

  it('navigates back to /dormitory/invoices on clicking back button', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTitle(/Quay lại danh sách hóa đơn/i)).toBeDefined();
    });

    const backBtn = screen.getByTitle(/Quay lại danh sách hóa đơn/i);
    fireEvent.click(backBtn);

    expect(mockPush).toHaveBeenCalledWith('/dormitory/invoices');
  });

  it('opens CustomCalendar popover on clicking the billing month calendar button', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Chọn kỳ thu/i })).toBeDefined();
    });

    const calendarBtn = screen.getByRole('button', { name: /Chọn kỳ thu/i });
    fireEvent.click(calendarBtn);

    await waitFor(() => {
      expect(screen.getByText('T2')).toBeDefined();
      expect(screen.getByText('CN')).toBeDefined();
    });
  });
});
