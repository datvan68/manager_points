export interface Criterion {
  id: string;
  name: string;
  pointsPerUnit: number;
  type: "reward" | "violation";
  maxScore?: number;
  minScore?: number;
  is_locked?: boolean;
  is_score_counted?: boolean;
}

/**
 * Tính điểm cho một tiêu chí dựa trên số lượng count và pointsPerUnit.
 * Đảm bảo clamp điểm trong giới hạn [minScore, maxScore] hoặc [-maxScore, 0] nếu là violation.
 */
export const calculateCriterionScore = (criterion: Criterion, count: number): number => {
  const maxScore = criterion.maxScore ?? 10;
  const minScore = criterion.minScore ?? 0;
  const rawScore = count * criterion.pointsPerUnit;

  return criterion.pointsPerUnit >= 0
    ? Math.max(minScore, Math.min(maxScore, rawScore))
    : Math.max(-maxScore, Math.min(0, rawScore));
};

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
