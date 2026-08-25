import { describe, expect, it } from 'vitest';
import { orderCriteriaByUsage, readCriterionUsage } from './criterion-usage';
import { buildStudentRecordDraft, buildViolationItems, clearPendingQuickViolations, mergeStudentsById, toggleStudentSelectionState, isStudentRecordDraft } from './AddRecordView';

describe('AddRecordView draft contract', () => {
  it('builds the latest source state for navigation persistence', () => {
    expect(buildStudentRecordDraft({
      classIds: ['class-1'], reportDate: new Date('2026-08-25T00:00:00.000Z'),
      criterionId: 'criterion-1', selectedStudentId: 'student-1', entryMode: 'manual',
      pendingQuickViolationKeys: new Set(['student-1:criterion-1']), violationNote: 'note', addedViolations: [],
    })).toEqual(expect.objectContaining({
      classIds: ['class-1'], reportDate: '2026-08-25T00:00:00.000Z', entryMode: 'manual',
      pendingQuickViolationKeys: ['student-1:criterion-1'],
    }));
  });

  it('accepts the create-form fields and rejects malformed values', () => {
    expect(isStudentRecordDraft({
      classIds: ['class-1'], reportDate: '2026-08-25T00:00:00.000Z', criterionId: 'criterion-1',
      selectedStudentId: 'student-1', entryMode: 'quick', pendingQuickViolationKeys: [],
      violationNote: 'note', addedViolations: [],
    })).toBe(true);
    expect(isStudentRecordDraft({ classIds: ['class-1'], reportDate: 123 })).toBe(false);
    expect(isStudentRecordDraft({
      classIds: [], reportDate: '2026-08-25T00:00:00.000Z', criterionId: '', selectedStudentId: '',
      entryMode: 'quick', pendingQuickViolationKeys: [], violationNote: '', addedViolations: [{}],
    })).toBe(false);
  });
});

describe('AddRecordView shared criterion usage', () => {
  it('renders every API criterion exactly once after the frequent group', () => {
    const criteria = [
      { _id: 'class-a', criterion_name: 'Lớp A' },
      { _id: 'class-b', criterion_name: 'Lớp B' },
      { _id: 'class-c', criterion_name: 'Lớp C' },
      { _id: 'class-d', criterion_name: 'Lớp D' },
    ] as any;
    const ordered = orderCriteriaByUsage(criteria, { 'class-c': 4, 'class-a': 2 });

    expect(ordered.frequent.map(item => item._id)).toEqual(['class-c', 'class-a']);
    expect(ordered.remaining.map(item => item._id)).toEqual(['class-b', 'class-d']);
    expect([...ordered.frequent, ...ordered.remaining]).toHaveLength(criteria.length);
  });

  it('treats missing usage as no frequent group', () => {
    expect(readCriterionUsage('missing-user')).toEqual({});
    expect(orderCriteriaByUsage([{ _id: 'class-a' }] as any, {}).frequent).toEqual([]);
  });
});

describe('AddRecordView multi-student staging', () => {
  const students = [
    { _id: 'student-a', full_name: 'Nguyễn A', student_code: 'A01' },
    { _id: 'student-b', full_name: 'Trần B', student_code: 'B01' },
  ] as any;
  const criterion = {
    _id: 'criterion-a',
    criterion_name: 'Đi học muộn',
    score_per_unit: -5,
    min_score: -5,
  } as any;

  it('toggles a student without dropping previously selected snapshots', () => {
    const first = toggleStudentSelectionState([], [], students[0]);
    const second = toggleStudentSelectionState(first.selectedIds, first.selectedStudents, students[1]);
    const removed = toggleStudentSelectionState(second.selectedIds, second.selectedStudents, students[0]);

    expect(second.selectedIds).toEqual(['student-a', 'student-b']);
    expect(removed.selectedIds).toEqual(['student-b']);
    expect(removed.selectedStudents.map(student => student._id)).toEqual(['student-b']);
  });

  it('stages one row per selected student and keeps the note', () => {
    expect(buildViolationItems(students, ['student-a', 'student-b'], criterion, 'Lần đầu', [])).toEqual([
      expect.objectContaining({ student_id: 'student-a', class_note: 'Lần đầu' }),
      expect.objectContaining({ student_id: 'student-b', class_note: 'Lần đầu' }),
    ]);
  });

  it('skips already-staged student and criterion pairs', () => {
    const existing = buildViolationItems(students, ['student-a'], criterion, '', []);
    expect(buildViolationItems(students, ['student-a', 'student-b'], criterion, '', existing).map(item => item.student_id)).toEqual(['student-b']);
  });

  it('merges overlapping class rosters by student id', () => {
    expect(mergeStudentsById([[students[0]], [students[0], students[1]]]).map(student => student._id)).toEqual(['student-a', 'student-b']);
  });

  it('clears only pending quick rows when the criterion changes', () => {
    const other = buildViolationItems(students, ['student-b'], criterion, '', []);
    expect(clearPendingQuickViolations([...existingRows(), ...other], new Set(['student-a:criterion-a'])).map(item => item.student_id)).toEqual(['student-b']);
  });
});

function existingRows() {
  return buildViolationItems(studentsForTest(), ['student-a'], criterionForTest(), '', []);
}

function studentsForTest() {
  return [
    { _id: 'student-a', full_name: 'Nguyễn A', student_code: 'A01' },
    { _id: 'student-b', full_name: 'Trần B', student_code: 'B01' },
  ] as any;
}

function criterionForTest() {
  return { _id: 'criterion-a', criterion_name: 'Đi học muộn', score_per_unit: -5, min_score: -5 } as any;
}
