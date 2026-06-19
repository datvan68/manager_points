import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluationPeriodApi } from './evaluation-period-api';
import { httpClient, handleResponse } from './http-client';

vi.mock('./http-client', () => ({
  httpClient: vi.fn(),
  handleResponse: vi.fn()
}));

describe('evaluationPeriodApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getEvaluationPeriods', () => {
    it('should correctly call httpClient with exact url without duplicated /api/api/', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue([]) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue([]);

      const res = await evaluationPeriodApi.getEvaluationPeriods();
      
      expect(httpClient).toHaveBeenCalledTimes(1);
      const [url] = vi.mocked(httpClient).mock.calls[0];
      
      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/evaluation-periods');
      
      expect(res).toEqual([]);
    });
  });

  describe('createEvaluationPeriod', () => {
    it('should correctly call httpClient without duplicated /api/api/', async () => {
      const mockResponse = { ok: true, json: vi.fn().mockResolvedValue({}) };
      (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);
      (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue({ _id: '123' });

      await evaluationPeriodApi.createEvaluationPeriod({
        semester_id: 'sem',
        sv_deadline: '2023',
        gv_deadline: '2023',
        admin_deadline: '2023'
      });
      
      const [url] = vi.mocked(httpClient).mock.calls[0];
      expect(url).not.toContain('/api/api/');
      expect(url).toContain('/api/evaluation-periods');
    });
  });
});
