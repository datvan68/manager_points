import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AttendanceRecordPanel from './AttendanceRecordPanel';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const emptyMetrics = { recentAcademicRecords: [] } as any;

describe('AttendanceRecordPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it("describes today's records and empty state", () => {
    render(<AttendanceRecordPanel metrics={emptyMetrics} />);

    expect(screen.getByText('Ghi nhận học vụ hôm nay')).toBeDefined();
    expect(screen.getByText('Hôm nay chưa có ghi nhận học vụ')).toBeDefined();
  });

  it('keeps populated row content and both history navigation actions', () => {
    render(
      <AttendanceRecordPanel
        metrics={{
          recentAcademicRecords: [{
            _id: 'record-1',
            record_title: 'Tuyên dương',
            student_id: { full_name: 'Nguyễn An' },
            points_effect: 3,
            recorded_at: '2026-09-10T01:00:00.000Z',
          }],
        } as any}
      />,
    );

    expect(screen.getByText('Tuyên dương')).toBeDefined();
    expect(screen.getByText(/Nguyễn An/)).toBeDefined();
    expect(screen.getByText('+3đ')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Tất cả/ }));
    fireEvent.click(screen.getByRole('button', { name: /Xem tất cả ghi nhận rèn luyện/ }));
    expect(push).toHaveBeenCalledTimes(2);
    expect(push).toHaveBeenNthCalledWith(1, '/students/record');
    expect(push).toHaveBeenNthCalledWith(2, '/students/record');
  });
});
