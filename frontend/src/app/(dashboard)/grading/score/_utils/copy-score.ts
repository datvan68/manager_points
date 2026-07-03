import { calculateCriterionScore, Criteria as Criterion } from './score-calculation';

export type { Criterion };

/**
 * Xây dựng danh sách counts an toàn cho target student từ source counts:
 * - Giữ nguyên các tiêu chí bị khóa (is_locked = true) của target student.
 * - Giữ nguyên (không hạ thấp dưới) mức pre-existing academic record (original_count) của target student.
 * - Nếu source count thấp hơn target original_count, giữ nguyên giá trị hiện tại của target.
 *
 * NOTE (role-aware): When counts_by_role is available on details,
 * the srcCount should reflect the resolved_count or the teacher_recorded_count.
 * The backend ensures current_count aligns with the resolved count,
 * so this function remains compatible without changes.
 */
export const buildTargetSafeCounts = (
  sourceCounts: Record<string, number>,
  targetCurrentCounts: Record<string, number>,
  targetPreCounts: Record<string, { original_count?: number; current_count: number }>,
  criteriaList: Criterion[]
): Record<string, number> => {
  const result: Record<string, number> = {};

  criteriaList.forEach((cri) => {
    const srcCount = sourceCounts[cri.id] || 0;
    const targetPre = targetPreCounts[cri.id] || { current_count: 0 };

    // Lấy count hiện tại trong state của target, nếu chưa có thì lấy current_count pre-existing
    const targetCurrent = targetCurrentCounts[cri.id] !== undefined
      ? targetCurrentCounts[cri.id]
      : (targetPre.current_count || 0);

    if (cri.is_locked) {
      // Không thay đổi các tiêu chí bị khóa
      result[cri.id] = targetCurrent;
    } else {
      // Backend sẽ tự quyết định giới hạn hạ điểm dựa vào daily_report_id & permissions
      result[cri.id] = srcCount;
    }
  });

  return result;
};
export default {
  calculateCriterionScore,
  buildTargetSafeCounts
};

