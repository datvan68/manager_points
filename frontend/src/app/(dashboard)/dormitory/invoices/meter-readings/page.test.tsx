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

const mockMeterReadingsData = {
  config: {
    electricity: { quota_per_person: 15, unit_price: 2500, unit: 'kWh' },
    water: { quota_per_person: 4, unit_price: 10000, unit: 'm³' },
    configured_collection_days: 10,
  },
  billing_month: '2026-03',
  rooms: [
    {
      room_id: 'room-1',
      room: {
        _id: 'room-1',
        room_code: 'P101',
        room_name: 'Phòng 101',
        building_id: { _id: 'b-1', name: 'Tòa A', building_code: 'A' },
      },
      occupant_count: 2,
      previous_readings: {
        electricity: 100,
        water: 10,
      },
      current_readings: {
        electricity: 150,
        water: 20,
      },
      status: 'unrecorded',
    },
  ],
};

describe('Dormitory Meter Readings Page (AC-10)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dormitoryApi.invoices.getMeterReadings as any).mockResolvedValue(mockMeterReadingsData);
    (dormitoryApi.invoices.saveBulkMeterReadings as any).mockResolvedValue({
      results: [{ room_id: 'room-1', success: true }],
    });
  });

  it('renders page header with back button and room cards', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Ghi chỉ số điện - nước KTX')).toBeDefined();
      expect(screen.getByText('Phòng 101')).toBeDefined();
    });

    // Check back button navigation
    const backBtn = screen.getByTitle('Quay lại danh sách hóa đơn');
    expect(backBtn).toBeDefined();
    fireEvent.click(backBtn);
    expect(mockPush).toHaveBeenCalledWith('/dormitory/invoices');
  });

  it('calculates consumption and costs when entering new readings', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Phòng 101')).toBeDefined();
    });

    // Find electricity reading input by aria-label
    const elecInput = screen.getByLabelText(/Số điện mới/i);
    expect(elecInput).toBeDefined();

    // Enter new electricity reading: 160 (consumption 60, quota 30, excess 30 => 30*2500 = 75,000)
    await act(async () => {
      fireEvent.change(elecInput, { target: { value: '160' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/Thành tiền: 75\.000/i)).toBeDefined();
    });
  });

  it('calculates from room-specific effective_tariffs and displays Riêng badge (AC-04, AC-05)', async () => {
    const roomWithOverride = {
      ...mockMeterReadingsData.rooms[0],
      effective_tariffs: {
        electricity: { quota_per_person: 20, unit_price: 2500, unit: 'kWh', source: 'room_override' as const },
        water: { quota_per_person: 5, unit_price: 10000, unit: 'm³', source: 'room_override' as const },
      },
    };
    (dormitoryApi.invoices.getMeterReadings as any).mockResolvedValue({
      ...mockMeterReadingsData,
      rooms: [roomWithOverride],
    });

    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Phòng 101')).toBeDefined();
      expect(screen.getAllByText('Riêng').length).toBeGreaterThanOrEqual(1);
    });

    // 2 occupants, room quota = 20 kWh. Previous = 100, New = 160 => Consumption = 60.
    // Quota total = 2 * 20 = 40. Excess = 20 => 20 * 2500 = 50,000
    const elecInput = screen.getByLabelText(/Số điện mới/i);
    await act(async () => {
      fireEvent.change(elecInput, { target: { value: '160' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/Thành tiền: 50\.000/i)).toBeDefined();
    });
  });

  it('has consistent outer spacing class on root main element', async () => {
    const { container } = render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Ghi chỉ số điện - nước KTX')).toBeDefined();
    });

    const mainEl = container.querySelector('main');
    expect(mainEl).toBeDefined();
    expect(mainEl?.className).toContain('p-4');
    expect(mainEl?.className).toContain('sm:p-6');
    expect(mainEl?.className).toContain('overflow-y-auto');
  });

  it('saves two room cards independently when both are blurred quickly', async () => {
    const secondRoom = {
      ...mockMeterReadingsData.rooms[0],
      room_id: 'room-2',
      room: { ...mockMeterReadingsData.rooms[0].room, _id: 'room-2', room_code: 'P102', room_name: 'Phòng 102' },
    };
    (dormitoryApi.invoices.getMeterReadings as any).mockResolvedValue({
      ...mockMeterReadingsData,
      rooms: [mockMeterReadingsData.rooms[0], secondRoom],
    });
    (dormitoryApi.invoices.saveBulkMeterReadings as any).mockImplementation(async (payload: any) => ({
      results: [{ room_id: payload.readings[0].room_id, success: true, invoice: { _id: `inv-${payload.readings[0].room_id}`, status: 'Chưa thu' } }],
    }));

    render(<MeterReadingsPage />);
    await waitFor(() => expect(screen.getByText('Phòng 102')).toBeDefined());

    const electricityInputs = screen.getAllByLabelText(/Số điện mới/i);
    const waterInputs = screen.getAllByLabelText(/Số nước mới/i);
    fireEvent.change(electricityInputs[0], { target: { value: '161' } });
    fireEvent.change(waterInputs[0], { target: { value: '21' } });
    fireEvent.blur(waterInputs[0]);
    fireEvent.change(electricityInputs[1], { target: { value: '171' } });
    fireEvent.change(waterInputs[1], { target: { value: '31' } });
    fireEvent.blur(waterInputs[1]);

    await waitFor(() => expect(dormitoryApi.invoices.saveBulkMeterReadings).toHaveBeenCalledTimes(2));
    const payloads = (dormitoryApi.invoices.saveBulkMeterReadings as any).mock.calls.map((call: any[]) => call[0]);
    expect(payloads.map((payload: any) => payload.readings[0].room_id).sort()).toEqual(['room-1', 'room-2']);
    expect(payloads.find((payload: any) => payload.readings[0].room_id === 'room-1').readings[0].electricity_reading).toBe(161);
    expect(payloads.find((payload: any) => payload.readings[0].room_id === 'room-2').readings[0].electricity_reading).toBe(171);
  });
});
