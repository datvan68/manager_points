import { describe, expect, it } from 'vitest';
import { mapAcademicRecordStudentGroup, processReportsData } from './report-helpers';

describe('mapAcademicRecordStudentGroup', () => {
  it('maps a grouped student to one summary row using authoritative counts', () => {
    const row = mapAcademicRecordStudentGroup(
      {
        studentId: 'student-1',
        latestRecord: {
          _id: 'record-2',
          student_id: { _id: 'student-1', student_code: 'SV001', full_name: 'Nguyễn Văn A', class_id: 'class-1' },
          criterion_id: { criterion_type: 'ky_luat' },
          recorded_at: '2026-09-07T10:00:00.000Z',
          record_title: 'Cảnh cáo',
          points_effect: -3,
          status: 'active'
        },
        recordCount: 3,
        recordTypeCounts: { khen_thuong: 1, cong_diem: 1, ky_luat: 1 },
        recordTypes: ['khen_thuong', 'cong_diem', 'ky_luat'],
        totalPoints: -1
      },
      [],
      [{ _id: 'class-1', class_name: 'K TP1', dept_id: 'dept-1' }],
      [{ _id: 'dept-1', name: 'Công nghệ thông tin' }]
    );

    expect(row).toMatchObject({
      key: 'student-1',
      student_code: 'SV001',
      full_name: 'Nguyễn Văn A',
      class_name: 'K TP1',
      record_count: 3,
      reward_count: 1,
      bonus_count: 1,
      discipline_count: 1,
      total_points: -1,
      latest_record_title: 'Cảnh cáo'
    });
    expect(row).not.toHaveProperty('latest_recorded_by');
  });
});

describe('processReportsData KPI aggregates', () => {
  it('keeps KPI order and uses authoritative aggregate metadata over a partial preview', () => {
    const result = processReportsData(
      {
        students: [],
        studentsTotal: 12,
        classes: [{ _id: 'class-1', class_name: 'K TP1', dept_id: 'dept-1' }],
        departments: [{ _id: 'dept-1', name: 'Công nghệ thông tin' }],
        semesters: [],
        evaluationPeriods: [],
        summaries: [],
        evaluationDetails: [],
        categories: [],
        criteria: [],
        academicRecords: [{
          _id: 'preview-record',
          student_id: { _id: 'student-1', full_name: 'Preview' },
          record_title: 'Kỷ luật',
          points_effect: -1,
          status: 'active',
        }],
        academicRecordGroups: [],
        academicRecordAggregates: {
          totalStudents: 12,
          disciplineOccurrences: 7,
          attentionStudentCount: 2,
        },
        dailyReports: [],
        tasks: [],
        taskProgress: [],
        notifications: [],
        loginLogs: [],
      } as any,
      {
        semesterId: '',
        evaluationPeriodId: '',
        departmentId: '',
        classId: '',
        startDate: '',
        endDate: '',
        searchQuery: '',
        status: '',
      },
    );

    expect(result.kpis.map((kpi: any) => kpi.title)).toEqual([
      'Tổng sinh viên',
      'Tổng số lớp',
      'Số kỷ luật',
      'Cần xử lý',
    ]);
    expect(result.kpis.map((kpi: any) => kpi.value)).toEqual([12, 1, 7, 2]);
    expect(result.kpis[3].value).not.toBe(result.tables.records.length);
  });
});
