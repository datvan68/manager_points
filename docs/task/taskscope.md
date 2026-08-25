task: "Restore student cards and display saved class notes"
pipeline: bug_fix
profile: Full
objective: "After reopening either grading form, reload the student cards for restored classes; after saving a class report, show its class note in list/detail/edit views."

evidence:
  current_behavior:
    - "The supplied screenshot shows a restored selection count of 2 / 0 with 'Không tìm thấy sinh viên'. In AddRecordView.tsx and AddClassReportView.tsx, restoringDraftRef makes the classIds effect return before initializing pagination and calling fetchClassStudents()."
    - "AddClassReportView.tsx submits class_notes, matching backend DTO/schema, but frontend/src/api/daily-class-report-api.ts declares returned data as class_note and the record page/detail dialogs read report.class_note. A response containing class_notes therefore renders 'Không có ghi chú thêm.'."
  expected_behavior:
    - "Restored class selections trigger student loading without clearing restored student/criterion/note selections or staged violations."
    - "The API boundary consistently exposes the backend class_notes value to existing frontend consumers, including class report detail and edit flows."
  root_cause:
    - "Draft restoration suppresses both destructive resets and required student refetching in one shared effect."
    - "The daily class report response contract uses class_notes while its frontend domain model and consumers use class_note, with no normalization."

scope:
  inspect:
    - "frontend/src/hooks/useRecordDraft.ts: hydration contract"
    - "backend/src/daily-class-report/{dto,schemas,service}: canonical class_notes field"
  write:
    - "frontend/src/components/grading/AddRecordView.tsx"
    - "frontend/src/components/grading/AddRecordView.test.tsx"
    - "frontend/src/components/grading/AddClassReportView.tsx"
    - "frontend/src/components/grading/AddClassReportView.test.tsx"
    - "frontend/src/api/daily-class-report-api.ts"
    - "frontend/src/api/daily-class-report-api.test.ts"
    - "frontend/src/app/(dashboard)/students/record/page.test.tsx"
  preserve:
    - "Draft retention on Back, draft deletion on explicit Cancel or successful create, and create/edit separation"
    - "Backend request field class_notes, API routes, RBAC, validation, pagination, and idempotency"
    - "Existing report.class_note frontend consumers through a single compatibility adapter"
  out:
    - "Backend schema/data migration"
    - "Server-side draft storage or cross-tab/device persistence"
    - "Student card redesign or unrelated report fields"

acceptance_criteria:
  - "AC-01: Reopening a drafted Student Record form with restored classIds calls the student API for every restored class and renders the returned student cards; restored selections, notes, mode, and staged violations remain intact."
  - "AC-02: Reopening a drafted Class Report form has the same refetch behavior; the selected/total counter and attendance totals are recalculated from returned students without clearing restored form state."
  - "AC-03: A user-driven class change still clears invalid transient selections and removes only staged violations outside the newly selected classes; draft hydration does not perform those destructive resets."
  - "AC-04: Daily class report create/update requests continue sending class_notes. All report-returning API methods normalize class_notes to the frontend class_note field, with a class_note fallback for compatible legacy/mock responses."
  - "AC-05: After create/update succeeds and the list refetches, both desktop/mobile 'Chi tiết báo cáo buổi học', table/card note text, export mapping, and edit form receive the saved note instead of the empty fallback."
  - "AC-06: Empty or whitespace-only notes still render the existing empty-note fallback; no backend contract or stored data is changed."

execution:
  - "E-01 [AC-01, AC-03] AddRecordView.tsx → separate required class-student loading from user-change-only resets; make async results respect the current restored class selection."
  - "E-02 [AC-02, AC-03] AddClassReportView.tsx → apply the same restoration lifecycle and retain attendance recalculation after student totals load."
  - "E-03 [AC-04, AC-06] daily-class-report-api.ts → define raw/normalized report handling once and apply it to list, detail, class, create/update, deleted, restore, and delete responses that return reports."
  - "E-04 [AC-01..AC-03] AddRecordView.test.tsx and AddClassReportView.test.tsx → add mocked hydration/refetch regressions covering rendered cards, preserved restored fields, and user class changes."
  - "E-05 [AC-04..AC-06] daily-class-report-api.test.ts and record/page.test.tsx → verify field normalization and saved-note rendering in report detail, including the empty fallback."

temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope.md: user-requested rolling taskscope"

verification:
  - "V-01 [AC-01..AC-03] npm --prefix frontend test -- src/components/grading/AddRecordView.test.tsx src/components/grading/AddClassReportView.test.tsx → pass."
  - "V-02 [AC-04..AC-06] npm --prefix frontend test -- src/api/daily-class-report-api.test.ts 'src/app/(dashboard)/students/record/page.test.tsx' → pass."
  - "V-03 [AC-01..AC-06] npm --prefix frontend run typecheck → exit 0."
  - "V-04 [AC-01, AC-02] Manual: enter both forms, select classes/students, Back, reopen → student cards and restored selections are visible."
  - "V-05 [AC-04..AC-06] Manual: save a non-empty class note, reopen desktop/mobile detail and edit → exact note is shown; save blank note → existing fallback is shown."

risks:
  - "Changing the restore effect can reintroduce clearing of hydrated selections or accept stale async student responses; tests must cover both races."
  - "Daily class report responses are shared with reporting/export screens; normalization must be centralized and retain legacy class_note compatibility."

stop_conditions:
  - "Stop if evidence requires changing persisted backend field names, migrating stored reports, or changing authorization/API routes."
