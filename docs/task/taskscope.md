task: "Create a student record from the search preview"
pipeline: feature_development
profile: Quick
objective: "Authorized users can choose one criterion and create one record for the student in Basic Information."

evidence:
  current_behavior: "frontend/src/components/students/StudentDirectorySearch.tsx:previewModal -> a search result opens Basic Information with only Close and Detail."
  expected_behavior: "Authorized users get Ghi nhận, select one criterion, then explicitly confirm one record."
  root_cause: null

scope:
  inspect: ["frontend/src/api/academic-record-api.ts:createAcademicRecord", "frontend/src/api/criteria-api.ts:getCriteria", "frontend/src/api/semester-api.ts:getSemesters", "frontend/src/providers/auth-provider.tsx:useAuth"]
  write: ["frontend/src/components/students/StudentDirectorySearch.tsx:previewModal and record state/handlers", "frontend/src/components/students/StudentDirectorySearch.test.tsx:preview record tests"]
  preserve: ["search debounce/cancellation and result rendering", "Close/Detail/Escape/backdrop behavior", "STUDENT_READ search visibility", "academic-record API/schema contracts"]
  out: ["backend, schema, grading calculations, bulk records, notes/evidence fields, editing existing records"]

acceptance_criteria:
  - "AC-01: Only admins or users with CREATE_STUDENT_RECORD see Ghi nhận; read-only users cannot start creation."
  - "AC-02: Clicking Ghi nhận loads criteria and semesters, shows a single criterion selector, and keeps Confirm disabled until a criterion and active semester are available."
  - "AC-03: Confirm creates exactly one record with selected student/criterion, active semester, criterion title, current user, active status, recorded timestamp, and an idempotency key; duplicate clicks are blocked while saving."
  - "AC-04: Success reports completion and resets record controls; failures report an error without closing the preview or losing selection."

execution:
  - "E-01 [AC-01,AC-02] StudentDirectorySearch.tsx -> add permission-gated Ghi nhận controls and lazy criteria/active-semester loading."
  - "E-02 [AC-03,AC-04] StudentDirectorySearch.tsx -> submit createAcademicRecord with saving guard and success/error state cleanup."
  - "E-03 [AC-01..AC-04] StudentDirectorySearch.test.tsx -> cover authorization, validation, payload, submit guard, success, and failure."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/components/students/StudentDirectorySearch.test.tsx -> targeted Vitest suite passes."
  - "V-02 [AC-01..AC-04] npm --prefix frontend run typecheck -> TypeScript exits 0."

risks: ["Search is available to read-only roles; gate this mutation independently with CREATE_STUDENT_RECORD."]
stop_conditions: ["Stop if creation requires a backend/API/schema change, no active semester can be resolved by the existing API, or repository permissions use a different create-record authority."]
