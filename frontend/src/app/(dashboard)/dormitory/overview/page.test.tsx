import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DormitoryOverviewPage from './page';
import { dormitoryApi } from '@/api/dormitory-api';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/api/dormitory-api', () => ({
  dormitoryApi: {
    reports: {
      getDashboardStats: vi.fn(),
      getOccupancyReport: vi.fn(),
    },
  },
}));

const mockStats = {
  total_rooms: 40,
  available_rooms: 12,
  active_contracts: 110,
  unpaid_invoices: 8,
  pending_maintenance: 3,
  rooms: { occupied: 28, available: 12, air_conditioned: 16, standard: 24 },
  beds: { used: 110, free: 50 },
  students: { registered: 125, residing: 110 },
  dormitory_fees: { paid: 95, unpaid: 15 },
  utilities: { paid: 80, unpaid: 30 },
  monthly: [
    {
      month: '2026-03',
      registrations: 20,
      move_ins: 18,
      dormitory_fee_paid: 18,
      dormitory_fee_unpaid: 2,
      utility_paid: 15,
      utility_unpaid: 5,
    },
  ],
};

const mockOccupancy = {
  buildings: [
    {
      building_id: 'b1',
      building_code: 'TOA-A',
      name: 'Tòa Nhà A',
      total_rooms: 20,
      total_beds: 80,
      used_beds: 65,
      available_beds: 15,
      occupancy_rate: 81,
    },
  ],
  summary: {
    total_buildings: 1,
    total_beds: 80,
    used_beds: 65,
    available_beds: 15,
    overall_occupancy_rate: 81,
  },
};

describe('DormitoryOverviewPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (dormitoryApi.reports.getDashboardStats as any).mockResolvedValue(mockStats);
    (dormitoryApi.reports.getOccupancyReport as any).mockResolvedValue(mockOccupancy);
  });

  it('renders loading state initially and then displays the complete dashboard data', async () => {
    render(<DormitoryOverviewPage />);

    // Waits for header and stats to load
    await waitFor(() => {
      expect(screen.getByText('Tổng quan Quản lý KTX')).toBeInTheDocument();
    });

    // Check KPI metrics
    expect(screen.getByText('Tỷ lệ lấp đầy')).toBeInTheDocument();
    expect(screen.getAllByText('81%').length).toBeGreaterThan(0);
    expect(screen.getByText('SV Đang nội trú')).toBeInTheDocument();
    expect(screen.getByText('Hóa đơn chưa thu')).toBeInTheDocument();
    expect(screen.getByText('Bảo trì đang mở')).toBeInTheDocument();

    // Check Building list
    expect(screen.getByText('Tòa Nhà A')).toBeInTheDocument();
    expect(screen.getByText('TOA-A')).toBeInTheDocument();

    // Check Quick Shortcuts & Action Center
    expect(screen.getByText('Cần Xử Lý Ngay')).toBeInTheDocument();
    expect(screen.getByText('Lối Tắt Phân Hệ KTX')).toBeInTheDocument();
  });
});
