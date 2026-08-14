import { describe, expect, it } from 'vitest';
import { buildPublicRegistrationPayload, emptyApplicantProfile, publicRoomTypeForGender } from './PublicDormitoryRegistrationModal';

describe('public KTX registration room type', () => {
  it('allows the requested room type only for female applicants', () => {
    expect(publicRoomTypeForGender('Female', 'Máy lạnh')).toBe('Máy lạnh');
    expect(publicRoomTypeForGender('Male', 'Máy lạnh')).toBe('Thường');
    expect(publicRoomTypeForGender('Other', 'Máy lạnh')).toBe('Thường');
  });
});

it('persists populated applicant and parent profile fields while omitting blank fields', () => {
  const applicant_profile = emptyApplicantProfile();
  applicant_profile.ethnicity = 'Kinh';
  applicant_profile.father!.full_name = 'Nguyễn Văn B';
  const payload = buildPublicRegistrationPayload({ full_name: 'Nguyễn Văn A', student_code: '', date_of_birth: '2003-01-15', gender: 'Male', phone_number: '0912345678', room_type: 'Máy lạnh', notes: '', applicant_profile });
  expect(payload.applicant_profile).toEqual({ ethnicity: 'Kinh', father: { full_name: 'Nguyễn Văn B' } });
});
