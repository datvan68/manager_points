import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDashboardOverview } from './dashboard-helpers';

const panelSource = readFileSync(resolve(__dirname, 'StudentSpotlightPanel.tsx'), 'utf8');
const kpiSource = readFileSync(resolve(__dirname, 'KpiGrid.tsx'), 'utf8');

const makeConfig = (academicRecords: any[], user: any = { id: 'admin', roleCode: 'ADMIN' }) => ({
  user,
  students: [
    { _id: 's1', student_code: '001', full_name: 'Nguyễn A', status: 'Studying', class_id: 'c1' },
    { _id: 's2', student_code: '002', full_name: 'Trần B', status: 'Studying', class_id: 'c1' },
  ],
  classes: [{ _id: 'c1', class_name: '12A1', advisor_id: 'teacher' }],
  departments: [],
  semesters: [{ _id: 'sem1', status: 'active' }],
  periods: [],
  summaries: [],
  academicRecords,
  criteria: [
    { _id: 'crit1', criterion_name: 'Đi muộn', criterion_type: 'ky_luat', score_per_unit: -2 },
    { _id: 'crit2', criterion_name: 'Thành tích', criterion_type: 'cong_diem', score_per_unit: 1 },
  ],
  categories: [],
  tasks: [],
  notifications: [],
  unreadCount: 0,
});

const record = (student_id: string, quantity?: number, criterion_id = 'crit1') => ({
  _id: `${student_id}-${quantity || 'legacy'}`,
  student_id,
  criterion_id,
  semester_id: 'sem1',
  status: 'active',
  is_deleted: false,
  points_effect: -2,
  quantity,
  record_title: 'Đi muộn',
});

describe('dashboard spotlight quantity aggregation', () => {
  it('normalizes quantity and groups repeated criteria', () => {
    const metrics = buildDashboardOverview(makeConfig([record('s1', 2), record('s1', 3), record('s1')]));
    expect(metrics.studentHighlights.topDiscipline[0].recordCount).toBe(6);
    expect(metrics.studentHighlights.topDiscipline[0].groupedRecords).toEqual([{ label: 'Đi muộn', count: 6 }]);
  });

  it('ranks discipline students by total quantity and excludes exactly three from KPI', () => {
    const metrics = buildDashboardOverview(makeConfig([record('s1', 3), record('s2', 4)]));
    expect(metrics.studentHighlights.topDiscipline.map(item => item.studentId)).toEqual(['s2', 's1']);
    expect(metrics.kpis.studentAttentionCount).toBe(1);
  });

  it('ranks bonus students by quantity before points', () => {
    const metrics = buildDashboardOverview(makeConfig([
      { ...record('s1', 2, 'crit2'), points_effect: 10 },
      { ...record('s2', 3, 'crit2'), points_effect: 1 },
    ]));
    expect(metrics.studentHighlights.topBonus.map(item => item.studentId)).toEqual(['s2', 's1']);
  });

  it('keeps teacher approval KPI semantics', () => {
    const metrics = buildDashboardOverview(makeConfig([], { id: 'teacher', roleCode: 'TEACHER' }));
    expect(metrics.kpis.pendingMyReviewCount).toBe(0);
  });

  it('keeps discipline first and exposes the requested table/KPI labels', () => {
    expect(panelSource).toContain("useState<'rewards' | 'bonus' | 'discipline' | 'scores'>('discipline')");
    expect(panelSource).toContain('Số lượt:');
    expect(panelSource).toContain('Điểm bị trừ:');
    expect(panelSource).toContain('Ghi nhận:');
    expect(panelSource).not.toContain('grid-cols-[minmax(0,1.4fr)');
    expect(kpiSource).toContain('isTeacher ? "Hồ sơ chờ phê duyệt" : "Sinh viên cần xử lý"');
  });
});
