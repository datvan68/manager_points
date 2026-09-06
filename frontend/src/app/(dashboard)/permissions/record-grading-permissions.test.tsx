import { describe, expect, it } from 'vitest';
import { sortPermissionGroups, sortPermissions } from './permission-order';

describe('record/grading permission editor contract', () => {
  it('keeps record capabilities isolated from grading capabilities', () => {
    const record = [
      'READ_STUDENT_RECORD', 'CREATE_STUDENT_RECORD', 'UPDATE_STUDENT_RECORD',
      'DELETE_STUDENT_RECORD', 'READ_CLASS_RECORD', 'READ_ALL_CLASS_RECORD',
      'CREATE_CLASS_RECORD', 'UPDATE_CLASS_RECORD', 'DELETE_CLASS_RECORD',
    ].map((code) => ({ code }));
    const grading = ['GRADING_PAGE', 'GRADING_SEMESTER_MANAGE', 'CONFIG_RECORD'].map((code) => ({ code }));
    expect(sortPermissions(record).map((permission) => permission.code)).toEqual(record.map((permission) => permission.code));
    expect(sortPermissions(grading).map((permission) => permission.code)).toEqual(grading.map((permission) => permission.code));
    expect(record.map((permission) => permission.code)).not.toEqual(expect.arrayContaining(grading.map((permission) => permission.code)));
  });

  it('renders groups in student, record, grading order', () => {
    expect(sortPermissionGroups([
      { tag: 'G_GRADING' },
      { tag: 'G_STUDENT_RECORD' },
      { tag: 'G_STUDENT' },
    ]).map((group) => group.tag)).toEqual([
      'G_STUDENT', 'G_STUDENT_RECORD', 'G_GRADING',
    ]);
  });
});
