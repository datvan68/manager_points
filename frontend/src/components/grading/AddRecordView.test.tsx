import { describe, expect, it } from 'vitest';
import { orderCriteriaByUsage, readCriterionUsage } from './criterion-usage';

describe('AddRecordView shared criterion usage', () => {
  it('renders every API criterion exactly once after the frequent group', () => {
    const criteria = [
      { _id: 'class-a', criterion_name: 'Lớp A' },
      { _id: 'class-b', criterion_name: 'Lớp B' },
      { _id: 'class-c', criterion_name: 'Lớp C' },
      { _id: 'class-d', criterion_name: 'Lớp D' },
    ] as any;
    const ordered = orderCriteriaByUsage(criteria, { 'class-c': 4, 'class-a': 2 });

    expect(ordered.frequent.map(item => item._id)).toEqual(['class-c', 'class-a']);
    expect(ordered.remaining.map(item => item._id)).toEqual(['class-b', 'class-d']);
    expect([...ordered.frequent, ...ordered.remaining]).toHaveLength(criteria.length);
  });

  it('treats missing usage as no frequent group', () => {
    expect(readCriterionUsage('missing-user')).toEqual({});
    expect(orderCriteriaByUsage([{ _id: 'class-a' }] as any, {}).frequent).toEqual([]);
  });
});
