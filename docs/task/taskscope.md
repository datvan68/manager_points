task: "Make grading selectors responsive and fix compact student list"
pipeline: feature_development
profile: Full
objective: "Class and HSSV record forms use fullscreen confirmed selection only on mobile/tablet, remain usable on compact desktops, and show the selected student's full name in manual mode."

evidence:
  current_behavior: "frontend/src/components/grading/RecordSelectionUi.tsx:RecordSelectionDialog always renders DialogContent; quickGridClass uses breakpoint max-heights unrelated to actual card rows. Both forms pass selectedStudentId without displayValue, so the trigger displays the raw ID."
  expected_behavior: "Viewport widths <=1023px use the fullscreen draft/confirm selector; >=1024px use an anchored desktop picker. Quick lists expose at most six complete cards before scrolling, and manual student triggers display full_name."
  root_cause: "The selection component has no responsive rendering branch; fixed grid heights plus responsive columns/card heights clip compact-desktop content; committedLabel falls back to value when displayValue is absent."

scope:
  inspect: ["frontend/src/components/grading/RecordSelectionUi.tsx: responsive selector and quickGridClass", "frontend/src/components/grading/{AddClassReportView.tsx,AddRecordView.tsx}: matchMedia state, selector integrations, quick grids", "frontend/src/components/grading/RecordSelectionUi.test.tsx: nearest behavior tests"]
  write: ["frontend/src/components/grading/RecordSelectionUi.tsx: responsive modal/anchored picker and six-card viewport", "frontend/src/components/grading/RecordSelectionUi.test.tsx: breakpoint, commit, label, and overflow regressions", "frontend/src/components/grading/AddClassReportView.tsx: selector mode and student display name", "frontend/src/components/grading/AddRecordView.tsx: selector mode and student display name"]
  preserve: ["Search, single/multi selection, lazy loading, criterion grouping, disabled/loading/empty states", "Mobile/tablet draft selection commits only on Confirm and Cancel/close preserves the committed value", "Criterion side effects, APIs, payloads, RBAC, edit/create flows, date picker, and mobile quick-entry behavior"]
  out: ["Backend/API/schema changes", "Application-wide Select/Dialog changes", "Date-picker redesign", "Changes to violation rules or saved-record tables"]

acceptance_criteria:
  - "AC-01: At <=1023px every class/student/criterion trigger opens the fullscreen dialog with Confirm/Cancel semantics; at >=1024px it opens an anchored picker and never fullscreen, including compact desktop widths."
  - "AC-02: Quick mode shows 0-6 complete student cards without an inner vertical scrollbar and exactly a six-card viewport with scrolling for 7+ cards at each supported column breakpoint; no card/text is clipped or covered by the scrollbar."
  - "AC-03: After selecting a student in manual mode, both forms' 'Họ tên sinh viên' trigger shows full_name (not _id/student_code), while the existing placeholder remains before selection."
  - "AC-04: Search, multi-select, lazy-load, criterion ordering, committed handlers, and existing save payloads retain current behavior across both responsive modes."

execution:
  - "E-01 [AC-01,AC-02,AC-04] frontend/src/components/grading/RecordSelectionUi.tsx → branch presentation at 1023/1024, reuse one selection model, and derive the scroll viewport from six cards plus responsive column count with scrollbar clearance."
  - "E-02 [AC-01,AC-03,AC-04] frontend/src/components/grading/{AddClassReportView.tsx,AddRecordView.tsx} → pass responsive mode and selected student's full_name to every affected trigger without changing handlers."
  - "E-03 [AC-01,AC-02,AC-03,AC-04] frontend/src/components/grading/RecordSelectionUi.test.tsx → mock matchMedia and cover mobile/tablet confirmation, desktop anchored rendering, full-name display, and 6/7-card overflow classes."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02,AC-03,AC-04] npm --prefix frontend test -- src/components/grading/RecordSelectionUi.test.tsx src/components/grading/AddClassReportView.test.tsx src/components/grading/AddRecordView.test.tsx → all suites pass."
  - "V-02 [AC-01,AC-02,AC-03,AC-04] npm --prefix frontend run typecheck → exit code 0."
  - "V-03 [AC-01,AC-02,AC-03] Manual responsive check of /students/record at 1023px, 1024px, and >=1280px in both flows → correct picker type, full-name trigger, six complete cards, and scrolling from card 7."

risks: ["Responsive rendering must not double-fire selection handlers when crossing the breakpoint; the six-card cap must count cards, not rows."]
stop_conditions: ["Stop if the breakpoint must differ from the repository's existing 1023px mobile/tablet boundary, desktop selection requires a new product interaction, or the fix needs shared UI/API changes outside the four write paths."]
