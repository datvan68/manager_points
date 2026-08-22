import { describe, it, expect, vi, beforeEach } from 'vitest';
import { systemApi } from './system-api';
import { httpClient, handleResponse } from './http-client';

vi.mock('./http-client', () => ({
  httpClient: vi.fn(),
  handleResponse: vi.fn()
}));

describe('systemApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDashboardMetrics', () => {
    it('should correctly call httpClient with exact url without duplicated /api/api/', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ metrics: true });

      const res = await systemApi.getDashboardMetrics('sem-123');
      
      expect(httpClient).toHaveBeenCalledTimes(1);
      const [url] = vi.mocked(httpClient).mock.calls[0];
      
      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/system/dashboard-metrics');
      expect(url).toContain('semesterId=sem-123');
      
      expect(res.metrics).toBe(true);
    });
  });

  describe('getLoginLogs', () => {
    it('should correctly call httpClient without duplicated /api/api/', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], total: 0 });

      await systemApi.getLoginLogs({ page: 1, limit: 10 });
      
      const [url] = vi.mocked(httpClient).mock.calls[0];
      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/system/login-logs');
      expect(url).toContain('page=1');
      expect(url).toContain('limit=10');
    });
  });

  describe('getBackups', () => {
    it('should correctly call httpClient without duplicated /api/api/', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], total: 0 });

      await systemApi.getBackups({ page: 1, limit: 10 });
      
      const [url] = vi.mocked(httpClient).mock.calls[0];
      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/system/backups');
      expect(url).toContain('page=1');
      expect(url).toContain('limit=10');
    });
  });

  describe('getPerformanceSummary', () => {
    it('should correctly call httpClient without duplicated /api/api/', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({});

      await systemApi.getPerformanceSummary({ route: '/api/test' });
      
      const [url] = vi.mocked(httpClient).mock.calls[0];
      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/system/performance/summary');
      expect(url).toContain('route=%2Fapi%2Ftest');
    });
  });

  describe('previewBackupImport', () => {
    it('should correctly call httpClient with FormData and method POST', async () => {
      const mockFile = new File(['dummy content'], 'test.gz', { type: 'application/gzip' });
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ previewSessionId: 'sess' });

      const res = await systemApi.previewBackupImport(mockFile);
      
      expect(httpClient).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(httpClient).mock.calls[0];
      
      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/system/backups/import/preview');
      expect(options?.method).toBe('POST');
      expect(options?.body).toBeInstanceOf(FormData);
      
      const formData = options?.body as FormData;
      expect(formData.get('file')).toBe(mockFile);
      
      expect(handleResponse).toHaveBeenCalledWith(mockResponse);
      expect(res.previewSessionId).toBe('sess');
    });
  });

  describe('restoreBackupImport', () => {
    it('should correctly call httpClient with JSON payload and method POST', async () => {
      const mockPayload = {
        previewSessionId: 'sess-123',
        collections: ['users'],
        mode: 'replace_selected_collections' as const,
        confirmationText: 'RESTORE'
      };
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: 'job-123' });

      const res = await systemApi.restoreBackupImport(mockPayload);
      
      expect(httpClient).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(httpClient).mock.calls[0];
      
      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/system/backups/import/restore');
      expect(options?.method).toBe('POST');
      expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(options?.body as string)).toEqual(mockPayload);
      
      expect(handleResponse).toHaveBeenCalledWith(mockResponse);
      expect(res._id).toBe('job-123');
    });
  });

  describe('getRestoreJobs', () => {
    it('should correctly call httpClient with query params', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], total: 0 });

      const res = await systemApi.getRestoreJobs({ page: 2, limit: 10 });

      expect(httpClient).toHaveBeenCalledTimes(1);
      const [url] = vi.mocked(httpClient).mock.calls[0];

      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/system/backups/restore-jobs');
      expect(url).toContain('page=2');
      expect(url).toContain('limit=10');

      expect(res.items).toEqual([]);
    });
  });

  describe('storageApi', () => {
    it('should call getStorageSummary correctly', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ live_files_count: 10 });

      const res = await systemApi.getStorageSummary();
      const [url] = vi.mocked(httpClient).mock.calls[0];

      expect(url).toContain('/api/system/storage/summary');
      expect(res.live_files_count).toBe(10);
    });

    it('should call getStorageInventory with query params', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ items: [], total: 0 });

      await systemApi.getStorageInventory({ page: 1, limit: 15, status: 'quarantined' });
      const [url] = vi.mocked(httpClient).mock.calls[0];

      expect(url).toContain('/api/system/storage/inventory');
      expect(url).toContain('page=1');
      expect(url).toContain('limit=15');
      expect(url).toContain('status=quarantined');
    });

    it('should call previewStorageReconciliation with POST', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ mode: 'preview' });

      await systemApi.previewStorageReconciliation();
      const [url, options] = vi.mocked(httpClient).mock.calls[0];

      expect(url).toContain('/api/system/storage/reconcile/preview');
      expect(options?.method).toBe('POST');
    });

    it('should call executeStorageReconciliation with POST', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ mode: 'execute' });

      await systemApi.executeStorageReconciliation();
      const [url, options] = vi.mocked(httpClient).mock.calls[0];

      expect(url).toContain('/api/system/storage/reconcile/execute');
      expect(options?.method).toBe('POST');
    });

    it('should call restoreStorageAsset with POST', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ asset_id: 'asset-123' });

      await systemApi.restoreStorageAsset('asset-123');
      const [url, options] = vi.mocked(httpClient).mock.calls[0];

      expect(url).toContain('/api/system/storage/restore/asset-123');
      expect(options?.method).toBe('POST');
    });

    it('should call purgeStorageAsset with DELETE and confirmation payload', async () => {
      const mockPayload = {
        confirmationToken: 'valid-token',
        confirmationPhrase: 'XÓA VĨNH VIỄN',
        reason: 'cleanup',
      };
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({
        message: 'Purged',
        asset_id: 'asset-123',
        reclaimed_bytes: 5000,
      });

      const res = await systemApi.purgeStorageAsset('asset-123', mockPayload);
      const [url, options] = vi.mocked(httpClient).mock.calls[0];

      expect(url).toContain('/api/system/storage/purge/asset-123');
      expect(options?.method).toBe('DELETE');
      expect(options?.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(options?.body as string)).toEqual(mockPayload);
      expect(res.reclaimed_bytes).toBe(5000);
    });

    it('should call getStorageAuditLogs with limit', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      await systemApi.getStorageAuditLogs(25);
      const [url] = vi.mocked(httpClient).mock.calls[0];

      expect(url).toContain('/api/system/storage/audit-logs?limit=25');
    });
  });
});
