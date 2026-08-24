import { beforeEach, describe, expect, it } from 'vitest';
import {
  CRITERION_USAGE_STORAGE_KEY_PREFIX,
  incrementCriterionUsage,
  orderCriteriaByUsage,
  readCriterionUsage,
} from './criterion-usage';

const criteria = [
  { _id: 'one', criterion_name: 'Một' },
  { _id: 'two', criterion_name: 'Hai' },
  { _id: 'three', criterion_name: 'Ba' },
  { _id: 'four', criterion_name: 'Bốn' },
] as any;

describe('AddClassReportView criterion usage', () => {
  beforeEach(() => localStorage.clear());

  it('shares a per-user key and increments selections', () => {
    expect(incrementCriterionUsage('user-1', 'one')).toEqual({ one: 1 });
    expect(incrementCriterionUsage('user-1', 'one')).toEqual({ one: 2 });
    expect(localStorage.getItem(`${CRITERION_USAGE_STORAGE_KEY_PREFIX}user-1`)).toBe('{"one":2}');
    expect(readCriterionUsage('user-2')).toEqual({});
  });

  it('falls back to empty usage when storage is malformed and keeps stable top-three order', () => {
    localStorage.setItem(`${CRITERION_USAGE_STORAGE_KEY_PREFIX}user-1`, '{broken');
    expect(readCriterionUsage('user-1')).toEqual({});

    const { frequent, remaining } = orderCriteriaByUsage(criteria, {
      four: 2,
      two: 2,
      three: 1,
      one: 1,
    });
    expect(frequent.map(item => item._id)).toEqual(['two', 'four', 'one']);
    expect(remaining.map(item => item._id)).toEqual(['three']);
    expect(new Set([...frequent, ...remaining].map(item => item._id)).size).toBe(criteria.length);
  });
});
