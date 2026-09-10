slot_id: "taskscope-02"
generation: 1
task_id: "20260910-dashboard-today-academic-records"
scope_file: "docs/task/taskscope-02.md"
status: blocked
scope_revision: 1
created_at: "2026-09-10T14:57:58.3000520+07:00"
updated_at: "2026-09-10T14:57:58.3000520+07:00"
base_commit: "0f15a1b4022bfa3c0d4a6a767c65bd6fead8a120"
task: "Show today's academic records on the dashboard"
pipeline: feature_development
profile: Quick
objective: "Make the dashboard academic-record panel show at most five active records recorded during the current Vietnam calendar day, newest first, while preserving semester, role, and deletion filters."
coordination:
  depends_on:
    - "docs/task/taskscope-01.md generation 1 must release backend/src/system/system.service.ts and backend/src/system/system.service.spec.ts by reaching completed or cancelled status."
  warnings:
    - "TASKSCOPE_CONFLICT: taskscope-01 generation 1 is ready and reserves backend/src/system/system.service.ts and backend/src/system/system.service.spec.ts."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "backend/src/system/system.service.ts:getDashboardMetrics filters recentAcademicRecords by semester, active status, deletion state, and requester scope, then sorts by recorded_at/createdAt and limits to five without a day boundary; frontend/src/components/dashboard/AttendanceRecordPanel.tsx labels the list as recent records and renders recorded_at as a date."
  expected_behavior: "The same authorized list is additionally restricted to recorded_at within today's Asia/Ho_Chi_Minh calendar boundaries and the panel copy communicates that daily scope."
  root_cause: null
scope:
  inspect:
    - "backend/src/academic-record/schemas/academic-record.schema.ts"
    - "frontend/src/api/system-api.ts"
    - "frontend/src/app/(dashboard)/page.tsx"
  write:
    - "backend/src/system/system.service.ts"
    - "backend/src/system/system.service.spec.ts"
    - "frontend/src/components/dashboard/AttendanceRecordPanel.tsx"
    - "frontend/src/components/dashboard/AttendanceRecordPanel.test.tsx"
  preserve:
    - "GET /api/system/dashboard-metrics keeps its existing request and response shape; no new public query parameter is introduced."
    - "Semester selection, active/deleted conditions, requester RBAC, teacher class class scope, and student self scope remain unchanged."
    - "A dashboard record day is determined by recorded_at, not occurred_at or createdAt; createdAt remains only the secondary sort key."
    - "The All links continue to open /students/record without applying the dashboard-only daily restriction."
  out:
    - "Changes to the full academic-record history page or its filters"
    - "Schema, index, migration, backfill, permission, or persisted-data changes"
    - "Changes to student highlights, scoring, follow-up semantics, or other dashboard panels"
    - "Commit, push, deployment, or production testing"
acceptance_criteria:
  - "AC-01: recentAcademicRecords contains only active, non-deleted records whose recorded_at is at or after the start of today and before the start of tomorrow in Asia/Ho_Chi_Minh; records immediately outside either boundary are excluded."
  - "AC-02: Existing semester and requester scoping is preserved for admin, teacher, and student paths, and matching records remain sorted newest first with a maximum of five items."
  - "AC-03: The panel title and empty state explicitly describe today's records; populated rows retain the existing title, student, point badge, and navigation behavior."
  - "AC-04: The dashboard endpoint response shape, academic-record schema, dependencies, permissions, and the full-history route remain unchanged."
execution:
  - "E-01 [AC-01,AC-02,AC-04] backend/src/system/system.service.ts:getDashboardMetrics -> compute one half-open [startOfToday, startOfTomorrow) UTC interval from the Asia/Ho_Chi_Minh calendar day and add the same recorded_at range to teacher aggregate and non-teacher find filters before sorting and limiting."
  - "E-02 [AC-01,AC-02,AC-04] backend/src/system/system.service.spec.ts -> add focused assertions for both query branches, Vietnam-day boundary inclusion/exclusion, preserved scope predicates, descending order, and limit five."
  - "E-03 [AC-03,AC-04] frontend/src/components/dashboard/AttendanceRecordPanel.tsx -> rename the heading to Ghi nhận học vụ hôm nay and the empty message to Hôm nay chưa có ghi nhận học vụ while preserving populated-row and navigation behavior."
  - "E-04 [AC-03,AC-04] frontend/src/components/dashboard/AttendanceRecordPanel.test.tsx (new; use the existing dashboard component Vitest convention) -> cover heading, empty state, populated row, and both /students/record navigation actions."
verification:
  - "V-01 [AC-01,AC-02,AC-04] npm --prefix backend test -- --runTestsByPath src/system/system.service.spec.ts --runInBand -> the target suite passes with both query branches and Vietnam-day edge cases covered."
  - "V-02 [AC-03,AC-04] npm --prefix frontend test -- \"src/components/dashboard/AttendanceRecordPanel.test.tsx\" -> the target component suite passes."
  - "V-03 [AC-01,AC-02,AC-03,AC-04] npm --prefix frontend run typecheck && npm --prefix backend run build -> frontend typing and Nest compilation both succeed."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-02.md: user-requested reusable taskscope slot"
risks:
  - "Using the host process timezone would shift day boundaries when deployed outside Vietnam; the implementation must derive Asia/Ho_Chi_Minh boundaries explicitly and query MongoDB with UTC instants."
stop_conditions:
  - "Do not execute while taskscope-01 generation 1 remains ready, in_progress, or blocked because its backend write reservation overlaps this scope."
  - "TASKSCOPE_CONFLICT if another active scope or unknown changes reserve or modify any write path at execution time."
  - "Stop for a scope amendment if the product meaning changes from recorded today (recorded_at) to occurred today (occurred_at), or if a public API/schema/dependency change becomes necessary."
