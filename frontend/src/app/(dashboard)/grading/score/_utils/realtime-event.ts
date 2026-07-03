export interface EventMergeParams {
  event: any;
  currentCounts: Record<string, Record<string, number>>; // studentId -> criterionId -> count
  currentOptions: Record<string, Record<string, string | null>>; // studentId -> criterionId -> optionId
  currentDetailsMap: Record<string, any>; // active student's criterionId -> detail
  activeStudentId: string;
}

export interface EventMergeResult {
  nextCountsByStudent: Record<string, Record<string, number>>;
  nextOptionsByStudent: Record<string, Record<string, string | null>>;
  nextDetailsMap: Record<string, any>;
  detailsToUpdate: { criterionId: string; detail: any }[];
  normalizedCounts: Record<string, number>;
  normalizedOptions: Record<string, string | null>;
  // === NEW: Role-aware fields from event ===
  countsByRoleMap: Record<string, any>; // criterionId -> counts_by_role
  conflictMap: Record<string, boolean>; // criterionId -> has_conflict
}

const isLockedOrReviewed = (detail: any) => {
  if (!detail) return false;
  const isLocked = detail.status === 'locked' || !!detail.locked_at;
  const isReviewed = detail.status === 'gv_reviewed' || !!detail.gv_reviewed_by || !!detail.gv_reviewed_at;
  const isApproved = detail.final_score !== null && detail.final_score !== undefined;
  const isFinalized = detail.status === 'finalized';
  return isLocked || isReviewed || isApproved || isFinalized;
};

export function mergeRealtimeEvent(params: EventMergeParams): EventMergeResult {
  const { event, currentCounts, currentOptions, currentDetailsMap, activeStudentId } = params;

  if (!event || !event.studentId) {
    return {
      nextCountsByStudent: currentCounts || {},
      nextOptionsByStudent: currentOptions || {},
      nextDetailsMap: currentDetailsMap || {},
      detailsToUpdate: [],
      normalizedCounts: {},
      normalizedOptions: {},
      countsByRoleMap: {},
      conflictMap: {},
    };
  }

  const sid = event.studentId;

  // Clone references
  const nextCountsByStudent = { ...currentCounts };
  const nextOptionsByStudent = { ...currentOptions };
  let nextDetailsMap = { ...currentDetailsMap };

  const studentCounts = { ...(currentCounts[sid] || {}) };
  const studentOptions = { ...(currentOptions[sid] || {}) };

  const detailsToUpdate: { criterionId: string; detail: any }[] = [];
  const rawDetails = [];
  if (event.updatedDetail) {
    rawDetails.push(event.updatedDetail);
  }
  if (event.updatedDetails && Array.isArray(event.updatedDetails)) {
    rawDetails.push(...event.updatedDetails);
  }

  rawDetails.forEach((detail: any) => {
    let criterionId = detail.criterion_id && typeof detail.criterion_id === 'object'
      ? detail.criterion_id._id
      : detail.criterion_id;
    
    // fallback only for single detail
    if (!criterionId && rawDetails.length === 1) {
      criterionId = event.criterionId;
    }

    if (criterionId) {
      criterionId = criterionId.toString();
      detailsToUpdate.push({ criterionId, detail });
    }
  });

  const isSnapshot = !!(event.isSnapshot || event.fullSnapshot);
  const isClearOrNoRecord = event.type === 'clear' || event.type === 'delete' || event.type === 'no-record' || event.type === 'academic_record_deleted' || event.isClear || event.status === 'clear';

  detailsToUpdate.forEach(({ criterionId, detail }) => {
    // Normalize count:
    // - valid number: use it
    // - numeric string: parse it
    // - missing/null/invalid: use existing count for that student/criterion, otherwise 0
    let countVal = detail.current_count;
    let normalizedCount = 0;
    if (typeof countVal === 'number' && !isNaN(countVal)) {
      normalizedCount = countVal;
    } else if (typeof countVal === 'string' && !isNaN(Number(countVal)) && countVal.trim() !== '') {
      normalizedCount = Number(countVal);
    } else {
      if (isClearOrNoRecord) {
        normalizedCount = 0;
      } else {
        normalizedCount = (currentCounts[sid] || {})[criterionId] ?? 0;
      }
    }
    studentCounts[criterionId] = normalizedCount;

    // Normalize selected option:
    // - if selected_option_id is a non-empty string, store it
    // - if event explicitly indicates option clear, delete it
    // - if field is absent from the detail, preserve the existing local option
    const hasOptionField = 'selected_option_id' in detail;
    const optVal = detail.selected_option_id;

    if (hasOptionField) {
      if (optVal && typeof optVal === 'string' && optVal.trim() !== '') {
        studentOptions[criterionId] = optVal;
      } else {
        delete studentOptions[criterionId];
      }
    } else {
      if (isSnapshot || isClearOrNoRecord) {
        delete studentOptions[criterionId];
      }
    }
  });

  // Handle criterionIds declared in event but missing from details
  if (event.criterionIds && Array.isArray(event.criterionIds)) {
    const receivedIds = new Set(detailsToUpdate.map(d => d.criterionId));
    event.criterionIds.forEach((criIdStr: any) => {
      if (criIdStr) {
        const criId = criIdStr.toString();
        if (!receivedIds.has(criId)) {
          const oldDetail = sid === activeStudentId ? currentDetailsMap[criId] : null;
          if (!isLockedOrReviewed(oldDetail)) {
            studentCounts[criId] = 0;
            delete studentOptions[criId];
            if (sid === activeStudentId) {
              delete nextDetailsMap[criId];
            }
          }
        }
      }
    });
  }

  // Full snapshot pruning
  if (isSnapshot) {
    const receivedIds = new Set(detailsToUpdate.map(d => d.criterionId));
    const allCurrentCriIds = new Set([
      ...Object.keys(studentCounts),
      ...Object.keys(studentOptions),
      ...(sid === activeStudentId ? Object.keys(currentDetailsMap) : [])
    ]);

    allCurrentCriIds.forEach((criId) => {
      if (!receivedIds.has(criId)) {
        const oldDetail = sid === activeStudentId ? currentDetailsMap[criId] : null;
        if (!isLockedOrReviewed(oldDetail)) {
          studentCounts[criId] = 0;
          delete studentOptions[criId];
          if (sid === activeStudentId) {
            delete nextDetailsMap[criId];
          }
        }
      }
    });
  }

  nextCountsByStudent[sid] = studentCounts;
  nextOptionsByStudent[sid] = studentOptions;

  if (sid === activeStudentId) {
    detailsToUpdate.forEach(({ criterionId, detail }) => {
      nextDetailsMap[criterionId] = detail;
    });
  }

  // === NEW: Extract role-aware data from details ===
  const countsByRoleMap: Record<string, any> = {};
  const conflictMap: Record<string, boolean> = {};
  detailsToUpdate.forEach(({ criterionId, detail }) => {
    if (detail.counts_by_role) {
      countsByRoleMap[criterionId] = detail.counts_by_role;
    }
    if (detail.has_conflict !== undefined) {
      conflictMap[criterionId] = !!detail.has_conflict;
    }
  });

  return {
    nextCountsByStudent,
    nextOptionsByStudent,
    nextDetailsMap,
    detailsToUpdate,
    normalizedCounts: studentCounts,
    normalizedOptions: studentOptions,
    countsByRoleMap,
    conflictMap,
  };
}
