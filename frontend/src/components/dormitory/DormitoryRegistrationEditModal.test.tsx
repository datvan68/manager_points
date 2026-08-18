import { describe, expect, it } from 'vitest';
import { buildEditRegistrationPayload, formFromRegistration, mapActiveSemester } from './DormitoryRegistrationEditModal';

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

  it('omits linked Student identity overrides while keeping supplied fields editable', () => {
    const form = formFromRegistration({ _id: 'entry-1', student_id: { _id: 'student-1', full_name: 'Student A', student_code: 'SV001', date_bir: '2003-01-02', sex: 'Female' }, full_name: 'Old value', date_of_birth: '2000-01-01', gender: 'Male', phone_number: '0912345678', room_type: 'Thường', notes: 'old' } as any);
    const payload = buildEditRegistrationPayload({ ...form, phone_number: '0987654321', room_type: 'Máy lạnh', notes: 'new' }, form, true);
    expect(payload).toEqual({ phone_number: '0987654321', room_type: 'Máy lạnh', notes: 'new', applicant_profile: undefined });
    expect(payload).not.toHaveProperty('full_name');
    expect(payload).not.toHaveProperty('date_of_birth');
    expect(payload).not.toHaveProperty('gender');
  });
});
