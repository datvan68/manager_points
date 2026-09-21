import { beforeEach, describe, expect, it, vi } from 'vitest';
import { academicRecordApi } from './academic-record-api';
import { tokenStorage } from './auth-api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('academic record purge API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(tokenStorage, 'getAccessToken').mockReturnValue('admin-token');
    mockFetch.mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ eligible: 2 }),
    });
  });

  it('authenticates preview and execute requests with the selected local dates', async () => {
    await academicRecordApi.previewPurgeAcademicRecords('2026-01-02', '2026-01-05');
    await academicRecordApi.purgeAcademicRecords('2026-01-02', '2026-01-05');

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/academic-records/purge/preview'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
        body: JSON.stringify({ startDate: '2026-01-02', endDate: '2026-01-05' }),
      }),
    );
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/academic-records/purge'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
  });

  it('sends one authenticated bulk request with the selected IDs', async () => {
    const result = { requested: 2, succeeded: ['a'], failed: [{ id: 'b', message: 'blocked' }], succeededCount: 1, failedCount: 1 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(result) });

    await expect(academicRecordApi.bulkDeleteAcademicRecords(['a', 'b'])).resolves.toEqual(result);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/academic-records/bulk'),
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
        body: JSON.stringify({ ids: ['a', 'b'] }),
      }),
    );
  });

  it('sends 40 selected students in one authenticated bulk follow-up request', async () => {
    const studentIds = Array.from({ length: 40 }, (_, index) => `student-${index}`);
    const result = { requested: 40, succeeded: studentIds, failed: [], succeededCount: 40, failedCount: 0 };
    mockFetch.mockResolvedValueOnce({ ok: true, json: vi.fn().mockResolvedValue(result) });

    await expect(academicRecordApi.bulkMarkFollowUp({ semesterId: 'semester-1', studentIds })).resolves.toEqual(result);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/academic-records/follow-up/bulk'),
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
        body: JSON.stringify({ semesterId: 'semester-1', studentIds }),
      }),
    );
  });
});
