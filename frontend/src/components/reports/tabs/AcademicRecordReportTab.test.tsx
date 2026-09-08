import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AcademicRecordReportTab from './AcademicRecordReportTab';

const row = {
  key: 'student-1', _id: 'student-1', student_code: 'SV001', full_name: 'Nguyễn Văn A',
  class_name: 'K TP1', department_name: 'CNTT', record_count: 3, reward_count: 1,
  bonus_count: 1, discipline_count: 1, total_points: -1, latest_record_title: 'Cảnh cáo',
  latest_record_at: '07/09/2026', latest_record_type: 'ky_luat' as const
};

describe('AcademicRecordReportTab', () => {
  it('renders student summary labels, counts, and student pagination wording', () => {
    render(<AcademicRecordReportTab data={[row]} isLoading={false} onExport={vi.fn()} serverSide totalItems={12} currentPage={1} pageSize={10} />);

    expect(screen.getByText('Tổng hợp Ghi nhận sinh viên')).toBeInTheDocument();
    expect(screen.getAllByText('3 lần').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Khen thưởng').length).toBeGreaterThan(0);
    expect(screen.getByText(/trên tổng số 12 sinh viên/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Chi tiết' }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Chi tiết' })[0]);
    expect(screen.getByText('Chi tiết ghi nhận')).toBeInTheDocument();
    expect(screen.queryByText(/Người ghi/)).not.toBeInTheDocument();
  });

  it('keeps loading and empty states', () => {
    const { rerender } = render(<AcademicRecordReportTab data={[]} isLoading={true} onExport={vi.fn()} />);
    expect(screen.queryByText('Không tìm thấy sinh viên có ghi nhận nào khớp với bộ lọc.')).not.toBeInTheDocument();
    rerender(<AcademicRecordReportTab data={[]} isLoading={false} onExport={vi.fn()} />);
    expect(screen.getAllByText(/Không tìm thấy sinh viên có ghi nhận nào khớp với bộ lọc/).length).toBeGreaterThan(0);
  });
});
