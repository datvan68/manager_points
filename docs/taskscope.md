# Task Identity and Pipeline

- Task: `fix-room-bed-provisioning-legacy-index`
- Pipeline: `bug_fix` + `data_migration`
- Profile: Full; rules version `3.2.0`
- Repository: `D:\PROJECT\manager_points`; branch `main`.

# Risk Level

- Risk: high. The source fix affects the room/bed persistence invariant, and correcting the legacy MongoDB index or existing room data is a persistent-data mutation.
- Main risks: reporting room creation as successful after a partial bulk write, deleting the wrong index, creating duplicate beds during retry, overwriting the occupied bed, or leaving `room.bed_count` inconsistent with persisted active beds.
- Source and migration-code changes are Git-revertible. Database index changes and data reconciliation require an explicit Human Gate.

# Objective

Guarantee that creating a room with `bed_count = N` succeeds only when exactly `N` non-retired bed records exist for that room. For `bed_count = 5`, the result must be five beds named `<ROOM_CODE>-G1` through `<ROOM_CODE>-G5`; partial creation must fail and roll back instead of being silently accepted.

# Scope Boundaries

- Backend provisioning logic in `backend/src/dormitory/services/rooms.service.ts` and focused tests in `backend/src/dormitory/services/rooms.service.spec.ts`.
- Bed indexes in `backend/src/dormitory/schemas/bed.schema.ts`.
- A focused, idempotent migration/audit under `backend/scripts/**` plus repository-native package commands and tests.
- Development-data reconciliation for the confirmed `KTX01` mismatch only after explicit approval.
- Invariant: after a successful create or capacity increase, `room.bed_count === count(beds where room_id = room._id and status != 'Đã nghỉ')`.
- Code invariant: a room with code `KTX01` and capacity 5 owns exactly `KTX01-G1` through `KTX01-G5`, unless a higher suffix is required to preserve historical non-reuse.

# Out of Scope

- Bed-management UI, room-table redesign, student reassignment, contract changes, or unrelated dormitory refactors.
- Deleting or replacing the existing occupied `KTX01-G1` bed.
- Production deployment, production database mutation, or automatic repair of ambiguous room/bed records.

# Context and Dependencies

- A read-only development audit on 2026-08-13 confirmed room `KTX01` has `bed_count = 5` but only one persisted bed: `KTX01-G1`, status `Đang sử dụng`; cached availability is 0.
- The `beds` collection contains both the current unique compound index `bed_code_1_room_id_1` and a legacy unique compound index `ma_giuong_1_room_id_1`.
- New bed documents do not populate `ma_giuong`. Under the legacy unique compound index, multiple new beds in the same room collide on the missing `ma_giuong` value plus `room_id`.
- `ensureRoomBeds()` currently uses unordered `bulkWrite`. When one operation succeeds and the remaining operations fail with duplicate key, its catch block treats the error as an idempotent race and continues without verifying the requested final count. This explains the observed one-of-five result.
- Room creation already calls `ensureRoomBeds(savedRoom._id, dto.bed_count)` and attempts compensating deletion when an error escapes. The missing final postcondition allows the partial write to appear successful.
- The existing capacity dry-run is read-only but still plans legacy `G01` codes and must not be used to execute this repair unchanged.

# Steps

1. Add a regression test reproducing an unordered bulk result where one bed is inserted and the remaining operations fail with duplicate key. Verify that creating a five-bed room cannot return success with only one persisted active bed.
2. Harden `ensureRoomBeds()`:
   - validate `bedCount` as a positive integer;
   - generate deterministic room-qualified codes;
   - distinguish a true concurrent idempotent collision from a partial provisioning failure;
   - re-query persisted non-retired beds after `bulkWrite`;
   - return success only when the final active count equals the requested count and all expected codes belong to the room;
   - otherwise throw a conflict/internal persistence error so room creation performs its compensating rollback.
3. Add tests for `bed_count = 5`, partial bulk failure, complete duplicate-key retry, repeated provisioning, and rollback. Assert exact persisted codes rather than only asserting that `ensureRoomBeds()` was called.
4. Define an idempotent index migration that:
   - inspects the actual index definitions before changes;
   - removes only the verified legacy `ma_giuong_1_room_id_1` index;
   - retains `bed_code_1_room_id_1` as the canonical unique compound index;
   - treats an already-absent legacy index as a no-op;
   - refuses execution if the index name or key definition differs from the reviewed target;
   - emits a redacted before/after index report and provides a rollback command that recreates the exact prior definition if required.
