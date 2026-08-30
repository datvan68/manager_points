task: "Reconcile grouped total points with visible history"
pipeline: bug_fix
profile: Quick
objective: "A student's Total points equals the manual sum of point values shown in Chi tiết trạng thái for the same filtered records."

evidence:
  current_behavior: "Group.totalPoints uses calculateGroupedRecordScore, but both detail loaders display criterion.score_per_unit/min_score and load the student's full active history without group date/creator filters. Quantity, option, manual, discipline, and filtered records can disagree."
  root_cause: "Group and detail use different point derivations and record sets."

scope:
  write: ["backend/src/academic-record/academic-record.service.ts", "backend/src/academic-record/academic-record.service.spec.ts", "frontend/src/api/academic-record-api.ts", "frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx"]
  preserve: ["RBAC and active/not-deleted rules", "group pagination/order/types/latest/count", "default API compatibility", "mutation and realtime refresh behavior"]
  out: ["score-formula changes", "schema migration/backfill", "SummaryPoint totals", "drawer redesign"]

acceptance_criteria:
  - "AC-01: Backend returns one effectivePoints per history record and obtains group.totalPoints by summing those values. Count quantity, selected option, manual score, positive score, and discipline reuse ScoreEngineService; points_effect is only the fallback when criterion data is unavailable."
  - "AC-02: Both detail entry points request the clicked student's same semester/date/creator scope as the group; inactive, deleted, and out-of-scope records appear in neither history nor total."
  - "AC-03: History badges render effectivePoints, not criterion defaults. A mixed regression proves displayed signed rows, including decimal/zero/negative values, add exactly to displayed totalPoints without double quantity multiplication or absolute conversion."
  - "AC-04: Legacy missing inputs resolve to numeric points_effect or 0, never NaN; negative zero is displayed as zero. RBAC and existing non-group consumers remain compatible."

execution:
  - "E-01 [AC-01,AC-04] Centralize per-record effective-point derivation in AcademicRecordService; reuse it for filtered history serialization and grouped reduction."
  - "E-02 [AC-02,AC-03] Pass group filters through both frontend history paths and remove local criterion-based point inference."
  - "E-03 [AC-01..AC-04] Add backend/frontend reconciliation and excluded-record regressions."

verification: ["npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts --runInBand", "npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx'", "npm --prefix backend run build", "npm --prefix frontend run typecheck", "git diff --check"]

risks: ["Legacy points_effect may be per-unit; do not prefer it over canonical criterion inputs."]
stop_conditions: ["Stop if Total points must use SummaryPoint/full-semester scope while detail stays filter-scoped.", "Stop if historical points must remain frozen after criterion edits; that requires an approved persistence rule."]

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md"]
