task: "Refine quick student selection for class evaluation"
pipeline: feature_development
profile: Full
objective: "Make quick selection the mobile-first workflow and allow a combined roster from multiple selected classes."

evidence:
  current_behavior: "frontend/src/components/grading/AddClassReportView.tsx keeps entryMode inside the violation card, defaults to manual, loads students for one classId, styles selected cards blue, and always renders the violation table and attendance summary."
  expected_behavior: "Mode controls sit outside the violation section; mobile is locked to quick mode; class selection accepts multiple classes; selected cards show red 'Đã chọn'; quick mode hides the table and summary shown in the supplied reference image."
  constraint: "CreateDailyClassReportDto and the database schema accept one class_id, so persistence semantics for multiple classes require a product decision."

scope:
  inspect: ["frontend/src/components/grading/AddClassReportView.tsx:class/entry mode state, fetchClassStudents, handleSave", "frontend/src/api/student-api.ts:getStudents", "frontend/src/api/daily-class-report-api.ts:CreateDailyClassReportDto", "backend/src/daily-class-report/dto/create-daily-class-report.dto.ts:class_id"]
  write: ["frontend/src/components/grading/AddClassReportView.tsx:responsive mode controls, multi-class roster, selected-card label, conditional sections", "frontend/src/components/grading/AddClassReportView.test.tsx:selection and visibility helpers"]
  conditional_write: ["API/backend report contract only after HG-01 selects multi-class persistence semantics"]
  preserve: ["manual entry behavior on desktop", "top-three frequent criteria", "detail-note retention", "duplicate student/criterion and ten-item limits", "edit-mode compatibility and RBAC"]
  out: ["attendance-session workflow", "unrelated page redesign"]

acceptance_criteria:
  - "AC-01: The two exclusive mode buttons render above/outside 'Ghi nhận sinh viên vi phạm (nếu có)'; below the lg breakpoint quick mode is automatically active and manual mode cannot be selected."
  - "AC-02: 'Mã lớp học' supports multiple selections and the quick roster merges students from every selected class without duplicate student IDs; removing a class removes its uncommitted roster selections."
  - "AC-03: A selected student card exposes aria-pressed=true and visible red text 'Đã chọn'; clicking again removes that criterion assignment."
  - "AC-04: In quick mode, hide the violation table and the complete attendance summary (class size, present, absent, attendance percentage); manual mode continues to show them."
  - "AC-05: Search, paging/loading, selected count, save/edit behavior, and error toasts remain correct across selected classes under the HG-01 decision."

human_gates:
  - "HG-01: Confirm whether Save creates one daily report per selected class (recommended, with each student's record linked to their class report) or changes the public contract/schema to store multiple class IDs. Do not implement multi-class persistence before confirmation."

execution:
  - "E-01 [AC-01,AC-03,AC-04] AddClassReportView.tsx → move controls, enforce responsive quick mode, add the red status text, and conditionally render manual-only results."
  - "E-02 [AC-02,AC-05] AddClassReportView.tsx → replace classId roster state with selected class IDs and class-aware merged fetch/selection cleanup."
  - "E-03 [AC-05] Apply the HG-01 persistence model with the smallest compatible frontend/backend patch."
  - "E-04 [AC-01..AC-05] AddClassReportView.test.tsx and any contract-nearest test required by E-03 → add regressions."

verification:
  - "V-01 [AC-01..AC-05] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx"
  - "V-02 [AC-01..AC-05] npm --prefix frontend run typecheck"
  - "V-03 [AC-05] Run the narrow backend spec/build required by the HG-01 implementation; git diff --check"

risks: ["Aggregated paging must track each class independently; attendance totals and report ownership must not become cross-class inconsistent."]
stop_conditions: ["Stop at HG-01 until persistence semantics are confirmed; amend exact write paths and verification after the decision."]
