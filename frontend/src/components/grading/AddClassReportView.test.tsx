import { beforeEach, describe, expect, it } from 'vitest';
import {
  CRITERION_USAGE_STORAGE_KEY_PREFIX,
  incrementCriterionUsage,
  orderCriteriaByUsage,
  readCriterionUsage,
} from './criterion-usage';
import { createViolationItem, getViolationAddError } from './AddClassReportView';

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
});
