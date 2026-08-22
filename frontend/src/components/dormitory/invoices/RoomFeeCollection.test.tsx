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
    roster: {
      getAll: vi.fn(),
    },
    roomFeeInvoices: {
      getAll: vi.fn(),
      getOne: vi.fn(),
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      uploadTransferQr: vi.fn(),
      previewPeriod: vi.fn(),
      createPeriod: vi.fn(),
      previewIndividual: vi.fn(),
      createIndividual: vi.fn(),
      uploadProof: vi.fn(),
      pay: vi.fn(),
      updateProof: vi.fn(),
      getProofBlob: vi.fn(),
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
    let objectUrlId = 0;
    const mockCreate = vi.fn((_b: Blob) => `blob:http://localhost/proof-blob-${++objectUrlId}`);
    const mockRevoke = vi.fn();
    window.URL.createObjectURL = mockCreate;
    window.URL.revokeObjectURL = mockRevoke;
    URL.createObjectURL = mockCreate;
    URL.revokeObjectURL = mockRevoke;

    mockHasPermission.mockReturnValue(true);
    (dormitoryApi.roomFeeInvoices.getAll as any).mockResolvedValue({
      data: mockInvoices,
      meta: { total: 3, page: 1, limit: 20, totalPages: 1 },
    });
    (dormitoryApi.roomFeeInvoices.getConfig as any).mockResolvedValue(mockConfig);
    (dormitoryApi.roomFeeInvoices.getProofBlob as any).mockResolvedValue(
      new Blob(['dummy-blob-content'], { type: 'image/png' }),
    );
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
      expect(screen.getByRole('button', { name: 'Lập đợt thu phí phòng' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Lập đợt thu phí phòng' }));

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

  it('renders "Kiểm tra" button in actions column for paid invoice', async () => {
    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getAllByRole('button', { name: /Kiểm tra/i }).length).toBeGreaterThanOrEqual(1);
  });

  it('opens unified modal for unpaid invoice and submits transfer proof', async () => {
    const fakeProof = { url: '/uploads/new-proof.png', file_name: 'new-proof.png' };
    (dormitoryApi.roomFeeInvoices.uploadProof as any).mockResolvedValue(fakeProof);
    (dormitoryApi.roomFeeInvoices.pay as any).mockResolvedValue({
      ...mockInvoices[0],
      status: 'Chưa thu',
      payment_method: 'Chuyển khoản',
      payment_proof: fakeProof,
      payment_review: { status: 'pending' },
    });

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Kiểm tra/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Kiểm tra/i })[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Hóa đơn' })).toBeDefined();
      expect(screen.getByText(/Mã QR đóng tiền/i)).toBeDefined();
    });

    // Upload file
    const fileInput = document.getElementById('room-fee-pay-proof-upload') as HTMLInputElement;
    const file = new File(['dummy'], 'bill.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const submitBtn = await screen.findByRole('button', { name: 'Gửi' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.uploadProof).toHaveBeenCalledWith(file);
      expect(dormitoryApi.roomFeeInvoices.pay).toHaveBeenCalledWith('rfi-unpaid', {
        payment_method: 'Chuyển khoản',
        payment_proof: fakeProof,
      });
    });
  });

  it('opens unified modal for pending proof and supports approving and rejecting', async () => {
    (dormitoryApi.roomFeeInvoices.reviewProof as any).mockResolvedValue({
      ...mockInvoices[1],
      status: 'Đã thu',
      payment_review: { status: 'approved' },
    });

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Kiểm tra/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Kiểm tra/i })[1]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Hóa đơn' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Duyệt' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Không duyệt' })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Duyệt' }));

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

  it('opens Individual Issuance modal, previews calculation, and submits individual invoice', async () => {
    (dormitoryApi.roster.getAll as any).mockResolvedValue({
      data: [
        {
          _id: 'roster-entry-1',
          full_name: 'Phạm Minh D',
          student_code: 'SV004',
          room_id: { _id: 'room-1', room_name: 'Phòng 101', room_type: 'Thường' },
        },
      ],
    });

    (dormitoryApi.roomFeeInvoices.previewIndividual as any).mockResolvedValue({
      roster_entry_id: 'roster-entry-1',
      member_name: 'Phạm Minh D',
      member_code: 'SV004',
      room_id: 'room-1',
      room_code: 'P101',
      room_name: 'Phòng 101',
      room_type: 'Thường',
      start_month: '2026-03',
      end_month: '2026-07',
      months_count: 5,
      monthly_rate: 550000,
      total_amount: 2750000,
      already_exists: false,
    });

    (dormitoryApi.roomFeeInvoices.createIndividual as any).mockResolvedValue({
      _id: 'rfi-ind-1',
      invoice_code: 'RFI-IND-01',
      member_name: 'Phạm Minh D',
      total_amount: 2750000,
    });

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Lập đợt thu cá nhân/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Lập đợt thu cá nhân/i }));

    await waitFor(() => {
      expect(screen.getByText('Lập đợt thu phí phòng cá nhân')).toBeDefined();
    });

    const searchInput = screen.getByPlaceholderText(/Tìm theo tên SV, mã SV/i);
    fireEvent.change(searchInput, { target: { value: 'Phạm Minh' } });

    await waitFor(() => {
      expect(screen.getByText('Phạm Minh D')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Phạm Minh D'));

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.previewIndividual).toHaveBeenCalled();
      expect(screen.getByText(/Xem trước kết quả thu cá nhân/i)).toBeDefined();
    });

    const submitBtn = screen.getByRole('button', { name: /Xác nhận tạo hóa đơn/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.createIndividual).toHaveBeenCalledWith(
        expect.objectContaining({
          roster_entry_id: 'roster-entry-1',
          months_count: 5,
        }),
      );
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining('Lập hóa đơn phí phòng thành công'),
      );
    });
  });

  it('handles compact mode matchMedia without breaking pagination or list', async () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(max-width: 1023px)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      );
    });

    window.matchMedia = originalMatchMedia;
  });

  it('supports rejecting proof in unified modal', async () => {
    (dormitoryApi.roomFeeInvoices.reviewProof as any).mockResolvedValue({
      ...mockInvoices[1],
      status: 'Chưa thu',
      payment_review: { status: 'rejected' },
    });

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Kiểm tra/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Kiểm tra/i })[1]);

    const rejectBtn = await screen.findByRole('button', { name: 'Không duyệt' });
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.reviewProof).toHaveBeenCalledWith(
        'rfi-pending',
        'rejected',
        expect.any(String),
      );
    });
  });

  it('supports deleting existing proof with confirmation and uploading new proof', async () => {
    const updatedProof = { url: '/uploads/replaced-proof.png', file_name: 'replaced.png' };
    (dormitoryApi.roomFeeInvoices.uploadProof as any).mockResolvedValue(updatedProof);
    (dormitoryApi.roomFeeInvoices.updateProof as any).mockResolvedValue({
      ...mockInvoices[1],
      payment_proof: updatedProof,
    });

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Kiểm tra/i }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Kiểm tra/i })[1]);

    await waitFor(() => {
      expect(screen.getByText('Ảnh chứng từ hiện tại')).toBeDefined();
      expect(screen.getByRole('button', { name: /Xóa ảnh/i })).toBeDefined();
    });

    // Click Xóa ảnh
    const deleteProofBtn = screen.getByRole('button', { name: /Xóa ảnh/i });
    fireEvent.click(deleteProofBtn);

    // ConfirmModal appears
    await waitFor(() => {
      expect(screen.getByText('Xác nhận xóa ảnh chứng từ')).toBeDefined();
    });

    // Confirm delete
    const confirmDeleteBtn = screen.getAllByRole('button', { name: 'Xóa ảnh' })[1] || screen.getAllByRole('button', { name: 'Xóa ảnh' })[0];
    await act(async () => {
      fireEvent.click(confirmDeleteBtn);
    });

    // Upload area should now be visible
    await waitFor(() => {
      expect(screen.getByText('Ảnh xác nhận chuyển khoản')).toBeDefined();
    });

    const fileInput = document.getElementById('room-fee-pay-proof-upload') as HTMLInputElement;
    const file = new File(['replacement'], 'new-bill.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const saveBtn = await screen.findByRole('button', { name: 'Gửi' });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.uploadProof).toHaveBeenCalledWith(file);
    });
  });

  it('loads proof via getProofBlob and uses blob URL instead of raw private storage URL (AC-01, AC-02, AC-04)', async () => {
    const mockBlob = new Blob(['proof-image-content'], { type: 'image/png' });
    (dormitoryApi.roomFeeInvoices.getProofBlob as any).mockResolvedValue(mockBlob);

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Kiểm tra/i }).length).toBeGreaterThan(0);
    });

    // Click Kiểm tra on second invoice (rfi-pending which has proof)
    fireEvent.click(screen.getAllByRole('button', { name: /Kiểm tra/i })[1]);

    await waitFor(() => {
      expect(dormitoryApi.roomFeeInvoices.getProofBlob).toHaveBeenCalledWith('rfi-pending');
    });

    // Wait for blob URL image to be rendered
    const proofImg = await screen.findByAltText('Chứng từ thanh toán');
    expect(proofImg).toBeInTheDocument();
    expect(proofImg.getAttribute('src')).toMatch(/^blob:/);
    expect(proofImg.getAttribute('src')).not.toContain('/uploads/proof-pending.png');
    expect(proofImg.getAttribute('src')).not.toContain('/api/media/private');

    // Check "Mở ảnh gốc" link uses blob URL
    const openLink = screen.getByRole('link', { name: /Mở ảnh gốc/i });
    expect(openLink.getAttribute('href')).toMatch(/^blob:/);
    expect(openLink.getAttribute('href')).not.toContain('/uploads/proof-pending.png');
  });

  it('displays Vietnamese error and retry button when getProofBlob fails (AC-03)', async () => {
    (dormitoryApi.roomFeeInvoices.getProofBlob as any).mockRejectedValue(
      new Error('404 Not Found'),
    );

    render(<RoomFeeCollection />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Kiểm tra/i }).length).toBeGreaterThan(0);
    });

    // Click Kiểm tra on second invoice (rfi-pending)
    fireEvent.click(screen.getAllByRole('button', { name: /Kiểm tra/i })[1]);

    await waitFor(() => {
      expect(screen.getByText('Không tìm thấy ảnh chứng từ thanh toán.')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Thử lại/i })).toBeInTheDocument();
  });
});

