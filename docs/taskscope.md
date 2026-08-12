# Task Identity and Pipeline

- Task: `dormitory-registration-reassignment-capacity-floor-removal`
- Pipeline: `feature_development` + `bug_fix` + `data_migration`
- Profile: Full; rules version `3.2.0`
- Repository: `D:\PROJECT\manager_points`; branch `main`; base commit `b487b5eb1772c40c12fae3ed7615b169d6290450`; initial worktree clean.

# Risk Level

- Risk: high for the complete task because it changes room-assignment invariants across frontend/backend and includes optional persistent MongoDB repair/removal; source-only work and read-only audit are medium risk.
- Reversibility: source/test changes are Git-revertible. Executed bed reconciliation and `$unset` of floor fields require a reviewed backup/rollback artifact.
- Blast radius: dormitory registrations, rooms/buildings, public room response/UI, and the `buildings`, `rooms`, `beds`, registrations, and contracts collections. No production execution or deployment is authorized by this scope.

# Objective

The registrations table continues to offer an explicit room-change action after assignment; assignment/reassignment leaves exactly one effective bed per student; displayed free/maximum capacity is derived from persisted bed records and agrees across registrations/buildings; and unused floor/storey fields are removed from dormitory frontend, backend, API contracts, and—only after a separate gate—from stored MongoDB documents.

# Scope Boundaries

- Approved frontend: `frontend/src/app/(dashboard)/dormitory/registrations/**`, `frontend/src/app/(dashboard)/dormitory/buildings/**`, `frontend/src/app/public/room/[qrId]/page.tsx`, `frontend/src/api/dormitory-api.ts`, and their focused tests.
- Approved backend: `backend/src/dormitory/**` plus a focused `backend/scripts/**` audit/migration script and package script entries if required.
- Known targets: `RoomAssignmentPopover`, registration action visibility and row reconciliation; registration list normalization; `RoomAssignmentService.assignRoom/transferRoom/suggestRooms`; `RoomsService.findAll/ensureRoomBeds/syncRoomAvailability`; building/room schemas and DTOs; QR room response; frontend `Building`/`Room` types and building/public-room rendering.
- Database audit is read-only by default and may report only room/building codes and aggregate counts; no student PII or connection string is logged.
- Capacity contract:
  - `current_students` is effective occupied-bed/active-assignment count.
  - `max_students` is the count of persisted bed documents for the room.
  - `available_bed_count` is the count of persisted beds with status `Trống`.
  - `rooms.bed_count` remains declared capacity for create/update/reconciliation, but runtime maximum/free displays must not trust it when persisted beds disagree.

# Out of Scope

- Deployment, production mutation, deleting rooms/buildings/students/contracts, changing pricing or room types, and unrelated dormitory screens.
- Changing bed `position` values unless a verified stored value is specifically a floor/storey artifact; the current audited bed contains no such text.
- Silent repair during GET/list/suggestion requests. Read paths must not create or delete beds.
- Automatically choosing whether to modify production data. Migration execution requires the Safety Gate below.

# Context and Dependencies

- Frontend currently hides room assignment after assignment with `canAssignRoom && !hasAssignedBed(r)`. Backend `assignRoom()` also rejects an existing bed or active contract, so removing the UI condition alone cannot satisfy reassignment.
- Existing `transferRoom()` handles active contracts but updates only the contract; registration list normalization can prefer stale registration room data. The effective room/bed source must be deterministic and returned to the UI, including an active contract identifier when needed.
- `suggestRooms()` currently calls `ensureRoomBeds()`, so a GET-like suggestion request can mutate data. It must become read-only; repair belongs in the explicit migration path.
- Buildings currently show stored `bed_count` and an active-contract count named `total_students`; they do not expose persisted-bed-derived maximum capacity.
- Floor/storey fields still exist in `Building.floor_count`, `Room.floor`, create/update DTOs, frontend API types/defaults/list text, the QR response, the public room page, and a room schema test. Removing schema fields alone will not remove existing MongoDB keys.
- Read-only local database audit on 2026-08-12 found one room, `KTX01`: declared `bed_count = 5`, one persisted bed, zero persisted free beds, cached `available_bed_count = 0`, and the one bed is in use. The single room has `floor`; the single building has `floor_count`. This confirms a real declared-versus-persisted bed mismatch without exposing PII.

# Steps

1. Baseline focused tests and add a read-only, non-production-safe audit that reports per-room declared beds, persisted total/free/used beds, effective assignments/contracts, cached availability, and presence of `floor`/`floor_count`.
2. Define one backend capacity projection from `beds`; return `max_students`, `current_students`, and `available_bed_count` consistently from room listing and room suggestions. Remove bed creation from `suggestRooms()` and keep create/update provisioning explicit and idempotent.
3. Implement one reassignment command for registrations:
   - without an active contract, atomically reserve the new bed, conditionally replace the matching old assignment, release the old bed, and sync both rooms;
   - with an active contract, transfer the effective contract room/bed and keep registration/list projection consistent;
   - on any conflict or intermediate failure, preserve the complete old assignment and availability state.
