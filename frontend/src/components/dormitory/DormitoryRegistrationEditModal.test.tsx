import { describe, expect, it } from 'vitest';
import { buildEditRegistrationPayload, mapActiveSemester } from './DormitoryRegistrationEditModal';

describe('canonical roster edit behavior', () => {
  it('builds only canonical roster fields', () => {
    const payload = buildEditRegistrationPayload({ full_name: ' Nguyễn A ', student_code: '', semester: 'HK1', academic_year: '2026-2027', date_of_birth: '2003-01-01', gender: 'Other', phone_number: '0912345678', room_type: 'Thường', notes: ' note ', applicant_profile: {} });
    expect(payload).toEqual(expect.objectContaining({ full_name: 'Nguyễn A', phone_number: '0912345678', notes: 'note' }));
    expect(payload).not.toHaveProperty('registration_id');
  });

  it('requires exactly one active semester', () => {
    expect(() => mapActiveSemester([])).toThrow();
    expect(mapActiveSemester([{ _id: 's1', semester_name: 'HK1 - 2026 - 2027', status: 'active' } as any])).toEqual({ semester: 'HK1', academic_year: '2026-2027' });
  });
});
