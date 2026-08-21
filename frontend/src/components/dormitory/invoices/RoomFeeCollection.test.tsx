import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RoomFeeCollection from './RoomFeeCollection';
import { dormitoryApi } from '@/api/dormitory-api';
import { toast } from 'sonner';

vi.mock('framer-motion', () => ({
  motion: new Proxy({}, {
    get: (_, prop) => (props: any) => {
      const Tag = typeof prop === 'string' ? prop : 'div';
      return <Tag {...props} />;
    },
  }),
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

const mockHasPermission = vi.fn().mockReturnValue(true);
vi.mock('@/providers/auth-provider', () => ({
  useAuth: () => ({
    user: { id: 'u1', role: 'admin' },
    hasPermission: mockHasPermission,
  }),
}));

vi.mock('@/api/dormitory-api', () => ({
  dormitoryApi: {
    roomFeeInvoices: {
      getAll: vi.fn(),
      getOne: vi.fn(),
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      uploadTransferQr: vi.fn(),
      previewPeriod: vi.fn(),
      createPeriod: vi.fn(),
      uploadProof: vi.fn(),
      pay: vi.fn(),
      updateProof: vi.fn(),
      reviewProof: vi.fn(),
      bulkReviewProof: vi.fn(),
      bulkDelete: vi.fn(),
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

const mockInvoices = [
  {
    _id: 'rfi-unpaid',
    invoice_code: 'RFI-001',
    member_name: 'Nguyễn Văn A',
    member_code: 'SV001',
    room_code: 'P101',
    room_name: 'Phòng 101',
    room_type: 'Thường',
    monthly_rate: 500000,
    start_month: '2026-03',
    end_month: '2026-07',
    months_count: 5,
    total_amount: 2500000,
    status: 'Chưa thu',
  },
  {
    _id: 'rfi-pending',
    invoice_code: 'RFI-002',
    member_name: 'Trần Thị B',
    member_code: 'SV002',
    room_code: 'P201',
    room_name: 'Phòng 201',
    room_type: 'Máy lạnh',
    monthly_rate: 700000,
    start_month: '2026-03',
    end_month: '2026-07',
    months_count: 5,
    total_amount: 3500000,
    status: 'Chưa thu',
    payment_method: 'Chuyển khoản',
    payment_proof: {
      url: '/uploads/proof-pending.png',
      file_name: 'proof-pending.png',
    },
    payment_review: {
      status: 'pending',
      submitted_at: '2026-03-26T10:00:00.000Z',
    },
  },
  {
    _id: 'rfi-paid',
    invoice_code: 'RFI-003',
    member_name: 'Lê Văn C',
    member_code: 'SV003',
    room_code: 'P102',
    room_name: 'Phòng 102',
    room_type: 'Thường',
    monthly_rate: 500000,
    start_month: '2026-03',
    end_month: '2026-07',
    months_count: 5,
    total_amount: 2500000,
    status: 'Đã thu',
    payment_method: 'Tiền mặt',
    paid_at: '2026-03-01T10:00:00.000Z',
  },
];

const mockConfig = {
  _id: 'cfg-1',
  standard_monthly_rate: 500000,
  air_conditioned_monthly_rate: 700000,
  months_to_collect: 5,
  transfer_qr_image: { url: '/uploads/transfer-qr.png' },
};

describe('RoomFeeCollection Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasPermission.mockReturnValue(true);
    (dormitoryApi.roomFeeInvoices.getAll as any).mockResolvedValue({
      data: mockInvoices,
      meta: { total: 3, page: 1, limit: 20, totalPages: 1 },
    });
    (dormitoryApi.roomFeeInvoices.getConfig as any).mockResolvedValue(mockConfig);
    (dormitoryApi.roomFeeInvoices.updateConfig as any).mockImplementation(async (cfg: any) => ({ ...mockConfig, ...cfg }));
    (dormitoryApi.roomFeeInvoices.previewPeriod as any).mockResolvedValue({
      start_month: '2026-03',
      end_month: '2026-07',
      months_count: 5,
      standard_monthly_rate: 500000,
      air_conditioned_monthly_rate: 700000,
      total_assigned: 3,
      eligible_count: 3,
      eligible_standard_count: 2,
      eligible_ac_count: 1,
      skipped_existing_count: 0,
      invalid_assignment_count: 0,
      expected_total_amount: 8500000,
    });
  });

  it('renders standard table columns: Họ tên, Phòng, Kỳ thu, Khoản thu, Trạng thái, Thao tác', async () => {
    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Trần Thị B').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Lê Văn C').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByText('Họ tên')).toBeDefined();
    expect(screen.getByText('Phòng')).toBeDefined();
    expect(screen.getByText('Kỳ thu')).toBeDefined();
    expect(screen.getByText('Khoản thu')).toBeDefined();
    expect(screen.getByText('Trạng thái')).toBeDefined();
    expect(screen.getByText('Thao tác')).toBeDefined();
  });

  it('renders status badges: Chưa thu, Chờ duyệt, Đã thu', async () => {
    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByText('Chưa thu').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Chờ duyệt').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Đã thu').length).toBeGreaterThan(0);
    });
  });

  it('opens Config modal, loads rates, and submits updated configuration', async () => {
    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cấu hình đơn giá thu phí phòng/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Cấu hình đơn giá thu phí phòng/i }));

    await waitFor(() => {
      expect(screen.getByText('Cấu hình đợt thu phí phòng')).toBeDefined();
      expect(screen.getByLabelText(/Giá phòng thường/i)).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Lưu cấu hình/i }));

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.updateConfig).toHaveBeenCalled();
    });
  });

  it('opens Create Period modal with live preview and submits period creation', async () => {
    (dormitoryApi.roomFeeInvoices.createPeriod as any).mockResolvedValue({
      created_count: 3,
      skipped_count: 0,
      invalid_count: 0,
      total_amount: 8500000,
    });

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Lập đợt thu/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Lập đợt thu/i }));

    await waitFor(() => {
      expect(screen.getByText('Lập đợt thu tiền phòng')).toBeDefined();
      expect(screen.getByText('Xem trước kết quả lập đợt thu')).toBeDefined();
    });

    const submitBtn = await screen.findByRole('button', { name: /Xác nhận lập đợt thu/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.createPeriod).toHaveBeenCalled();
    });
  });

  it('opens Pay modal for unpaid invoice and supports cash payment', async () => {
    (dormitoryApi.roomFeeInvoices.pay as any).mockResolvedValue({
      ...mockInvoices[0],
      status: 'Đã thu',
      payment_method: 'Tiền mặt',
    });

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Đóng ngay/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Đóng ngay/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('Thanh toán phí phòng')).toBeDefined();
      expect(screen.getByText('Tiền mặt tại quầy')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Xác nhận Đã thu tiền mặt/i }));

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.pay).toHaveBeenCalledWith('rfi-unpaid', {
        payment_method: 'Tiền mặt',
        notes: undefined,
        payment_proof: undefined,
      });
    });
  });

  it('opens Review modal for pending proof and supports approving', async () => {
    (dormitoryApi.roomFeeInvoices.reviewProof as any).mockResolvedValue({
      ...mockInvoices[1],
      status: 'Đã thu',
      payment_review: { status: 'approved' },
    });

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Duyệt/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Duyệt/i })[0]);

    await waitFor(() => {
      expect(screen.getByText('Chứng từ & Thông tin hóa đơn')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Duyệt chứng từ' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Không duyệt' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Duyệt chứng từ' }));

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.reviewProof).toHaveBeenCalledWith(
        'rfi-pending',
        'approved',
        expect.any(String),
      );
    });
  });

  it('allows bulk approve for selected pending invoices', async () => {
    (dormitoryApi.roomFeeInvoices.bulkReviewProof as any).mockResolvedValue({
      requested: 1,
      results: [{ id: 'rfi-pending', outcome: 'approved' }],
    });

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThanOrEqual(1);
    });

    const checkboxes = document.querySelectorAll('tbody input[type="checkbox"]');
    // Select rfi-pending (index 1)
    fireEvent.click(checkboxes[1]);

    const approveBtn = await screen.findByRole('button', { name: /Duyệt chứng từ.*đã chọn/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.bulkReviewProof).toHaveBeenCalledWith(
        ['rfi-pending'],
        'approved',
        expect.any(String),
      );
    });
  });
});