4. Keep the room action visible after assignment, label it “Đổi phòng” when applicable, exclude the current effective room/bed from invalid choices, call the correct assignment/reassignment contract, and refresh/reconcile the row from the server response. Display room availability as `Còn X/Y giường trống` using persisted counts.
5. In buildings, expose “Số SV tối đa” from `max_students` (persisted beds), retain current occupancy only as a separately named value if shown, and never substitute active-contract count for maximum capacity.
6. Remove floor/storey fields and rendering from backend schemas/DTOs/QR projection, frontend API types/defaults/building/public-room UI, obsolete tests, and relevant dormitory field-mapping artifacts. Add migration tests proving new payloads reject/ignore obsolete fields according to the global validation contract.
7. Add a dry-run-first migration with non-production guard, backup manifest, execute flag, and rollback support to reconcile missing bed documents up to declared `bed_count`, recalculate cached availability, and `$unset` `rooms.floor`/`buildings.floor_count`. Stop at the Human Gate before execute.
8. Run focused tests, builds/typecheck, repeat the read-only audit, and review the final diff/status for unintended changes.

# Acceptance Criteria

- AC1: Every registration row eligible for assignment retains an action after initial assignment; its label changes to “Đổi phòng”, and a successful change displays the server-confirmed new room/bed without a page reload.
- AC2: Reassignment is safe under concurrency: one bed cannot be assigned twice, one student has exactly one effective bed, and the previous bed is released only after the new assignment succeeds. A failed change leaves registration, active contract, both beds, and both room counts unchanged.
- AC3: Active-contract and non-contract registrations both use the effective current room/bed in list responses and UI; stale registration fields cannot override an active contract transfer.
- AC4: Registrations display `Còn X/Y giường trống`, where `X` and `Y` are counted from persisted `beds`; buildings display `max_students = Y`. `current_students <= max_students`, and cached availability is not used as an unverified source of truth.
- AC5: Room create/update provisioning remains idempotent; suggestion/list GET requests perform no inserts, updates, or deletes. Mismatch repair occurs only through the explicit gated migration.
- AC6: No supported backend DTO/schema/response or frontend type/UI contains `floor` or `floor_count`; building and public room views contain no floor text. Post-migration audit finds neither key in `rooms`/`buildings`.
- AC7: Dry-run reports `KTX01` as declared 5 versus persisted 1 before repair. After separately approved execution, it reports five unique persisted beds, four free/one used for the audited state, matching cached availability and maximum capacity; rerunning execute makes no further changes.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/room-assignment.service.spec.ts dormitory/services/registrations.service.spec.ts dormitory/services/rooms.service.spec.ts dormitory/schemas/room.schema.spec.ts` => assignment, reassignment, rollback, concurrency, capacity projection, and removed-floor cases pass.
- `D:\PROJECT\manager_points\backend` :: repository-native audit/migration dry-run command added by implementation => reports mismatches and floor keys, performs zero writes, masks the connection string, and refuses production.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/registrations/page.test.tsx" "src/app/(dashboard)/dormitory/buildings/page.test.tsx" "src/api/dormitory-api.test.ts"` => persistent change-room action, `X/Y` capacity, maximum-student, API contract, and no-floor regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => TypeScript passes.
- Manual development check: assign and then change a student between two rooms; simulate a taken-bed conflict; confirm the old assignment survives failure and both tabs show the same persisted capacity.
- After separately approved migration execute: rerun audit and compare to the reviewed before/after manifest; verify idempotent second run and absence of `floor`/`floor_count` keys.

# Safety Gates

- Gate A — None: source/test implementation, builds, and read-only database audit in development.
- Gate B — Human approval required before any migration `--execute`, including local/development data, because it inserts bed documents and removes stored fields. Required evidence: target database/environment, masked URI, dry-run output, backup path/hash, exact affected counts, rollback command, and non-production guard result.
- Production migration, deployment, or persistent repair is not authorized by this taskscope and requires an additional explicit request and environment-specific approval.

# Artifacts and Checkpoints

- Base checkpoint: commit `b487b5eb1772c40c12fae3ed7615b169d6290450`; clean status before planning edit.
- Planning evidence: redacted read-only audit summarized in Context and Dependencies.
- Execution artifacts: focused test/build/typecheck outputs, audit dry-run report, migration before/after manifest, backup/rollback evidence, and final `git diff`/status.
- Do not include database credentials or student PII in repository artifacts or logs.

# Execution Budgets

- One writer per path. Serialize backend contract/invariant changes before frontend alignment; migration execute cannot overlap application writes.
- Step deadline: 900 seconds (maximum 1,800); retries: 2; engineering loops: 3; review-remediation cycles: 2.
- Stop and amend scope for a new collection/schema redesign, public API break beyond removing floor fields, a fourth application module outside dormitory, destructive cleanup beyond the enumerated `$unset`/bed reconciliation, production effects, or security-sensitive expansion.
