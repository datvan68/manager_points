import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ClassRecordPanel from './ClassRecordPanel';
import { systemApi } from '@/api/system-api';

vi.mock('@/api/system-api', () => ({
  systemApi: { getClassRecordSummaries: vi.fn() },
}));

describe('ClassRecordPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders class totals and the two-line record popover', async () => {
    vi.mocked(systemApi.getClassRecordSummaries).mockResolvedValue({
      items: [{ classId: 'class-1', className: '10A1', recordCount: 3, records: [{ recordId: 'record-1', studentId: 'student-1', studentName: 'Nguyễn An', classId: 'class-1', className: '10A1', content: 'Tuyên dương' }] }],
      total: 1, page: 1, limit: 20, hasMore: false, semesterId: 'sem-1',
    });
    render(<ClassRecordPanel semesterId="sem-1" />);

    await waitFor(() => expect(screen.getByText('Lớp 10A1 - 3 ghi nhận')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: /Lớp 10A1/ }));
    expect(await screen.findByText('Nguyễn An - 10A1')).toBeDefined();
    expect(screen.getByText('Tuyên dương')).toBeDefined();
    expect(systemApi.getClassRecordSummaries).toHaveBeenCalledWith({ semesterId: 'sem-1', page: 1, limit: 20 }, expect.any(AbortSignal));
  });

  it('keeps a newer semester response when the previous request resolves later', async () => {
    let resolveFirst!: (value: any) => void;
    let resolveSecond!: (value: any) => void;
    vi.mocked(systemApi.getClassRecordSummaries)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveSecond = resolve; }));
    const view = render(<ClassRecordPanel semesterId="sem-1" />);
    view.rerender(<ClassRecordPanel semesterId="sem-2" />);

    await act(async () => resolveFirst({ items: [{ classId: 'old', className: 'Cũ', recordCount: 1, records: [] }], total: 1 }));
    expect(screen.queryByText(/Lớp Cũ/)).toBeNull();
    await act(async () => resolveSecond({ items: [{ classId: 'new', className: 'Mới', recordCount: 2, records: [] }], total: 1 }));
    expect(await screen.findByText('Lớp Mới - 2 ghi nhận')).toBeDefined();
  });

  it('shows explicit empty and error states', async () => {
    vi.mocked(systemApi.getClassRecordSummaries).mockResolvedValueOnce({ items: [], total: 0 } as any);
    const view = render(<ClassRecordPanel semesterId="sem-1" />);
    expect(await screen.findByText('Chưa có ghi nhận trong học kỳ này.')).toBeDefined();
    vi.mocked(systemApi.getClassRecordSummaries).mockRejectedValueOnce(new Error('offline'));
    view.rerender(<ClassRecordPanel semesterId="sem-2" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeDefined());
  });
});
