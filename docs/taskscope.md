# Task Identity and Pipeline

- Task: `dormitory-room-bed-provisioning-and-code-convention`
- Pipeline: `bug_fix` + `feature_development`
- Profile: Full; rules version `3.2.0`
- Repository: `D:\PROJECT\manager_points`; branch `main`; base commit `db525a9ad0854e5546613866dac28cdf3c7e5917`.

# Risk Level

- Risk: high. The task changes persisted room/bed invariants across backend and frontend and may require reconciliation of existing data.
- Main risks: configured quantity differing from active beds, partial room/bed creation, duplicate or malformed bed codes, code collisions during room-code changes, repeated shrink retiring too many beds, growth counting retired beds as capacity, and invalid actions on occupied beds.
- Source changes are Git-revertible. Any persistent-data reconciliation or migration execution requires a Human Gate.

# Objective

Guarantee that creating a room with `bed_count = N` creates exactly `N` non-retired bed records and assigns each bed a server-generated, room-qualified code in the format `<ROOM_CODE>-G<n>` (for example, room `P201` with two beds creates `P201-G1` and `P201-G2`). Preserve this quantity/code contract through retries and later capacity changes while occupied/historical beds remain protected.

# Scope Boundaries

- Backend: `backend/src/dormitory/schemas/bed.schema.ts`, `dormitory-enums.ts`, room/bed DTOs, `controllers/beds.controller.ts`, `services/rooms.service.ts`, `services/beds.service.ts`, related module wiring, and focused tests under `backend/src/dormitory/**`.
- Existing-data audit/reconciliation: `backend/scripts/migrate-dormitory-capacity.ts` and related focused tests/package commands only when required to detect or repair legacy mismatches.
- Frontend: `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx`, a focused bed-manager component under that page or `frontend/src/components/dormitory/**`, `frontend/src/api/dormitory-api.ts`, and focused tests.
- Capacity invariant: `room.bed_count === count(beds where room_id = room._id and status != 'Đã nghỉ')` after every successful scoped mutation.
- Bed-code invariant: every server-managed bed code is `<normalized room.room_code>-G<positive integer>`; its numeric suffix is unique inside the room and is never reused after retirement or deletion when history may exist.
- Runtime capacity remains bed-derived. `room.bed_count` is the requested/configured quantity and must be synchronized in the same operation, never used to conceal missing or extra active beds.

# Out of Scope

- Moving beds between rooms or treating beds as transferable inventory assets.
- Redesigning registration, contracts, billing, QR, or the full dormitory interface beyond compatibility with the bed-count invariant.
- Hard-deleting occupied or historically referenced beds, automatically moving students, or guessing how to resolve ambiguous legacy data.
- Deployment, production mutation, or executing reconciliation/migration without explicit approval.

# Context and Dependencies

- No bed-management UI exists on the buildings page. The room dialog only exposes `Tổng số giường`; room-row actions only edit or delete the room.
- Room creation calls `ensureRoomBeds(roomId, bed_count)` and compensates by deleting the new room/beds on provisioning failure. Existing tests mock provisioning and do not verify that requesting `N` creates exactly `N` persisted non-retired beds or that rollback is complete.
- `ensureRoomBeds()` currently compares the requested quantity with all bed documents, including `Đã nghỉ`. Consequently, increasing capacity after a shrink may create no beds even though active capacity is too low.
- Room shrink currently compares against all bed documents and retires before updating the room. Repeating the same quantity can retire additional beds, and a subsequent room-update failure can leave beds retired while `room.bed_count` remains unchanged.
- Direct bed create/delete/status endpoints can change bed records without synchronizing `room.bed_count`; the UI must not expose a path that violates the invariant.
- `ensureRoomBeds()` currently generates `G01`, `G02`, ... without the room code, so different rooms expose duplicate-looking bed codes even though `(room_id, bed_code)` is already unique.
- `Room.room_code` is globally unique and is currently editable through `UpdateRoomDto`; the implementation must define an atomic rename strategy so room and bed codes cannot diverge.
- Assignment uses conditional reservation of a `Trống` bed and must continue rejecting occupied, maintenance, and retired beds.

# Steps

1. Add failing backend tests that count actual generated operations/records and verify exact codes for room creation, retry, rollback, growth, shrink, repeated identical updates, retired-bed presence, room-code changes, and mutation failure.
2. Replace the current reconciliation math with `activeCount = count(status != 'Đã nghỉ')`:
   - desired equals active: no bed mutation;
   - desired greater than active: create exactly the delta as new `Trống` beds;
   - desired lower than active: retire exactly the delta from eligible `Trống`, `has_history != true` beds;
   - reject before writes when insufficient eligible beds exist.
3. Centralize bed-code generation in the backend:
   - normalize the room code once using the same canonical value persisted on `Room`;
   - generate `<ROOM_CODE>-G1` through `<ROOM_CODE>-GN` on initial creation, with no zero padding;
   - on growth, derive the next suffix from all current and retired bed codes for that room and never reuse an issued suffix;
   - reject client-supplied codes that do not match the selected room, or remove arbitrary `bed_code` input from normal create flows;
   - retain the compound unique index and add a global unique `bed_code` index only after the legacy audit proves all values can be migrated safely.
4. Make capacity adjustment and `room.bed_count` update atomic with a MongoDB session/transaction. If the configured development database cannot transact, use a tested compensating rollback that restores both room and bed states on every failure.
5. When `room_code` changes, update every bed prefix in the same atomic operation while retaining bed IDs, suffixes, occupancy, and history. Preflight every target code and reject the entire update on collision; no partial rename is allowed.
6. Close invariant-breaking bed API paths:
   - status changes between `Trống` and `Bảo trì` do not change physical capacity;
   - retiring/reactivating or adding/removing a bed must use one capacity-adjustment service that synchronizes the room quantity;
   - occupied or protected-history beds cannot be deleted/retired/reactivated through unsafe generic endpoints.
