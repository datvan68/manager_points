import { describe, expect, it } from 'vitest';
import { getArchivedTrainingScores } from './page';

describe('getArchivedTrainingScores', () => {
  it('uses locked summaries when the student has no historical snapshots', () => {
    const scores = getArchivedTrainingScores(
      { _id: 'student-1', student_code: '1240510001', full_name: 'Nguyễn Lê Hoàng Thọ', date_bir: '', sex: 'Other', status: 'Studying', training_point_history: [] },
      [
        { status: 'draft', total_score: 48 },
        { status: 'locked', semester_id: 'semester-2', period_id: 'period-2', total_score: 85, rank_label: 'Tốt', updatedAt: '2026-05-31T00:00:00.000Z' },
      ],
    );

    expect(scores).toEqual([expect.objectContaining({ semester_id: 'semester-2', total_score: 85, rank_label: 'Tốt' })]);
  });

  it('preserves stored snapshots when they exist', () => {
    const history = [{ semester_id: 'semester-1', period_id: 'period-1', total_score: 90, locked_at: '2026-01-01T00:00:00.000Z' }];

    expect(getArchivedTrainingScores(
      { _id: 'student-1', student_code: '1240510001', full_name: 'Nguyễn Lê Hoàng Thọ', date_bir: '', sex: 'Other', status: 'Studying', training_point_history: history },
      [{ status: 'locked', total_score: 85 }],
    )).toBe(history);
  });
});
