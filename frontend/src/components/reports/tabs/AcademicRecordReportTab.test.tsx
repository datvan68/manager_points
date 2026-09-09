import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AcademicRecordReportTab from './AcademicRecordReportTab';

const getAcademicRecords = vi.fn();
const markFollowUp = vi.fn();
vi.mock('@/api/academic-record-api', () => ({
  academicRecordApi: {
    getAcademicRecords: (...args: unknown[]) => getAcademicRecords(...args),
    markFollowUp: (...args: unknown[]) => markFollowUp(...args),
  },
}));

const row = {
  key: 'student-1', _id: 'student-1', student_code: 'SV001', full_name: 'Nguyễn Văn A',
  class_name: 'K TP1', department_name: 'CNTT', record_count: 3, reward_count: 1,
  bonus_count: 1, discipline_count: 1, total_points: -1, latest_record_title: 'Cảnh cáo',
  latest_record_at: '07/09/2026', latest_record_type: 'ky_luat' as const,
  follow_up_status: 'unhandled' as const, new_record_count: 0,
};

describe('AcademicRecordReportTab', () => {
  beforeEach(() => {
    getAcademicRecords.mockReset();
    markFollowUp.mockReset();
    vi.restoreAllMocks();
  });

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

  it('renders separate status and action columns with exact follow-up states', () => {
    render(
      <AcademicRecordReportTab
        data={[
          row,
          { ...row, key: 'student-2', _id: 'student-2', follow_up_status: 'settled', new_record_count: 0 },
          { ...row, key: 'student-3', _id: 'student-3', follow_up_status: 'new', new_record_count: 1 },
          { ...row, key: 'student-4', _id: 'student-4', follow_up_status: 'new', new_record_count: 3 },
        ]}
        isLoading={false}
        onExport={vi.fn()}
        semesterId="semester-1"
      />,
    );

    expect(screen.getByRole('columnheader', { name: 'Trạng thái' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Hành động' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Theo dõi' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Chưa xử lý').length).toBeGreaterThan(1);
    expect(screen.getAllByText('Đã xử lý').length).toBeGreaterThan(1);
    expect(screen.getAllByText('1 ghi nhận mới').length).toBeGreaterThan(1);
    expect(screen.getAllByText('3 ghi nhận mới').length).toBeGreaterThan(1);
    expect(screen.getAllByRole('button', { name: 'Xử lý' })).toHaveLength(8);
    const settledActions = screen.getAllByRole('button', { name: 'Xử lý' }).filter(button => button.hasAttribute('disabled'));
    expect(settledActions.length).toBeGreaterThan(0);
    expect(settledActions[0]).toHaveClass('disabled:opacity-50');
  });

  it('refreshes only after a successful confirmation and prevents duplicate handling', async () => {
    markFollowUp.mockResolvedValueOnce({ success: true });
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AcademicRecordReportTab data={[row]} isLoading={false} onExport={vi.fn()} semesterId="semester-1" onRefresh={onRefresh} />,
    );
    expect(screen.getAllByText('Chưa xử lý').length).toBeGreaterThan(0);
    rerender(<AcademicRecordReportTab data={[{ ...row, follow_up_status: 'settled', new_record_count: 0 }]} isLoading={false} onExport={vi.fn()} semesterId="semester-1" onRefresh={onRefresh} />);
    expect(screen.getAllByText('Đã xử lý').length).toBeGreaterThan(0);
    rerender(<AcademicRecordReportTab data={[{ ...row, follow_up_status: 'new', new_record_count: 1 }]} isLoading={false} onExport={vi.fn()} semesterId="semester-1" onRefresh={onRefresh} />);
    expect(screen.getAllByText('1 ghi nhận mới').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Xử lý' }).find(button => !button.hasAttribute('disabled'))!);
    fireEvent.click(await screen.findByRole('button', { name: 'OK', exact: true }));
    const pendingActions = screen.getAllByRole('button', { name: 'Đang xử lý...' });
    expect(pendingActions[0]).toBeDisabled();
    fireEvent.click(pendingActions[0]);
    await waitFor(() => expect(markFollowUp).toHaveBeenCalledWith('student-1', 'semester-1'));
    expect(markFollowUp).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });

  it('retains the row state and shows an error when handling fails', async () => {
    markFollowUp.mockRejectedValueOnce(new Error('stale'));
    render(<AcademicRecordReportTab data={[row]} isLoading={false} onExport={vi.fn()} semesterId="semester-1" />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Xử lý' }).find(button => !button.hasAttribute('disabled'))!);
    fireEvent.click(await screen.findByRole('button', { name: 'OK', exact: true }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể cập nhật trạng thái xử lý');
    expect(screen.getAllByText('Chưa xử lý').length).toBeGreaterThan(0);
  });

  it('does not submit or refresh when the action is cancelled', async () => {
    const onRefresh = vi.fn();
    render(<AcademicRecordReportTab data={[row]} isLoading={false} onExport={vi.fn()} semesterId="semester-1" onRefresh={onRefresh} />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Xử lý' }).find(button => !button.hasAttribute('disabled'))!);
    fireEvent.click(await screen.findByRole('button', { name: 'Hủy', exact: true }));

    expect(markFollowUp).not.toHaveBeenCalled();
    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('selects only actionable rows, opens a frozen bulk confirmation, and prevents duplicate submit', async () => {
    markFollowUp.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ success: true }), 10)));
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<AcademicRecordReportTab data={[row, { ...row, key: 'student-2', _id: 'student-2', follow_up_status: 'settled', new_record_count: 0 }]} isLoading={false} onExport={vi.fn()} semesterId="semester-1" onRefresh={onRefresh} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes.find(input => !(input as HTMLInputElement).disabled && input !== checkboxes[0])!);
    expect(screen.getByRole('button', { name: 'Xử lý đã chọn' })).toBeInTheDocument();
    expect(screen.getAllByText(/1/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Xử lý đã chọn' }));
    expect(await screen.findByText('Xác nhận đã xử lý ghi nhận của 1 sinh viên đã chọn?')).toBeInTheDocument();

    const confirm = screen.getAllByRole('button', { name: 'Xử lý', exact: true }).at(-1)!;
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(markFollowUp).toHaveBeenCalledTimes(1));
    expect(markFollowUp).toHaveBeenCalledWith('student-1', 'semester-1');
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
  });

  it('refreshes successful rows once and retains failed rows for retry', async () => {
    markFollowUp.mockImplementation((studentId: string) => studentId === 'student-2' ? Promise.reject(new Error('stale')) : Promise.resolve({ success: true }));
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<AcademicRecordReportTab data={[row, { ...row, key: 'student-2', _id: 'student-2' }]} isLoading={false} onExport={vi.fn()} semesterId="semester-1" onRefresh={onRefresh} />);

    const rowCheckboxes = screen.getAllByRole('checkbox').filter(input => !(input as HTMLInputElement).disabled);
    fireEvent.click(rowCheckboxes[1]);
    fireEvent.click(rowCheckboxes[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Xử lý đã chọn' }));
    fireEvent.click((await screen.findAllByRole('button', { name: 'Xử lý', exact: true })).at(-1)!);

    await waitFor(() => expect(markFollowUp).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('alert')).toHaveTextContent('một số sinh viên');
    expect(screen.getByRole('button', { name: 'Xử lý đã chọn' })).toBeInTheDocument();
  });
});
