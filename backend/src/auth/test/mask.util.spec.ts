import { maskLoginKey } from '../utils/mask.util';

describe('maskLoginKey', () => {
  it('should return empty string for null, undefined, or empty inputs', () => {
    expect(maskLoginKey(null)).toBe('');
    expect(maskLoginKey(undefined)).toBe('');
    expect(maskLoginKey('')).toBe('');
    expect(maskLoginKey('   ')).toBe('');
  });

  it('should mask emails correctly', () => {
    // Local part length > 2
    expect(maskLoginKey('john.doe@example.com')).toBe('j***e@example.com');
    expect(maskLoginKey('abc@domain.com')).toBe('a***c@domain.com');

    // Local part length <= 2
    expect(maskLoginKey('ab@domain.com')).toBe('a***@domain.com');
    expect(maskLoginKey('a@domain.com')).toBe('a***@domain.com');
  });

  it('should mask non-email keys (student codes / usernames) correctly', () => {
    // Length > 4
    expect(maskLoginKey('12345678')).toBe('123***78');
    expect(maskLoginKey('admin123')).toBe('adm***23');

    // Length <= 4
    expect(maskLoginKey('1234')).toBe('***');
    expect(maskLoginKey('12')).toBe('***');
  });
});
