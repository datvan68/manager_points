import { describe, expect, it } from 'vitest';
import { sortPermissionGroups, sortPermissions } from './permission-order';

describe('permission editor ordering', () => {
  it('places record and grading groups in business order', () => {
    const groups = [
      { tag: 'G_GRADING', name: 'Điểm' },
      { tag: 'G_STUDENT_RECORD', name: 'Ghi nhận' },
      { tag: 'G_STUDENT', name: 'Sinh viên' },
    ];
    expect(sortPermissionGroups(groups).map((group) => group.tag)).toEqual([
      'G_STUDENT', 'G_STUDENT_RECORD', 'G_GRADING',
    ]);
  });

  it('uses the explicit record/grading order and deterministic fallback', () => {
    const permissions = [
      { code: 'CONFIG_RECORD' },
      { code: 'UNKNOWN_B' },
      { code: 'READ_CLASS_RECORD' },
      { code: 'GRADING_PAGE' },
      { code: 'UNKNOWN_A' },
      { code: 'READ_STUDENT_RECORD' },
    ];
    expect(sortPermissions(permissions).map((permission) => permission.code)).toEqual([
      'READ_STUDENT_RECORD', 'READ_CLASS_RECORD', 'GRADING_PAGE', 'CONFIG_RECORD',
      'UNKNOWN_B', 'UNKNOWN_A',
    ]);
  });
});
