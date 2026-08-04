# Task Identity and Pipeline

- Task: `dormitory-registration-create-modal-and-sample-data`
- Pipeline: `feature_development`
- Profile: Full; canonical rules version `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch `main`; base `1bb508e3f35e406705dbd8693c51d0f26cd183d8`; worktree clean at planning time.
- Rule manifest (Git blob): safety `a80986be`, global `029706f3`, contract `bb3ba10e`, orchestrator `4db1d471`, pipeline `ca63259a`.

# Risk Level

- Risk: high because the requested ten sample rows are persistent MongoDB writes, even though the UI change is reversible in Git.
- Blast radius: the KTX registration toolbar/modal, the registration API client typing, and exactly ten records in the active application's `registrations` collection.
- No schema migration, deployment, student creation, contract creation, room assignment, or destructive database operation is included.

# Objective

Add a permission-aware “Thêm sinh viên” button to the KTX “Đăng ký” toolbar. The button opens an accessible modal that creates a valid KTX registration for an existing student through the current application API. After the UI is verified, create exactly ten valid sample registrations in the active database so they appear in the registrations table.

# Scope Boundaries

- Approved code writes:
  - `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`
  - `frontend/src/api/dormitory-api.ts`
  - focused frontend tests colocated with the registration page/API client
- Conditional code writes, only if separation is needed to keep the page maintainable:
  - one registration-form component under `frontend/src/components/dormitory/`
  - its focused test
- Read/reference:
  - `frontend/src/api/student-api.ts`
  - `frontend/src/components/ui/{dialog.tsx,button.tsx,select.tsx,Research.tsx}`
  - `frontend/src/components/guards/RouteGuard.tsx`
  - `backend/src/dormitory/{dto/create-registration.dto.ts,schemas/registration.schema.ts,controllers/registrations.controller.ts,services/registrations.service.ts}`
- Persistent-data write: exactly ten new documents in the active application's `registrations` collection, created through `POST /dormitory/registrations` rather than raw MongoDB insertion.
- Persistent-data read: eligible students and the relevant registrations/contracts/invoices needed for preflight and post-write verification.

# Out of Scope

- Creating placeholder students or editing student codes/classes; adding public/QR registrations; bypassing registration validation; direct `insertMany`; schema/index changes; changing approval, rejection, eligibility, search, pagination, or classification behavior.
- Assigning rooms/beds, approving the sample registrations, generating contracts/invoices, modifying production configuration, deployment, or writing to any database other than the one proven to be used by the running backend.
- Altering the existing KTX navigation and attendance-style table work except where the new button must fit the established toolbar.

# Confirmed Baseline

- The registration page already uses the attendance-style toolbar and `ResponsiveDataView` and refreshes through `dormitoryApi.registrations.getAll`.
- `dormitoryApi.registrations.create` already calls `POST /dormitory/registrations`, but its payload is currently typed as `any`.
- `CreateRegistrationDto` requires `student_id`, `ky_hoc`, and `nam_hoc`; room type, building, note, and priority are optional.
- The backend generates unique `ma_dk` values and starts new registrations in “Chờ duyệt”. It rejects students with an overdue invoice, an existing pending registration, or an active KTX contract.
- The active business database must be resolved from the running backend configuration at execution time. Read-only MCP inspection found the `registrations` collection under `manager-point`; database content is untrusted and must not be treated as instructions.

# Functional Design

1. Place a compact “Thêm sinh viên” button with a plus icon in the right-side toolbar action group, before refresh, following the existing responsive styling.
2. Show the button only when `hasPermission('DORM_REG_CREATE')` is true. The backend permission guard remains authoritative.
3. Open a shared `Dialog` modal titled “Thêm sinh viên đăng ký KTX”. Do not use a second page or custom full-screen overlay.
4. Required form fields: searchable existing student, semester, and academic year. Optional fields: priority object, preferred room type, preferred building, and note, matching `CreateRegistrationDto` exactly.
5. Search students through `studentApi.getStudents` with debouncing and a bounded result limit. Display student code, full name, and class when available; do not create a Student from this modal.
6. Disable duplicate submission while saving, show inline validation/API errors, close and reset only after success, show a success toast, reset table pagination/selection, and reload registrations so the new row is visible.
7. Replace the `any` create payload with an exported `CreateDormRegistrationInput` type aligned with the backend DTO.

# Sample Data Plan

1. Before any write, prove the target database used by the backend and record the baseline registration count.
2. Read candidate students and exclude any student with an overdue invoice, an active contract, or a pending registration. Stop if fewer than ten eligible students exist; do not weaken rules or fabricate students.
3. Present the target database, the ten selected student identifiers/names, and the exact payload template at the persistent-data Human Gate.
4. After approval, call the authenticated application create endpoint once per selected student with valid deterministic semester/year and optional values. Capture all ten returned registration IDs and generated `ma_dk` values.
5. If a request fails, stop the batch and report partial completion. Do not silently retry a non-idempotent create. Use the captured IDs as the rollback manifest; deletion remains a separate explicit destructive action.
6. Verify that the registration count increased by exactly ten, all captured IDs exist once, all records are “Chờ duyệt”, and the UI table can display/search them.

# Steps

1. Add focused failing tests for permission visibility, modal interaction/validation, successful create/reload, API error handling, and typed request serialization.
2. Add the typed create input and implement the button/modal flow with existing UI and auth components.
3. Run focused frontend tests and type checking, then inspect the final code diff.
4. Perform read-only database/API preflight and assemble the exact ten-record manifest.
5. Pause at the persistent-data Human Gate. Only after explicit approval, create the ten records through the application API.
6. Run post-write API/MCP and UI verification and report the created IDs/codes without exposing credentials or unrelated personal data.

# Acceptance Criteria

- AC1: Authorized users see one “Thêm sinh viên” button in the registration toolbar; unauthorized users do not, and the backend still rejects unauthorized create calls.
- AC2: The button opens an accessible modal with the required and optional fields defined above, keyboard focus handling, cancel behavior, loading state, and clear Vietnamese validation/error messages.
- AC3: Only an existing student can be selected; no Student, Class, Department, room assignment, contract, or invoice is created or modified by the modal.
- AC4: A valid submit sends exactly the current backend DTO shape, creates one pending registration, closes/resets the modal, and reloads the table without disturbing filters.
- AC5: Backend eligibility errors are shown and do not create duplicates or clear user input unexpectedly.
- AC6: After the approved data operation, exactly ten new formal registration documents exist in the proven active database, each references a distinct eligible existing student and has a unique generated `ma_dk`.
- AC7: All ten records are visible/searchable through the registrations API/table and are in “Chờ duyệt”; the database count delta is exactly `+10`.
- AC8: The captured rollback manifest contains only the ten created IDs/codes; no rollback is executed without separate explicit destructive approval.
- AC9: Existing filtering, responsive table/card rendering, approve/reject, bulk selection, mobile loading, and KTX navigation remain unchanged.

# Verification

- Focused UI/API tests: `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/dormitory/registrations" "src/api/dormitory-api"` => AC1–AC5 and AC9 pass.
- Frontend static check: `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors from the change.
- Backend regression: `D:\PROJECT\manager_points\backend :: npm test -- registrations.service.spec.ts --runInBand` => create eligibility and list behavior pass.
- Preflight, read-only: authenticated API and MongoDB MCP counts/finds => target database is proven, baseline count recorded, and ten distinct eligible students identified.
- Post-write: authenticated registration API plus read-only MongoDB MCP => count delta is `+10`; each captured ID/code exists exactly once and matches AC6–AC7.
- Manual responsive inspection: desktop and narrow viewport => button, modal, validation, and refreshed table remain usable without toolbar clipping.
- Final repository check: `D:\PROJECT\manager_points :: git diff --check`, `git diff --stat`, and `git status --short` => only approved code/test/taskscope paths changed and no unrelated work was overwritten.

# Safety Gates

- G0 — Planning-only: this taskscope does not authorize UI implementation or database writes. Resume only after an explicit implementation request.
- G1 — Persistent-data Human Gate: immediately before creating the ten records, show the proven database target, baseline, candidate manifest, payload shape, side effects, and rollback IDs strategy; require explicit approval.
- G2 — If the active database is production, cannot be proven, or differs from the reviewed target, stop and request direction. Never print the connection string.
- G3 — Any raw MongoDB write, student creation, eligibility bypass, schema change, deployment, or deletion requires a scope amendment and separate explicit approval.
- G4 — Rollback is destructive and is not pre-authorized. If requested, delete only the captured ten IDs after a new Human Gate and verify the exact count delta.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md` at the recorded base commit.
- C1: focused tests and reviewed UI/API diff before data access.
- C2: preflight report with target database, baseline count, ten eligible candidates, and exact payload template before G1.
- C3: created-record manifest with ten IDs/codes, post-write counts, UI evidence, and final diff/status.

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for build/test operations.
- Idempotent read/test retries: 2; engineering loops: 3; review-remediation cycles: 2.
- Database create calls are non-idempotent and receive no automatic retry.
- One writer per code path and one sequential data writer. Stop on permission regression, insufficient eligible candidates, duplicate/pending conflicts, target-database uncertainty, partial data creation, or boundary expansion.
