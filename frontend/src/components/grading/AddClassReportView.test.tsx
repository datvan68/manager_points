import { beforeEach, describe, expect, it } from 'vitest';
import {
  CRITERION_USAGE_STORAGE_KEY_PREFIX,
  incrementCriterionUsage,
  orderCriteriaByUsage,
  readCriterionUsage,
} from './criterion-usage';
import { buildClassReportDraft, clearPendingQuickViolations, createViolationItem, filterClassesBySearch, getViolationAddError, mergeStudentsById, isClassReportDraft, shouldResetClassDependentState } from './AddClassReportView';
import { quickGridClass } from './RecordSelectionUi';

describe('AddClassReportView draft contract', () => {
  it('refetches restored classes while preserving restored attendance state', () => {
    expect(shouldResetClassDependentState(true)).toBe(false);
    expect(shouldResetClassDependentState(false)).toBe(true);
  });

  it('builds the latest source state without derived attendance totals', () => {
    const draft = buildClassReportDraft({
      classIds: ['class-1'], reportDate: new Date('2026-08-25T00:00:00.000Z'), teacherName: 'Teacher', classNote: 'note',
      selectedStudentId: 'student-1', selectedCriterionId: 'criterion-1', violationNote: 'absence', addedViolations: [],
      pendingQuickViolationKeys: new Set(['student-1:criterion-1']), entryMode: 'quick',
    });
    expect(draft).toEqual(expect.objectContaining({
      classIds: ['class-1'], reportDate: '2026-08-25T00:00:00.000Z',
      pendingQuickViolationKeys: ['student-1:criterion-1'],
    }));
    expect(draft).not.toHaveProperty('totalPresent');
  });

  it('accepts create-form fields without derived attendance totals', () => {
    expect(isClassReportDraft({
      classIds: ['class-1'], reportDate: '2026-08-25T00:00:00.000Z', teacherName: 'Teacher', classNote: 'note',
      selectedStudentId: 'student-1', selectedCriterionId: 'criterion-1', violationNote: 'absence',
      addedViolations: [], pendingQuickViolationKeys: [], entryMode: 'manual',
    })).toBe(true);
    expect(isClassReportDraft({ classIds: ['class-1'], totalPresent: 10 })).toBe(false);
    expect(isClassReportDraft({
      classIds: [], reportDate: '2026-08-25T00:00:00.000Z', teacherName: '', classNote: '',
      selectedStudentId: '', selectedCriterionId: '', violationNote: '', addedViolations: [{}],
      pendingQuickViolationKeys: [], entryMode: 'quick',
    })).toBe(false);
  });
});

const criteria = [
  { _id: 'one', criterion_name: 'Một' },
  { _id: 'two', criterion_name: 'Hai' },
  { _id: 'three', criterion_name: 'Ba' },
  { _id: 'four', criterion_name: 'Bốn' },
] as any;

describe('AddClassReportView criterion usage', () => {
  beforeEach(() => localStorage.clear());

  it('shares a per-user key and increments selections', () => {
    expect(incrementCriterionUsage('user-1', 'one')).toEqual({ one: 1 });
    expect(incrementCriterionUsage('user-1', 'one')).toEqual({ one: 2 });
    expect(localStorage.getItem(`${CRITERION_USAGE_STORAGE_KEY_PREFIX}user-1`)).toBe('{"one":2}');
    expect(readCriterionUsage('user-2')).toEqual({});
  });

  it('falls back to empty usage when storage is malformed and keeps stable top-three order', () => {
    localStorage.setItem(`${CRITERION_USAGE_STORAGE_KEY_PREFIX}user-1`, '{broken');
    expect(readCriterionUsage('user-1')).toEqual({});

    const { frequent, remaining } = orderCriteriaByUsage(criteria, {
      four: 2,
      two: 2,
      three: 1,
      one: 1,
    });
    expect(frequent.map(item => item._id)).toEqual(['two', 'four', 'one']);
    expect(remaining.map(item => item._id)).toEqual(['three']);
    expect(new Set([...frequent, ...remaining].map(item => item._id)).size).toBe(criteria.length);
  });
});

describe('AddClassReportView violation selection', () => {
  const student = { _id: 'student-1', full_name: 'Nguyễn Văn A', student_code: 'SV001' } as any;
  const criterion = { _id: 'criterion-1', criterion_name: 'Đi học muộn', score_per_unit: -3 } as any;

  it('builds manual and quick entries with the same payload and retains the note', () => {
    const violation = createViolationItem(student, criterion, 'Nhắc nhở lần 1');

    expect(violation).toMatchObject({
      student_id: 'student-1',
      student_name: 'Nguyễn Văn A',
      student_code: 'SV001',
      criterion_id: 'criterion-1',
      criterion_name: 'Đi học muộn',
      points_effect: -3,
      class_note: 'Nhắc nhở lần 1',
    });
  });

  it('rejects duplicate student/criterion pairs and the eleventh item', () => {
    const existing = [createViolationItem(student, criterion, '')];
    expect(getViolationAddError(existing, 'student-1', 'criterion-1')).toBe('duplicate');

    const tenItems = Array.from({ length: 10 }, (_, index) => ({
      ...existing[0],
      student_id: `student-${index}`,
    }));
    expect(getViolationAddError(tenItems, 'student-11', 'criterion-1')).toBe('limit');
  });

  it('merges rosters from selected classes without duplicate student IDs', () => {
    const firstClassStudent = { _id: 'student-1', full_name: 'Nguyễn Văn A' } as any;
    const secondClassStudent = { _id: 'student-2', full_name: 'Trần Văn B' } as any;
    const refreshedStudent = { _id: 'student-1', full_name: 'Nguyễn Văn A cập nhật' } as any;

    expect(mergeStudentsById([[firstClassStudent], [secondClassStudent, refreshedStudent]])).toEqual([
      refreshedStudent,
      secondClassStudent,
    ]);
  });

  it('filters classes by displayed name, year, or id', () => {
    const classes = [{ _id: 'class-1', class_name: 'CNTT-01', class_year: '2025' }, { _id: 'class-2', class_name: 'Kế toán-02', class_year: '2024' }] as any;
    expect(filterClassesBySearch(classes, 'ke toan')).toHaveLength(1);
    expect(filterClassesBySearch(classes, '2025')[0]._id).toBe('class-1');
  });

  it('clears only pending quick violations when the criterion changes', () => {
    const preserved = createViolationItem({ _id: 'student-1', full_name: 'A', student_code: 'A' } as any, { _id: 'criterion-old', criterion_name: 'Cũ' } as any, 'manual');
    const pending = createViolationItem({ _id: 'student-2', full_name: 'B', student_code: 'B' } as any, { _id: 'criterion-old', criterion_name: 'Cũ' } as any, 'quick');

    expect(clearPendingQuickViolations([preserved, pending], new Set(['student-2:criterion-old']))).toEqual([preserved]);
  });

  it('keeps the quick violation viewport complete through the six-card boundary', () => {
    expect(quickGridClass(6)).toContain('overflow-visible');
    expect(quickGridClass(7)).toMatch(/auto-rows-\[52px\].*sm:auto-rows-\[56px\].*xl:auto-rows-\[52px\]/);
  });
});
