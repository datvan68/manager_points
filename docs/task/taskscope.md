task: "Unify multi-class selection and mobile touch sizing for record forms"
pipeline: feature_development
profile: Full
objective: "Create-mode users can select multiple classes without checkboxes on both record forms, and all mobile controls/cards are comfortably touchable without changing save contracts."

evidence:
  current_behavior: "AddClassReportView.tsx and AddRecordView.tsx keep classIds and merge rosters, but desktop Select commits only classIds[0], mobile class pickers render checkbox inputs, and form controls/cards commonly use 32–40 px heights with 11–13 px text."
  expected_behavior: "At <768 px and desktop widths, class rows toggle multiple selections through the whole row with selected styling/check icon (no checkbox); mobile buttons, inputs, selects and tappable cards use >=44 px targets and readable >=14 px control text."
  root_cause: "frontend/src/components/grading/{AddClassReportView,AddRecordView}.tsx maintain separate breakpoint-specific class pickers and compact sizing instead of the imported shared RecordSelectionDialog contract."

scope:
  inspect: ["frontend/src/app/(dashboard)/students/record/page.tsx:view routing", "frontend/src/components/ui/{button,Input,select}.tsx:existing primitives"]
  write: ["frontend/src/components/grading/RecordSelectionUi.tsx:shared multi-select/touch contract", "frontend/src/components/grading/AddClassReportView.tsx:class picker and responsive controls/cards", "frontend/src/components/grading/AddRecordView.tsx:class picker and responsive controls/cards", "frontend/src/components/grading/RecordSelectionUi.test.tsx:shared interaction regression", "frontend/src/components/grading/{AddClassReportView,AddRecordView}.test.tsx:class-selection helpers/contracts"]
  preserve: ["create/edit API payloads, RBAC, validation, draft persistence, roster merging, criteria/student selection and save behavior", "edit mode remains single-class where one existing report/record owns one class"]
  out: ["backend/API/schema changes", "record-list page redesign", "global UI primitive or breakpoint changes"]

acceptance_criteria:
  - "AC-01: In create mode on both forms, users can select/deselect any number of classes on desktop and mobile by pressing a class row; no checkbox input is rendered, selected rows expose aria-selected and a visible check indicator, and search/confirm/cancel remain functional."
  - "AC-02: Changing selected classes loads the union roster without duplicate students and removes only class-dependent staged data from deselected classes."
  - "AC-03: Below 768 px, interactive buttons/inputs/select triggers/class and student cards are at least 44 px high, control text is at least 14 px, spacing prevents accidental adjacent taps, and content remains within the viewport without horizontal overflow."
  - "AC-04: Desktop density and existing edit/save/API contracts remain unchanged except for create-mode multi-class selection."

execution:
  - "E-01 [AC-01,AC-03,AC-04] RecordSelectionUi.tsx → standardize row-button multi-selection, confirmation semantics, selected icon/ARIA, and mobile-only touch sizing."
  - "E-02 [AC-01..AC-04] AddClassReportView.tsx and AddRecordView.tsx → replace duplicate class pickers with the shared selector and apply mobile-first sizes to scoped controls/cards only."
  - "E-03 [AC-01..AC-04] Update the three focused test files for no-checkbox multi-select, draft commit/cancel, union-state preservation, and mobile size classes."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-02] npm --prefix frontend test -- src/components/grading/RecordSelectionUi.test.tsx src/components/grading/AddClassReportView.test.tsx src/components/grading/AddRecordView.test.tsx → all focused tests pass."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck → exits 0."
  - "V-03 [AC-01,AC-03,AC-04] Manual at 390x844, 768x1024 and >=1280 px → multi-select/no-checkbox, >=44 px mobile targets, readable cards, no horizontal overflow, desktop/edit flows preserved."

risks: ["Shared selector changes affect three record selection surfaces; scope styling by mobile prop and cover commit/cancel behavior.", "Multi-class edit would conflict with single-record/report APIs and is explicitly preserved as single-class."]
stop_conditions: ["Stop if acceptance requires backend/public contract changes, global UI primitive changes, or changing edit mode to update multiple persisted reports/records."]
