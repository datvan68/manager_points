import { Injectable } from '@nestjs/common';
import {
  CountsByRole,
  getNonZeroRoleCount,
  getTotalCount,
} from './score-engine.service';

// === Type Definitions ===

export interface CountResolutionInput {
  counts_by_role: Partial<CountsByRole>;
  existing_resolution?: {
    resolved_count: number;
    resolved_by_role: string;
    resolution_source: string;
  } | null;
  context: 'auto' | 'teacher_review' | 'supervisor_approval' | 'admin_override';
  requester_role?: string;
  requester_user_id?: string;
}

export interface CountResolutionOutput {
  resolved_count: number;
  resolved_by_role: string;
  resolution_source: string;
  has_conflict: boolean;
  conflict_description?: string;
  auto_resolved: boolean;
}

// === Conflict Detection ===

/**
 * Detect if a conflict exists between role-specific counts.
 *
 * A conflict exists when (taskscope §3.1):
 * - student_reported_count ≠ teacher_recorded_count AND no resolution exists
 * - Multiple roles have non-zero counts AND no explicit resolution has been recorded
 *
 * A conflict does NOT apply when:
 * - Only one role has recorded counts (no disagreement)
 * - A resolution has been explicitly recorded regardless of count differences
 */
export function detectConflict(
  counts: Partial<CountsByRole>,
  existingResolution?: { resolved_count: number } | null,
): { has_conflict: boolean; description?: string } {
  // If explicit resolution exists, no conflict
  if (
    existingResolution &&
    existingResolution.resolved_count !== null &&
    existingResolution.resolved_count !== undefined
  ) {
    return { has_conflict: false };
  }

  const nonZeroRoles = getNonZeroRoleCount(counts);

  // Only one role or no roles → no conflict
  if (nonZeroRoles <= 1) {
    return { has_conflict: false };
  }

  // Multiple roles with non-zero counts — check for disagreement
  const student = counts.student || 0;
  const teacher = counts.teacher || 0;
  const supervisor = counts.supervisor || 0;
  const admin = counts.admin || 0;

  const descriptions: string[] = [];

  if (student > 0 && teacher > 0 && student !== teacher) {
    descriptions.push(
      `Student reported: ${student}, Teacher recorded: ${teacher}`,
    );
  }
  if (student > 0 && supervisor > 0 && student !== supervisor) {
    descriptions.push(
      `Student reported: ${student}, Supervisor recorded: ${supervisor}`,
    );
  }
  if (teacher > 0 && supervisor > 0 && teacher !== supervisor) {
    descriptions.push(
      `Teacher recorded: ${teacher}, Supervisor recorded: ${supervisor}`,
    );
  }

  if (descriptions.length > 0) {
    return {
      has_conflict: true,
      description: descriptions.join('; '),
    };
  }

  // Multiple roles but same counts → no practical conflict
  return { has_conflict: false };
}

// === Count Resolution Service ===

