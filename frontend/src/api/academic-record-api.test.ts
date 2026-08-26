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
});
