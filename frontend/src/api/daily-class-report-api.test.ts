import { beforeEach, describe, expect, it, vi } from 'vitest';
import { dailyClassReportApi, normalizeDailyClassReport } from './daily-class-report-api';
import { handleResponse, httpClient } from './http-client';

vi.mock('./http-client', () => ({
  httpClient: vi.fn(),
  handleResponse: vi.fn(),
}));

const rawReport = {
  _id: 'report-1', class_id: 'class-1', user_id: 'user-1', report_date: '2026-08-25',
  total_present: 2, total_absent: 0, class_notes: 'Ghi chú đã lưu',
};

describe('dailyClassReportApi report normalization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps canonical class_notes to the frontend class_note field', () => {
    expect(normalizeDailyClassReport(rawReport)).toMatchObject({ class_note: 'Ghi chú đã lưu' });
  });

  it('normalizes list, detail, and legacy responses while preserving blank notes', async () => {
    (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    (handleResponse as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: [rawReport], meta: { total: 1 } })
      .mockResolvedValueOnce({ ...rawReport, class_notes: '  ' })
      .mockResolvedValueOnce([{ ...rawReport, class_notes: undefined, class_note: 'Legacy note' }]);

    await expect(dailyClassReportApi.getDailyClassReports()).resolves.toMatchObject({
      data: [{ class_note: 'Ghi chú đã lưu' }],
    });
    await expect(dailyClassReportApi.getDailyClassReport('report-1')).resolves.toMatchObject({ class_note: '' });
    await expect(dailyClassReportApi.getDailyClassReportsByClass('class-1')).resolves.toEqual([
      expect.objectContaining({ class_note: 'Legacy note' }),
    ]);
  });

  it('keeps create and update payloads on the backend class_notes contract', async () => {
    (httpClient as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true });
    (handleResponse as ReturnType<typeof vi.fn>).mockResolvedValue(rawReport);
    const dto = {
      class_id: 'class-1', reported_by: 'user-1', report_date: '2026-08-25',
      total_present: 2, total_absent: 0, class_notes: 'Ghi chú đã lưu',
    };

    await dailyClassReportApi.createDailyClassReport(dto);
    await dailyClassReportApi.updateDailyClassReport('report-1', { class_notes: 'Ghi chú đã sửa' });

    expect(JSON.parse((httpClient as ReturnType<typeof vi.fn>).mock.calls[0][1].body)).toMatchObject({ class_notes: dto.class_notes });
    expect(JSON.parse((httpClient as ReturnType<typeof vi.fn>).mock.calls[1][1].body)).toEqual({ class_notes: 'Ghi chú đã sửa' });
  });
});
