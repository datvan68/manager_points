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
});
