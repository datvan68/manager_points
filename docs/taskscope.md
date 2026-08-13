# Task Identity and Pipeline

- Task: `fix-room-bed-provisioning-and-registration-room-unselect`
- Pipeline: `bug_fix` + `feature_development`
- Profile: Full; rules version `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch `main`; base commit `27fcbc97172ec063b4f141a7b9f765e2e5eede8c`; initial worktree clean.

# Risk Level

- Risk: high. The work crosses backend persistence and frontend UI, includes a MongoDB index repair, and changes room/bed assignment state.
- Source changes are Git-revertible. Index mutation and any non-test persistent-data execution require Human Gates.

# Objective

Creating `KTX01` with `bed_count = 2` succeeds with exactly two canonical active beds, and the registrations room picker lets an operator explicitly remove an assignment so another room can be chosen or the registration can remain unassigned without corrupting bed, room, or contract state.

# Scope Boundaries

- Room provisioning and regression tests: `backend/src/dormitory/services/rooms.service.ts`, `rooms.service.spec.ts`.
- Verified legacy bed-index repair: `backend/scripts/migrate-dormitory-bed-index.ts` and its existing package scripts/tests if adjustment is required.
- Assignment cancellation: `room-assignment.service.ts`, its focused tests, registrations controller/DTO tests, and a narrowly owned cancellation DTO if needed.
- Registrations UI/API: `frontend/src/api/dormitory-api.ts`, its focused API test, `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, and `page.test.tsx`.

# Out of Scope

- Production migration/deployment, manual database edits, unrelated buildings-page redesign, registration deletion/rejection, contract cancellation, or changing occupied/historical bed identity.
- Allowing a room assignment to be removed while an active contract exists; those records must use the contract transfer/cancellation workflow.

# Context and Dependencies

- `RoomsService.create()` saves the room, calls `ensureRoomBeds()`, validates the final active-bed count/canonical codes, and compensates on failure.
- Provisioning uses `bed_code` plus `room_id`; the guarded migration identifies legacy unique index `ma_giuong_1_room_id_1`, which can reject the second insert when new beds omit `ma_giuong`. Canonical unique index `bed_code_1_room_id_1` must remain.
- The picker currently assigns immediately when a free bed is clicked. The current bed is disabled, direct reassignment is supported, and no unassign API exists.
- Registration/public-registration room and bed fields are optional; active-contract room and bed fields are required.

# Steps

1. Reproduce room creation in a focused service test for `KTX01`/two beds and establish exact legacy-index failure and compensation behavior.
2. Keep strict, idempotent canonical provisioning (`KTX01-G1`, `KTX01-G2`), repair only concrete provisioning/compensation defects, and preserve the canonical uniqueness invariant.
3. Validate the guarded bed-index dry-run and exact-index checks; execute no index change without Gate A.
4. Add an authenticated unassign command that conditionally clears registration/public-registration assignment fields, releases only the matching used bed, synchronizes room availability, rejects active-contract records, and compensates partial failure/concurrent change.
5. Add `Bỏ chọn phòng` to the picker only for an existing cancellable assignment, require explicit confirmation, refresh row state after success, and preserve direct reassignment and stale-request protection.
6. Add focused backend/API/UI regression coverage, run affected verification, and inspect final diff/status.

# Acceptance Criteria

- AC1: Creating `KTX01` with `bed_count = 2` persists exactly two distinct active beds: `KTX01-G1` and `KTX01-G2`.
- AC2: Repeating provisioning is idempotent; a failed create leaves no new room or partial unprotected beds.
- AC3: The exact legacy index is removable only when the reviewed canonical unique index exists; dry-run performs zero writes.
- AC4: Confirmed unassign clears `room_id`/`bed_id` (and public `room_code`), releases the previously assigned bed, and recalculates room availability.
- AC5: After unassign, the row shows no room and the operator may assign another room or close the picker with no selection.
- AC6: Direct reassignment still reserves the new bed before releasing the old bed and never leaves two effective beds.
- AC7: Unassign is rejected for an active contract with a clear UI/API message and no persisted changes.
- AC8: Failure or concurrent modification restores/preserves the prior assignment; occupied/historical beds and unrelated data remain unchanged.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/rooms.service.spec.ts dormitory/services/room-assignment.service.spec.ts dormitory/controllers/registrations.controller.spec.ts` => AC1, AC2, AC4, AC6-AC8 pass.
- `D:\PROJECT\manager_points\backend` :: `npm run migration:dormitory-bed-index:dry-run` => reviewed index inventory and zero writes (AC3).
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/registrations/page.test.tsx" src/api/dormitory-api.test.ts` => unassign, confirmation, refresh, error, and reassignment UI/API cases pass (AC4-AC7).
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => updated API/UI types compile.
- Repository root :: `git diff --check` and `git status --short` => only scoped changes exist.

# Safety Gates

- Gate A: approve the exact development database, inspected index definitions, execute command, backup/rollback evidence, and resume point before dropping the legacy index.
- Gate B: separate approval for any production migration or deployment.
- This taskscope authorizes no implementation, database write, deployment, or contract cancellation.

# Artifacts and Checkpoints

- Record focused test outputs, pre/post index inventory if Gate A is approved, rollback command, build/typecheck results, and final diff/status.
- Checkpoint after an approved development index mutation and before final affected verification. Stop for an unexpected index, active-contract unassign requirement, non-isolatable compensation, or boundary expansion.

# Execution Budgets

- Dependency order: regression baseline -> backend changes/tests -> frontend changes/tests -> gated index action if approved -> final verification/review.
- One writer per path; serialize assignment service/API/UI changes. Step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
