task: "Mirror class-report quick selection in training records"
pipeline: feature_development
profile: Quick
objective: "In create mode, select multiple classes and quickly record one criterion for students from their combined rosters."

evidence:
  current_behavior: "frontend/src/components/grading/AddRecordView.tsx:classId/create-mode student picker supports one class and the current dirty implementation adds a checkbox multi-student field; frontend/src/components/grading/AddClassReportView.tsx:classIds/entryMode already provides the required searchable multi-class and quick-card pattern."
  expected_behavior: "Training-record creation mirrors AddClassReportView multi-class, manual/quick mode, roster search, selected-card, and criterion-reset behavior."
  root_cause: null

scope:
  inspect: ["frontend/src/components/grading/AddClassReportView.tsx:classIds, entryMode, roster loading, handleToggleQuickStudent", "frontend/src/api/academic-record-api.ts:bulkCreateAcademicRecords contract"]
  write: ["frontend/src/components/grading/AddRecordView.tsx:create-mode class and entry selection", "frontend/src/components/grading/AddRecordView.test.tsx:multi-class/quick-selection regressions"]
  preserve: ["single-class/single-student edit mode", "criterion usage ordering", "note/date values", "student+criterion deduplication", "bulk API payload, idempotency, RBAC"]
  out: ["backend/API/schema changes", "changes to AddClassReportView", "multi-record edit"]

acceptance_criteria:
  - "AC-01: Create mode replaces the single-class select with a text-searchable checkbox picker; selecting classes loads and deduplicates their students, while removing a class removes its pending/staged students."
  - "AC-02: Manual and quick buttons appear outside the student-record section; mobile always uses quick mode, matching AddClassReportView visibility behavior."
  - "AC-03: Quick mode requires a criterion, supports roster search/paging, toggles a student card as one staged record, and shows red 'Đã chọn' inline right of the name."
  - "AC-04: Changing criterion clears only pending quick selections; save still submits all staged records through bulkCreateAcademicRecords and edit mode remains single-record."

execution:
  - "E-01 [AC-01] AddRecordView.tsx -> replace classId create state/fetching with classIds, searchable checks, per-class paging, and merged roster; retain classId for edit mode."
  - "E-02 [AC-02..AC-04] AddRecordView.tsx -> replace the dirty checkbox field with AddClassReportView-style manual/quick controls and card toggling."
  - "E-03 [AC-01..AC-04] AddRecordView.test.tsx -> cover roster merge/class removal, quick toggle/reset, deduplication, and mode rules."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/components/grading/AddRecordView.test.tsx -> focused tests pass."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck; git diff --check -> no TypeScript or whitespace errors."

risks: ["Roster requests from several classes may finish out of order; merge by student ID and track paging per class."]
stop_conditions: ["Stop if multi-class training records require an academic-record API/schema change or different behavior from AddClassReportView."]
