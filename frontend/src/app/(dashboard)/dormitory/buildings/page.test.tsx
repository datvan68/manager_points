import { describe, expect, it } from 'vitest';
import { roomBedCountLabel } from './page';

describe('KTX room capacity display', () => {
  it('uses the persisted-bed-derived maximum under the Giường column', () => {
    expect(roomBedCountLabel({ max_students: 1 })).toBe('1');
    expect(roomBedCountLabel({ max_students: 5 })).toBe('5');
    expect(roomBedCountLabel({ max_students: undefined as any })).toBe('0');
  });
});
