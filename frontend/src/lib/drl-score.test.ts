import { describe, it, expect } from 'vitest';
import { resolveDrlScore } from './drl-score';

describe('resolveDrlScore Helper', () => {
  it('should return 85 for { total_score: 85 }', () => {
    expect(resolveDrlScore({ total_score: 85 })).toBe(85);
  });

  it('should return 0 for { total_score: 0 }', () => {
    expect(resolveDrlScore({ total_score: 0 })).toBe(0);
  });

  it('should return 75 for { score: 75 } using legacy score field', () => {
    expect(resolveDrlScore({ score: 75 })).toBe(75);
  });

  it('should return null for null, undefined, empty string, or invalid data', () => {
    expect(resolveDrlScore(null)).toBeNull();
    expect(resolveDrlScore(undefined)).toBeNull();
    expect(resolveDrlScore({ total_score: null })).toBeNull();
    expect(resolveDrlScore({ total_score: undefined })).toBeNull();
    expect(resolveDrlScore({ total_score: '' })).toBeNull();
    expect(resolveDrlScore({ total_score: 'not-a-number' })).toBeNull();
    expect(resolveDrlScore({})).toBeNull();
  });

  it('should clamp values outside 0-100 range', () => {
    expect(resolveDrlScore({ total_score: 105 })).toBe(100);
    expect(resolveDrlScore({ total_score: -5 })).toBe(0);
    expect(resolveDrlScore({ score: 120 })).toBe(100);
    expect(resolveDrlScore({ score: -50 })).toBe(0);
  });
});
