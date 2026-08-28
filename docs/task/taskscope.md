task: "Fix search-preview record creation and rank frequent criteria"
pipeline: bug_fix
profile: Quick
objective: "Authorized users can record in-scope students and get a dynamic top-three frequent-criteria group."

evidence:
  current_behavior: "StudentDirectorySearch.tsx:handleCreateRecord hides every API rejection behind the generic error; previewModal labels every filtered criterion as Sử dụng nhiều."
  expected_behavior: "Creation succeeds once or shows the server reason; Sử dụng nhiều dynamically ranks at most three per-user criteria."
  root_cause: "The preview discards API errors and bypasses the shared criterion-usage helpers."

scope:
  inspect: ["backend/src/academic-record/academic-record.service.ts:create/assertCanAccessStudent", "frontend/src/api/academic-record-api.ts:createAcademicRecord", "frontend/src/components/grading/criterion-usage.ts"]
  write: ["frontend/src/components/students/StudentDirectorySearch.tsx:record/error/ranking", "frontend/src/components/students/StudentDirectorySearch.test.tsx:regressions"]
  preserve: ["RBAC and grading scope", "semester/locked-summary rules", "idempotency", "search/preview behavior", "per-user usage storage"]
  out: ["backend/API/schema changes", "grading calculations", "bulk recording", "cross-device usage sync"]

acceptance_criteria:
  - "AC-01: Confirm sends one valid request, blocks duplicate clicks, and reports success only after resolution."
  - "AC-02: API 400/403/locked/validation messages are shown safely; unknown failures use the fallback and retain the open preview and selection."
  - "AC-03: Sử dụng nhiều is hidden with no usage; otherwise it shows at most three unique criteria by descending count, with every remainder still selectable."
  - "AC-04: Using a criterion increments its per-user count immediately; overtaking promotes it and demotes the lower-count third item."

execution:
  - "E-01 [AC-01,AC-02] StudentDirectorySearch.tsx -> align payload and preserve categorized API errors."
  - "E-02 [AC-03,AC-04] StudentDirectorySearch.tsx -> load/increment usage and render ordered frequent/remaining groups."
  - "E-03 [AC-01..AC-04] StudentDirectorySearch.test.tsx -> cover creation, errors, top-three promotion, uniqueness, and submit guard."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/components/students/StudentDirectorySearch.test.tsx"
  - "V-02 [AC-03,AC-04] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx src/components/grading/AddRecordView.test.tsx"
  - "V-03 [AC-01..AC-04] npm --prefix frontend run typecheck"

risks: ["Teachers may find out-of-scope students; backend denial must remain enforced and visible."]
stop_conditions: ["Stop if reproduction proves the API persists a record but returns failure during score sync, or fixing creation requires a backend contract/transaction change."]
