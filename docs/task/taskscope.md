slot_id: "taskscope-00"
generation: 5
task_id: "20260830-212009-fix-hssv-drawer-record-points"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-08-30T21:20:09+07:00"
updated_at: "2026-08-30T21:35:00+07:00"
base_commit: "4c92f31f8e69473cd6adedc602954604e1593f01"
task: "Fix per-record scores in HSSV status drawer"
pipeline: bug_fix
profile: Full
objective: "Show each HSSV history item with its signed per-record score impact; one unauthorized absence worth -1 must display -1đ, never the criterion's remaining score such as +7đ."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-08-30T21:35:00+07:00"
  outcome: success
  final_commit_or_state: "Working tree changes present; no commit created. Unrelated grading page change preserved."
  changed_paths: ["backend/src/academic-record/academic-record.service.ts", "backend/src/academic-record/academic-record.service.spec.ts", "frontend/src/app/(dashboard)/students/record/page.test.tsx", "docs/task/taskscope.md"]
  checks_passed: ["npm --prefix backend test -- academic-record/academic-record.service.spec.ts --runInBand (76 passed, 2 todo)", "npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' (21 passed)", "npm --prefix backend run build", "npm --prefix frontend run typecheck", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "backend/src/academic-record/academic-record.service.ts:calculateGroupedRecordScore passes a count record through ScoreEngine and returns the full criterion contribution; for ky_luat max_score=10, score_per_unit=-1 and count=3 this becomes 7, while frontend/src/app/(dashboard)/students/record/page.tsx:handleOpenDrawerChange formats positive effectivePoints as +7đ."
  expected_behavior: "History rows and grouped Tính điểm use the signed impact of each stored action; a quantity-1 count action on score_per_unit=-1 is -1đ."
  root_cause: "calculateGroupedRecordScore conflates a criterion's current/raw contribution with the delta contributed by one academic-record action."

scope:
  inspect: ["backend/src/academic-record/score-engine.service.ts:calculate/getCriterionContribution contracts", "frontend/src/app/(dashboard)/students/record/page.tsx:handleOpenDrawerChange/mappedRecords formatting"]
  write: ["backend/src/academic-record/academic-record.service.ts:per-record effectivePoints and grouped total calculation", "backend/src/academic-record/academic-record.service.spec.ts:signed count-action regressions", "frontend/src/app/(dashboard)/students/record/page.test.tsx:HSSV drawer regression"]
  preserve: ["Criterion system/final score calculation, RBAC and filters, API response shape, positive count rewards, single-option/manual-score behavior, record counts and ordering"]
  out: ["Changing criteria or stored records", "Schema/migration/API changes", "Drawer redesign", "Unrelated grading totals"]

acceptance_criteria:
  - "AC-01: A ky_luat count record with max_score=10, score_per_unit=-1 and quantity=1 serializes effectivePoints=-1; it does not serialize +9 or another remaining criterion score."
  - "AC-02: Grouped totalPoints is the algebraic sum of signed record impacts, including negative, positive and zero results."
  - "AC-03: Opening the Tình hình HSSV 'Chi tiết trạng thái' drawer renders the example history badge/detail as -1đ and never +7đ, while positive records retain a leading + sign."

execution:
  - "E-01 [AC-01,AC-02] backend/src/academic-record/academic-record.service.ts:calculateGroupedRecordScore/serializeRecordWithEffectivePoints → separate per-action signed impact from full criterion contribution and reuse it for history plus grouped totals."
  - "E-02 [AC-01,AC-02] backend/src/academic-record/academic-record.service.spec.ts → cover counted discipline -1 per quantity, mixed signed totals, and preserved single-option/manual behavior."
  - "E-03 [AC-03] frontend/src/app/(dashboard)/students/record/page.test.tsx → open the drawer with effectivePoints -1/+5 fixtures and assert signed badges/details."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01,AC-02] npm --prefix backend test -- academic-record/academic-record.service.spec.ts --runInBand → focused Jest suite passes."
  - "V-02 [AC-03] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → focused Vitest suite passes."
  - "V-03 [AC-01,AC-02] npm --prefix backend run build → Nest build exits 0."
  - "V-04 [AC-03] npm --prefix frontend run typecheck → TypeScript exits 0."

risks: ["Scoring semantics are shared by grouped totals and history serialization; an incorrect split could change reward, single-option or manual-score output."]
stop_conditions: ["Stop if the expected -1 is not derivable from canonical action/criterion fields without trusting incompatible legacy data, or if the fix requires schema/data migration, API contract change, or grading-summary behavior change."]
