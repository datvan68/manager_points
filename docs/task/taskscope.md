slot_id: "taskscope-00"
generation: 23
task_id: "20260903-144231-hide-dormitory-room-debt"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-03T14:42:31+07:00"
updated_at: "2026-09-03T14:45:20+07:00"
base_commit: "6447346d8dfb5a90947b3431563a4c9015c84099"
task: "Hide dormitory room debt section"
pipeline: feature_development
profile: Quick
objective: "Temporarily remove the unused Công nợ theo phòng section from /dormitory/overview while retaining the rest of the overview."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-03T14:45:20+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree contains the scoped implementation changes; no commit created."
  changed_paths: ["frontend/src/app/(dashboard)/dormitory/overview/page.tsx", "frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx", "docs/task/taskscope.md"]
  checks_passed: ["npm --prefix frontend test -- src/app/(dashboard)/dormitory/overview/page.test.tsx (12 passed)", "npm --prefix frontend run typecheck", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/dormitory/overview/page.tsx:DormitoryOverviewPage always renders the Công nợ theo phòng Card, including totals, anomaly notice, and mobile/desktop room-debt rows."
  expected_behavior: "The overview does not render the unused room-debt section at any viewport; room status and registration summary remain visible and function unchanged."
  root_cause: "The debt Card remains in the page despite this overview feature not being used."

scope:
  inspect: ["frontend/src/app/(dashboard)/dormitory/overview/page.tsx:DormitoryOverviewPage invoiceSummary/invoices and room-debt Card", "frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx:debt assertions and empty-report coverage"]
  write: ["frontend/src/app/(dashboard)/dormitory/overview/page.tsx:DormitoryOverviewPage room-debt rendering", "frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx:overview assertions"]
  preserve: ["Dashboard statistics request and partial-response warning", "Room status/search/detail behavior and registration summary", "Desktop/mobile layouts outside the hidden section", "API, schema, RBAC, and realtime refresh contracts"]
  out: ["Backend/API/schema changes", "Invoice-report data contract changes", "Removing the invoice summary from the fetched response", "Other dormitory overview redesign"]

acceptance_criteria:
  - "AC-01: Neither desktop nor mobile /dormitory/overview renders Công nợ theo phòng, its debt totals, anomaly notice, room-debt rows, or its empty state."
  - "AC-02: Room status and Tóm tắt đăng ký continue to render after the removed section; data loading, failure, and partial-response behavior remain intact."
  - "AC-03: Focused page tests replace the debt visibility expectation with absence coverage and retain relevant overview assertions."

execution:
  - "E-01 [AC-01,AC-02] page.tsx:DormitoryOverviewPage -> remove the room-debt Card and rendering-only invoice fallback that becomes unused; retain invoice-summary validation for the existing partial-response warning."
  - "E-02 [AC-03] page.test.tsx:overview and empty-report tests -> remove debt-content expectations and assert the section is absent while preserving non-debt coverage."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-03] npm --prefix frontend test -- 'src/app/(dashboard)/dormitory/overview/page.test.tsx' -> focused tests pass."
  - "V-02 [AC-01,AC-02] npm --prefix frontend run typecheck -> exits 0."
  - "V-03 [AC-01..AC-03] git diff --check -> no whitespace errors."

risks: ["Removing invoice-summary validation as part of hiding the UI could conceal a structurally incomplete dashboard response; preserve that warning path."]
stop_conditions: ["Stop if temporary hiding must change the dashboard API response or if the invoice-summary partial-response warning is intentionally being retired."]
