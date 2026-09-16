import { beforeEach, describe, expect, it, vi } from 'vitest';
import { timetableApi } from './timetable-api';
import { handleResponse, httpClient } from './http-client';
vi.mock('./http-client', () => ({ httpClient: vi.fn(), handleResponse: vi.fn() }));

describe('timetableApi', () => {
  beforeEach(() => vi.clearAllMocks());
  it('sends bulk selections in one request', async () => {
    vi.mocked(httpClient).mockResolvedValue(new Response(JSON.stringify({ results: [], missing: [] }), { status: 200 }));
    await timetableApi.getTimetables([{ year: 'y', semester: 's', week: 'w', className: 'A' }]);
    expect(httpClient).toHaveBeenCalledWith(expect.stringContaining('/timetable/bulk'), expect.objectContaining({ method: 'POST', body: JSON.stringify({ selections: [{ year: 'y', semester: 's', week: 'w', className: 'A' }] }) }));
  });
  it('gets today timetable by system class id using GET only', async () => {
    vi.mocked(httpClient).mockResolvedValue({ ok: true } as Response);
    vi.mocked(handleResponse).mockResolvedValue({ status: 'empty', date: '2026-09-14', lessons: [] });
    await timetableApi.getTodayForClass('class/1');
    expect(vi.mocked(httpClient).mock.calls[0][0]).toContain('/timetable/today/class%2F1');
    expect(vi.mocked(httpClient).mock.calls[0][1]?.method).toBeUndefined();
  });

  it('sends only DTO fields when syncing a linked class or checking its week', async () => {
    vi.mocked(httpClient).mockResolvedValue({ ok: true } as Response);
    vi.mocked(handleResponse).mockResolvedValue({ status: 'pending' });
    const selection = { year: '2026', semester: '1', faculty: 'f', course: 'c', className: 'opaque|class', weekCount: 12 };
    const link = { ...selection, systemClassId: 'system-1', sourceLabel: 'Class A', matchMethod: 'manual' as const };
    const originalSelection = { ...selection };
    const originalLink = { ...link };
    await timetableApi.startSavedClassSync(link);
    expect(JSON.parse(String(vi.mocked(httpClient).mock.calls[0][1]?.body))).toEqual(selection);
    await timetableApi.syncSavedClassWeek({ ...link, week: 'opaque|week' }, 'update');
    expect(JSON.parse(String(vi.mocked(httpClient).mock.calls[1][1]?.body))).toEqual({ ...selection, week: 'opaque|week', intent: 'update' });
    await timetableApi.getSavedClassWeekStatus({ ...link, week: 'opaque|week' });
    const params = new URL(String(vi.mocked(httpClient).mock.calls[2][0]), 'http://localhost').searchParams;
    expect(Object.fromEntries(params)).toEqual({ year: '2026', semester: '1', faculty: 'f', course: 'c', className: 'opaque|class', week: 'opaque|week' });
    expect(link).toEqual(originalLink);
    expect(selection).toEqual(originalSelection);
  });

  it('omits weekCount from saved-class week status when it is absent', async () => {
    vi.mocked(httpClient).mockResolvedValue({ ok: true } as Response);
    vi.mocked(handleResponse).mockResolvedValue({ status: 'missing' });
    const selection = { year: '2026', semester: '1', className: 'opaque|class', week: 'opaque|week' };
    await timetableApi.getSavedClassWeekStatus(selection);
    const params = new URL(String(vi.mocked(httpClient).mock.calls[0][0]), 'http://localhost').searchParams;
    expect(Object.fromEntries(params)).toEqual(selection);
  });
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

  it('serializes persistent class links additively when saving settings', async () => {
    vi.mocked(httpClient).mockResolvedValue({ ok: true } as Response);
    vi.mocked(handleResponse).mockResolvedValue({ enabled: true, intervalMinutes: 60, coverage: [], classLinks: [] });
    await timetableApi.updateSyncSettings({ enabled: true, intervalMinutes: 60, coverage: [], selectedClasses: [{ year: '2026', semester: '1', className: 'legacy' }], classLinks: [{ systemClassId: 'system-1', year: '2026', semester: '1', className: 'opaque-1', sourceLabel: 'Class 1', matchMethod: 'manual' }] });
    expect(JSON.parse(String(vi.mocked(httpClient).mock.calls[0][1]?.body))).toMatchObject({ classLinks: [{ systemClassId: 'system-1', className: 'opaque-1', matchMethod: 'manual' }], selectedClasses: [{ className: 'legacy' }] });
  });
});
