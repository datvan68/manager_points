/**
 * PDF Score Utilities — Shared scoring logic for grading PDF preview and export.
 *
 * This module provides a single source of truth for score resolution,
 * matching the backend recomputeTotalScore priority chain:
 *   final_score → gv_score → sv_score → selected_option_score → system_score → computed → 0
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NormalizedEvalDetail {
  count: number;
  finalScore: number | null;
  teacherScore: number | null;
  studentScore: number | null;
  systemScore: number | null;
  selectedOptionScore: number | null;
}

export interface NormalizedCriterion {
  id: string;
  name: string;
  pointsPerUnit: number;
  type: 'reward' | 'violation';
  maxScore: number;
  minScore: number;
  isScoreCounted: boolean;
}

// ---------------------------------------------------------------------------
// Normalizers
// ---------------------------------------------------------------------------

/**
 * Normalize a raw criterion object from either frontend (camelCase) or
 * backend (snake_case) field naming conventions into a canonical shape.
 */
export function normalizeCriterion(raw: any): NormalizedCriterion {
  return {
    id: raw.id || raw._id || '',
    name: raw.name || raw.criterion_name || '',
    pointsPerUnit: raw.pointsPerUnit ?? raw.score_per_unit ?? 0,
    type:
      raw.type === 'violation' || raw.criterion_type === 'ky_luat'
        ? 'violation'
        : 'reward',
    maxScore: raw.maxScore ?? raw.max_score ?? 10,
    minScore: raw.minScore ?? raw.min_score ?? 0,
    isScoreCounted: raw.isScoreCounted ?? raw.is_score_counted ?? true,
  };
}

/**
 * Build a NormalizedEvalDetail from a raw evaluation-detail document.
 */
export function normalizeEvalDetail(raw: any): NormalizedEvalDetail {
  return {
    count: raw.current_count ?? raw.count ?? 0,
    finalScore: raw.final_score ?? raw.finalScore ?? null,
    teacherScore: raw.gv_score ?? raw.teacherScore ?? null,
    studentScore: raw.sv_score ?? raw.studentScore ?? null,
    systemScore: raw.system_score ?? raw.systemScore ?? null,
    selectedOptionScore:
      raw.selected_option_score ?? raw.selectedOptionScore ?? null,
  };
}

// ---------------------------------------------------------------------------
// Score Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the display score for a single criterion, using the same priority
 * chain as the backend `recomputeTotalScore`.
 *
 * Priority (first non-null wins):
 *   1. finalScore
 *   2. teacherScore (gv_score)
 *   3. studentScore (sv_score)
 *   4. selectedOptionScore
 *   5. systemScore
 *   6. computed from count × pointsPerUnit (clamped)
 *   7. 0 (or maxScore for violations with no detail)
 */
export function resolveScore(
  criterion: NormalizedCriterion,
  detail?: NormalizedEvalDetail | null,
): number {
  const isViolation = criterion.type === 'violation';

  // No detail at all — violation criteria default to maxScore (no violations = full score)
  if (!detail) {
    return isViolation ? criterion.maxScore : 0;
  }

  // Try the priority chain of pre-calculated scores
  let preCalculated: number | null = null;
  if (detail.finalScore !== null && detail.finalScore !== undefined) {
    preCalculated = detail.finalScore;
  } else if (detail.teacherScore !== null && detail.teacherScore !== undefined) {
    preCalculated = detail.teacherScore;
  } else if (detail.studentScore !== null && detail.studentScore !== undefined) {
    preCalculated = detail.studentScore;
  } else if (detail.selectedOptionScore !== null && detail.selectedOptionScore !== undefined) {
    preCalculated = detail.selectedOptionScore;
  } else if (detail.systemScore !== null && detail.systemScore !== undefined) {
    preCalculated = detail.systemScore;
  }

  if (preCalculated !== null && preCalculated !== undefined) {
    // For violation criteria, handle negative raw scores:
    // backend stores negative → convert to "remaining score" = max - |raw|
    if (isViolation && preCalculated < 0) {
      return criterion.maxScore - Math.abs(preCalculated);
    }
    // If the precalculated score is 0 and count is also 0 for violations,
    // it means no violations occurred → full score
    if (isViolation && preCalculated === 0 && detail.count === 0) {
      return criterion.maxScore;
    }
    return preCalculated;
  }

  // Fallback: compute from count × pointsPerUnit
  const ppu = criterion.pointsPerUnit;
  const raw = detail.count * ppu;

  if (ppu >= 0) {
    // Reward criterion: clamp between minScore and maxScore
    return Math.max(criterion.minScore, Math.min(criterion.maxScore, raw));
  } else {
    // Violation criterion (negative ppu): clamp between -maxScore and 0
    return Math.max(-criterion.maxScore, Math.min(0, raw));
  }
}

