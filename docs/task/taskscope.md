task: "Replace mobile student preview with a readable criterion sheet"
pipeline: feature_development
profile: Quick
objective: "On mobile, opening Record shows only the criterion sheet; closing or successfully submitting it restores the same student's basic-information preview with readable mobile typography."

evidence:
  current_behavior: "frontend/src/components/students/StudentDirectorySearch.tsx:previewModal keeps the basic-information DOM mounted behind a fixed criterion overlay; criterion controls use text-xs/text-[10px], and the criterion Close action calls closePreview(), which dismisses the whole student preview."
  expected_behavior: "Below sm, the criterion flow replaces the visible basic-information content, uses mobile-readable text, and returns to that content after cancel or successful confirmation. At sm and wider, the existing inline criterion layout remains."
  root_cause: "Criterion visibility is inferred from loaded data and shares closePreview() with the parent dialog; no dedicated criterion-panel state/close action controls the mobile view."

scope:
  inspect: ["frontend/src/components/students/StudentDirectorySearch.tsx:record state and previewModal", "frontend/src/components/students/StudentDirectorySearch.test.tsx:record interaction regressions"]
  write: ["frontend/src/components/students/StudentDirectorySearch.tsx:mobile criterion view/state", "frontend/src/components/students/StudentDirectorySearch.test.tsx:mobile visibility, return, and typography assertions"]
  preserve: ["student search, selected student, permissions, criteria/semester loading, usage ordering, idempotent submission, safe errors, desktop layout, and detail navigation", "failed submissions keep the criterion sheet open with its selection and error"]
  out: ["API/backend changes", "search-result redesign", "student detail-page changes", "new UI dependencies"]

acceptance_criteria:
  - "AC-01: Below sm, after Record is activated, the criterion sheet is visible and the basic-information header, fields, and parent close control are not visible or focusable behind it."
  - "AC-02: Closing the criterion sheet cancels only that flow and restores the same student's basic-information preview; a successful confirmation automatically does the same and shows the existing success message."
  - "AC-03: On mobile, the criterion search input is at least 16px, criterion/action labels are at least 14px, secondary labels are at least 12px, and existing 44px minimum touch targets remain; sm+ keeps the compact typography."
  - "AC-04: Loading and failed submission states stay in the criterion sheet; the API is called once with the currently selected student, criterion, semester, recorder, and idempotency key."

execution:
  - "E-01 [AC-01..AC-04] frontend/src/components/students/StudentDirectorySearch.tsx:record controls → add an explicit criterion-panel close/reset path distinct from closePreview(), conditionally hide the mobile basic-information region while the panel is loading/open, restore it after cancel/success, and apply mobile-first text sizes with sm overrides."
  - "E-02 [AC-01..AC-04] frontend/src/components/students/StudentDirectorySearch.test.tsx → assert hidden/restored preview content, cancel versus parent dismissal, success restoration, failure retention, font-size classes, and unchanged submission payload/single-call protection."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/components/students/StudentDirectorySearch.test.tsx → focused suite passes."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck → exits 0."
  - "V-03 [AC-01..AC-03] Manual 375x812 and >=640px checks → mobile swaps between the two views without background content/focus or horizontal overflow; desktop remains inline."

risks: ["Responsive visibility cannot be inferred from jsdom layout, so tests must assert responsive classes/state and retain the stated manual viewport check."]
stop_conditions: ["Stop if the requested mobile breakpoint is not sm (640px), if confirmation should close the entire student preview instead of restoring it, or if a new dialog/popover dependency or API change becomes necessary."]
