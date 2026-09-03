import { describe, expect, it } from 'vitest';
import {
  normalizeDormitoryRosterDate,
  normalizeDormitoryRosterGender,
  parseDormitoryRosterRows,
  validateDormitoryRosterFile,
} from './DormitoryRosterImportModal';

describe('DormitoryRosterImportModal parsing', () => {
  it('normalizes Vietnamese labels and spreadsheet dates', () => {
    expect(normalizeDormitoryRosterGender('NỮ')).toBe('Female');
    expect(normalizeDormitoryRosterGender('other')).toBe('Other');
    expect(normalizeDormitoryRosterDate('02/01/2004')).toBe('2004-01-02');
    expect(normalizeDormitoryRosterDate('2004-01-02')).toBe('2004-01-02');
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

  it('rejects missing headers and enforces file bounds before API use', () => {
    expect(parseDormitoryRosterRows([['Họ và tên'], ['Nguyễn A']]).errors[0].row).toBe(1);
    expect(validateDormitoryRosterFile({ name: 'roster.csv', size: 1 })).toMatch(/Excel/);
    expect(validateDormitoryRosterFile({ name: 'roster.xlsx', size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/);
    expect(validateDormitoryRosterFile({ name: 'roster.xls', size: 1 })).toBeNull();
  });
});
