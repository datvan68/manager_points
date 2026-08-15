## Task Identity and Pipeline

Task: `dormitory-registration-crud-student-identity` | Pipeline: `bug_fix` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `d617d5bff56115ba16db76ef784a87c11841bccf`

## Risk Level

Risk: medium. The change aligns frontend/backend CRUD contracts across registration sources without schema migration, persistent-data rewrite, or external effects.

## Objective

Dormitory CRUD correctly handles enrolled students' identity, preserves source-specific behavior, and removes the redundant active-semester/year cards from the edit modal.

## Scope Boundaries

Approved/write: `frontend/src/api/dormitory-api.ts`, `frontend/src/api/dormitory-api.test.ts`, `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`, `frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx`, `frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx`, `backend/src/dormitory/controllers/registrations.controller.ts`, `backend/src/dormitory/controllers/registrations.controller.spec.ts`, `backend/src/dormitory/services/registrations.service.ts`, `backend/src/dormitory/services/registrations.service.spec.ts`.

## Out of Scope

Editing Student master data, class membership, room assignment, public-registration linking, PDF generation, permissions, schemas, and migrations.

## Context and Dependencies

A `FORMAL` registration stores `student_id`; list reads populate `student_id.full_name` and `student_id.student_code`. These identity fields must remain owned by the Student record. Public/temporary registrations own top-level identity fields. The edit modal currently hides formal identity and duplicates the active semester/year already summarized in its title. Detail read currently resolves only the formal collection, so CRUD verification must retain the source discriminator when loading records.

## Steps

1. Establish a Create/Read/Update/Delete matrix for `FORMAL`, `PUBLIC`, and `ADMIN_TEMPORARY`.
2. For an enrolled/classified student, submit `student_id` on Create; populate and display Họ và tên/Mã SV read-only on Read/Edit; never copy or update them in the registration record.
3. Keep Họ và tên/Mã SV editable for public/temporary records and route list/detail/update/delete to the matching source.
4. Remove the `Kỳ active` and `Năm học active` cards while retaining active-semester loading, validation, payload values, and the title summary.
5. Add source/identity/UI regressions, run focused suites, and inspect the final diff.

## Acceptance Criteria

- AC1: Creating a formal registration for a student in a class stores the selected `student_id`; list/detail/edit show the current Student name and code.
- AC2: Formal Update cannot mutate `full_name` or `student_code`; public/temporary Update can mutate their own identity fields.
- AC3: Read and Delete target the correct source; invalid IDs, mismatched sources, linked records, and unsupported fields remain rejected.
- AC4: The edit modal contains no active-semester/year cards; the active semester remains visible once in the title and is still submitted.
- AC5: Focused CRUD and modal tests pass without unhandled errors.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/api/dormitory-api.test.ts "src/app/(dashboard)/dormitory/registrations/page.test.tsx" src/components/dormitory/DormitoryRegistrationEditModal.test.tsx` => source routing, formal identity, and modal UI tests pass.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/controllers/registrations.controller.spec.ts dormitory/services/registrations.service.spec.ts` => CRUD/source/identity matrix passes.
- `D:\PROJECT\manager_points` :: `git diff --check` => no whitespace errors.

## Safety Gates

None.

## Artifacts and Checkpoints

Focused test output and final diff; no checkpoint required.

## Execution Budgets

One writer per path; up to 3 engineering iterations and 2 review-remediation cycles; stop for boundary expansion, migration, permission changes, or persistent-data work.
