slot_id: "taskscope-00"
generation: 24
task_id: "20260903-162300-import-dormitory-roster"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-03T16:23:00+07:00"
updated_at: "2026-09-03T16:39:00+07:00"
base_commit: "63ad6fefe3bae16d3bb9c6bad415878f1b935551"
task: "Import dormitory roster from Excel"
pipeline: feature_development
profile: Full
objective: "Authorized staff can import an Excel roster containing Họ và tên, Ngày sinh, Giới tính, and Số điện thoại into the active dormitory semester with deterministic row-level results."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-03T16:39:00+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree contains the scoped implementation changes; no commit created."
  changed_paths: ["frontend/src/components/dormitory/DormitoryRosterImportModal.tsx", "frontend/src/components/dormitory/DormitoryRosterImportModal.test.tsx", "frontend/src/app/(dashboard)/dormitory/roster/page.tsx", "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx", "frontend/src/api/dormitory-api.ts", "frontend/src/api/dormitory-api.test.ts", "backend/src/dormitory/dto/import-roster.dto.ts", "backend/src/dormitory/controllers/dormitory-roster.controller.ts", "backend/src/dormitory/services/dormitory-roster.service.ts", "backend/src/dormitory/services/dormitory-roster.service.spec.ts", "docs/task/taskscope.md"]
  checks_passed: ["npm --prefix backend test -- src/dormitory/services/dormitory-roster.service.spec.ts --runInBand (11 passed)", "npm --prefix frontend test -- 'src/components/dormitory/DormitoryRosterImportModal.test.tsx' 'src/app/(dashboard)/dormitory/roster/page.test.tsx' 'src/api/dormitory-api.test.ts' (24 passed)", "npm --prefix backend run build (exit 0)", "npm --prefix frontend run typecheck (exit 0)", "git diff --check (pass)"]
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/dormitory/roster/page.tsx:DormitoryRosterPage exposes only single-entry creation; backend/src/dormitory/services/dormitory-roster.service.ts:buildEntry already validates the four identity/contact values, resolves exactly one active semester, and creates UNLINKED manual entries."
  expected_behavior: "The roster page accepts .xlsx/.xls files using the repository's 10 MB/5,000-row convention, previews validation, imports valid rows through one permission-protected bulk endpoint, and reports successes, duplicates, and row errors."
  root_cause: null

scope:
  inspect: ["frontend/src/components/popups/ImportStudentRecordPopup.tsx:Excel/template/preview conventions", "backend/src/dormitory/services/dormitory-roster.service.ts:buildEntry validation, active-semester, identity, duplicate, and invalidation contracts", "backend/src/dormitory/schemas/dormitory-roster-entry.schema.ts:identity fields/indexes"]
  write: ["frontend/src/components/dormitory/DormitoryRosterImportModal.tsx:Excel template, parsing, preview, submit, result UI", "frontend/src/components/dormitory/DormitoryRosterImportModal.test.tsx:import workflow coverage", "frontend/src/app/(dashboard)/dormitory/roster/page.tsx:DormitoryRosterPage import entry point and refresh", "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx:permission and refresh integration", "frontend/src/api/dormitory-api.ts:bulk roster import types/client", "frontend/src/api/dormitory-api.test.ts:bulk import HTTP contract", "backend/src/dormitory/dto/import-roster.dto.ts:bounded row DTO", "backend/src/dormitory/controllers/dormitory-roster.controller.ts:POST import route with DORM_REG_CREATE", "backend/src/dormitory/services/dormitory-roster.service.ts:validate/duplicate/import batch", "backend/src/dormitory/services/dormitory-roster.service.spec.ts:batch persistence and error coverage"]
  preserve: ["DORM_REG_CREATE RBAC", "Existing single-create, edit, delete, PDF, room assignment, search, pagination, and public registration behavior", "Canonical Male/Female/Other values and phone/date validation", "No student linkage from four-field imports", "No schema, migration, dependency, or configuration changes"]
  out: ["CSV support", "Student-account matching/linking", "Room assignment or applicant-profile import", "Background jobs/progress polling", "Changing active-semester configuration", "Importing more than the four requested fields"]

acceptance_criteria:
  - "AC-01: A DORM_REG_CREATE user can download a four-column template and select only .xlsx/.xls up to 10 MB and 5,000 non-empty rows; invalid files/headers are rejected before API mutation."
  - "AC-02: Preview maps headers Họ và tên, Ngày sinh, Giới tính, Số điện thoại; accepts canonical gender values plus Nam/Nữ/Khác case-insensitively, normalizes valid spreadsheet or dd/MM/yyyy birth dates, and shows row-numbered errors without exposing data outside the modal."
  - "AC-03: POST /dormitory/roster/import requires DORM_REG_CREATE, rejects an absent/ambiguous active semester, revalidates every row server-side, and creates valid UNLINKED entries in that semester with room_type Thường."
  - "AC-04: Rows duplicated within the file or matching normalized full name plus birth date in the active semester are not created; the response deterministically returns created, duplicated, failed, and row-level reasons, and emits one roster overview invalidation when at least one row is created."
  - "AC-05: After import, the page presents the result summary and refreshes roster data once; existing roster actions and users without create permission remain unchanged."

execution:
  - "E-01 [AC-01,AC-02,AC-05] DormitoryRosterImportModal.tsx and tests -> implement template/download, bounded parsing, preview/errors, import/result states, and discard in-memory personal data on close."
  - "E-02 [AC-03,AC-04] import-roster.dto.ts and dormitory-roster.service.ts/spec -> add bounded DTOs and server validation, active-semester duplicate precheck, valid-row persistence, deterministic summary, and single invalidation."
  - "E-03 [AC-03] dormitory-roster.controller.ts -> add POST import before parameterized routes and retain DORM_REG_CREATE guard."
  - "E-04 [AC-03,AC-04] dormitory-api.ts/api.test.ts -> add typed JSON bulk-import contract and response assertions."
  - "E-05 [AC-01,AC-05] roster/page.tsx/page.test.tsx -> show Import only for canCreate, open the modal, and reload once after successful/partial creation."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-03,AC-04] npm --prefix backend test -- src/dormitory/services/dormitory-roster.service.spec.ts --runInBand -> focused service tests pass."
  - "V-02 [AC-01,AC-02,AC-05] npm --prefix frontend test -- 'src/components/dormitory/DormitoryRosterImportModal.test.tsx' 'src/app/(dashboard)/dormitory/roster/page.test.tsx' 'src/api/dormitory-api.test.ts' -> focused tests pass."
  - "V-03 [AC-01..AC-05] npm --prefix backend run build && npm --prefix frontend run typecheck -> both exit 0."
  - "V-04 [AC-01..AC-05] git diff --check -> no whitespace errors; final diff changes only scope.write plus this retained taskscope."

risks: ["Bulk import persists personal data and adds a public backend contract; server-side validation/RBAC and an explicit Human Gate are mandatory.", "Excel numeric phone cells may lose leading zeroes before parsing; the template must format the phone column as text and invalid values must remain row errors.", "Partial row success must be explicit and deterministic; retries can otherwise create duplicates."]
stop_conditions: ["Stop until the user explicitly approves implementation of the personal-data persistence flow.", "Stop for any schema/index/migration change, new dependency, student auto-linking, non-development data execution, or duplicate policy other than normalized full name plus birth date in the active semester.", "Stop if active taskscope reservations or dirty paths overlap any scope.write target."]
