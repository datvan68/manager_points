import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvoicesPage from './page';
import { dormitoryApi } from '@/api/dormitory-api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

let mockHasPermission = vi.fn().mockReturnValue(true);

vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { _id: 'user-1', name: 'Admin', role: 'admin' },
    hasPermission: mockHasPermission,
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
        getAll: vi.fn(),
        getConfig: vi.fn(),
        updateConfig: vi.fn(),
        getRoomInfo: vi.fn(),
        createMonthly: vi.fn(),
        updateMonthly: vi.fn(),
        pay: vi.fn(),
        getProofBlob: vi.fn(),
        deleteInvoice: vi.fn(),
        bulkDelete: vi.fn(),
      },
      rooms: {
        getAll: vi.fn(),
      },
      roomFeeInvoices: {
        getConfig: vi.fn(),
        getAll: vi.fn(),
      },
    },
  };
});

describe('InvoicesPage - Room Specific Utility Tariffs & Modal Configuration', () => {
  const mockRooms = [
    { _id: 'room-1', room_code: 'P101', room_name: 'Phòng 101', building_id: { _id: 'b-1', name: 'Tòa A' } },
    { _id: 'room-2', room_code: 'P102', room_name: 'Phòng 102', building_id: { _id: 'b-1', name: 'Tòa A' } },
  ];

  const mockConfig = {
    _id: 'cfg-1',
    electricity: {
      quota_per_person: 15,
      unit_price: 2500,
      unit: 'kWh',
      room_quota_overrides: [
        { room_id: { _id: 'room-1', room_code: 'P101', room_name: 'Phòng 101' }, quota_per_person: 25 },
      ],
      room_unit_price_overrides: [
        { room_id: { _id: 'room-1', room_code: 'P101', room_name: 'Phòng 101' }, unit_price: 3200 },
      ],
    },
    water: {
      quota_per_person: 4,
      unit_price: 10000,
      unit: 'm³',
      room_quota_overrides: [],
      room_unit_price_overrides: [
        { room_id: { _id: 'room-2', room_code: 'P102', room_name: 'Phòng 102' }, unit_price: 15000 },
      ],
    },
    payment_deadline: '2026-04-10T00:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    let objectUrlId = 0;
    const mockCreate = vi.fn((_b: Blob) => `blob:http://localhost/invoice-blob-${++objectUrlId}`);
    const mockRevoke = vi.fn();
    window.URL.createObjectURL = mockCreate;
    window.URL.revokeObjectURL = mockRevoke;
    URL.createObjectURL = mockCreate;
    URL.revokeObjectURL = mockRevoke;

    mockHasPermission = vi.fn().mockReturnValue(true);
    vi.mocked(dormitoryApi.invoices.getAll).mockResolvedValue({
      data: [],
      meta: { total: 0, page: 1, limit: 20 },
    } as any);
    vi.mocked(dormitoryApi.rooms.getAll).mockResolvedValue({ data: mockRooms } as any);
    vi.mocked(dormitoryApi.invoices.getConfig).mockResolvedValue(mockConfig as any);
    vi.mocked(dormitoryApi.invoices.updateConfig).mockResolvedValue(mockConfig as any);
    vi.mocked(dormitoryApi.invoices.getProofBlob).mockResolvedValue(
      new Blob(['dummy-proof-content'], { type: 'image/png' }),
    );
  });

  it('renders invoice page and opens wide configuration modal with room quota & price overrides (AC-01, AC-09)', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(dormitoryApi.rooms.getAll).toHaveBeenCalled();
    });

    const configButton = screen.getByLabelText('Cấu hình định mức & đơn giá');
    fireEvent.click(configButton);

    await waitFor(() => {
      expect(dormitoryApi.invoices.getConfig).toHaveBeenCalled();
    });

    expect(screen.getByText('Cấu hình định mức & đơn giá điện - nước')).toBeInTheDocument();
    expect(screen.getByText('Thông số Điện')).toBeInTheDocument();
    expect(screen.getByText('Thông số Nước')).toBeInTheDocument();
    expect(screen.getByText('Định mức riêng theo phòng (Điện)')).toBeInTheDocument();
    expect(screen.getByText('Đơn giá riêng theo phòng (Điện)')).toBeInTheDocument();
    expect(screen.getByText('Định mức riêng theo phòng (Nước)')).toBeInTheDocument();
    expect(screen.getByText('Đơn giá riêng theo phòng (Nước)')).toBeInTheDocument();
  });

  it('allows adding and removing room unit price overrides and saves configuration (AC-02, AC-03)', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(dormitoryApi.rooms.getAll).toHaveBeenCalled();
    });

    const configButton = screen.getByLabelText('Cấu hình định mức & đơn giá');
    fireEvent.click(configButton);

    await waitFor(() => {
      expect(screen.getByText('Cấu hình định mức & đơn giá điện - nước')).toBeInTheDocument();
    });

    // Wait for rooms and config to be loaded
    await waitFor(() => {
      const selects = screen.getAllByRole('combobox', { name: 'Chọn phòng để thêm đơn giá riêng' });
      expect(selects[0]).not.toBeDisabled();
    });

    const elecPriceSelect = screen.getAllByRole('combobox', { name: 'Chọn phòng để thêm đơn giá riêng' })[0];
    fireEvent.keyDown(elecPriceSelect, { key: 'ArrowDown' });
    fireEvent.keyDown(elecPriceSelect, { key: 'Enter' });

    const addButtons = screen.getAllByRole('button', { name: /Thêm phòng/i });
    // Click the Add Room button for electricity price overrides (index 1)
    fireEvent.click(addButtons[1]);

    // Now modify the price for room-2
    const room2PriceInput = screen.getByLabelText('Đơn giá phòng Phòng 102 (Tòa A)');
    fireEvent.change(room2PriceInput, { target: { value: '4500' } });

    // Delete room-1 from electricity unit price overrides
    const deleteBtn = screen.getByLabelText('Xóa đơn giá riêng của Phòng 101');
    fireEvent.click(deleteBtn);

    const saveButton = screen.getByRole('button', { name: /Lưu cấu hình/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(dormitoryApi.invoices.updateConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          electricity: expect.objectContaining({
            quota_per_person: 15,
            unit_price: 2500,
            room_quota_overrides: [{ room_id: 'room-1', quota_per_person: 25 }],
            room_unit_price_overrides: [{ room_id: 'room-2', unit_price: 4500 }],
          }),
          water: expect.objectContaining({
            quota_per_person: 4,
            unit_price: 10000,
            room_quota_overrides: [],
            room_unit_price_overrides: [{ room_id: 'room-2', unit_price: 15000 }],
          }),
        }),
      );
    });
  });

  it('renders access denied message when lacking DORM_INVOICE_READ permission', () => {
    mockHasPermission = vi.fn().mockReturnValue(false);
    render(<InvoicesPage />);
    expect(screen.getByText('Bạn không có quyền truy cập trang này')).toBeInTheDocument();
    expect(screen.queryByLabelText('Cấu hình định mức & đơn giá')).not.toBeInTheDocument();
  });

  it('does not render manual refresh button in toolbar', async () => {
    mockHasPermission = vi.fn().mockReturnValue(true);
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(dormitoryApi.rooms.getAll).toHaveBeenCalled();
    });
    expect(screen.queryByLabelText('Tải lại danh sách')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tải lại')).not.toBeInTheDocument();
  });

  it('hides create/config buttons when user has READ but not CREATE permission', async () => {
    mockHasPermission = vi.fn((perm: string) => perm === 'DORM_INVOICE_READ');
    render(<InvoicesPage />);
    await waitFor(() => {
      expect(dormitoryApi.rooms.getAll).toHaveBeenCalled();
    });
    expect(screen.queryByLabelText('Cấu hình định mức & đơn giá')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ghi điện nước')).not.toBeInTheDocument();
  });

  it('loads proof via getProofBlob and uses blob URL instead of raw private storage URL (AC-01, AC-02, AC-04)', async () => {
    const mockInvoiceWithProof = {
      _id: 'inv-util-1',
      room_id: { _id: 'room-1', room_code: 'P101', room_name: 'Phòng 101' },
      billing_month: '2026-03',
      total_amount: 150000,
      status: 'Chưa thu',
      payment_method: 'Chuyển khoản',
      payment_proof: {
        url: '/uploads/private/proof-util.png',
        file_name: 'proof-util.png',
      },
      payment_review: {
        status: 'pending',
        submitted_at: '2026-03-25T10:00:00.000Z',
      },
    };

    vi.mocked(dormitoryApi.invoices.getAll).mockResolvedValue({
      data: [mockInvoiceWithProof],
      meta: { total: 1, page: 1, limit: 20 },
    } as any);

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kiểm tra/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra/i }));

    await waitFor(() => {
      expect(dormitoryApi.invoices.getProofBlob).toHaveBeenCalledWith('inv-util-1');
    });

    const proofImg = await screen.findByAltText('Chứng từ thanh toán');
    expect(proofImg).toBeInTheDocument();
    expect(proofImg.getAttribute('src')).toMatch(/^blob:/);
    expect(proofImg.getAttribute('src')).not.toContain('/uploads/private/proof-util.png');
    expect(proofImg.getAttribute('src')).not.toContain('/api/media/private');

    const openLink = screen.getByRole('link', { name: /Mở ảnh gốc/i });
    expect(openLink.getAttribute('href')).toMatch(/^blob:/);
    expect(openLink.getAttribute('href')).not.toContain('/uploads/private/proof-util.png');
  });

  it('displays Vietnamese error and retry button when getProofBlob fails (AC-03)', async () => {
    const mockInvoiceWithProof = {
      _id: 'inv-util-2',
      room_id: { _id: 'room-1', room_code: 'P101', room_name: 'Phòng 101' },
      billing_month: '2026-03',
      total_amount: 150000,
      status: 'Chưa thu',
      payment_method: 'Chuyển khoản',
      payment_proof: {
        url: '/uploads/private/proof-util.png',
        file_name: 'proof-util.png',
      },
      payment_review: {
        status: 'pending',
        submitted_at: '2026-03-25T10:00:00.000Z',
      },
    };

    vi.mocked(dormitoryApi.invoices.getAll).mockResolvedValue({
      data: [mockInvoiceWithProof],
      meta: { total: 1, page: 1, limit: 20 },
    } as any);

    vi.mocked(dormitoryApi.invoices.getProofBlob).mockRejectedValueOnce(
      new Error('404 Not Found'),
    );

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kiểm tra/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Kiểm tra/i }));

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy ảnh chứng từ thanh toán.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
  });
});
