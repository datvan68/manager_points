# Task Identity and Pipeline

- Task: `reuse-dormitory-registration-edit-modal`
- Pipeline: `feature_development`
- Profile: Full
- Rules: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base commit: `40411ce62b055a6b038612c12ecbc45d7acfd091`
- Base state: clean working tree before this scope update

# Risk Level

- Risk: medium.
- Environment: development.
- Evidence: one frontend package, but shared form extraction affects the registrations page, student profile, applicant-profile fields, and regression tests; no persistence, API contract, dependency, deployment, or external-state change is planned.
- Reversibility: Git-revertible source changes.
- Blast radius: KTX registration edit UI only.

# Objective

Provide one reusable, complete `Sửa đơn đăng ký` modal for both the registrations tab and student KTX card; initialize semester/academic year from the single active semester and use `CustomCalendar` for the CCCD/CMND issue date.

# Scope Boundaries

- Approved: `frontend/src/app/(dashboard)/dormitory/registrations/**`, `frontend/src/components/dormitory/**`, `frontend/src/components/students/StudentDormitoryCard*`.
- Write: the registrations page/tests, student dormitory card/tests, shared applicant-profile fields, and a new reusable KTX edit-modal component/test under `frontend/src/components/dormitory/`.
- Known targets: `openEdit`, edit state/effect/submit flow and current edit `Dialog` in `registrations/page.tsx`; `StudentDormitoryCard` modal/state/save flow; `ApplicantProfileFields` in `PublicDormitoryRegistrationModal.tsx`; `mapActiveSemester`; `semesterApi.getSemesters`; `dormitoryApi.registrations.update` and `updateMine`.
- Excluded: create/public-registration behavior, room assignment, list filtering/pagination, backend APIs, schemas, dependencies, and unrelated student-profile cards.

# Out of Scope

- Redesigning modal styling or changing KTX business rules.
- Changing which fields each role may update or changing registration source payload shapes.
- Modifying the `CustomCalendar` component itself.

# Context and Dependencies

- The registrations edit modal is currently inline in `registrations/page.tsx`; active-semester initialization only runs for `ADMIN_TEMPORARY` rows.
- `StudentDormitoryCard.tsx` contains a separate edit modal and separate update logic.
- `ApplicantProfileFields` is shared from `PublicDormitoryRegistrationModal.tsx`; its CCCD/CMND issue date currently uses `Input type="date"`.
- Active semester labels are parsed by the existing `mapActiveSemester` helper and must remain the source of `semester` and `academic_year` defaults.

# Steps

1. Extract the complete registrations edit form into a reusable dormitory edit-modal component with controlled open/close, registration data, permissions/update strategy, refresh callback, and focus restoration where applicable.
2. On every modal open, load exactly one active semester, map its label with the existing validation, and initialize/override `semester` and `academic_year`; expose loading/error states and prevent invalid submission.
3. Replace the CCCD/CMND issue-date native date input in shared applicant-profile fields with `Popover` + `CustomCalendar`, preserving `YYYY-MM-DD` form values, cancel/confirm behavior, and existing payloads.
4. Replace the registrations page inline edit dialog with the reusable modal while preserving FORMAL versus temporary field/payload behavior and list refresh.
5. Remove the student card's duplicate modal and open the same reusable complete form from its KTX detail icon, preserving staff/self-service authorization, `update` versus `updateMine`, error-state retention, close behavior, and card refresh.
6. Update focused tests for active-semester defaults, `CustomCalendar`, both modal entry points, full-field rendering, source-aware payloads, permissions, success/failure, and focus restoration.

# Acceptance Criteria

- AC1: Opening `Sửa đơn đăng ký` from the registrations tab defaults `Kỳ` and `Năm học` to the valid active semester for every supported registration source; missing, duplicate, malformed, or failed active-semester loading blocks save with a visible error.
- AC2: `Ngày cấp CCCD/CMND` uses `CustomCalendar` and stores/submits the selected date in the existing API format.
- AC3: The student KTX icon opens the same reusable `Sửa đơn đăng ký` component and displays the complete applicable field set from the registrations flow; no card-local duplicate edit modal remains.
- AC4: Existing role permissions, FORMAL/temporary/self-service payload routing, validation, success/error behavior, input preservation after failure, refresh, non-resident card state, room/price display, and focus restoration remain intact.
- AC5: No create/public-registration, room-assignment, backend, schema, or dependency behavior changes.

# Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/registrations/page.test.tsx" "src/components/dormitory/PublicDormitoryRegistrationModal.test.tsx" "src/components/dormitory/DormitoryRegistrationEditModal.test.tsx" "src/components/students/StudentDormitoryCard.test.tsx"` => all focused KTX modal and calendar regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no introduced TypeScript errors.
- `D:\PROJECT\manager_points` :: `git diff --check` => valid patch formatting.
- Final inspection: changed paths remain inside the approved boundary and the diff contains no duplicate student-card edit dialog or unrelated changes.

# Safety Gates

- None. Stop and amend scope if implementation requires backend/schema changes, a new dependency, permission-policy changes, or persistent/external mutation.

# Artifacts and Checkpoints

- Artifact: `docs/taskscope.md`.
- Checkpoints/hashes: none required before implementation; Git diff is the review/recovery artifact.

# Execution Budgets

- One writer per path; serialize the shared modal extraction and caller migrations.
- Maximum ENG iterations: 3; review remediation cycles: 2; idempotent retries: 2.
- Stop on boundary expansion, overlapping dirty changes, failed required criteria, or a newly triggered gate.
