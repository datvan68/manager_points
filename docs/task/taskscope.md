task: "Polish quick class-evaluation selection"
pipeline: feature_development
profile: Full
objective: "Improve the quick-selection layout and class picker, reset pending quick selections when the criterion changes, and make lecturer name optional end to end."

evidence:
  current_behavior: "AddClassReportView.tsx renders class checkboxes without text search, places the red 'Đã chọn' below the student name, retains quick violations when handleCriterionChange selects another criterion, and blocks Save when teacherName is blank. The create DTO and Mongoose schema also require teacher_name."
  expected_behavior: "Keep a searchable text-style class selector with checkbox multi-selection; keep 'Đã chọn' inline at the right of the student name; clear the previous criterion's pending quick selections on criterion change; accept an empty lecturer name."

scope:
  inspect: ["frontend/src/components/grading/AddClassReportView.tsx:classIds, class picker, quick student cards, handleCriterionChange, handleSave", "frontend/src/api/daily-class-report-api.ts:CreateDailyClassReportDto", "backend/src/daily-class-report/dto/create-daily-class-report.dto.ts:teacher_name", "backend/src/daily-class-report/schemas/daily-class-report.schema.ts:teacher_name"]
  write: ["frontend/src/components/grading/AddClassReportView.tsx:searchable checkbox class picker, inline selected state, criterion reset, lecturer validation/payload", "frontend/src/components/grading/AddClassReportView.test.tsx:quick reset and selection helpers", "frontend/src/api/daily-class-report-api.ts:create payload typing", "backend/src/daily-class-report/dto/create-daily-class-report.dto.ts:optional teacher_name contract", "backend/src/daily-class-report/schemas/daily-class-report.schema.ts:optional/default lecturer storage", "backend/src/daily-class-report/daily-class-report.service.spec.ts:blank lecturer regression"]
  preserve: ["multiple-class selection and per-class report creation", "student roster search/paging", "desktop manual mode and mobile quick mode", "top-three frequent criteria", "detail-note retention", "edit-mode records and manual violations when quick criterion changes", "RBAC and existing report compatibility"]
  out: ["class API search behavior", "attendance calculations", "unrelated report/import validation"]

acceptance_criteria:
  - "AC-01: Each selected quick-mode student card renders the red text 'Đã chọn' on the same row, right-aligned beside the student name; the name truncates or wraps within its remaining width without pushing the status onto a new row."
  - "AC-02: 'Mã lớp học' is a text-entry combobox that filters classes by displayed class name/code and shows a checkbox for every result; checking or unchecking results adds or removes classes without closing the picker or losing other selections."
  - "AC-03: In quick mode, changing from one criterion to another clears the prior criterion's unsaved quick student selections and resets the selected counter/cards to zero. Existing edit-mode records and manually added violations are not deleted."
  - "AC-04: 'Tên giảng viên' has no required marker/native required constraint, blank input does not show a blocking toast, and create/update succeeds with the field omitted or normalized to an empty string."
  - "AC-05: Frontend API typing, backend validation, Swagger metadata, and Mongo persistence consistently treat teacher_name as optional while existing non-empty values remain unchanged."

execution:
  - "E-01 [AC-01,AC-02] AddClassReportView.tsx -> implement the inline card header and accessible searchable multi-select popover using existing UI primitives."
  - "E-02 [AC-03] AddClassReportView.tsx -> separate pending quick selections from preserved manual/edit entries and clear only that pending set when the criterion changes."
  - "E-03 [AC-04,AC-05] Align frontend validation/payload types with the optional backend DTO and schema default."
  - "E-04 [AC-01..AC-05] Add focused frontend helper/component regressions and a backend create-service regression."

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/components/grading/AddClassReportView.test.tsx"
  - "V-02 [AC-04,AC-05] npm --prefix backend test -- src/daily-class-report/daily-class-report.service.spec.ts --runInBand"
  - "V-03 [AC-01..AC-05] npm --prefix frontend run typecheck; npm --prefix backend run build; git diff --check"

risks: ["Reset logic must not erase records loaded for editing or manual-mode entries; optionality must match DTO, schema, and frontend payload to prevent validation drift."]
stop_conditions: ["Stop if product behavior requires clearing persisted/edit-mode violations on criterion change, because that expands the requested reset into destructive editing behavior."]
