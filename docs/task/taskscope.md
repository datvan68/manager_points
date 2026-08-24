task: "Add dual student-selection modes to class evaluation"
pipeline: feature_development
profile: Quick
objective: "Users can keep manual entry or quickly mark multiple class students under one violation criterion."

evidence:
  current_behavior: "frontend/src/components/grading/AddClassReportView.tsx:handleAddViolationToList accepts one student; fetchClassStudents already pages/searches by class; handleSave persists addedViolations."
  expected_behavior: "Two exclusive mode buttons expose the existing manual form or a responsive student-card selector modeled on the supplied screenshot."
  root_cause: null

scope:
  inspect: ["frontend/src/components/grading/AddClassReportView.tsx:fetchClassStudents/handleSave", "frontend/src/api/student-api.ts:getStudents"]
  write: ["frontend/src/components/grading/AddClassReportView.tsx:entry mode and quick selector", "frontend/src/components/grading/AddClassReportView.test.tsx:mode/selection regressions"]
  preserve: ["Manual mode is default: student, criterion, note, Add", "existing addedViolations/save API and edit flow", "per-user top-three frequent criteria", "Add does not clear detail note", "duplicate pair and total-ten limits", "absence-based attendance calculation"]
  out: ["Backend/API/DTO changes", "attendance Present/Absent workflow", "unrelated page redesign"]

acceptance_criteria:
  - "AC-01: Manual/Quick buttons are mutually exclusive; switching preserves detail note and added violations."
  - "AC-02: Quick mode requires class and criterion and shows searchable/paged student cards with name, code, responsive one/two columns, selected/total count, and accessible selected state."
  - "AC-03: Toggling a card adds/removes exactly one ViolationItem using the active criterion and note; duplicates and totals above ten are rejected with existing toast conventions."
  - "AC-04: Manual entry, report editing, frequent-criteria ordering, absence counts, and persisted payload remain compatible."

execution:
  - "E-01 [AC-01..AC-04] AddClassReportView.tsx → add mode state, shared ViolationItem creation/removal rules, and quick cards using existing paging/search while retaining selection across pages."
  - "E-02 [AC-01..AC-04] AddClassReportView.test.tsx → cover default/switching state, note retention, toggle data, duplicate handling, and ten-item limit."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx → Vitest passes."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck; git diff --check → both exit 0."

risks: ["Paged/search results must not discard selections or derive selected count from only the visible page."]
stop_conditions: ["Stop if quick mode must exceed the existing ten-item limit or requires API/payload changes; obtain product confirmation and amend scope."]
