# Task Identity and Pipeline

- Task: `fix-room-create-bed-provisioning-and-building-statuses`
- Pipeline: `bug_fix` + `feature_development` + `data_migration`
- Profile: Full; rules version `3.2.0`
- Repository: `D:\PROJECT\manager_points`; current branch/worktree only.

# Risk Level

- Risk: high. The change spans room creation, bed persistence, backend/frontend enum contracts, and existing MongoDB indexes/data.
- Code changes are Git-revertible. Index or persisted-status changes require explicit Human Gates.

# Objective

Creating room `KTX01` with `bed_count = 3` succeeds only after exactly three active beds with unique codes `KTX01-G1`, `KTX01-G2`, and `KTX01-G3` exist. Buildings accept and expose only `Trống` and `Đầy` as status values across schema, validation, API typing, and the buildings page.

# Scope Boundaries

- Room/bed provisioning: `backend/src/dormitory/services/rooms.service.ts` and focused tests in `rooms.service.spec.ts`.
- Bed index repair: guarded changes/tests for `backend/scripts/migrate-dormitory-bed-index.ts` and package scripts only if required.
- Building status contract: backend dormitory enums, building schema, create/update DTOs, and focused backend tests.
- Buildings UI/API contract: `frontend/src/api/dormitory-api.ts`, `frontend/src/api/dormitory-enums.ts`, `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx`, and focused tests.
- A guarded, idempotent migration for existing building statuses, with dry-run and rollback evidence.

# Out of Scope

- Manual database edits, production execution/deployment, unrelated dormitory cleanup, room-status reduction, or changing occupied/historical bed identity.
- Suppressing the warning without satisfying the final bed invariant.
- Automatically deriving building status from room occupancy unless separately requested; this scope limits and migrates the stored/API values.

# Context and Dependencies

- `ensureRoomBeds()` already generates canonical codes using the uppercase room code plus `-G1`, `-G2`, and so on, performs idempotent upserts, then verifies the final active-bed count and codes.
- `RoomsService.create()` saves the room, provisions beds, and attempts to remove the new room and its beds when provisioning fails.
- The verified development database previously contained both canonical unique index `{ bed_code, room_id }` and legacy unique index `{ ma_giuong, room_id }`. New beds omit `ma_giuong`, so the legacy index can reject the second and third bed and cause the reported warning.
- Building status currently uses `Active`, `Inactive`, and `Maintenance` in backend enum/schema/DTOs and frontend types/UI. Existing documents therefore require an audited mapping before the enum is narrowed.
- Proposed migration mapping: `Active -> Trống`; `Inactive` and `Maintenance` must be reported separately in dry-run and require an explicitly reviewed mapping because collapsing them loses operational meaning.

# Steps

1. Add a regression test that creates `KTX01` with capacity 3 and asserts one room plus exactly three distinct active beds named `KTX01-G1..G3`.
2. Add failure tests for a legacy-index duplicate error: no success response, no orphan room, and no partially inserted beds. Confirm retry/idempotency does not create duplicates.
3. Keep canonical per-room code generation and the strict postcondition. Strengthen create compensation so it only removes records created by that request and preserves pre-existing or protected data.
4. Validate the guarded bed-index migration: exact legacy index match, canonical unique index required, zero-write dry-run, idempotent rerun, and reviewed rollback command.
5. Replace the building status enum/default/DTO validation/API type/UI options with only `Trống` and `Đầy`; default new buildings to `Trống`. Add rejection tests for legacy and arbitrary values.
6. Add a building-status migration dry-run that reports counts/IDs by old value and the proposed mapping without writes. Stop if `Inactive`, `Maintenance`, or unknown values exist until their mapping is explicitly approved.
7. After the applicable approvals, execute the index migration and building-status migration in development only, then run read-only post-migration audits.
8. Run focused backend/frontend tests, type checks/builds, and final diff/status inspection.

# Acceptance Criteria

- AC1: Creating `KTX01` with `bed_count = 3` persists exactly `KTX01-G1`, `KTX01-G2`, and `KTX01-G3`, all unique within the room.
- AC2: Repeating provisioning is idempotent and never creates a fourth bed or duplicate code.
- AC3: A provisioning failure returns an error and leaves neither the newly created room nor partial beds behind.
- AC4: The warning is absent when all three beds exist and remains a valid failure when the invariant cannot be met.
- AC5: The canonical `{ bed_code, room_id }` unique index remains; only the exact verified legacy `{ ma_giuong, room_id }` index is removed after approval.
- AC6: Backend schema/DTOs and frontend types/forms allow only `Trống` and `Đầy`; a new building defaults to `Trống`.
- AC7: Existing building documents contain only the two approved values after an approved migration; unknown or unapproved legacy values are not silently coerced.
- AC8: No occupied/historical beds or unrelated room, building, registration, contract, or student data are changed.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/services/rooms.service.spec.ts` => create, unique-code, idempotency, postcondition, and compensation tests pass.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/building-status.spec.ts` => only the two statuses validate and the migration planner rejects unapproved legacy mappings.
- `D:\PROJECT\manager_points\backend` :: `npm run migration:dormitory-bed-index:dry-run` => exact index plan, canonical index preserved, zero writes.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/buildings/page.test.tsx" src/api/dormitory-api.test.ts` => two UI options and API behavior pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => updated status union compiles.
- Repository root :: `git diff --check` and `git status --short` => only intended files are changed.

# Safety Gates

- Gate A — development bed-index mutation: approve the exact database, legacy/canonical definitions, execute command, and rollback command.
- Gate B — development building-status data migration: approve the dry-run inventory and exact mapping for every legacy value, plus backup and rollback evidence.
- Gate C — any production migration or deployment: separate approval with environment, backup, monitoring, and rollback evidence.
- This taskscope authorizes no code implementation or database write.

# Artifacts and Checkpoints

- Required evidence: focused test outputs, pre/post index audits, building-status dry-run inventory and approved mapping, backup/rollback record, backend build, frontend typecheck, and final diff/status.
- Stop and amend scope if another index blocks canonical beds, cleanup cannot isolate records from the failed create request, legacy building values cannot be mapped safely, or production-only action is required.

# Execution Budgets

- Dependency order: regression baseline -> source/test changes -> dry-runs -> Gate A/B -> approved development migrations -> post-audits -> final verification.
- One writer per path; serialize shared enum/API contract changes.
- Step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
