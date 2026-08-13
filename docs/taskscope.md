# Task Identity and Pipeline

- Task: `fix-room-capacity-update-bed-guarantee-warning`
- Pipeline: `bug_fix` + `data_migration`
- Profile: Full; rules version `3.2.0`
- Repository: `D:\PROJECT\manager_points`; branch `main`.

# Risk Level

- Risk: high. The warning is caused by a database index that blocks bed provisioning, while the room update flow can persist part of a capacity change before provisioning succeeds.
- Source changes are Git-revertible. Dropping an index or reconciling room/bed data is a persistent database mutation and requires an explicit Human Gate.

# Objective

Allow an authorized capacity change for room `KTX01` to complete only when the room and its active bed records reach one consistent final state. A requested capacity of 5 must result in exactly five active beds, `KTX01-G1` through `KTX01-G5`, without the warning `Khong the dam bao 5 giuong hoat dong cho phong KTX01` and without replacing the occupied `KTX01-G1` record.

# Scope Boundaries

- Capacity-update orchestration in `backend/src/dormitory/services/rooms.service.ts`.
- Focused regression tests in `backend/src/dormitory/services/rooms.service.spec.ts`.
- Guarded legacy-index migration in `backend/scripts/migrate-dormitory-bed-index.ts` and its focused tests.
- A focused, idempotent reconciliation path for room `KTX01`; do not reuse the broad capacity migration execute path unchanged.
- Read-only development database audits before and after any approved mutation.
- Invariant after success: `room.bed_count === count(non-retired beds for room)` and every active bed code is unique within that room.

# Out of Scope

- Bed-management UI, room-table redesign, student reassignment, contract changes, or unrelated dormitory cleanup.
- Deleting, renaming, retiring, or replacing occupied/historical bed `KTX01-G1`.
- Executing the existing broad capacity migration when it would also change unrelated room/building fields.
- Production deployment or production database mutation.

# Confirmed Evidence

- Read-only capacity audit on 2026-08-13: `KTX01` declares 5 beds but has 1 persisted active bed; that bed is occupied and cached availability is 0.
- Read-only index audit on 2026-08-13: `beds` still contains legacy unique index `ma_giuong_1_room_id_1` and canonical unique index `bed_code_1_room_id_1`.
- New bed documents use `bed_code` and do not populate `ma_giuong`. The legacy unique compound index therefore rejects additional beds in the same room as duplicate missing `ma_giuong` values.
- `ensureRoomBeds()` now re-queries the final bed state and intentionally throws the reported warning when the requested count was not reached. The warning is a correct safety failure; suppressing or weakening it is not a valid fix.
- `RoomsService.update()` currently persists the room update before calling `ensureRoomBeds()`. If provisioning fails, the request returns an error after part of the update may already be stored.
- The existing `migration:dormitory-capacity:execute` path has broader side effects, including unrelated room/building field cleanup, so it is not approved for this focused repair.

# Steps

1. Add a regression test for updating `KTX01` to capacity 5 while only `KTX01-G1` exists and the legacy index causes new-bed writes to fail. Assert that the API does not report success and that no partial room-capacity change is left behind.
2. Make capacity updates atomic from the service contract perspective:
   - capture the original room capacity and affected bed state;
   - validate increases and decreases before persisting the room field;
   - provision or retire only the required beds;
   - persist `room.bed_count` only after the bed postcondition succeeds;
   - if a later write fails, compensate only beds changed by this request and restore the original room state;
   - never compensate by deleting or modifying an occupied or historical bed.
3. Keep the strict `ensureRoomBeds()` postcondition and improve failure classification/logging so an index conflict is distinguishable from an invalid count or protected-bed constraint. Preserve the user-safe API message and do not expose database/index details to clients.
4. Complete focused tests for:
   - increase from one active bed to five;
   - retry/idempotency when all five beds already exist;
   - legacy-index duplicate failure with compensation;
   - room-update failure after bed provisioning with compensation;
   - decrease using only empty beds without history;
   - refusal to decrease when occupied or historical beds would be affected.
