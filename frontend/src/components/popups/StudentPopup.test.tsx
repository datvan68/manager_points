import { describe, expect, it } from 'vitest';
import { STUDENT_STATUS_OPTIONS } from './StudentPopup';

describe('StudentPopup status options', () => {
  it('does not offer the removed Graduated lifecycle transition', () => {
    expect(STUDENT_STATUS_OPTIONS.map((option) => option.value)).not.toContain('Graduated');
  });
});
