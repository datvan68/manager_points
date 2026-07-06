import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';

// === Type Definitions ===

export interface CountsByRole {
  student: number;
  teacher: number;
  supervisor: number;
  admin: number;
  system: number;
  import: number;
}

export type CalculationContext = 'sync' | 'manual' | 'approval';

export interface ScoreEngineInput {
  criterion: any; // CriterionDocument or lean object
  calculation_context: CalculationContext;
  count: number;
  counts_by_role?: Partial<CountsByRole>;
  resolved_count?: number | null;
  selected_option_id?: string | null;
  selected_option_label?: string | null;
  selected_option_score?: number | null;
  manual_score?: number | null;
}

export interface ScoreEngineOutput {
  resolved_count: number;
  system_score: number;
  current_count: number;
  selected_option_id: string | null;
  selected_option_label: string | null;
  selected_option_score: number | null;
  manual_score: number | null;
  calculation_reason: string;
  calculation_context: CalculationContext;
}

// === Helper: extract structured data from a record ===

/**
 * Reads structured fields first (action_type, payload, selected_option_*),
 * then falls back to record_title parsing for records not yet backfilled.
 *
 * Replaces all scattered string parsing logic across the codebase.
 */
export function extractStructuredData(record: any): {
  action_type: string | null;
  manual_score: number | null;
  selected_option_id: string | null;
  selected_option_label: string | null;
  selected_option_score: number | null;
} {
  // 1. Try structured fields first (post-migration records)
  if (record.action_type) {
    return {
      action_type: record.action_type,
      manual_score: record.payload?.manual_score ?? null,
      selected_option_id: record.selected_option_id ?? null,
      selected_option_label: record.selected_option_label ?? null,
      selected_option_score:
        record.selected_option_score !== undefined
          ? record.selected_option_score
          : null,
    };
  }

  // 2. Try direct selected_option fields (already structured, pre-migration)
  if (record.selected_option_id) {
    return {
      action_type: 'select_option',
      manual_score: null,
      selected_option_id: record.selected_option_id,
      selected_option_label: record.selected_option_label || null,
      selected_option_score:
        record.selected_option_score !== undefined
          ? record.selected_option_score
          : null,
    };
  }

  // 3. Fallback: parse record_title (legacy records not yet backfilled)
  if (record.record_title) {
    // Manual score: "Nhập điểm tay: 8.5"
    if (record.record_title.startsWith('Nhập điểm tay: ')) {
      const scoreStr = record.record_title.replace('Nhập điểm tay: ', '');
      const score = parseFloat(scoreStr);
      if (!isNaN(score)) {
        return {
          action_type: 'manual_score',
          manual_score: score,
          selected_option_id: null,
          selected_option_label: null,
          selected_option_score: null,
        };
      }
    }

    // Option selection: "Lựa chọn option A" / "Lua chon option B"
    const optionMatch = record.record_title.match(
      /Lu[aạ]\s*ch[oọ]n\s*option\s*(.+)/i,
    );
    if (optionMatch) {
      return {
        action_type: 'select_option',
        manual_score: null,
        selected_option_id: optionMatch[1].trim(),
        selected_option_label: null,
        selected_option_score: null,
      };
    }
  }

  // 4. Default: count-based record
  return {
    action_type: 'count',
    manual_score: null,
    selected_option_id: null,
    selected_option_label: null,
    selected_option_score: null,
  };
}

/**
 * Group records by recorded_by_role and return role-specific counts.
 */
export function groupRecordsByRole(records: any[]): CountsByRole {
  const counts: CountsByRole = {
    student: 0,
    teacher: 0,
    supervisor: 0,
    admin: 0,
    system: 0,
    import: 0,
  };

  for (const record of records) {
    const role = record.recorded_by_role;
    const quantity = record.quantity || 1;

    if (role && role in counts) {
      counts[role as keyof CountsByRole] += quantity;
    } else {
      // Records without recorded_by_role (pre-migration) — count as system
      counts.system += quantity;
    }
  }

  return counts;
}

/**
 * Get total count from CountsByRole.
 */
export function getTotalCount(counts: Partial<CountsByRole>): number {
  return Object.values(counts).reduce((sum, v) => sum + (v || 0), 0);
}

/**
 * Check how many distinct roles have non-zero counts.
 */
export function getNonZeroRoleCount(counts: Partial<CountsByRole>): number {
  return Object.values(counts).filter((v) => (v || 0) > 0).length;
}

// === Score Engine Service ===

