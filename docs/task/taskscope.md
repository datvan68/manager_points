slot_id: "taskscope-00"
generation: 3
task_id: "20260830-165026-adjust-hssv-record-detail"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-08-30T16:50:26+07:00"
updated_at: "2026-08-30T16:57:20+07:00"
base_commit: "6f141a1849de3e284f1a136092c89d5987f05497"
task: "Simplify record-type cells and show complete drawer history"
pipeline: bug_fix
profile: Quick
objective: "Keep Loại ghi nhận compact and show every active student record in the Chi tiết trạng thái drawer."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-08-30T16:57:20+07:00"
  outcome: success
  final_commit_or_state: "Working tree changes present; no commit created. Pre-existing backend/API changes preserved."
  changed_paths: ["frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx", "docs/task/taskscope.md"]
  checks_passed: ["npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' (21 passed)", "npm --prefix frontend run typecheck", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "page.tsx:MemoizedAcademicRecordTableCells adds RecordTypeCounts below the icons; handleOpenDrawerChange applies list filters to drawer history."
  expected_behavior: "The cell shows only icons; both drawers render all active records for the student."
  root_cause: "Drawer history reuses list-filter parameters instead of querying by student ID alone."

scope:
  inspect: ["frontend/src/api/academic-record-api.ts:getAcademicRecords unpaginated contract"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:MemoizedAcademicRecordTableCells and handleOpenDrawerChange", "frontend/src/app/(dashboard)/students/record/page.test.tsx:table-cell and drawer-history regressions"]
  preserve: ["Grouped counts, list filters, drawer states/order/counts, RBAC, deletion, and both drawer entry points"]
  out: ["Backend/API/schema changes", "Removing summary counts inside the drawer", "Changing non-drawer detail view or bulk-delete behavior"]

acceptance_criteria:
  - "AC-01: Loại ghi nhận shows existing icons without Total/per-type text below."
  - "AC-02: Either drawer queries only studentId and renders every returned active record once."
  - "AC-03: Drawer states, ordering, counts, permissions, and list filters remain unchanged."

execution:
  - "E-01 [AC-01] page.tsx:MemoizedAcademicRecordTableCells → remove its RecordTypeCounts."
  - "E-02 [AC-02,AC-03] page.tsx:handleOpenDrawerChange → query by studentId only; retain mapping/order/states."
  - "E-03 [AC-01..AC-03] page.test.tsx → cover compact cell and complete drawer history."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-03] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → focused regressions pass."
  - "V-02 [AC-01..AC-03] npm --prefix frontend run typecheck → affected page compiles."
  - "V-03 [AC-01..AC-03] git diff --check → no whitespace errors."

risks: ["Drawer visibility broadens within existing academic-record read permission."]
stop_conditions: ["Resolve/incorporate the dirty-path conflict; stop if drawer history must stay semester-scoped."]
