import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MeterReadingsPage from './page';
import { dormitoryApi } from '@/api/dormitory-api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/api/dormitory-api', async () => {
  const actual = await vi.importActual('@/api/dormitory-api');
  return {
    ...actual,
    dormitoryApi: {
      invoices: {
        getMeterReadings: vi.fn(),
        saveBulkMeterReadings: vi.fn(),
      },
    },
  };
});

describe('MeterReadingsPage - Room Specific Utility Tariffs & Calculation Parity', () => {
  const mockConfig = {
    electricity: { quota_per_person: 15, unit_price: 2500, unit: 'kWh' },
    water: { quota_per_person: 4, unit_price: 10000, unit: 'm³' },
  };

  const mockRooms = [
    {
      room_id: 'room-1',
      room: { _id: 'room-1', room_code: 'P101', room_name: 'Phòng 101' },
      occupant_count: 2,
      status: 'unrecorded' as const,
      previous_readings: { electricity: 100, water: 20 },
      effective_tariffs: {
        electricity: {
          quota_per_person: 25, // custom quota
          unit_price: 3000, // custom price
          unit: 'kWh',
          quota_source: 'room_override' as const,
          unit_price_source: 'room_override' as const,
          source: 'room_override' as const,
        },
        water: {
          quota_per_person: 4, // default quota
          unit_price: 10000, // default price
          unit: 'm³',
          quota_source: 'default' as const,
          unit_price_source: 'default' as const,
          source: 'default' as const,
        },
      },
    },
    {
      room_id: 'room-2',
      room: { _id: 'room-2', room_code: 'P102', room_name: 'Phòng 102' },
      occupant_count: 1,
      status: 'unrecorded' as const,
      previous_readings: { electricity: 50, water: 10 },
      effective_tariffs: {
        electricity: {
          quota_per_person: 15, // default quota
          unit_price: 3500, // custom price
          unit: 'kWh',
          quota_source: 'default' as const,
          unit_price_source: 'room_override' as const,
          source: 'room_override' as const,
        },
        water: {
          quota_per_person: 6, // custom quota
          unit_price: 12000, // custom price
          unit: 'm³',
          quota_source: 'room_override' as const,
          unit_price_source: 'room_override' as const,
          source: 'room_override' as const,
        },
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dormitoryApi.invoices.getMeterReadings).mockResolvedValue({
      config: mockConfig as any,
      billing_month: '2026-03',
      rooms: mockRooms as any,
    });
    vi.mocked(dormitoryApi.invoices.saveBulkMeterReadings).mockResolvedValue({
      results: [
        {
          room_id: 'room-1',
          success: true,
          invoice: { _id: 'inv-1', invoice_code: 'INV-1', status: 'Chưa thu', total_amount: 90000 } as any,
        },
      ],
    });
  });

  it('renders room cards displaying effective quotas, unit prices, and Riêng badges (AC-05)', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(dormitoryApi.invoices.getMeterReadings).toHaveBeenCalled();
    });

    expect(screen.getByText('Phòng 101')).toBeInTheDocument();
    expect(screen.getByText('Phòng 102')).toBeInTheDocument();

    // Check custom quota & price display for Room 1
    expect(screen.getByText('25 kWh')).toBeInTheDocument();
    expect(screen.getByText('3.000 đ')).toBeInTheDocument();

    // Badges 'Riêng' should appear for overridden fields
    const riengBadges = screen.getAllByText('Riêng');
    expect(riengBadges.length).toBeGreaterThan(0);
  });

  it('calculates preview amount using room-specific unit price and quota (AC-05)', async () => {
    render(<MeterReadingsPage />);

    await waitFor(() => {
      expect(screen.getByText('Phòng 101')).toBeInTheDocument();
    });

    // Room 1 has:
    // Occupants: 2
    // Elec: prev 100, quota 25/person (total 50), price 3,000đ
    // Water: prev 20, quota 4/person (total 8), price 10,000đ
    const elecInput = screen.getByLabelText('Số điện mới Phòng 101');
    const waterInput = screen.getByLabelText('Số nước mới Phòng 101');

    // Enter elec = 180 (consumption 80 kWh, excess 30 kWh * 3,000đ = 90,000đ)
    // Enter water = 25 (consumption 5 m³, excess 0 m³ * 10,000đ = 0đ)
    // Total = 90,000đ
    fireEvent.change(elecInput, { target: { value: '180' } });
    fireEvent.change(waterInput, { target: { value: '25' } });

    // Expect calculation preview
    expect(screen.getByText('90.000đ')).toBeInTheDocument();
  });
});
