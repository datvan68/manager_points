import { describe, expect, it } from 'vitest';
import { publicRoomTypeForGender } from './PublicDormitoryRegistrationModal';

describe('public KTX registration room type', () => {
  it('allows the requested room type only for female applicants', () => {
    expect(publicRoomTypeForGender('Female', 'Máy lạnh')).toBe('Máy lạnh');
    expect(publicRoomTypeForGender('Male', 'Máy lạnh')).toBe('Thường');
    expect(publicRoomTypeForGender('Other', 'Máy lạnh')).toBe('Thường');
  });
});
