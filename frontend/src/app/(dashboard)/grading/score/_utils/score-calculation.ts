export interface Criteria {
  id: string;
  name: string;
  pointsPerUnit: number;
  type: "reward" | "violation";
  maxScore?: number;
  minScore?: number;
  is_locked?: boolean;
  is_score_counted?: boolean;
  scoring_mode?: 'count' | 'single_option';
  options?: { id: string; label: string; score: number }[];
}

export interface Category {
  id: string;
  code?: string;
  title: string;
  maxPoints: number;
  items: Criteria[];
}

export const isNonCountedViolation = (criterion: Criteria) =>
  criterion.type === "violation" && criterion.is_score_counted === false;

export const getViolationContribution = (rawScore: number, maxScore: number, isScoreCounted?: boolean) =>
  isScoreCounted === false ? rawScore - maxScore : rawScore;


export const calculateCriterionScore = (criterion: Criteria, count: number, selectedOptionId?: string | null) => {
  const maxScore = criterion.maxScore ?? 10;
  const minScore = criterion.minScore ?? 0;

  if (criterion.scoring_mode === 'single_option') {
    if (selectedOptionId) {
      const option = criterion.options?.find(opt => opt.id === selectedOptionId);
      if (option) {
        return Math.max(minScore, Math.min(maxScore, option.score));
      }
    }
    return (criterion.type === "violation") ? maxScore : 0;
  }

  if (criterion.pointsPerUnit >= 0) {
    const rawScore = count * criterion.pointsPerUnit;
    return Math.max(minScore, Math.min(maxScore, rawScore));
  } else {
    const baseScore = maxScore;
    const deduction = count * Math.abs(criterion.pointsPerUnit);
    return Math.max(minScore, Math.min(maxScore, baseScore - deduction));
  }
};

export const getCriterionContributionScore = (criterion: Criteria, count: number, selectedOptionId?: string | null) => {
  const rawScore = calculateCriterionScore(criterion, count, selectedOptionId);
  if (isNonCountedViolation(criterion)) {
    const maxScore = criterion.maxScore ?? 10;
    return getViolationContribution(rawScore, maxScore, criterion.is_score_counted);
  }
  return rawScore;
};

export const getResolvedRawCriterionScore = (
  criterion: Criteria,
  count: number,
  selectedOptionId?: string | null,
  detail?: any,
  isStudentLocked?: boolean
) => {
  if (criterion.is_locked) {
    return getRecordDerivedRawCriterionScore(criterion, count, selectedOptionId, detail);
  }

  const isLocked = isStudentLocked || detail?.status === 'locked' || !!detail?.locked_at;
  const isReviewed = (detail?.status === 'gv_reviewed' || !!detail?.gv_reviewed_by || !!detail?.gv_reviewed_at) && detail?.status !== 'draft' && detail?.status !== 'sv_submitted';
  const isApproved = detail?.final_score !== null && detail?.final_score !== undefined && detail?.status !== 'draft' && detail?.status !== 'sv_submitted';
  const isEditableDraft = !isLocked && !isReviewed && !isApproved;

  if (isEditableDraft) {
    const effectiveCount = count;
    const effectiveOptionId = selectedOptionId;

    if (criterion.type === 'reward' && effectiveCount === 0 && !effectiveOptionId) {
      return 0;
    }

    return calculateCriterionScore(criterion, effectiveCount, effectiveOptionId);
  }

  const effectiveCount = detail && detail.current_count > count ? detail.current_count : count;
  const effectiveOptionId = selectedOptionId || detail?.selected_option_id;

  if (detail) {
    let score = detail.final_score !== null && detail.final_score !== undefined
      ? detail.final_score
      : detail.gv_score !== null && detail.gv_score !== undefined
        ? detail.gv_score
        : detail.sv_score !== null && detail.sv_score !== undefined
          ? detail.sv_score
          : detail.system_score !== null && detail.system_score !== undefined
            ? detail.system_score
            : null;

    if (score !== null) {
      if (score < 0 && criterion.type === "violation") {
        const maxScore = criterion.maxScore ?? 10;
        score = maxScore - Math.abs(score);
      } else if (score === 0 && effectiveCount === 0 && criterion.type === "violation") {
        const maxScore = criterion.maxScore ?? 10;
        score = maxScore;
      }
      return score;
    }
  }
  return calculateCriterionScore(criterion, effectiveCount, effectiveOptionId);
};

export const getResolvedCriterionScore = (
  criterion: Criteria,
  count: number,
  selectedOptionId?: string | null,
  detail?: any,
  isStudentLocked?: boolean
) => {
  if (criterion.is_locked) {
    return getRecordDerivedCriterionScore(criterion, count, selectedOptionId, detail);
  }

  const score = getResolvedRawCriterionScore(criterion, count, selectedOptionId, detail, isStudentLocked);
  if (isNonCountedViolation(criterion)) {
    const maxScore = criterion.maxScore ?? 10;
    return getViolationContribution(score, maxScore, criterion.is_score_counted);
  }
  return score;
};

