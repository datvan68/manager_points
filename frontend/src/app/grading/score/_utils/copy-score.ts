import { calculateCriterionScore, Criteria as Criterion } from './score-calculation';

export type { Criterion };

/**
 * Xây dựng danh sách counts an toàn cho target student từ source counts:
 * - Giữ nguyên các tiêu chí bị khóa (is_locked = true) của target student.
 * - Giữ nguyên (không hạ thấp dưới) mức pre-existing academic record (original_count) của target student.
 * - Nếu source count thấp hơn target original_count, giữ nguyên giá trị hiện tại của target.
 */
export const buildTargetSafeCounts = (
  sourceCounts: Record<string, number>,
  targetCurrentCounts: Record<string, number>,
  targetPreCounts: Record<string, { original_count: number; current_count: number }>,
  criteriaList: Criterion[]
): Record<string, number> => {
  const result: Record<string, number> = {};

  criteriaList.forEach((cri) => {
    const srcCount = sourceCounts[cri.id] || 0;
    const targetPre = targetPreCounts[cri.id] || { original_count: 0, current_count: 0 };
    const targetMin = targetPre.original_count || 0;

    // Lấy count hiện tại trong state của target, nếu chưa có thì lấy current_count pre-existing
    const targetCurrent = targetCurrentCounts[cri.id] !== undefined
      ? targetCurrentCounts[cri.id]
      : (targetPre.current_count || 0);

    if (cri.is_locked) {
      // Không thay đổi các tiêu chí bị khóa
      result[cri.id] = targetCurrent;
    } else {
      // Nếu source count nhỏ hơn target original_count, giữ nguyên giá trị hiện tại của target
      if (srcCount < targetMin) {
        result[cri.id] = targetCurrent;
      } else {
        result[cri.id] = Math.max(srcCount, targetMin);
      }
    }
  });

  return result;
};
export default {
  calculateCriterionScore,
  buildTargetSafeCounts
};