7. Return canonical room metrics after mutations: configured/physical capacity, assignable capacity, occupied, available, and maintenance counts. Reload the buildings table from the server-confirmed response/data.
8. Add a `Quản lý giường` action on each room row, permission-gated with existing bed permissions. The dialog/drawer must list every bed with code, position, status, and allowed actions; show loading, empty, error, and conflict states.
9. Keep `Tổng số giường` as the normal capacity control. Saving `2` creates/maintains exactly two non-retired beds without requiring manual bed creation. The bed manager may edit metadata and toggle maintenance; any add/retire/reactivate action must update capacity through the same canonical backend operation.
10. Add frontend tests for opening the manager, loading beds, rendering room-qualified codes and all statuses, disabling protected actions, refreshing counts after success, and preserving UI state after conflicts.
11. Extend the existing capacity audit/dry-run to report quantity mismatches, legacy codes such as `G01`, malformed prefixes/suffixes, duplicate target codes, and proposed `<ROOM_CODE>-G<n>` mappings. Do not execute writes in this task without approval.
12. Run focused backend/frontend verification, build/typecheck, independent review of the persistence/code invariants, and final diff/status inspection.

# Acceptance Criteria

- AC1: The buildings page exposes `Quản lý giường` for authorized users and lists all persisted beds for the selected room with code, position, and status.
- AC2: Creating room `P201` with `bed_count = 2` results in exactly two non-retired beds, `P201-G1` and `P201-G2`. An injected failure leaves neither the room nor partial beds.
- AC3: Retrying the same create/provision request does not create duplicates and preserves the exact active quantity.
- AC4: Updating `P201` from two to four beds creates exactly `P201-G3` and `P201-G4`. If a prior suffix is retired or historically used, it is not silently reused.
- AC5: Updating seven to five retires exactly two eligible beds. Repeating `bed_count = 5` performs no additional retirement.
- AC6: Shrink is rejected without changing the room or any bed when the delta exceeds eligible free, history-free beds. Occupied, maintenance, and protected-history beds are never selected automatically.
- AC7: Any failure during growth, retirement, or room update restores the prior `room.bed_count` and bed states. No observable partial state remains.
- AC8: Toggling a bed between `Trống` and `Bảo trì` changes assignable/available metrics but not `room.bed_count` or physical capacity.
- AC9: Direct bed mutations cannot violate `room.bed_count === non-retired bed count`; unsafe delete/retire operations return a conflict.
- AC10: After each successful UI action, the room row and bed manager show server-derived consistent counts and statuses without an optimistic mismatch.
- AC11: Assignment still accepts only a `Trống` non-retired bed belonging to the requested room and remains concurrency-safe.
- AC12: Changing room code `P201` to `P301` atomically changes its bed codes to `P301-G<n>` without changing bed IDs, status, occupancy, or history; a collision rejects the whole operation.
- AC13: The backend rejects or canonicalizes any direct bed-create request that could produce a code with another room's prefix, an invalid suffix, or a duplicate target code.
- AC14: Capacity/code audit dry-run performs no writes and deterministically reports configured count, active count, delta, current code, proposed code, collision, and manual-review reason where applicable.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/rooms.service.spec.ts dormitory/services/beds.service.spec.ts dormitory/services/room-assignment.service.spec.ts` => exact `P201-G1`/`P201-G2` provisioning, retry, growth suffixing, room-code rename, collision rollback, grow/shrink/no-op behavior, API invariants, and assignment protection pass. Create `beds.service.spec.ts` if absent.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/migration-capacity.spec.ts` => mismatch classification and no-write dry-run pass; use the final repository-native spec path if named differently.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/buildings/page.test.tsx" "src/api/dormitory-api.test.ts"` => bed-manager visibility, states, permissions, actions, conflicts, and refreshed counts pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => TypeScript passes.
- Optional approved development audit only: `D:\PROJECT\manager_points\backend` :: `npm run migration:dormitory-capacity:dry-run` => zero writes and a reviewed mismatch report; do not run without an explicitly configured/approved development connection.
- Manual development check: create `P201` at 2, confirm only `P201-G1` and `P201-G2`, retry, grow 2→4, rename to `P301`, shrink 4→2→2, toggle maintenance, and confirm both invariants after every step.
- Repository root :: `git diff --check` and `git status --short` => no malformed or unintended changes.

# Safety Gates

- Gate A — persistent reconciliation/migration execute: explicit approval required after review of the dry-run report, exact targets, backup manifest, rollback command, and ambiguous records.
- Gate B — production deployment or data mutation: separate explicit approval required with environment, impact, monitoring, and rollback evidence.
- Source implementation, unit tests, builds, and migration dry-run code do not authorize persistent database writes.

# Artifacts and Checkpoints

- Base checkpoint: commit `db525a9ad0854e5546613866dac28cdf3c7e5917`.
- Required evidence: invariant/API contract, focused test outputs, transaction or compensating-rollback tests, UI test output, redacted dry-run report if authorized, independent review, and final diff/status.
- Before any gated execute, record the reviewed script revision and backup-manifest path/hash without credentials or student PII.

# Execution Budgets

- Dependency order: quantity/code contract tests -> centralized code generator -> reconciliation service/atomicity -> safe bed API and room-code rename -> frontend manager -> audit dry-run logic -> affected verification -> independent review.
- One writer per path; serialize room/bed persistence changes. Frontend work begins after the API contract is stable.
- Step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
- Stop and amend scope for a new collection, transferable-bed inventory, public breaking API outside dormitory, production-only transaction dependency, ambiguous automated data repair, or any unapproved persistent-data mutation.
