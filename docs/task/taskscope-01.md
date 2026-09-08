---
slot_id: "taskscope-01"
generation: 1
task_id: "20260908-164735-separate-record-follow-up-status-action"
scope_file: "docs/task/taskscope-01.md"
status: in_progress
scope_revision: 2
created_at: "2026-09-08T16:47:35+07:00"
updated_at: "2026-09-08T16:55:00+07:00"
base_commit: "beba44765ce5b090aa7ba0417b4df286da309495"
task: "Separate academic-record follow-up status and action columns"
pipeline: explain_or_document
profile: Quick
objective: "In Reports > Ghi nhận SV, show follow-up state in a dedicated status column and provide a separate Xử lý action whose availability reflects whether there are records needing handling."
coordination:
  depends_on: []
  warnings:
    - "The request's second use of 'Cột thao tác' is normalized to 'Trạng thái'; the separate action column is named 'Hành động'."
    - "V-03/V-04 runtime verification was not run because the local data-service configuration could not prove separation from production under safety.md section 6a."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed:
    - "V-01: focused AcademicRecordReportTab test passed (6 tests)."
    - "V-02: frontend typecheck passed."
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx:columns renders status, handled time, new-record count, and the follow-up button together under one 'Theo dõi' column; the button label is 'Đã xử lý'."
  expected_behavior: "The table has separate 'Trạng thái' and 'Hành động' columns; status displays 'Chưa xử lý', 'Đã xử lý', or '<N> ghi nhận mới', while the action is labeled 'Xử lý' and is visibly disabled when no records need handling or while a request is pending."
  root_cause: null
scope:
  inspect:
    - "frontend/src/components/reports/ReportTable.tsx"
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/components/reports/report-types.ts"
    - "frontend/src/api/academic-record-api.ts"
  write:
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx"
  preserve:
    - "Keep the existing student-and-semester checkpoint API, confirmation dialog, refresh-after-success behavior, error message, status filter values, RBAC, pagination, and record-detail interactions unchanged."
    - "A row with follow_up_status='new' remains actionable so the newly created records can be acknowledged; marking it handled returns it to the disabled settled state after refresh."
    - "Do not infer follow-up state in the browser; render follow_up_status and new_record_count returned by the API."
  out:
    - "Backend schemas, services, controllers, DTOs, and API response contracts"
    - "Changing follow-up reset behavior, permissions, exports, or report filters"
acceptance_criteria:
  - "AC-01: The Ghi nhận SV table renders a dedicated 'Trạng thái' column and a separate 'Hành động' column; the old combined 'Theo dõi' column is absent."
  - "AC-02: An unhandled row displays 'Chưa xử lý'; a settled row displays 'Đã xử lý'; and a row with new records displays exactly '<N> ghi nhận mới' using new_record_count, including '1 ghi nhận mới' when the count is one."
  - "AC-03: The action column renders a button labeled 'Xử lý'. It is enabled for unhandled/new rows with a selected semester, disabled and visually faded for settled rows, and disabled while its request is pending to prevent duplicate submission."
  - "AC-04: Confirming an enabled action calls markFollowUp once for the row student and selected semester, then refreshes on success; cancelling or a failed request does not report success, and failure retains the actionable row state with the existing error feedback."
execution:
  - "E-01 [AC-01, AC-02] frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx:columns -> split the current follow-up renderer into 'Trạng thái' and 'Hành động'; map new status to the count-based label and keep handled metadata only if it remains readable without merging the action back into status."
  - "E-02 [AC-03, AC-04] frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx:handleFollowUp/action renderer -> rename the action to 'Xử lý', retain confirmation/API/refresh/error flow, and apply disabled plus faded styling for pending or settled rows while re-enabling rows with new records."
  - "E-03 [AC-01, AC-02, AC-03, AC-04] frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx -> update assertions for the two columns, exact three status presentations, action enable/disable styling semantics, duplicate-click prevention, success refresh, cancellation, and failure behavior."
verification:
  - "V-01 [AC-01, AC-02, AC-03, AC-04] npm --prefix frontend test -- \"src/components/reports/tabs/AcademicRecordReportTab.test.tsx\" -> Vitest exits 0 with assertions covering separate columns and all action/status states."
  - "V-02 [AC-01, AC-02, AC-03, AC-04] npm --prefix frontend run typecheck -> TypeScript exits 0."
  - "V-03 [AC-01, AC-02, AC-03] In the verified dev Reports > Ghi nhận SV tab, inspect one unhandled, one settled, and one new-record row -> the status text matches the API count; settled/pending actions are faded and non-interactive, while unhandled/new actions are available."
  - "V-04 [AC-04] In the verified dev UI, confirm Xử lý on an actionable task-scoped row -> one request succeeds, the report refreshes, status becomes 'Đã xử lý', and the action becomes disabled; clean up or restore only task-created test data under the dev-testing contract."
runtime_test:
  environment: development
  targets: "Resolve and verify the effective frontend URL, API destination, and dev data-service identity before interaction; stop runtime mutation if separation from production cannot be established."
  resources: "One task-scoped student/semester follow-up row; use existing dev records read-only where possible and record a minimal before-state before changing an existing dev checkpoint."
  scenarios: "Inspect unhandled/settled/new states, then mark one actionable row handled and verify the refreshed disabled state."
  cleanup: "Remove only positively identified task-created disposable records or restore the captured checkpoint when safe and unchanged by others; report retained changes if restoration is unsafe."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "The action must become available again for follow_up_status='new'; disabling every previously handled row would prevent acknowledging later records."
stop_conditions:
  - "Stop with TASKSCOPE_CONFLICT if either write path becomes dirty from unknown work or overlaps another active scope before execution."
  - "Stop runtime mutations if the effective services cannot be proven to use development data isolated from production."
---
