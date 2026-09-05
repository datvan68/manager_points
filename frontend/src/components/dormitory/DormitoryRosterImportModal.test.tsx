import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { dormitoryApi } from '@/api/dormitory-api';
import { semesterApi } from '@/api/semester-api';
import {
  formatDormitoryRosterRowRanges,
  groupDormitoryRosterImportResults,
  normalizeDormitoryRosterDate,
  normalizeDormitoryRosterGender,
  parseDormitoryRosterRows,
  validateDormitoryRosterFile,
} from './DormitoryRosterImportModal';
import DormitoryRosterImportModal from './DormitoryRosterImportModal';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('xlsx', () => ({
  read: vi.fn(() => ({ SheetNames: ['Sheet1'], Sheets: { Sheet1: {} } })),
  utils: { sheet_to_json: vi.fn(() => [['Họ và tên', 'Ngày sinh', 'Giới tính', 'Số điện thoại'], ['Nguyễn Văn A', '02/01/2004', 'Nam', '0912345678']]) },
}));

describe('DormitoryRosterImportModal parsing', () => {
  it('normalizes Vietnamese labels and spreadsheet dates', () => {
    expect(normalizeDormitoryRosterGender('NỮ')).toBe('Female');
    expect(normalizeDormitoryRosterGender('other')).toBe('Other');
    expect(normalizeDormitoryRosterDate('02/01/2004')).toBe('2004-01-02');
    expect(normalizeDormitoryRosterDate('2004-01-02')).toBe('2004-01-02');
    expect(normalizeDormitoryRosterDate(40022)).toBe('2009-07-28');
  });

  it('maps reordered headers and returns row-numbered validation errors', () => {
    const parsed = parseDormitoryRosterRows([
      ['Số điện thoại', 'Giới tính', 'Họ và tên', 'Ngày sinh'],
      ['0912345678', 'Nam', 'Nguyễn Văn A', '02/01/2004'],
      ['bad', 'unknown', 'A', '31/02/2004'],
    ]);
    expect(parsed.rows).toEqual([{ rowNumber: 2, full_name: 'Nguyễn Văn A', date_of_birth: '2004-01-02', gender: 'Male', phone_number: '0912345678' }]);
    expect(parsed.errors.map(error => error.row)).toEqual([3, 3, 3, 3]);
  });

  it('accepts an optional room code while preserving four-column imports', () => {
    const parsed = parseDormitoryRosterRows([
      ['Họ và tên', 'Ngày sinh', 'Giới tính', 'Số điện thoại', 'Mã phòng'],
      ['Nguyễn Văn A', '02/01/2004', 'Nam', '0912345678', 'p101'],
    ]);
    expect(parsed.errors).toEqual([]);
    expect(parsed.rows[0]).toMatchObject({ room_code: 'p101' });
  });

  it('rejects missing headers and enforces file bounds before API use', () => {
    expect(parseDormitoryRosterRows([['Họ và tên'], ['Nguyễn A']]).errors[0].row).toBe(1);
    expect(validateDormitoryRosterFile({ name: 'roster.csv', size: 1 })).toMatch(/Excel/);
    expect(validateDormitoryRosterFile({ name: 'roster.xlsx', size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/);
    expect(validateDormitoryRosterFile({ name: 'roster.xls', size: 1 })).toBeNull();
  });

  it('groups identical import outcomes and renders compact row ranges', () => {
    const groups = groupDormitoryRosterImportResults([
      { row: 2, status: 'failed', reason: 'Phòng KTX01 chỉ còn 4 giường trống.' },
      { row: 3, status: 'failed', reason: 'Phòng KTX01 chỉ còn 4 giường trống.' },
      { row: 5, status: 'failed', reason: 'Phòng KTX01 chỉ còn 4 giường trống.' },
      { row: 8, status: 'created' },
    ]);

    expect(groups).toHaveLength(2);
    expect(formatDormitoryRosterRowRanges(groups[0].rows)).toBe('2–3, 5');
    expect(groups[0]).toMatchObject({ status: 'failed', reason: 'Phòng KTX01 chỉ còn 4 giường trống.' });
  });

  it('closes input/confirmation before the first request and keeps the progress result visible', async () => {
    vi.spyOn(semesterApi, 'getSemesters').mockResolvedValue([{ _id: 'semester-1', semester_name: 'HK1 - 2026 - 2027', status: 'active', start_date: '', end_date: '' }]);
    let resolveImport!: (value: any) => void;
    const importRows = vi.spyOn(dormitoryApi.roster, 'importRows').mockImplementation(() => new Promise(resolve => { resolveImport = resolve; }));
    const file = new File(['synthetic'], 'roster.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    Object.defineProperty(file, 'arrayBuffer', { value: async () => new ArrayBuffer(1) });
    const { container } = render(<DormitoryRosterImportModal isOpen onClose={vi.fn()} />);
    fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra tệp' }));
    await screen.findByText('1 dòng hợp lệ đã sẵn sàng');
    fireEvent.click(screen.getByRole('button', { name: 'Import 1 dòng hợp lệ' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Import dữ liệu' }));
    await waitFor(() => expect(importRows).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByText('Nhập Danh sách KTX từ Excel')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Đang xử lý…' })).toBeDisabled();
    resolveImport({ requested: 1, created: 1, duplicated: 0, failed: 0, linked: 1, unlinked: 0, conflicts: 0, results: [{ row: 2, status: 'created', identity_state: 'LINKED' }] });
    await waitFor(() => expect(screen.getByText('1/1 · 100%')).toBeInTheDocument());
  });
});
