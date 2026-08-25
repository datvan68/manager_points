task: "Replace grading dropdowns with confirmed fullscreen selection"
pipeline: feature_development
profile: Full
objective: "Class and HSSV record forms use stable fullscreen selection dialogs, while quick student cards remain visually distinct and scroll only after six items."

evidence:
  current_behavior: "frontend/src/components/grading/{AddClassReportView.tsx,AddRecordView.tsx} render class, student, and criterion choices in anchored SelectContent/PopoverContent; both quick-mode student grids always apply max-height/overflow scrolling."
  expected_behavior: "Opening any class/student/criterion selector shows a viewport-filling modal with draft selection and explicit confirmation; quick grids show up to six stronger cards before scrolling."
  root_cause: "Anchored Radix Select/Popover content can shift or clip inside the scrollable dashboard form and commits values immediately; fixed responsive max-heights do not enforce a six-card threshold."

scope:
  inspect: ["frontend/src/components/ui/{dialog.tsx,select.tsx}: accessibility/portal conventions", "frontend/src/components/grading/{AddClassReportView.tsx,AddRecordView.tsx}: selector state, quick-mode handlers, and save payloads", "frontend/src/components/grading/{AddClassReportView.test.tsx,AddRecordView.test.tsx}: nearest test conventions"]
  write: ["frontend/src/components/grading/RecordSelectionUi.tsx: reusable fullscreen selector and quick-grid threshold styling", "frontend/src/components/grading/RecordSelectionUi.test.tsx: selection and grid regressions", "frontend/src/components/grading/AddClassReportView.tsx: class/student/criterion integrations", "frontend/src/components/grading/AddRecordView.tsx: create/edit class, student, and criterion integrations"]
  preserve: ["Existing search, multi-class selection, student lazy loading, frequent/remaining criterion grouping, disabled/empty/loading states", "Criterion usage tracking and quick-row clearing run only after confirmed criterion changes", "Validation, violation limits, edit/create behavior, APIs, save payloads, RBAC, and date calendar behavior"]
  out: ["Backend/API/schema changes", "Changing violation business rules or the saved-record table", "Replacing the shared application-wide Select primitive", "Redesigning the date picker"]

acceptance_criteria:
  - "AC-01: Every class, student, and criterion trigger in both forms opens an accessible fullscreen dialog; choices remain draft until Confirm, while Cancel/close preserves the previously committed value."
  - "AC-02: Single/multi-select, search, grouping, lazy-load, disabled, loading, and empty states retain their current behavior; confirmed values feed the existing handlers and payloads exactly once."
  - "AC-03: In quick mode, student cards have a visibly stronger default border/background/type treatment, retain distinct selected/disabled states, show without a vertical scrollbar for 0-6 items, and use a six-card viewport with vertical scrolling for 7+ items at mobile and desktop breakpoints."

execution:
  - "E-01 [AC-01,AC-02] frontend/src/components/grading/RecordSelectionUi.tsx → add controlled draft/confirm/cancel fullscreen selection UI and reusable six-card grid classes without new dependencies."
  - "E-02 [AC-01,AC-02,AC-03] frontend/src/components/grading/{AddClassReportView.tsx,AddRecordView.tsx} → replace anchored class/student/criterion menus and apply the shared quick-grid/card presentation."
  - "E-03 [AC-01,AC-02,AC-03] frontend/src/components/grading/RecordSelectionUi.test.tsx → cover deferred commit, cancel rollback, single/multi selection, and the 6/7-item overflow boundary."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix frontend test -- src/components/grading/RecordSelectionUi.test.tsx src/components/grading/AddClassReportView.test.tsx src/components/grading/AddRecordView.test.tsx → all suites pass."
  - "V-02 [AC-01,AC-02,AC-03] npm --prefix frontend run typecheck → exit code 0."
  - "V-03 [AC-01,AC-03] Manual responsive check of /students/record in both creation flows → fullscreen confirm/cancel works and the scrollbar appears only from the seventh card."

risks: ["Draft selection must not invoke criterion side effects before confirmation; responsive grid rows must cap six total cards rather than six rows."]
stop_conditions: ["Stop if the requested modal also includes the date calendar, requires an application-wide Select behavior change, changes API/save semantics, or needs more than these four write paths."]