export const calculateCategoryScore = (
  category: Category,
  counts: Record<string, number> = {},
  selectedOptionsState: Record<string, string | null> = {},
  detailsMap?: Record<string, any>,
  isStudentLocked?: boolean
) => {
  let catTotal = 0;
  const safeCounts = counts ?? {};
  const safeOptions = selectedOptionsState ?? {};
  const safeDetails = detailsMap ?? {};
  if (!category || !category.items) return 0;
  category.items.forEach((cri) => {
    const count = safeCounts[cri.id] ?? 0;
    const optId = safeOptions[cri.id] ?? null;
    const detail = safeDetails[cri.id];
    catTotal += getResolvedCriterionScore(cri, count, optId, detail, isStudentLocked);
  });
  return Math.max(0, Math.min(category.maxPoints, catTotal));
};

export const calculateTotalScore = (
  categories: Category[],
  counts: Record<string, number> = {},
  selectedOptionsState: Record<string, string | null> = {},
  detailsMap?: Record<string, any>,
  isStudentLocked?: boolean
) => {
  let total = 0;
  const safeCounts = counts ?? {};
  const safeOptions = selectedOptionsState ?? {};
  const safeDetails = detailsMap ?? {};
  if (!categories || !Array.isArray(categories)) return 0;
  categories.forEach((cat) => {
    total += calculateCategoryScore(cat, safeCounts, safeOptions, safeDetails, isStudentLocked);
  });
  return Math.max(0, Math.min(100, total));
};

export const getRecordDerivedRawCriterionScore = (
  criterion: Criteria,
  count: number,
  selectedOptionId?: string | null,
  detail?: any
) => {
  if (detail) {
    let score = detail.final_score !== null && detail.final_score !== undefined 
      ? detail.final_score 
      : detail.system_score !== null && detail.system_score !== undefined 
        ? detail.system_score 
        : null;

    if (score !== null) {
      if (score < 0 && criterion.type === "violation") {
        const maxScore = criterion.maxScore ?? 10;
        score = maxScore - Math.abs(score);
      } else if (score === 0 && count === 0 && criterion.type === "violation") {
        const maxScore = criterion.maxScore ?? 10;
        score = maxScore;
      }
      return score;
    }
  }
  const fallbackCount = detail?.current_count !== undefined ? detail.current_count : count;
  return calculateCriterionScore(criterion, fallbackCount, selectedOptionId);
};

export const getRecordDerivedCriterionScore = (
  criterion: Criteria,
  count: number,
  selectedOptionId?: string | null,
  detail?: any
) => {
  if (detail) {
    const rawScore = detail.final_score !== null && detail.final_score !== undefined 
      ? detail.final_score 
      : detail.system_score !== null && detail.system_score !== undefined 
        ? detail.system_score 
        : null;
      
    if (rawScore !== null) {
      const score = getRecordDerivedRawCriterionScore(criterion, count, selectedOptionId, detail);
      if (isNonCountedViolation(criterion)) {
        const maxScore = criterion.maxScore ?? 10;
        return getViolationContribution(score, maxScore, criterion.is_score_counted);
      }
      return score;
    }
  }
  const fallbackCount = detail?.current_count !== undefined ? detail.current_count : count;
  return getCriterionContributionScore(criterion, fallbackCount, selectedOptionId);
};

export const mergeDetailsWithPreExistingCounts = (
  details: any[],
  isLocked: boolean
) => {
  const counts: Record<string, number> = {};
  const optionsMap: Record<string, string | null> = {};
  const detailsMap: Record<string, any> = {};
  const evaluatedCriteriaIds = new Set<string>();

  (details || []).forEach((detail) => {
    const cri = typeof detail.criterion_id === "object" ? detail.criterion_id : null;
    const criId = cri?._id || detail.criterion_id;
    
    counts[criId] = detail.current_count ?? 0;
    optionsMap[criId] = detail.selected_option_id || null;
    detailsMap[criId] = detail;
    evaluatedCriteriaIds.add(criId);
  });

  // Removed logic that auto-injects preExistingCounts.current_count into counts
  // to avoid rollback bugs when Admin adjusts from 00 -> 01 or 01 -> 00.

  return { counts, optionsMap, detailsMap };
};

export default {
  calculateCriterionScore,
  getCriterionContributionScore,
  getResolvedRawCriterionScore,
  getResolvedCriterionScore,
  getRecordDerivedRawCriterionScore,
  getRecordDerivedCriterionScore,
  calculateCategoryScore,
  calculateTotalScore,
  mergeDetailsWithPreExistingCounts,
  isNonCountedViolation,
  getViolationContribution
};
