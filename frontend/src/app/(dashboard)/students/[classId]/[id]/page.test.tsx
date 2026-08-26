import { describe, expect, it } from 'vitest';
import { getArchivedTrainingScores, getRankBadgeStyle } from './page';

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

describe('getRankBadgeStyle', () => {
  it('returns purple theme for Xuất sắc rank', () => {
    expect(getRankBadgeStyle('Xuất sắc')).toBe('bg-purple-500/10 text-purple-700 border-purple-500/20');
  });

  it('returns blue theme for Tốt and Khá ranks', () => {
    expect(getRankBadgeStyle('Tốt')).toBe('bg-blue-500/10 text-[#1A73E8] border-blue-500/20');
    expect(getRankBadgeStyle('Khá')).toBe('bg-blue-500/10 text-[#1A73E8] border-blue-500/20');
  });

  it('returns amber theme for Trung bình rank', () => {
    expect(getRankBadgeStyle('Trung bình')).toBe('bg-amber-500/10 text-amber-700 border-amber-500/20');
  });

  it('returns rose theme for Yếu and Kém ranks', () => {
    expect(getRankBadgeStyle('Yếu')).toBe('bg-rose-500/10 text-rose-700 border-rose-500/20');
    expect(getRankBadgeStyle('Kém')).toBe('bg-rose-500/10 text-rose-700 border-rose-500/20');
  });

  it('returns fallback slate theme when rank is missing or unrecognized', () => {
    expect(getRankBadgeStyle(undefined)).toBe('bg-slate-500/10 text-[#64748B] border-slate-500/20');
    expect(getRankBadgeStyle('Chưa cập nhật')).toBe('bg-slate-500/10 text-[#64748B] border-slate-500/20');
  });
});
