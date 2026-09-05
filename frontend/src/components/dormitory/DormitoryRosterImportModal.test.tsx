import { describe, expect, it } from 'vitest';
import { formatDormitoryRosterRowRanges, groupDormitoryRosterImportResults } from './DormitoryRosterImportModal';

describe('DormitoryRosterImportModal result grouping', () => {
  it('groups acknowledged rows by status and reason for visible operation details', () => {
    expect(formatDormitoryRosterRowRanges([7, 8, 10])).toBe('7–8, 10');
    expect(groupDormitoryRosterImportResults([
      { row: 7, status: 'failed', reason: 'Số điện thoại không hợp lệ.' },
      { row: 8, status: 'failed', reason: 'Số điện thoại không hợp lệ.' },
      { row: 10, status: 'duplicated', reason: 'Đã tồn tại.' },
    ] as any)).toEqual([
      { status: 'failed', reason: 'Số điện thoại không hợp lệ.', rows: [7, 8] },
      { status: 'duplicated', reason: 'Đã tồn tại.', rows: [10] },
    ]);
  });
});
