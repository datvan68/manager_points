import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AcademicRecordReportTab from './AcademicRecordReportTab';

const getAcademicRecords = vi.fn();
vi.mock('@/api/academic-record-api', () => ({
  academicRecordApi: { getAcademicRecords: (...args: unknown[]) => getAcademicRecords(...args) },
}));

const row = {
  key: 'student-1', _id: 'student-1', student_code: 'SV001', full_name: 'Nguyễn Văn A',
  class_name: 'K TP1', department_name: 'CNTT', record_count: 3, reward_count: 1,
  bonus_count: 1, discipline_count: 1, total_points: -1, latest_record_title: 'Cảnh cáo',
  latest_record_at: '07/09/2026', latest_record_type: 'ky_luat' as const,
};

describe('AcademicRecordReportTab', () => {
  it('opens category details from each count and removes the old detail column', async () => {
    getAcademicRecords.mockResolvedValueOnce([
      {
        _id: 'record-1', record_title: 'Giấy khen', description: 'Thành tích tốt',
        points_effect: 2, recorded_at: '2026-09-07T00:00:00.000Z', status: 'active',
        criterion_id: { criterion_type: 'khen_thuong' }, student_id: 'student-1', semester_id: 'semester-1',
      },
      {
        _id: 'record-2', record_title: 'Cảnh cáo', points_effect: -3, status: 'active',
        criterion_id: { criterion_type: 'ky_luat' }, student_id: 'student-1', semester_id: 'semester-1',
      },
    ]);

    render(
      <AcademicRecordReportTab
        data={[row]}
        isLoading={false}
        onExport={vi.fn()}
        serverSide
        totalItems={12}
        currentPage={1}
        pageSize={10}
        detailQuery={{ semesterId: 'semester-1' }}
      />,
    );

    expect(screen.getByText('Tổng hợp Ghi nhận sinh viên')).toBeInTheDocument();
    expect(screen.getAllByText('3 lần').length).toBeGreaterThan(0);
    expect(screen.getByText(/trên tổng số 12 sinh viên/)).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Chi tiết' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Xem chi tiết Khen thưởng' })[0]);
    expect(await screen.findByText('Chi tiết khen thưởng')).toBeInTheDocument();
    expect(await screen.findByText('Giấy khen')).toBeInTheDocument();
    expect(screen.queryByText('Cảnh cáo')).not.toBeInTheDocument();
    await waitFor(() => expect(getAcademicRecords).toHaveBeenCalledWith(expect.objectContaining({ semesterId: 'semester-1', studentId: 'student-1' })));
  });

  it('keeps loading and empty states', () => {
    const { rerender } = render(<AcademicRecordReportTab data={[]} isLoading={true} onExport={vi.fn()} />);
    expect(screen.queryByText('Không tìm thấy sinh viên có ghi nhận nào khớp với bộ lọc.')).not.toBeInTheDocument();
    rerender(<AcademicRecordReportTab data={[]} isLoading={false} onExport={vi.fn()} />);
    expect(screen.getAllByText(/Không tìm thấy sinh viên có ghi nhận nào khớp với bộ lọc/).length).toBeGreaterThan(0);
  });
});
