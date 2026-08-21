import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dormitoryApi } from './dormitory-api';
import { httpClient } from './http-client';

vi.mock('./http-client', () => ({
  httpClient: vi.fn(),
  handleResponse: vi.fn(async (res: any) => {
    if (!res.ok) {
      const err = new Error(res.statusText || 'Error');
      (err as any).status = res.status;
      throw err;
    }
    return res.json();
  }),
}));

describe('dormitoryApi.roomFeeInvoices', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getConfig calls GET /dormitory/room-fee-invoices/config', async () => {
    const mockData = { standard_monthly_rate: 500000, air_conditioned_monthly_rate: 700000, months_to_collect: 5 };
    vi.mocked(httpClient).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    } as any);

    const result = await dormitoryApi.roomFeeInvoices.getConfig();
    expect(httpClient).toHaveBeenCalledWith(expect.stringContaining('/dormitory/room-fee-invoices/config'));
    expect(result).toEqual(mockData);
  });

  it('updateConfig calls PUT /dormitory/room-fee-invoices/config with payload', async () => {
    const payload = { standard_monthly_rate: 600000, air_conditioned_monthly_rate: 850000, months_to_collect: 6 };
    vi.mocked(httpClient).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ...payload, _id: 'cfg-1' }),
    } as any);

    const result = await dormitoryApi.roomFeeInvoices.updateConfig(payload);
    expect(httpClient).toHaveBeenCalledWith(
      expect.stringContaining('/dormitory/room-fee-invoices/config'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    );
    expect(result.standard_monthly_rate).toBe(600000);
  });

  it('previewPeriod calls POST /dormitory/room-fee-invoices/preview-period', async () => {
    const payload = { start_month: '2026-03', months_count: 5 };
    const mockResponse = { start_month: '2026-03', end_month: '2026-07', eligible_count: 12, expected_total_amount: 36000000 };
    vi.mocked(httpClient).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await dormitoryApi.roomFeeInvoices.previewPeriod(payload);
    expect(httpClient).toHaveBeenCalledWith(
      expect.stringContaining('/dormitory/room-fee-invoices/preview-period'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
    expect(result.eligible_count).toBe(12);
  });

  it('createPeriod calls POST /dormitory/room-fee-invoices/create-period', async () => {
    const payload = { start_month: '2026-03', months_count: 5, notes: 'Học kỳ 2' };
    const mockResponse = { created_count: 12, skipped_count: 0, invalid_count: 0, total_amount: 36000000 };
    vi.mocked(httpClient).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await dormitoryApi.roomFeeInvoices.createPeriod(payload);
    expect(httpClient).toHaveBeenCalledWith(
      expect.stringContaining('/dormitory/room-fee-invoices/create-period'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
    expect(result.created_count).toBe(12);
  });

  it('getAll builds query parameters correctly', async () => {
    vi.mocked(httpClient).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [], meta: { total: 0 } }),
    } as any);

    await dormitoryApi.roomFeeInvoices.getAll({
      status: 'Chưa thu',
      search: 'P101',
      page: 1,
      limit: 20,
    });

    expect(httpClient).toHaveBeenCalledWith(
      expect.stringMatching(/\/dormitory\/room-fee-invoices\?.*status=Ch%C6%B0a\+thu/),
    );
  });

  it('pay calls PATCH /dormitory/room-fee-invoices/:id/pay', async () => {
    const payload = { payment_method: 'Tiền mặt', notes: 'Đóng trực tiếp' };
    vi.mocked(httpClient).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ _id: 'rfi-1', status: 'Đã thu' }),
    } as any);

    const result = await dormitoryApi.roomFeeInvoices.pay('rfi-1', payload);
    expect(httpClient).toHaveBeenCalledWith(
      expect.stringContaining('/dormitory/room-fee-invoices/rfi-1/pay'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    );
    expect(result.status).toBe('Đã thu');
  });

  it('reviewProof calls PATCH /dormitory/room-fee-invoices/:id/proof/review', async () => {
    vi.mocked(httpClient).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ _id: 'rfi-1', status: 'Đã thu' }),
    } as any);

    const result = await dormitoryApi.roomFeeInvoices.reviewProof('rfi-1', 'approved', 'req-123');
    expect(httpClient).toHaveBeenCalledWith(
      expect.stringContaining('/dormitory/room-fee-invoices/rfi-1/proof/review'),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ decision: 'approved', request_id: 'req-123' }),
      }),
    );
    expect(result.status).toBe('Đã thu');
  });

  it('bulkDelete calls POST /dormitory/room-fee-invoices/bulk-delete', async () => {
    const mockResponse = { requested: 2, deleted: ['rfi-1'], not_found: [], rejected: [{ id: 'rfi-2', reason: 'Đã thu' }] };
    vi.mocked(httpClient).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const result = await dormitoryApi.roomFeeInvoices.bulkDelete(['rfi-1', 'rfi-2']);
    expect(httpClient).toHaveBeenCalledWith(
      expect.stringContaining('/dormitory/room-fee-invoices/bulk-delete'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ ids: ['rfi-1', 'rfi-2'] }),
      }),
    );
    expect(result.deleted).toContain('rfi-1');
  });
});