5. Extend the dry-run audit to report every room where declared capacity differs from non-retired persisted beds, including missing expected codes and protected occupied/history state. Dry-run performs no writes.
6. After source verification and explicit migration approval, remove the legacy index in the approved development database, then reconcile `KTX01` idempotently by preserving occupied `KTX01-G1` and creating only `KTX01-G2` through `KTX01-G5` as empty beds.
7. Re-run the audit and focused backend checks, then inspect the final diff and repository status for unintended changes.

# Acceptance Criteria

- AC1: Creating a new room `TEST05` with `bed_count = 5` persists exactly five non-retired beds: `TEST05-G1`, `TEST05-G2`, `TEST05-G3`, `TEST05-G4`, and `TEST05-G5`.
- AC2: The create request cannot return success when fewer or more than five active beds exist. Any provisioning failure removes the newly created room and every partial bed from that attempt.
- AC3: A duplicate-key error is accepted as an idempotent race only after a fresh database query proves the requested final count and codes are present; otherwise it is propagated as failure.
- AC4: Retrying `ensureRoomBeds(roomId, 5)` after successful provisioning creates no duplicates and preserves exactly five active beds.
- AC5: The migration dry-run identifies `ma_giuong_1_room_id_1` as legacy, retains `bed_code_1_room_id_1`, reports the `KTX01` 5-versus-1 mismatch, and performs zero writes.
- AC6: The migration execute path drops only the verified legacy index, is safe to rerun, records before/after evidence, and requires explicit approval.
- AC7: After approved development reconciliation, `KTX01-G1` keeps its ID, occupied status, and relationships; only `KTX01-G2` through `KTX01-G5` are added as empty beds.
- AC8: The final development audit reports `KTX01` with declared capacity 5 and active persisted count 5, with no duplicate canonical codes.
- AC9: Existing occupied or historical beds are never deleted, renamed, retired, or reassigned by this repair.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/rooms.service.spec.ts` => five-bed provisioning, partial duplicate failure, postcondition enforcement, idempotent retry, and rollback tests pass.
- `D:\PROJECT\manager_points\backend` :: run the repository-native focused migration spec => legacy-index detection, definition guard, no-op rerun, mismatch reporting, and zero-write dry-run tests pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- Approved development dry-run: `D:\PROJECT\manager_points\backend` :: `npm run migration:dormitory-capacity:dry-run` => reports the index state and `KTX01` mismatch without writes.
- Human Gate required before the exact development migration execute command is run.
- After approved execute, query the `rooms`, `beds`, and `beds` indexes read-only => `KTX01.bed_count = 5`; five active canonical beds exist; `KTX01-G1` remains occupied; legacy index is absent; canonical index remains unique.
- Repository root :: `git diff --check` and `git status --short` => no malformed or unintended changes.

# Safety Gates

- Gate A — development index migration: explicit approval required after review of the exact database, legacy index key/name, dry-run output, and rollback command.
- Gate B — development data reconciliation: explicit approval required after review of the exact room, existing protected bed, proposed inserted codes, and backup evidence.
- Gate C — production migration, reconciliation, or deployment: separate explicit approval required with environment, backup, impact, monitoring, and rollback evidence.
- This taskscope does not authorize any database write. Source implementation and read-only audit remain ungated.

# Artifacts and Checkpoints

- Required evidence: regression-test output, redacted before/after index definitions, capacity mismatch dry-run, approved migration command/output, post-reconciliation read-only query, backend build output, and final diff/status.
- Before a gated execute, record the exact database name, migration revision, target index definition, target room code, backup path/hash, and rollback command without credentials or student PII.

# Execution Budgets

- Dependency order: regression test -> provisioning postcondition -> migration/audit implementation -> focused tests/build -> reviewed dry-run -> Human Gate -> development index repair -> Human Gate -> `KTX01` reconciliation -> final audit.
- One writer per path. Serialize schema, provisioning, migration, and reconciliation work.
- Step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
- Stop and amend scope if the observed index definition differs, additional legacy indexes affect writes, reconciliation would touch occupied/history records, or any production-only action is required.
