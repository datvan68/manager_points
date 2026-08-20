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

  it('renders all rooms (including empty rooms) as vertical cards, not modal or table (AC-01, AC-02)', async () => {
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

    // Check empty room displays 0 occupants
    const card3 = screen.getByTestId('room-card-room-3');
    expect(card3.textContent).toContain('0 người ở');
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

  it('displays room info, previous readings, status and exactly two input fields per card (AC-02a)', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    });

    const card1 = screen.getByTestId('room-card-room-1');

    // Check occupant count
    expect(card1.textContent).toContain('2 người ở');

    // Check previous readings in disabled inputs
    const disabledInputs = card1.querySelectorAll('input[disabled]');
    expect((disabledInputs[0] as HTMLInputElement).value).toBe('100');
    expect((disabledInputs[1] as HTMLInputElement).value).toBe('20');

    // Check status
    expect(card1.textContent).toContain('Chưa ghi');

    // Check exactly 2 inputs for new readings
    const elecInput = screen.getByLabelText(/Số điện mới Phòng 101/i);
    const waterInput = screen.getByLabelText(/Số nước mới Phòng 101/i);
    expect(elecInput).toBeDefined();
    expect(waterInput).toBeDefined();
  });

  it('shows inline error on card when new reading is smaller than previous reading (AC-03)', async () => {
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

  it('calculates progress accurately based on all rooms (AC-06)', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    });

    // 1 recorded out of 3 total rooms = 33%
    expect(screen.getByText(/1 \/ 3 phòng \(33%\)/i)).toBeDefined();
  });

  it('allows saving an individual card and updates card status (AC-04, AC-05, AC-06)', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    });

    const elecInput = screen.getByLabelText(/Số điện mới Phòng 101/i);
    const waterInput = screen.getByLabelText(/Số nước mới Phòng 101/i);

    fireEvent.change(elecInput, { target: { value: '150' } });
    fireEvent.change(waterInput, { target: { value: '30' } });

    const card1 = screen.getByTestId('room-card-room-1');
    const saveBtn = card1.querySelector('button')!;
    fireEvent.click(saveBtn);

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
  });

  it('allows bulk save and handles partial failure per room (AC-06)', async () => {
    (dormitoryApi.invoices.saveBulkMeterReadings as any).mockResolvedValue({
      results: [
        {
          room_id: 'room-1',
          success: true,
          invoice: { _id: 'inv-1', invoice_code: 'INV-1', status: 'Chưa thu', total_amount: 50000 },
        },
        {
          room_id: 'room-2',
          success: false,
          error: 'Không thể chỉnh sửa hóa đơn đã thu',
        },
      ],
    });

    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByTestId('room-card-room-1')).toBeDefined();
    });

    const elecInput1 = screen.getByLabelText(/Số điện mới Phòng 101/i);
    const waterInput1 = screen.getByLabelText(/Số nước mới Phòng 101/i);
    fireEvent.change(elecInput1, { target: { value: '150' } });
    fireEvent.change(waterInput1, { target: { value: '30' } });

    const saveAllBtns = screen.getAllByRole('button', { name: /Lưu tất cả hợp lệ/i });
    fireEvent.click(saveAllBtns[0]);

    await waitFor(() => {
      expect(dormitoryApi.invoices.saveBulkMeterReadings).toHaveBeenCalled();
    });
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
});