@Injectable()
export class CountResolutionService {
  /**
   * Resolve role-aware counts according to resolution rules (taskscope §3).
   *
   * Auto-resolution rules (configurable):
   * - If only teacher has count → auto-resolve to teacher count
   * - If supervisor/admin has count → supervisor/admin count takes priority
   * - Student-only count always requires teacher/supervisor review before approval
   */
  resolve(input: CountResolutionInput): CountResolutionOutput {
    const {
      counts_by_role,
      existing_resolution,
      context,
      requester_role,
      requester_user_id,
    } = input;

    // If there's an explicit existing resolution and context is 'auto', keep it
    if (context === 'auto' && existing_resolution) {
      const conflict = detectConflict(counts_by_role, existing_resolution);
      return {
        resolved_count: existing_resolution.resolved_count,
        resolved_by_role: existing_resolution.resolved_by_role,
        resolution_source: existing_resolution.resolution_source,
        has_conflict: conflict.has_conflict,
        conflict_description: conflict.description,
        auto_resolved: false,
      };
    }

    // Explicit resolution contexts
    if (context === 'admin_override') {
      return {
        resolved_count: getTotalCount(counts_by_role),
        resolved_by_role: 'admin',
        resolution_source: 'admin_override',
        has_conflict: false,
        auto_resolved: false,
      };
    }

    if (context === 'supervisor_approval') {
      // Supervisor count takes priority if exists, otherwise total
      const supervisorCount = counts_by_role.supervisor || 0;
      const adminCount = counts_by_role.admin || 0;
      const resolvedCount =
        supervisorCount > 0
          ? supervisorCount
          : adminCount > 0
            ? adminCount
            : getTotalCount(counts_by_role);
      return {
        resolved_count: resolvedCount,
        resolved_by_role: 'supervisor',
        resolution_source: 'supervisor_approval',
        has_conflict: false,
        auto_resolved: false,
      };
    }

    if (context === 'teacher_review') {
      // Teacher count takes priority if exists
      const teacherCount = counts_by_role.teacher || 0;
      const resolvedCount =
        teacherCount > 0 ? teacherCount : getTotalCount(counts_by_role);
      return {
        resolved_count: resolvedCount,
        resolved_by_role: 'teacher',
        resolution_source: 'teacher_review',
        has_conflict: false,
        auto_resolved: false,
      };
    }

    // Auto-resolution (context === 'auto')
    return this.autoResolve(counts_by_role);
  }

  /**
   * Apply automatic resolution rules.
   */
  private autoResolve(counts: Partial<CountsByRole>): CountResolutionOutput {
    const conflict = detectConflict(counts);
    const student = counts.student || 0;
    const teacher = counts.teacher || 0;
    const supervisor = counts.supervisor || 0;
    const admin = counts.admin || 0;
    const system = counts.system || 0;
    const importCount = counts.import || 0;

    // Rule 1: If admin has count → admin takes priority
    if (admin > 0) {
      return {
        resolved_count: admin,
        resolved_by_role: 'admin',
        resolution_source: 'automatic_rule',
        has_conflict: conflict.has_conflict,
        conflict_description: conflict.description,
        auto_resolved: true,
      };
    }

    // Rule 2: If supervisor has count → supervisor takes priority
    if (supervisor > 0) {
      return {
        resolved_count: supervisor,
        resolved_by_role: 'supervisor',
        resolution_source: 'automatic_rule',
        has_conflict: conflict.has_conflict,
        conflict_description: conflict.description,
        auto_resolved: true,
      };
    }

    // Rule 3: If only teacher has count → auto-resolve to teacher
    if (teacher > 0 && student === 0) {
      return {
        resolved_count: teacher,
        resolved_by_role: 'teacher',
        resolution_source: 'automatic_rule',
        has_conflict: false,
        auto_resolved: true,
      };
    }

    // Rule 4: If teacher has count and student also → teacher takes priority but mark conflict
    if (teacher > 0 && student > 0) {
      return {
        resolved_count: teacher,
        resolved_by_role: 'teacher',
        resolution_source: 'automatic_rule',
        has_conflict: teacher !== student,
        conflict_description:
          teacher !== student
            ? `Student reported: ${student}, Teacher recorded: ${teacher}`
            : undefined,
        auto_resolved: true,
      };
    }

    // Rule 5: Student-only count → DO NOT auto-resolve (requires teacher/supervisor review)
    if (student > 0 && teacher === 0 && supervisor === 0 && admin === 0) {
      return {
        resolved_count: student,
        resolved_by_role: 'system',
        resolution_source: 'automatic_rule',
        has_conflict: true, // Student-only counts need review
        conflict_description:
          'Student-only count requires teacher/supervisor review before approval',
        auto_resolved: true,
      };
    }

    // Rule 6: System/import only counts → auto-resolve
    if (system > 0 || importCount > 0) {
      const total = system + importCount;
      return {
        resolved_count: total,
        resolved_by_role: 'system',
        resolution_source: 'automatic_rule',
        has_conflict: false,
        auto_resolved: true,
      };
    }

    // Default: zero counts
    return {
      resolved_count: 0,
      resolved_by_role: 'system',
      resolution_source: 'automatic_rule',
      has_conflict: false,
      auto_resolved: true,
    };
  }
}
