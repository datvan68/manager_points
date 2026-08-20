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
      updateProof: vi.fn(),
      reviewProof: vi.fn(),
      getConfig: vi.fn(),
      updateConfig: vi.fn(),
      getMeterReadings: vi.fn(),
      saveBulkMeterReadings: vi.fn(),
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
    _id: 'inv-pending',
    invoice_code: 'INV-PENDING',
    room_id: {
      _id: 'room-1',
      room_code: 'P101',
      room_name: 'Phòng 101',
      building_id: { name: 'Tòa A' },
    },
    billing_month: '2026-03',
    reading_date: '2026-03-25',
    occupant_count: 2,
    electricity: { amount: 50000 },
    water: { amount: 20000 },
    total_amount: 70000,
    status: 'Chưa thu',
    due_date: '2026-04-05',
    payment_method: 'Chuyển khoản',
    payment_proof: {
      url: '/uploads/proof-pending.png',
      file_name: 'proof-pending.png',
      mime_type: 'image/png',
      size: 102400,
    },
    payment_review: {
      status: 'pending',
      submitted_at: '2026-03-26T10:00:00.000Z',
    },
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
    payment_review: {
      status: 'approved',
      reviewed_at: '2026-03-01T10:00:00.000Z',
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
    mockHasPermission.mockReturnValue(true);
    (dormitoryApi.rooms.getAll as any).mockResolvedValue({ data: mockRooms, meta: { total: 1 } });
    (dormitoryApi.invoices.getAll as any).mockResolvedValue({
      data: mockInvoices,
      meta: { total: 3, page: 1, limit: 50, totalPages: 1 },
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

  it('renders the 7 standard table columns without title header and shows room name only (AC-04, AC-05)', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Phòng 101').length).toBeGreaterThanOrEqual(2);
    });

    // Verify title header is removed
    expect(screen.queryByText('Hóa đơn điện - nước KTX')).toBeNull();
    expect(screen.queryByText(/Quản lý đợt thu tiền điện - nước theo phòng/i)).toBeNull();

    // Check table headers
    expect(screen.getByText('Phòng')).toBeDefined();
    expect(screen.getByText('Kỳ thu')).toBeDefined();
    expect(screen.getByText('Tiền điện')).toBeDefined();
    expect(screen.getByText('Tiền nước')).toBeDefined();
    expect(screen.getByText('Tổng tiền')).toBeDefined();
    expect(screen.getByText('Trạng thái')).toBeDefined();
    expect(screen.getByText('Thao tác')).toBeDefined();
  });

  it('displays business statuses: Chưa thu, Chờ duyệt, and Đã thu', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Chưa thu').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Chờ duyệt').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Đã thu').length).toBeGreaterThan(0);
    });
  });

  it('does not have text button "Lập đợt thu", has Advanced icon button and "Ghi điện nước" button', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ghi điện nước/i })).toBeDefined();
    });

    expect(screen.queryByRole('button', { name: /^Lập đợt thu$/i })).toBeNull();
    const configBtn = screen.getByRole('button', { name: /Cấu hình định mức & đơn giá/i });
    expect(configBtn).toBeDefined();
  });

  it('opens Utility Config modal on clicking Advanced icon button', async () => {
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

  it('navigates to /dormitory/invoices/meter-readings on clicking "Ghi điện nước"', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Ghi điện nước/i })).toBeDefined();
    });

    const meterReadingsBtn = screen.getByRole('button', { name: /Ghi điện nước/i });
    fireEvent.click(meterReadingsBtn);

    expect(mockPush).toHaveBeenCalledWith('/dormitory/invoices/meter-readings');
  });

  it('simplified payment modal has no payment method selector or notes and submits transfer proof (AC-01, AC-02, AC-03)', async () => {
    (dormitoryApi.invoices.uploadProof as any).mockResolvedValue({
      url: '/uploads/new-proof.png',
      file_name: 'new-proof.png',
      mime_type: 'image/png',
      size: 102400,
    });
    (dormitoryApi.invoices.pay as any).mockResolvedValue({
      ...mockInvoices[0],
      payment_method: 'Chuyển khoản',
      payment_proof: { url: '/uploads/new-proof.png' },
      payment_review: { status: 'pending' },
    });

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Đóng ngay/i }).length).toBeGreaterThanOrEqual(1);
    });

    const payBtn = screen.getAllByRole('button', { name: /Đóng ngay/i })[0];
    fireEvent.click(payBtn);

    await waitFor(() => {
      expect(screen.getByText('Hóa đơn thanh toán')).toBeDefined();
      // AC-01: No payment method selector or notes input
      expect(screen.queryByText('Phương thức thanh toán')).toBeNull();
      expect(screen.queryByText('Ghi chú xác nhận')).toBeNull();
      expect(screen.getByText('Ảnh chứng từ thanh toán')).toBeDefined();
      expect(screen.getByText('Quét mã để thanh toán')).toBeDefined();
    });

    // AC-02: Submit button disabled without proof
    const submitBtn = screen.getByRole('button', { name: /Gửi duyệt/i });
    expect(submitBtn).toBeDefined();
    expect(submitBtn.hasAttribute('disabled')).toBe(true);

    // Upload proof file
    const file = new File(['proof-image'], 'proof.png', { type: 'image/png' });
    const fileInput = document.getElementById('pay-proof-upload') as HTMLInputElement;
    expect(fileInput).toBeDefined();

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    // Submit proof
    expect(submitBtn.hasAttribute('disabled')).toBe(false);
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    await waitFor(() => {
      expect(dormitoryApi.invoices.uploadProof).toHaveBeenCalled();
      expect(dormitoryApi.invoices.pay).toHaveBeenCalledWith('inv-unpaid', {
        payment_method: 'Chuyển khoản',
        payment_proof: {
          url: '/uploads/new-proof.png',
          file_name: 'new-proof.png',
          mime_type: 'image/png',
          size: 102400,
        },
      });
    });
  });

  it('clicking "Duyệt" opens shared modal in review mode and allows approving or rejecting (AC-07, AC-08, AC-09)', async () => {
    (dormitoryApi.invoices.reviewProof as any).mockResolvedValue({
      ...mockInvoices[1],
      status: 'Đã thu',
      payment_review: { status: 'approved' },
    });

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Duyệt/i }).length).toBeGreaterThanOrEqual(1);
    });

    const reviewBtn = screen.getAllByRole('button', { name: /Duyệt/i })[0];
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText('Hóa đơn thanh toán')).toBeDefined();
      expect(screen.getByText('Ảnh chứng từ hiện tại')).toBeDefined();
      expect(screen.getByRole('button', { name: /Không duyệt/i })).toBeDefined();
      expect(screen.getByRole('button', { name: /^Duyệt$/i })).toBeDefined();
    });

    // Click Duyệt
    const approveBtn = screen.getByRole('button', { name: /^Duyệt$/i });
    await act(async () => {
      fireEvent.click(approveBtn);
    });

    await waitFor(() => {
      expect(dormitoryApi.invoices.reviewProof).toHaveBeenCalledWith('inv-pending', 'approved');
    });
  });

  it('unauthorized users do not see review buttons in shared modal (AC-08)', async () => {
    mockHasPermission.mockReturnValue(false);

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Duyệt/i }).length).toBeGreaterThanOrEqual(1);
    });

    const reviewBtn = screen.getAllByRole('button', { name: /Duyệt/i })[0];
    fireEvent.click(reviewBtn);

    await waitFor(() => {
      expect(screen.getByText('Hóa đơn thanh toán')).toBeDefined();
      expect(screen.queryByRole('button', { name: /Không duyệt/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /^Duyệt$/i })).toBeNull();
    });
  });

  it('clicking "Kiểm tra" on approved invoice allows revoking proof with confirmation modal (AC-10, AC-11)', async () => {
    (dormitoryApi.invoices.reviewProof as any).mockResolvedValue({
      ...mockInvoices[2],
      status: 'Chưa thu',
      payment_review: { status: 'rejected' },
    });

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Kiểm tra/i }).length).toBeGreaterThanOrEqual(1);
    });

    const checkBtn = screen.getAllByRole('button', { name: /Kiểm tra/i })[0];
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText('Hóa đơn thanh toán')).toBeDefined();
      expect(screen.getByRole('button', { name: /Bỏ duyệt/i })).toBeDefined();
    });

    // Click Bỏ duyệt
    const revokeBtn = screen.getByRole('button', { name: /Bỏ duyệt/i });
    fireEvent.click(revokeBtn);

    // ConfirmModal appears
    await waitFor(() => {
      expect(screen.getByText('Bỏ duyệt chứng từ')).toBeDefined();
      expect(screen.getByText(/Hóa đơn sẽ trở về trạng thái Chưa thu/i)).toBeDefined();
    });

    // Click confirm in ConfirmModal
    const confirmRevokeBtn = screen.getAllByRole('button', { name: 'Bỏ duyệt' })[1] || screen.getAllByRole('button', { name: 'Bỏ duyệt' })[0];
    await act(async () => {
      fireEvent.click(confirmRevokeBtn);
    });

    await waitFor(() => {
      expect(dormitoryApi.invoices.reviewProof).toHaveBeenCalledWith('inv-paid', 'revoked');
    });
  });

  it('allows uploading replacement proof in shared modal (AC-12)', async () => {
    (dormitoryApi.invoices.uploadProof as any).mockResolvedValue({
      url: '/uploads/replacement-proof.png',
      file_name: 'replacement-proof.png',
      mime_type: 'image/png',
      size: 204800,
    });
    (dormitoryApi.invoices.updateProof as any).mockResolvedValue({
      ...mockInvoices[2],
      payment_proof: { url: '/uploads/replacement-proof.png' },
      payment_review: { status: 'pending' },
    });

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Kiểm tra/i }).length).toBeGreaterThanOrEqual(1);
    });

    const checkBtn = screen.getAllByRole('button', { name: /Kiểm tra/i })[0];
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText('Hóa đơn thanh toán')).toBeDefined();
      expect(screen.getByText('Cập nhật ảnh mới (nếu tải lên sai)')).toBeDefined();
    });

    const file = new File(['fake-image'], 'replacement.png', { type: 'image/png' });
    const fileInput = document.getElementById('pay-proof-replace-upload') as HTMLInputElement;
    expect(fileInput).toBeDefined();

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    const saveBtn = screen.getByRole('button', { name: /Lưu cập nhật/i });
    expect(saveBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    await waitFor(() => {
      expect(dormitoryApi.invoices.uploadProof).toHaveBeenCalled();
      expect(dormitoryApi.invoices.updateProof).toHaveBeenCalledWith('inv-paid', expect.any(Object));
    });
  });

  it('renders CustomPagination with total items', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Phòng 101').length).toBeGreaterThanOrEqual(2);
    });

    expect(screen.getByText(/Hiển thị 1-3 trên tổng số 3 hóa đơn/i)).toBeDefined();
  });

  it('selects row checkboxes and shows FloatingActionBar with selected count', async () => {
    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Phòng 101').length).toBeGreaterThanOrEqual(2);
    });

    const rowCheckboxes = document.querySelectorAll('tbody input[type="checkbox"]');
    expect(rowCheckboxes.length).toBeGreaterThanOrEqual(2);

    // Select first row
    await act(async () => {
      fireEvent.click(rowCheckboxes[0]);
    });

    await waitFor(() => {
      expect(screen.getAllByText(/Đã chọn/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('button', { name: /Xóa hóa đơn đã chọn/i })).toBeDefined();
    });

    // Clear selection
    const clearBtn = screen.getByRole('button', { name: /Hủy chọn/i });
    await act(async () => {
      fireEvent.click(clearBtn);
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /Xóa hóa đơn đã chọn/i })).toBeNull();
    });
  });

  it('executes bulk delete via ConfirmModal and handles success', async () => {
    (dormitoryApi.invoices.bulkDelete as any).mockResolvedValue({
      requested: 1,
      deleted: ['inv-unpaid'],
      not_found: [],
      rejected: [],
    });

    render(<InvoicesPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Phòng 101').length).toBeGreaterThanOrEqual(2);
    });

    const rowCheckbox = document.querySelector('tbody input[type="checkbox"]') as HTMLInputElement;
    expect(rowCheckbox).toBeTruthy();
    await act(async () => {
      fireEvent.click(rowCheckbox);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Xóa hóa đơn đã chọn/i })).toBeDefined();
    });

    const deleteBtn = screen.getByRole('button', { name: /Xóa hóa đơn đã chọn/i });
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Xóa hóa đơn đã chọn')).toBeDefined();
    });

    const confirmBtn = screen.getByRole('button', { name: 'Xóa hóa đơn' });
    await act(async () => {
      fireEvent.click(confirmBtn);
    });

    await waitFor(() => {
      expect(dormitoryApi.invoices.bulkDelete).toHaveBeenCalledWith(['inv-unpaid']);
    });
  });
});


