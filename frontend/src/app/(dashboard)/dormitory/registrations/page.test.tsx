import { describe, expect, it } from 'vitest';
import { buildEditRegistrationPayload, buildRegistrationExportRows, createdDateLabel, getPublicRegistrationUrl, isAvailableBed, mapActiveSemester, priorityLabel, REGISTRATION_TABLE_CLASS_NAME, roomLabel, roomStatusLabel, sourceLabel, studentCode } from './page';

describe('KTX registration active semester mapping', () => {
  it('maps the active semester label to the registration payload fields', () => {
    expect(mapActiveSemester([
      { _id: 'semester-1', semester_name: 'HK2 - 2025 - 2026', start_date: '', end_date: '', status: 'active' },
    ])).toEqual({ semester: 'HK2', academic_year: '2025-2026' });
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

describe('KTX public registration QR destination', () => {
  it('uses the same-origin public registration route', () => {
    expect(getPublicRegistrationUrl('https://ktx.example.edu/')).toBe('https://ktx.example.edu/public/dormitory/register');
  });
});

describe('KTX registration table display mapping', () => {
  it('uses the requested student-code, priority, and source labels', () => {
    const row = { student_id: null, priority_group: 'Không', source: 'PUBLIC' } as any;
    expect(studentCode(row)).toBe('Chưa có mã SV');
    expect(priorityLabel(row)).toBe('Không');
    expect(sourceLabel(row.source)).toBe('QR');
    expect(sourceLabel('FORMAL')).toBe('Thủ công');
    expect(priorityLabel({ priority_group: 'Khó khăn' } as any)).toBe('Có');
    expect(studentCode({ student_id: { student_code: '  ' } } as any)).toBe('Chưa có mã SV');
    expect(createdDateLabel('not-a-date')).toBe('—');
    expect(roomLabel({ assigned_room_name: 'A101' } as any)).toBe('A101');
    expect(roomLabel({} as any)).toBe('Chưa xếp phòng');
  });
});

describe('KTX registration edit payloads', () => {
  const form = {
    full_name: 'Nguyễn A', student_code: '', semester: 'HK2', academic_year: '2025-2026', date_of_birth: '2003-01-15',
    gender: 'Female' as const, phone_number: '0912345678', room_type: 'Máy lạnh' as const, notes: 'Gần khu học tập', priority_group: 'Không' as const,
  };

  it('keeps temporary updates flat so the API never receives preference', () => {
    const payload = buildEditRegistrationPayload('ADMIN_TEMPORARY', form);
    expect(payload).toMatchObject({ room_type: 'Máy lạnh', notes: 'Gần khu học tập' });
    expect(payload).not.toHaveProperty('preference');
  });

  it('keeps nested preference for formal registration updates', () => {
    expect(buildEditRegistrationPayload('FORMAL', form).preference).toEqual({ room_type: 'Máy lạnh', notes: 'Gần khu học tập' });
  });
});

it('uses compact typography and Vietnamese Unicode export rows', () => {
  expect(REGISTRATION_TABLE_CLASS_NAME).toBe('text-xs');
  expect(buildRegistrationExportRows([{ _id: '1', student_id: { full_name: 'Nguyễn Ánh', student_code: '012' }, source: 'PUBLIC', priority_group: 'Không', assigned_room_name: 'A101', createdAt: '2026-01-02T00:00:00.000Z' }] as any)).toEqual([expect.objectContaining({ 'Mã SV': '012', 'Họ và tên': 'Nguyễn Ánh', 'Phòng': 'A101' })]);
});

it('formats room options and only accepts available beds', () => {
  expect(roomStatusLabel('Trống')).toBe('Trống');
  expect(roomStatusLabel('Bảo trì')).toBe('Bảo trì');
  expect(isAvailableBed({ status: 'Trống' } as any)).toBe(true);
  expect(isAvailableBed({ status: 'Đang sử dụng' } as any)).toBe(false);
});