/**
 * Calculate the total score for a category by summing all criterion scores
 * and clamping to [0, maxPoints].
 */
export function resolveCategoryScore(
  items: NormalizedCriterion[],
  details: Record<string, NormalizedEvalDetail | undefined>,
  maxPoints: number,
): number {
  let sum = 0;
  for (const item of items) {
    sum += resolveScore(item, details[item.id]);
  }
  return sum;
}

export interface PdfStudentPayload {
  student: {
    id: string;
    name: string;
    dob: string;
    studentCode: string;
  };
  semesterName: string;
  className: string;
  categories: {
    id: string;
    code: string;
    title: string;
    maxPoints: number;
    achievedScore: number;
    items: {
      id: string;
      index: number;
      name: string;
      maxScore: number | string;
      achievedScore: number;
    }[];
  }[];
  summary: {
    coreTotal: number;
    bonusTotal: number;
    finalTotal: number;
    classification: string;
  };
}

export function getClassification(score: number): string {
  if (score >= 90) return 'Xuất sắc';
  if (score >= 80) return 'Tốt';
  if (score >= 70) return 'Khá';
  if (score >= 50) return 'Trung bình';
  return 'Yếu';
}

export function formatDob(dob: any): string {
  if (!dob) return '';
  if (typeof dob !== 'string') return String(dob);
  
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dob)) return dob;
  
  const ymdMatch = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    return `${ymdMatch[3]}/${ymdMatch[2]}/${ymdMatch[1]}`;
  }
  
  const date = new Date(dob);
  if (!isNaN(date.getTime())) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }
  
  return dob;
}

export function buildPdfPayloads(
  selectedStudents: any[],
  categories: any[],
  evaluationCounts: Record<string, Record<string, any>>,
  semesterName: string,
  className: string
): PdfStudentPayload[] {
  const orderMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5 };
  
  const sortedCategories = [...categories].sort((a, b) => {
    const aCode = (a.code || '').toUpperCase();
    const bCode = (b.code || '').toUpperCase();
    const aOrder = orderMap[aCode] || 99;
    const bOrder = orderMap[bCode] || 99;
    return aOrder - bOrder;
  });

  return selectedStudents.map((student) => {
    const counts = evaluationCounts[student.id] || {};
    let coreTotal = 0;
    let bonusTotal = 0;

    const mappedCategories = sortedCategories.map((cat) => {
      let catScore = 0;
      const mappedItems = cat.items.map((item: any, index: number) => {
        const criterion = normalizeCriterion(item);
        const detailRaw = counts[item.id];
        let detail: NormalizedEvalDetail | null = null;
        if (detailRaw) {
          if (typeof detailRaw === 'number') {
            detail = normalizeEvalDetail({ count: detailRaw });
          } else {
            detail = normalizeEvalDetail(detailRaw);
          }
        }
        const achievedScore = resolveScore(criterion, detail);
        
        let contribution = achievedScore;
        if (criterion.type === 'violation' && criterion.isScoreCounted === false) {
          contribution = achievedScore - criterion.maxScore;
        }
        catScore += contribution;
        
        return {
          id: item.id,
          index: index + 1,
          name: item.name,
          maxScore: item.maxScore ?? item.max_score ?? '',
          achievedScore,
        };
      });

      const clampedScore = Math.max(0, Math.min(cat.maxPoints || 100, catScore));
      const isCore = orderMap[(cat.code || '').toUpperCase()] !== undefined;
      if (isCore) {
        coreTotal += clampedScore;
      } else {
        bonusTotal += clampedScore;
      }

      return {
        id: cat.id,
        code: cat.code || '',
        title: cat.title,
        maxPoints: cat.maxPoints || 100,
        achievedScore: clampedScore,
        items: mappedItems,
      };
    });

    coreTotal = Math.max(0, Math.min(100, coreTotal));
    let finalTotal = Math.max(0, Math.min(100, coreTotal + bonusTotal));
    
    // Priority: use the student.score from summary if available, to match backend exactly
    if (student.score !== undefined && student.score !== null) {
      finalTotal = student.score;
    }
    
    const classification = getClassification(finalTotal);

    return {
      student: {
        id: student.id,
        name: student.name,
        dob: formatDob(student.dob),
        studentCode: student.studentCode || student.id,
      },
      semesterName,
      className,
      categories: mappedCategories,
      summary: {
        coreTotal,
        bonusTotal,
        finalTotal,
        classification,
      }
    };
  });
}
