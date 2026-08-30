slot_id: "taskscope-00"
generation: 4
task_id: "20260830-205722-verify-hssv-signed-scores"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 2
created_at: "2026-08-30T20:57:22+07:00"
updated_at: "2026-08-30T21:08:48+07:00"
base_commit: "6beb666693e71cb26153b6f2cf63b556d847656f"
task: "Verify criterion scores and signed student totals"
pipeline: bug_fix
profile: Full
objective: "Ensure each HSSV record uses its criterion-defined score and Tính điểm is the signed algebraic total, which may be negative, positive or zero."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-08-30T21:08:48+07:00"
  outcome: success
  final_commit_or_state: "Working tree changes present; no commit created. Unrelated taskscope-01 changes preserved."
  changed_paths: ["backend/src/academic-record/academic-record.service.spec.ts", "frontend/src/app/(dashboard)/students/record/page.test.tsx", "docs/task/taskscope.md"]
  checks_passed: ["npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts --runInBand (75 passed, 2 todo)", "npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' (21 passed)", "npm --prefix backend run build", "npm --prefix frontend run typecheck", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "The drawer renders mr.points from API effectivePoints; the grouped table renders item.totalPoints. The screenshot shows a Kỷ luật record as +7.5đ."
  expected_behavior: "effectivePoints follows the matched criterion; totalPoints preserves every sign and becomes negative when discipline deductions exceed positive contributions."
  root_cause: "Historical stale points_effect/score_per_unit display paths were replaced before this execution by backend/src/academic-record/academic-record.service.ts:serializeRecordWithEffectivePoints and frontend/src/app/(dashboard)/students/record/page.tsx:handleOpenDrawerChange/mappedRecords; current HEAD delegates criterion scoring to ScoreEngine and grouped totals to the same signed contribution adapter."

scope:
  inspect: ["backend/src/academic-record/score-engine.service.ts:calculate/getCriterionContribution", "frontend/src/app/(dashboard)/students/record/page.tsx:mappedRecords and drawerHistory mapping"]
  write: ["backend/src/academic-record/academic-record.service.ts:calculateGroupedRecordScore/serializeRecordWithEffectivePoints/grouped totalPoints", "backend/src/academic-record/academic-record.service.spec.ts:individual and grouped signed-score regressions", "frontend/src/app/(dashboard)/students/record/page.test.tsx:signed Điểm số/Tính điểm regression"]
  preserve: ["ScoreEngine criterion semantics, RBAC/filtering, record counts, API shape, score formatting and Excel export"]
  out: ["Changing criterion configuration or stored records", "Migration/schema/API changes", "Unrelated drawer/table layout changes"]

acceptance_criteria:
  - "AC-01: Each individual effectivePoints is calculated from its matched criterion's scoring_mode, quantity, score_per_unit, min/max, option/manual value and is_score_counted; no unrelated criterion or legacy points_effect overrides it."
  - "AC-02: Drawer Điểm số displays effectivePoints, not legacy points_effect or a value inferred only from record type."
  - "AC-03: Group totalPoints and Tính điểm equal the algebraic sum of all active returned contributions and may be negative, positive or zero; discipline deductions remain negative and can make the total negative."

execution:
  - "E-01 [AC-01] Add focused failing cases including Kỷ luật 7.5 and negative discipline; correct only the academic-record scoring adapter if needed."
  - "E-02 [AC-03] Verify/correct grouped reduction to sum the same per-record contribution exactly once."
  - "E-03 [AC-02,AC-03] Extend page regression for signed individual and grouped display."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested taskscope"]

verification:
  - "V-01 [AC-01,AC-03] npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts --runInBand"
  - "V-02 [AC-02,AC-03] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx'"
  - "V-03 [AC-01..AC-03] npm --prefix backend run build; npm --prefix frontend run typecheck; git diff --check"

risks: ["Criterion sign depends on configuration; do not hard-code Kỷ luật as negative without matching ScoreEngine/is_score_counted semantics."]
stop_conditions: ["Stop for a product-rule conflict between criterion configuration and expected sign, or if correction requires data migration/API changes."]