@Injectable()
export class ScoreEngineService {
  /**
   * Centralized score calculation — consolidates logic from:
   * - academic-record.utils.ts:calculateCriterionScoreHelper
   * - academic-record.service.ts:calculateSyncDetail (inline scoring)
   * - evaluation-detail.service.ts:bulkUpsert (inline scoring)
   * - summaries-point.service.ts:recomputeTotalScore (inline scoring)
   * - daily-class-report.service.ts:importClassRecords (pointsPerUnit)
   *
   * @param input - Score calculation parameters
   * @returns ScoreEngineOutput with resolved count, score, and context
   */
  calculate(input: ScoreEngineInput): ScoreEngineOutput {
    const {
      criterion,
      calculation_context,
      count,
      counts_by_role,
      resolved_count,
      selected_option_id,
      selected_option_label,
      selected_option_score,
      manual_score,
    } = input;

    // Determine the effective count to use for scoring
    let effectiveCount: number;
    let calculationReason: string;

    if (
      calculation_context === 'approval' &&
      resolved_count !== null &&
      resolved_count !== undefined
    ) {
      // Approval context: use resolved_count only, no fallback
      effectiveCount = resolved_count;
      calculationReason = `approval: using resolved_count=${resolved_count}`;
    } else if (counts_by_role && getNonZeroRoleCount(counts_by_role) > 0) {
      // Role-aware: use total of all role counts
      effectiveCount = getTotalCount(counts_by_role);
      calculationReason = `role-aware total from counts_by_role`;
    } else {
      // Fallback: use raw count
      effectiveCount = count;
      calculationReason = `fallback: using raw count=${count}`;
    }

    // Core scoring logic
    let systemScore = 0;
    let optId = selected_option_id || null;
    let optLabel = selected_option_label || null;
    let optScore =
      selected_option_score !== undefined ? selected_option_score : null;
    let currentCount = effectiveCount;
    const effectiveManualScore = manual_score ?? null;

    const scorePerUnit = criterion.score_per_unit || 0;
    const maxScore =
      criterion.max_score ??
      (criterion.criterion_type === 'ky_luat' || scorePerUnit < 0 ? 10 : 100);
    const minScore = criterion.min_score || 0;
    const isDiscipline =
      criterion.criterion_type === 'ky_luat' || scorePerUnit < 0;
    const isSyncContext = calculation_context === 'sync';

    if (criterion.scoring_mode === 'single_option') {
      // --- Single Option Mode ---
      if (optId) {
        const option = criterion.options?.find((o: any) => o.id === optId);
        if (option) {
          systemScore = option.score;
          optLabel = option.label;
          optScore = option.score;
          currentCount = 1;
          calculationReason += '; single_option matched';
        } else {
          // Invalid option
          optId = null;
          optLabel = null;
          optScore = null;
          currentCount = 0;
          systemScore = isSyncContext ? 0 : isDiscipline ? maxScore : 0;
          calculationReason += '; single_option invalid — reset';
        }
      } else {
        // No option selected
        currentCount = 0;
        systemScore = isSyncContext ? 0 : isDiscipline ? maxScore : 0;
        calculationReason += '; single_option none selected';
      }
    } else {
      // --- Count/Manual Score Mode ---
      if (effectiveManualScore !== null) {
        // Manual score takes priority
        systemScore = effectiveManualScore;
        calculationReason += `; manual_score=${effectiveManualScore}`;
      } else if (currentCount > 0) {
        // Count-based calculation
        if (scorePerUnit >= 0) {
          systemScore = currentCount * scorePerUnit;
          systemScore = Math.max(minScore, Math.min(maxScore, systemScore));
        } else {
          // Discipline/negative: max_score - count * |score_per_unit|
          systemScore = Math.max(
            minScore,
            Math.min(
              maxScore,
              maxScore - currentCount * Math.abs(scorePerUnit),
            ),
          );
        }
        calculationReason += `; count=${currentCount} × score_per_unit=${scorePerUnit}`;
      } else {
        // Zero count
        if (isSyncContext) {
          // Sync context: discipline with 0 count → maxScore, reward with 0 count → 0
          systemScore = isDiscipline ? maxScore : 0;
          calculationReason += `; sync zero-count: isDiscipline=${isDiscipline}`;
        } else if (calculation_context === 'approval') {
          // Approval context: 0 count → 0 or maxScore depending on type
          systemScore = isDiscipline ? maxScore : 0;
          calculationReason += `; approval zero-count: isDiscipline=${isDiscipline}`;
        } else {
          // Manual context: standard calculation
          systemScore = currentCount * scorePerUnit;
          if (scorePerUnit >= 0) {
            systemScore = Math.max(minScore, Math.min(maxScore, systemScore));
          } else {
            systemScore = Math.max(
              minScore,
              Math.min(
                maxScore,
                maxScore - currentCount * Math.abs(scorePerUnit),
              ),
            );
          }
          calculationReason += `; manual zero-count standard calc`;
        }
      }
    }

    return {
      resolved_count: effectiveCount,
      system_score: systemScore,
      current_count: currentCount,
      selected_option_id: optId,
      selected_option_label: optLabel,
      selected_option_score: optScore,
      manual_score: effectiveManualScore,
      calculation_reason: calculationReason,
      calculation_context,
    };
  }

  /**
   * Calculate the contribution of a criterion score to category total.
   * Handles the discipline/non-counted scoring inversion.
   */
  getCriterionContribution(criterion: any, rawScore: number): number {
    const isDiscipline =
      criterion.criterion_type === 'ky_luat' || criterion.score_per_unit < 0;
    if (isDiscipline && criterion.is_score_counted === false) {
      return rawScore - (criterion.max_score || 10);
    }
    return rawScore;
  }
}
