slot_id: "taskscope-00"
generation: 1
task_id: "20260830-criterion-derived-group-total"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 3
created_at: "2026-08-30T16:10:00+07:00"
updated_at: "2026-08-30T16:35:00+07:00"
base_commit: "1009be21ec5b263bdcf781d29ce1b1743f7081d2"
task: "Calculate grouped total from configured criterion points"
pipeline: bug_fix
profile: Quick
objective: "Total points is the signed sum of in-scope records derived from existing criterion configuration."

coordination:
  depends_on: []
  warnings: ["TASKSCOPE_WARNING: frontend/src/app/(dashboard)/students/record/page.test.tsx changed since original base; revalidated against current HEAD."]

evidence:
  current_behavior: "AcademicRecordService derives effectivePoints through ScoreEngineService but falls back to points_effect without a criterion."
  required_rule: "Read criterion configuration, derive each contribution, and add algebraically; -3 + 5 = 2."

scope:
  write: ["backend/src/academic-record/academic-record.service.ts", "backend/src/academic-record/academic-record.service.spec.ts", "frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx"]
  preserve: ["criterion configuration", "ScoreEngine modes", "RBAC/record filters", "pagination/API shape", "realtime refresh"]
  out: ["criterion CRUD", "score persistence", "migration/backfill", "SummaryPoint", "UI redesign"]

acceptance_criteria:
  - "AC-01: Group/detail reads never write criterion configuration or stored record points."
  - "AC-02: ScoreEngine derives each contribution from criterion configuration and the mode's quantity/option/manual input. An unresolved criterion contributes 0; points_effect never replaces configured values."
  - "AC-03: group.totalPoints is the arithmetic sum of in-scope contributions, preserving negative, positive, decimal, and zero values without absolute conversion, sign reversal, aggregate clamping, or double quantity multiplication."
  - "AC-04: Both detail views show the same contributions used by totalPoints; a regression displays -3, +5, and total 2."

execution:
  - "E-01 [AC-01..AC-03] Use calculateGroupedRecordScore as the read-only derivation for grouped reduction and effectivePoints."
  - "E-02 [AC-04] Bind detail views only to backend effectivePoints."
  - "E-03 [AC-01..AC-04] Cover mixed signs, decimals, missing criterion, and input immutability."

completion:
  completed_at: "2026-08-30T16:35:00+07:00"
  outcome: success
  final_commit_or_state: "Working tree changes present; no commit created."
  changed_paths: ["backend/src/academic-record/academic-record.service.ts", "backend/src/academic-record/academic-record.service.spec.ts", "frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx"]
  checks_passed: ["backend academic-record service test", "frontend student record test (17 passed)", "backend build", "frontend typecheck", "git diff --check"]
  cleanup_pending: []

verification:
  - "npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts --runInBand"
  - "npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx'"
  - "npm --prefix backend run build"
  - "npm --prefix frontend run typecheck"
  - "git diff --check"

risks: ["Records with an unresolved criterion contribute 0."]
stop_conditions: ["Stop if totals require historical criterion snapshots instead of current configuration."]

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md"]
