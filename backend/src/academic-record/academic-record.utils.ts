import { Types } from 'mongoose';

export function calculateCriterionScoreHelper(params: {
  criterion: any;
  count: number;
  selectedOptionId?: string | null;
  selectedOptionLabel?: string | null;
  selectedOptionScore?: number | null;
  manualScore?: number | null;
  isSyncPath?: boolean;
}) {
  const {
    criterion,
    count,
    selectedOptionId,
    selectedOptionLabel,
    selectedOptionScore,
    manualScore,
    isSyncPath = false,
  } = params;

  let systemScore = 0;
  let optId = selectedOptionId || null;
  let optLabel = selectedOptionLabel || null;
  let optScore = selectedOptionScore !== undefined ? selectedOptionScore : null;
  let currentCount = count;

  const scorePerUnit = criterion.score_per_unit || 0;
  const maxScore = criterion.max_score ?? (criterion.criterion_type === 'ky_luat' || scorePerUnit < 0 ? 10 : 100);
  const minScore = criterion.min_score || 0;

  if (criterion.scoring_mode === 'single_option') {
    if (optId) {
      const option = criterion.options?.find((o: any) => o.id === optId);
      if (option) {
        systemScore = option.score;
        optLabel = option.label;
        optScore = option.score;
        currentCount = 1;
      } else {
        optId = null;
        optLabel = null;
        optScore = null;
        currentCount = 0;
        if (isSyncPath) {
          systemScore = 0;
        } else {
          const isDiscipline = criterion.criterion_type === 'ky_luat' && criterion.is_score_counted === false;
          systemScore = isDiscipline ? maxScore : 0;
        }
      }
    } else {
      currentCount = 0;
      if (isSyncPath) {
        systemScore = 0;
      } else {
        const isDiscipline = criterion.criterion_type === 'ky_luat' && criterion.is_score_counted === false;
        systemScore = isDiscipline ? maxScore : 0;
      }
    }
  } else {
    if (manualScore !== undefined && manualScore !== null) {
      systemScore = manualScore;
    } else {
      if (currentCount > 0) {
        systemScore = currentCount * scorePerUnit;
        if (scorePerUnit >= 0) {
          systemScore = Math.max(minScore, Math.min(maxScore, systemScore));
        } else {
          systemScore = Math.max(minScore, Math.min(maxScore, maxScore - currentCount * Math.abs(scorePerUnit)));
        }
      } else {
        if (isSyncPath) {
          systemScore = (criterion.criterion_type === 'ky_luat' || scorePerUnit < 0) ? maxScore : 0;
        } else {
          systemScore = currentCount * scorePerUnit;
          if (scorePerUnit >= 0) {
            systemScore = Math.max(minScore, Math.min(maxScore, systemScore));
          } else {
            systemScore = Math.max(minScore, Math.min(maxScore, maxScore - currentCount * Math.abs(scorePerUnit)));
          }
        }
      }
    }
  }

  return {
    systemScore,
    selectedOptionId: optId,
    selectedOptionLabel: optLabel,
    selectedOptionScore: optScore,
    currentCount,
  };
}

export function normalizeObjectId(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Types.ObjectId) {
    return value.toString();
  }
  if (value && typeof value === 'object') {
    if (value._id) {
      return normalizeObjectId(value._id);
    }
    if (value.id) {
      return normalizeObjectId(value.id);
    }
  }
  return String(value);
}

export function buildGradingEventPayload(params: {
  type: string;
  summary: any;
  student: any;
  criterionIds?: string[];
  extra?: any;
}) {
  const { type, summary, student, criterionIds, extra } = params;

  const classId = student && student.class_id
    ? normalizeObjectId(student.class_id)
    : '';

  const payload: any = {
    type,
    classId,
    semesterId: normalizeObjectId(summary.semester_id),
    studentId: normalizeObjectId(summary.student_id),
    summaryId: normalizeObjectId(summary._id),
    updatedAt: new Date(),
    totalScore: summary.total_score,
    grading: summary.grading,
    status: summary.status,
    ...extra,
  };

  if (criterionIds && criterionIds.length > 0) {
    payload.criterionIds = criterionIds;
    if (summary.details) {
      payload.updatedDetails = summary.details.filter((d: any) =>
        d.criterion_id && criterionIds.includes(normalizeObjectId(d.criterion_id))
      );
      if (criterionIds.length === 1) {
        payload.criterionId = criterionIds[0];
        payload.updatedDetail = payload.updatedDetails[0] || null;
      }
    }
  }

  return payload;
}

