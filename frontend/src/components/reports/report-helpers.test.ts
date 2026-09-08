import { describe, expect, it } from 'vitest';
import { mapAcademicRecordStudentGroup } from './report-helpers';

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
  });
});