5. Verify `migrate-dormitory-bed-index.ts` remains guarded and idempotent: exact legacy key/name match, canonical unique index required, dry-run has zero writes, already-absent legacy index is a no-op, and rollback recreates the reviewed definition.
6. After explicit development approval, execute only the guarded bed-index migration to remove `ma_giuong_1_room_id_1`; preserve `bed_code_1_room_id_1`.
7. After separate explicit development-data approval, reconcile only `KTX01`: preserve the existing occupied `KTX01-G1` document and create missing empty beds `KTX01-G2` through `KTX01-G5` idempotently. Synchronize cached availability from persisted bed statuses.
8. Re-run the capacity/index audits and focused backend verification, then inspect the final diff and repository status.

# Acceptance Criteria

- AC1: The guarded index dry-run reports legacy `ma_giuong_1_room_id_1` and canonical `bed_code_1_room_id_1` and performs zero writes.
- AC2: After approved index migration, only the verified legacy index is absent; the canonical compound index remains unique.
- AC3: After approved reconciliation, `KTX01` has exactly five non-retired beds with codes `KTX01-G1` through `KTX01-G5`.
- AC4: `KTX01-G1` retains its original `_id`, occupied status, relationships, and history; `G2` through `G5` are newly created empty beds.
- AC5: Repeating the same capacity update or reconciliation creates no duplicate beds and returns a consistent room projection.
- AC6: A failed increase leaves both `room.bed_count` and the active bed set at their pre-request values; no partial success is returned.
- AC7: A failed decrease restores any beds retired by that request and does not alter occupied or historical beds.
- AC8: The strict warning is no longer raised for a valid update after the index repair and reconciliation; it remains raised when the requested final invariant genuinely cannot be satisfied.
- AC9: No unrelated room, building, registration, contract, or student data is changed.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/services/rooms.service.spec.ts` => capacity increase/decrease, compensation, idempotency, and protected-bed tests pass.
- `D:\PROJECT\manager_points\backend` :: run the focused bed-index migration spec => definition guard, canonical-index requirement, no-op rerun, rollback output, and zero-write dry-run tests pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- Development read-only :: `npm run migration:dormitory-bed-index:dry-run` => reviewed index state, no writes.
- Development read-only :: `npm run migration:dormitory-capacity:dry-run` => reports the current `KTX01` 5-versus-1 mismatch before repair and 5-versus-5 after approved repair.
- After approved mutations, query `rooms`, `beds`, and `beds` indexes read-only => room capacity, active count, bed codes, protected `G1`, availability cache, and index state satisfy AC2-AC4.
- Repository root :: `git diff --check` and `git status --short` => no malformed or unintended changes.

# Safety Gates

- Gate A - development index migration: explicit approval required after reviewing the exact database, index definitions, execute command, and rollback command.
- Gate B - `KTX01` data reconciliation: separate explicit approval required after reviewing the exact room ID, protected `G1`, proposed inserted codes, and backup evidence.
- Gate C - production migration, reconciliation, or deployment: separate explicit approval with environment, backup, monitoring, and rollback evidence.
- This taskscope authorizes no database write. Do not run either execute command from this planning task.

# Artifacts and Checkpoints

- Required evidence: focused regression-test output, pre/post index reports, pre/post `KTX01` capacity reports, backup manifest/hash for data reconciliation, post-repair read-only query, backend build output, and final diff/status.
- Stop and amend scope if the legacy index definition differs, another index blocks canonical beds, any missing bed has protected historical identity, compensation cannot be isolated to the current request, or production-only action is required.

# Execution Budgets

- Dependency order: regression tests -> atomic/compensating update change -> focused verification -> index dry-run -> Gate A -> index execute -> reconciliation dry-run/backup -> Gate B -> focused reconciliation -> final audits.
- One writer per path. Serialize service, migration, and reconciliation changes.
- Step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
