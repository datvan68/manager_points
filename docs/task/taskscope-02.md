---
slot_id: "taskscope-02"
generation: 1
task_id: "20260909-073821-bulk-academic-record-follow-up"
scope_file: "docs/task/taskscope-02.md"
status: completed
scope_revision: 3
created_at: "2026-09-09T07:38:21+07:00"
updated_at: "2026-09-09T07:50:00+07:00"
base_commit: "f374196f7da78903741524f2baee8daa23ab1537"
task: "Add bulk follow-up handling to the academic-record report"
pipeline: feature_development
profile: Full
objective: "In Reports > Ghi nhận SV > Dữ liệu, allow users to select actionable student rows, open a FloatingActionBar, and confirm one bulk Xử lý action in ConfirmModal before marking the selected follow-ups handled."
coordination:
  depends_on: []
  warnings:
    - "The taskscope-01 dependency was completed in commit e13e686c and its reservation artifact was removed in f374196f; the baseline was refreshed before marking this scope ready."
    - "Bulk processing reuses the existing per-student markFollowUp API; no backend bulk contract is introduced."
completion:
  completed_at: "2026-09-09T07:50:00+07:00"
  outcome: "Implemented bulk follow-up selection and confirmation for the academic-record report."
  final_commit_or_state: "Working tree changes on main; uncommitted."
  changed_paths:
    - "frontend/src/components/ui/ResponsiveDataView.tsx"
    - "frontend/src/components/ui/ResponsiveDataView.test.tsx"
    - "frontend/src/components/reports/ReportTable.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx"
  checks_passed:
    - "V-01: npm --prefix frontend test -- \"src/components/reports/tabs/AcademicRecordReportTab.test.tsx\" \"src/components/ui/ResponsiveDataView.test.tsx\" (13 tests passed)."
    - "V-02: npm --prefix frontend run typecheck (passed)."
    - "git diff --check on all scoped changed files (passed)."
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx renders per-row Xử lý and calls window.confirm before one academicRecordApi.markFollowUp request; ReportTable does not expose ResponsiveDataView selection, although ResponsiveDataView already supports controlled checkboxes and the shared FloatingActionBar/ConfirmModal components exist."
  expected_behavior: "Only unhandled/new rows can be selected on the current data page; any selection shows a FloatingActionBar whose Xử lý action opens ConfirmModal, and confirmation handles the frozen selected set once without duplicate submission."
  root_cause: null
scope:
  inspect:
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/api/academic-record-api.ts"
    - "frontend/src/components/ui/FloatingActionBar.tsx"
    - "frontend/src/components/modals/ConfirmModal.tsx"
  write:
    - "frontend/src/components/ui/ResponsiveDataView.tsx"
    - "frontend/src/components/reports/ReportTable.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx"
  preserve:
    - "Keep RBAC, report filters, server-side pagination, export, detail dialogs, status rendering, and the student/semester markFollowUp API contract unchanged."
    - "Settled rows remain non-actionable; unhandled and new rows remain actionable when semesterId is present."
    - "A failed student request is not reported as successful; failed rows remain selected for retry, while successful rows are refreshed once after the batch."
    - "Selection controls remain accessible in both desktop table and responsive mobile cards."
  out:
    - "Backend controllers, DTOs, services, schemas, and new bulk API endpoints"
    - "Changes to follow-up checkpoint semantics, permissions, filters, exports, or unrelated report tabs"
acceptance_criteria:
  - "AC-01: Each displayed unhandled/new row has an enabled checkbox, settled rows cannot be selected, and the header selection control selects or clears all actionable rows on the displayed page."
  - "AC-02: Selecting at least one row shows the shared FloatingActionBar with the exact selected count and an Xử lý action; clearing, changing report page/page size/status filter, or completing all selected rows removes stale selection."
  - "AC-03: Clicking the bulk Xử lý action opens the shared ConfirmModal with the frozen selected count; cancelling sends no request, while confirming sends exactly one markFollowUp call per selected student for the active semester and prevents duplicate confirmation during the batch."
  - "AC-04: After a fully successful batch the report refreshes once and selection clears; after partial/total failure it refreshes successful changes once, shows the existing scoped error feedback, and retains only failed student IDs for retry."
execution:
  - "E-01 [AC-01] frontend/src/components/ui/ResponsiveDataView.tsx:selection -> add an optional row-selectability predicate and apply disabled/accessibility behavior consistently to desktop and mobile selection controls without changing existing consumers."
  - "E-02 [AC-01, AC-02] frontend/src/components/reports/ReportTable.tsx:ReportTableProps/ResponsiveDataView -> expose controlled selection and forward it to the currently displayed page, preserving existing pagination and non-selectable report tables."
  - "E-03 [AC-01, AC-02, AC-03, AC-04] frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx -> manage selected IDs and a frozen confirm set, render FloatingActionBar plus ConfirmModal, run existing markFollowUp calls with duplicate-submit protection, refresh once, clear successes, retain failures, and reset stale selection on navigation/filter/data-boundary changes."
  - "E-04 [AC-01, AC-02, AC-03, AC-04] frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx -> cover row/select-all eligibility, floating count/clear/reset, modal cancel/confirm, frozen IDs, duplicate prevention, full success, and partial failure retry state."
verification:
  - "V-01 [AC-01, AC-02, AC-03, AC-04] npm --prefix frontend test -- \"src/components/reports/tabs/AcademicRecordReportTab.test.tsx\" \"src/components/ui/ResponsiveDataView.test.tsx\" -> Vitest exits 0 with selection eligibility and bulk confirmation outcomes covered."
  - "V-02 [AC-01, AC-02, AC-03, AC-04] npm --prefix frontend run typecheck -> TypeScript exits 0."
  - "V-03 [AC-01, AC-02, AC-03] In the verified dev Reports > Ghi nhận SV data view, select actionable rows on desktop and mobile, clear/reselect, then cancel ConfirmModal -> the bar/count/disabled states are correct and no request changes data."
  - "V-04 [AC-03, AC-04] In the verified dev UI, confirm bulk Xử lý for task-scoped actionable rows -> each selected student is handled once, the view refreshes once, completed selection clears, and any induced failed row remains selected with error feedback."
runtime_test:
  environment: development
  targets: "Resolve and verify the effective frontend URL, API destination, and dev data-service identity before interaction; stop runtime mutation if separation from production cannot be established."
  resources: "A small task-scoped set of unhandled/new student-semester follow-ups plus a settled row; capture minimal before-state for any existing dev checkpoints changed."
  scenarios: "Verify desktop/mobile selection and cancellation, then confirm one small bulk batch and observe refresh, cleared successes, and retained failures when safely reproducible."
  cleanup: "Remove only task-created disposable records or restore captured checkpoints when safe and unchanged by others; report retained changes if restoration is unsafe."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-02.md: user-requested reusable taskscope slot"
risks:
  - "Four frontend write paths and responsive selection behavior exceed the Quick file limit, so this scope uses Full."
  - "Client-side fan-out can partially succeed; the UI must freeze the submitted set and retain failed IDs rather than replay successful requests."
stop_conditions:
  - "Stop with TASKSCOPE_CONFLICT if any write path is reserved by another active scope or becomes dirty from unknown work before execution."
  - "Stop runtime mutations if the effective services cannot be proven to use development data isolated from production."
---
