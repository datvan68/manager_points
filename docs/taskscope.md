## Task Identity and Pipeline

Task: `dormitory-registration-and-room-crud-fixes` | Pipeline: `bug_fix` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `d74ce0ad24fb9c3dc628e9a3e6266224616edf9f`

## Risk Level

Risk: medium for application changes; high only if the development database requires removal of a legacy bed index. Changes span registration and room CRUD across frontend/backend.

## Objective

Formal student registrations update without unsupported fields, and Buildings can create a second distinct room while all room CRUD operations preserve room/bed consistency.

## Scope Boundaries

Approved/write: `frontend/src/api/dormitory-api.ts`, registration edit/student-card components and tests, Buildings page and tests, dormitory registration/room controllers, services, DTOs, schemas and focused tests, plus `backend/scripts/migrate-dormitory-bed-index.ts` and its test only if index diagnosis requires correction.

## Out of Scope

Student/class master-data edits, room assignment, contracts/invoices, production migration, permissions, unrelated dormitory screens, and destructive data cleanup.

## Context and Dependencies

`FORMAL` updates allow `preference` but reject top-level `full_name`, `student_code`, `room_type`, and `notes`; the reported message proves a public-shaped payload reached the formal endpoint. Room creation persists the room then provisions canonical `<ROOM>-G<n>` beds. The schema expects a compound unique bed index, while a guarded legacy-index migration already exists.

## Steps

1. Reproduce formal updates from both Registrations and Student detail; trace source metadata and payload construction through API/controller/service.
2. Enforce one source-aware payload mapper: formal identity stays read-only and room preferences remain nested; public/temporary identity and preferences use their supported top-level fields.
3. Reproduce creating two rooms with different codes in one building; capture whether failure occurs at validation, room uniqueness, bed provisioning, projection, or database index.
4. Correct room Create/Read/Update/Delete and rollback behavior so room and generated beds cannot be partially persisted; keep duplicate room codes rejected.
5. Verify the actual `beds` indexes with the existing dry-run. Amend the guarded migration/test only when the canonical compound index or legacy index is the demonstrated cause.
6. Add regressions for both entry points, consecutive room creation, duplicate handling, capacity update, protected deletion, and successful deletion; inspect final diff/status.

## Acceptance Criteria

- AC1: Updating a formal registration never sends/stores top-level `full_name`, `student_code`, `room_type`, or `notes`; permitted values update successfully.
- AC2: Public and temporary updates retain editable identity fields and source-correct routing.
- AC3: Two rooms with distinct codes can be created consecutively in the same building; each owns exactly its requested canonical beds.
- AC4: Duplicate codes fail clearly without deleting an existing room or leaving orphan/partial beds.
- AC5: Room read/list projections, update (including capacity), single/bulk delete, and protected occupancy/history rules pass focused tests.
- AC6: No database index is mutated without the applicable Human Gate.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/api/dormitory-api.test.ts src/components/dormitory/DormitoryRegistrationEditModal.test.tsx src/components/students/StudentDormitoryCard.test.tsx "src/app/(dashboard)/dormitory/registrations/page.test.tsx" "src/app/(dashboard)/dormitory/buildings/page.test.tsx"` => source-aware payload and Buildings CRUD regressions pass.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/controllers/registrations.controller.spec.ts dormitory/services/registrations.service.spec.ts dormitory/services/rooms.service.spec.ts` => registration and room/bed CRUD contracts pass.
- `D:\PROJECT\manager_points\backend` :: `npm run migration:dormitory-bed-index:dry-run` => reports index state without mutation.
- `D:\PROJECT\manager_points` :: `git diff --check` => no whitespace errors.

## Safety Gates

If dry-run proves an incorrect development-database index, request explicit approval before `migration:dormitory-bed-index:execute`; record before/after indexes and the emitted rollback command. Production execution remains excluded.

## Artifacts and Checkpoints

Failure reproduction, focused test output, index dry-run output, and final diff. Checkpoint only before an approved index mutation.

## Execution Budgets

One writer per path; up to 3 engineering iterations and 2 review-remediation cycles. Stop for production access, schema/data cleanup, permission changes, or scope expansion.
