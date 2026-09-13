import { describe, expect, it, vi } from 'vitest';
import { timetableApi } from './timetable-api';
import { handleResponse, httpClient } from './http-client';
vi.mock('./http-client', () => ({ httpClient: vi.fn(), handleResponse: vi.fn() }));

describe('timetableApi', () => {
  it('times out a stalled request and aborts its fetch', async () => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    try {
      vi.mocked(httpClient).mockImplementation(() => new Promise(() => {}));
      const pending = timetableApi.getOptions();
      const assertion = expect(pending).rejects.toThrow('Vui lòng thử lại');
      await vi.advanceTimersByTimeAsync(45000);
      await assertion;
      expect(vi.mocked(httpClient).mock.calls[0][1]?.signal?.aborted).toBe(true);
    } finally { vi.useRealTimers(); vi.clearAllMocks(); }
  });
  it('keeps opaque option values in requests', async () => {
    vi.mocked(httpClient).mockResolvedValue({ ok: true } as Response);
    vi.mocked(handleResponse).mockResolvedValue({ years: [] });
    await timetableApi.getTimetable({ year: '2025|source', semester: '2', week: '54', className: 'Lớp A/B' });
    expect(vi.mocked(httpClient).mock.calls[0][0]).toContain('year=2025%7Csource');
    expect(vi.mocked(httpClient).mock.calls[0][0]).toContain('className=L%E1%BB%9Bp+A%2FB');
  });

  it('uses the exact saved-class week status and action contracts', async () => {
    vi.mocked(httpClient).mockResolvedValue({ ok: true } as Response);
    vi.mocked(handleResponse).mockResolvedValue({ status: 'pending', key: 'k' });
    const selection = { year: '2026', semester: '1', faculty: 'f', course: 'c', className: 'A', week: 'opaque|past' };
    await timetableApi.getSavedClassWeekStatus(selection);
    expect(vi.mocked(httpClient).mock.calls[0][0]).toContain('/timetable/sync/class/week/status?');
    await timetableApi.syncSavedClassWeek(selection, 'update');
    expect(vi.mocked(httpClient).mock.calls[1][0]).toContain('/timetable/sync/class/week');
    expect(JSON.parse(String(vi.mocked(httpClient).mock.calls[1][1]?.body))).toMatchObject({ week: 'opaque|past', intent: 'update' });
  });
});
