import { describe, expect, it } from 'vitest';
import { mapActiveSemester } from './page';

describe('KTX registration active semester mapping', () => {
  it('maps the active semester label to the registration payload fields', () => {
    expect(mapActiveSemester([
      { _id: 'semester-1', semester_name: 'HK2 - 2025 - 2026', start_date: '', end_date: '', status: 'active' },
    ])).toEqual({ ky_hoc: 'HK2', nam_hoc: '2025-2026' });
  });

  it('rejects missing, duplicate, and malformed active semesters', () => {
    expect(() => mapActiveSemester([])).toThrow('Chưa có học kỳ active');
    expect(() => mapActiveSemester([
      { _id: 'semester-1', semester_name: 'HK1 - 2025 - 2026', start_date: '', end_date: '', status: 'active' },
      { _id: 'semester-2', semester_name: 'HK2 - 2025 - 2026', start_date: '', end_date: '', status: 'active' },
    ])).toThrow('Có nhiều học kỳ');
    expect(() => mapActiveSemester([
      { _id: 'semester-1', semester_name: 'Học kỳ hiện tại', start_date: '', end_date: '', status: 'active' },
    ])).toThrow('Không đọc được định dạng');
  });
});
