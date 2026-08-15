## Task Identity and Pipeline

Task: `dormitory-registration-crud-contract` | Pipeline: `bug_fix` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `de8d12e9825d3d2524cbeeb24d4882138611af82`

## Risk Level

Risk: medium. The review and fix span the dormitory frontend/backend CRUD contract; they are development-only, reversible, and have no migration or external effect.

## Objective

Create, list/detail, update, and delete flows for formal, public, and temporary dormitory registrations use consistent source-specific contracts; valid updates no longer fail with `Không thể cập nhật trường: applicant_profile, full_name, student_code, room_type, notes`.

## Scope Boundaries

Approved: `frontend/src/api/dormitory-api.ts`, `frontend/src/api/dormitory-api.test.ts`, `frontend/src/components/dormitory/**`, `frontend/src/components/students/**`, `backend/src/dormitory/**`.

Write: `frontend/src/api/dormitory-api.ts`, `frontend/src/api/dormitory-api.test.ts`, `frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx`, `frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx`, `frontend/src/components/students/StudentDormitoryCard.tsx`, `frontend/src/components/students/StudentDormitoryCard.test.tsx`, `backend/src/dormitory/controllers/registrations.controller.ts`, `backend/src/dormitory/controllers/registrations.controller.spec.ts`, `backend/src/dormitory/services/registrations.service.ts`, `backend/src/dormitory/services/registrations.service.spec.ts`.

## Out of Scope

Room assignment, public-registration linking, PDF generation, database schemas/data, permission policy changes, and unrelated student-profile behavior.

## Context and Dependencies

The controller exposes formal and temporary create, combined list, detail, source-aware update/delete, and self-service endpoints. Existing tests cover parts of Create and Update/Delete but do not form a complete CRUD/source matrix. `DormitoryRegistrationEditModal` builds different payloads by `source`; the student card currently forces staff updates through `FORMAL`. Backend `RegistrationsService.update` validates source-specific fields, but its allowed lists omit `applicant_profile` although `UpdateRegistrationDto` accepts it.

## Steps

1. Build a CRUD/source matrix for formal, public, temporary, and student self-service registrations; baseline controller, service, and API-client behavior.
2. Complete missing Create and Read coverage for canonical payloads, pagination/detail results, not-found handling, and source preservation.
3. Preserve and use the registration's actual source during Update; align backend whitelists with the DTO, including `applicant_profile`, while rejecting invalid fields and source mismatches.
4. Verify Delete uses the matching source, removes only eligible records, and continues protecting linked registrations/contracts.
5. Run the focused frontend/backend CRUD suites and inspect the final diff.

## Acceptance Criteria

- AC1: Formal and temporary Create requests persist the canonical source-specific shape; public creation remains on its existing public endpoint.
- AC2: List/detail responses preserve the source discriminator and return the correct collection record, pagination metadata, or not-found result.
- AC3: Each Update sends only its supported field shape to the matching source; valid `applicant_profile` is accepted.
- AC4: Delete targets the matching source and rejects linked records, invalid identifiers, and source/record mismatches.
- AC5: Unsupported fields remain rejected and all focused CRUD regressions pass without unhandled errors.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/api/dormitory-api.test.ts src/components/dormitory/DormitoryRegistrationEditModal.test.tsx src/components/students/StudentDormitoryCard.test.tsx` => client CRUD routes and source-specific payload regressions pass.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/controllers/registrations.controller.spec.ts dormitory/services/registrations.service.spec.ts` => controller/service CRUD and source matrix pass.
- `D:\PROJECT\manager_points` :: `git diff --check` => no whitespace errors.

## Safety Gates

None.

## Artifacts and Checkpoints

Focused test output and final diff; no checkpoint required.

## Execution Budgets

One writer per path; up to 3 engineering iterations and 2 review-remediation cycles; stop for boundary expansion, migration, or authorization changes.
