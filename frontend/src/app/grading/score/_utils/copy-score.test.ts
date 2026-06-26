import { describe, it, expect } from 'vitest';
import { buildTargetSafeCounts } from './copy-score';
import { calculateCriterionScore, Criteria as Criterion } from './score-calculation';

describe('Copy Score Utils', () => {
  describe('calculateCriterionScore', () => {
    it('should calculate positive scores correctly', () => {
      const criterion: Criterion = {
        id: 'cri-1',
        name: 'Tiêu chí cộng',
        pointsPerUnit: 5,
        type: 'reward',
        maxScore: 20,
        minScore: 0
      };

      expect(calculateCriterionScore(criterion, 0)).toBe(0);
      expect(calculateCriterionScore(criterion, 2)).toBe(10);
      expect(calculateCriterionScore(criterion, 4)).toBe(20);
      expect(calculateCriterionScore(criterion, 5)).toBe(20); // Clamp max
    });

    it('should calculate negative scores correctly', () => {
      const criterion: Criterion = {
        id: 'cri-2',
        name: 'Tiêu chí trừ',
        pointsPerUnit: -5,
        type: 'violation',
        maxScore: 15, // Max trừ là 15đ
        minScore: 0
      };

      expect(calculateCriterionScore(criterion, 0)).toBe(15);
      expect(calculateCriterionScore(criterion, 2)).toBe(5);
      expect(calculateCriterionScore(criterion, 3)).toBe(0);
      expect(calculateCriterionScore(criterion, 4)).toBe(0); // Clamp max trừ
    });
  });

  describe('buildTargetSafeCounts', () => {
    const criteriaList: Criterion[] = [
      { id: 'cri-1', name: 'Thường', pointsPerUnit: 5, type: 'reward' },
      { id: 'cri-2', name: 'Bị khóa', pointsPerUnit: 5, type: 'reward', is_locked: true },
      { id: 'cri-3', name: 'Điểm danh', pointsPerUnit: 2, type: 'reward' }
    ];

    it('should copy source counts normally when no restrictions apply', () => {
      const sourceCounts = { 'cri-1': 3, 'cri-2': 4, 'cri-3': 2 };
      const targetCurrentCounts = { 'cri-1': 1, 'cri-2': 1, 'cri-3': 1 };
      const targetPreCounts = {};

      const result = buildTargetSafeCounts(sourceCounts, targetCurrentCounts, targetPreCounts, criteriaList);

      expect(result['cri-1']).toBe(3); // copied normally
      expect(result['cri-2']).toBe(1); // kept target current count because it is locked
      expect(result['cri-3']).toBe(2); // copied normally
    });

    it('should overwrite target count even if it is lower than original_count, relying on backend for clamping', () => {
      const sourceCounts = { 'cri-1': 1, 'cri-3': 5 };
      const targetCurrentCounts = { 'cri-1': 3, 'cri-3': 3 };
      const targetPreCounts = {
        'cri-1': { original_count: 2, current_count: 3 }, // original_count = 2
        'cri-3': { original_count: 1, current_count: 2 }
      };

      const result = buildTargetSafeCounts(sourceCounts, targetCurrentCounts, targetPreCounts, criteriaList);

      // cri-1: no longer respects targetMin (2) -> overwrites with srcCount (1)
      expect(result['cri-1']).toBe(1);
      // cri-3: overwrites with srcCount (5)
      expect(result['cri-3']).toBe(5);
    });
  });
});
