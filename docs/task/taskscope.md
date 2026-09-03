slot_id: "taskscope-00"
generation: 16
task_id: "20260903-080313-delete-filtered-student-records"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-03T08:03:13+07:00"
updated_at: "2026-09-03T08:11:18+07:00"
base_commit: "3ba7b13116f7f9fb3aa2480dc070ce4dc13c2127"
task: "Delete filtered student records except daily-report records"
pipeline: bug_fix
profile: Quick
objective: "Deleting selected students soft-deletes eligible records in scope while preserving daily-report records."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-03T08:11:18+07:00"
  outcome: success
  final_commit_or_state: "Working tree changes retained; no commit requested."
  changed_paths: ["frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx", "docs/task/taskscope.md"]
  checks_passed: ["npm --prefix frontend test -- src/app/(dashboard)/students/record/page.test.tsx (26/26)", "npm --prefix frontend run typecheck", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "page.tsx:prepareDeletePreview restricts by latest-record semester and sends daily-report records to bulk delete, where backend rejects them."
  expected_behavior: "Use student plus active class/date/creator filters, without semester/search restriction; omit daily_report_id records before confirmation and deletion."
  root_cause: "prepareDeletePreview builds IDs from getFilteredStudentHistoryParams without excluding daily_report_id and unintentionally narrows the request by latest-record semester."

scope:
  inspect: ["frontend/src/api/academic-record-api.ts:getAcademicRecords/bulkDeleteAcademicRecords contracts", "backend/src/academic-record/academic-record.service.ts:remove daily_report_id guard"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:delete preview and confirmation", "frontend/src/app/(dashboard)/students/record/page.test.tsx:student bulk-delete regression coverage"]
  preserve: ["DELETE_STUDENT_RECORD and hierarchy checks", "class/date/creator filters", "search only locates students", "25-ID batching, partial failures, trash/restore/force-delete"]
  out: ["Backend/API/schema changes", "Deleting daily-report records", "Class-report deletion", "UI redesign"]

acceptance_criteria:
  - "AC-01: Without a date filter, selection previews and soft-deletes accessible cross-semester records except daily_report_id records."
  - "AC-02: With date filters, only records inside the selected range are candidates; active class and creator filters also remain effective."
  - "AC-03: Confirmation shows deletable count and preserved daily-report count; preserved records are not reported as failures."
  - "AC-04: Partial API failures remain selected/visible and duplicate deletion stays blocked during processing."

execution:
  - "E-01 [AC-01..AC-03] page.tsx:getFilteredStudentHistoryParams/prepareDeletePreview → remove semester narrowing, partition fetched records by daily_report_id, and render both counts."
  - "E-02 [AC-01..AC-04] page.test.tsx → cover cross-semester deletion, date-filter forwarding, daily-report exclusion/count, and existing partial/batching behavior."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → focused Vitest passes."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck → exits 0."
  - "V-03 [AC-01..AC-03] git diff --check → exits 0."

risks: ["Client-side exclusion depends on daily_report_id being present in the existing academic-record response."]
stop_conditions: ["Stop if exclusion requires an API/schema/RBAC change or daily_report_id is absent from the history response."]
