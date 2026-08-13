# Task Identity and Pipeline

- Task: `dormitory-bed-source-of-truth-and-management`
- Pipeline: `feature_development` + `bug_fix`
- Profile: Full; rules version `3.2.0`
- Repository: `D:\PROJECT\manager_points`; branch `main`; base commit `d0c46a3cb1832421f7db8e976d2fd62d141aed79`; worktree clean before this planning edit.

# Risk Level

- Risk: high because the change spans frontend/backend, alters persisted dormitory invariants, and may require reconciling existing rooms and beds.
- Main risks: duplicate or missing beds, deleting historical/occupied beds, inconsistent room counters/status, partial room creation, orphan rooms after building deletion, and incorrect occupancy reports.
- Source changes are Git-revertible. Persistent-data execution is separately gated and must use a reviewed backup manifest and rollback path.

# Objective

Make each persisted `Bed` the authoritative unit of room capacity: creating a room with five beds atomically provisions five identifiable bed records; staff can manage those beds from the room UI; capacity changes, assignment, deletion, and reporting preserve occupancy and history without conflicting counters.

# Scope Boundaries

- Backend domain: `backend/src/dormitory/**`, including room/bed/building schemas, DTOs, controllers, services, enums, reports, assignment logic, module registration, and focused tests.
- Backend migration tooling: `backend/scripts/migrate-dormitory-capacity.ts` and `backend/package.json` only where audit/dry-run/execute/rollback behavior or commands must be aligned.
- Frontend: `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx`, focused components/tests created under that page or `frontend/src/components/dormitory/**`, and `frontend/src/api/dormitory-api.ts` plus its focused tests.
- `Bed` is the capacity source of truth. A room-creation/update request may accept a desired bed quantity, but persisted `Room.bed_count` and `Room.available_bed_count` must not independently determine runtime capacity.
- Capacity definitions:
  - physical capacity: non-retired bed records;
  - assignable capacity: active, non-maintenance beds;
  - occupied count: assignable beds with an effective occupant;
  - available count: assignable beds without an effective occupant.
- Bed lifecycle must distinguish operational state (`Active`, `Maintenance`, `Retired`) from occupancy. If backward compatibility requires retaining the existing `status` field temporarily, expose one canonical mapping and prohibit contradictory states.

# Out of Scope

- Asset inventory or moving a physical bed between rooms; beds remain room-owned and are created for a room.
- Redesigning registration, contract, billing, maintenance-request, permission, or QR workflows except for compatibility with the canonical bed/capacity contract.
- Deployment, production database mutation, or execution of migration/rollback without explicit Human Gate approval.
- Hard-deleting a bed with occupancy/history, silently reassigning students, or cascading deletion of an occupied building.
- Broad dormitory UI redesign unrelated to room/bed management.

# Context and Dependencies

- `RoomsService.create()` currently saves the room and then provisions beds, so failure can leave partial state. `ensureRoomBeds()` only grows the set.
- Runtime room projection already counts persisted beds, but `Room.bed_count`, `Room.available_bed_count`, public QR responses, and reports still consume cached/declared values in places.
- The existing bed API supports create, list-by-room, status update, delete, and auto-create. The buildings page has only a numeric `Tổng số giường` field and no bed-management UI.
- Assignment reserves a free bed with a conditional update. This concurrency guarantee must remain authoritative and must use the new canonical lifecycle/occupancy rules.
- `migrate-dormitory-capacity.ts` already supports audit, dry-run, execute, backup manifest, and rollback for non-production connections; extend it rather than introducing an unrelated migration mechanism.
- MongoDB transactions require a transaction-capable deployment. If unavailable in the development/test environment, implement a tested compensating rollback while keeping the service interface transaction-ready.

# Steps

1. Establish focused regression tests for current provisioning, assignment reservation, room projection, report totals, building deletion, and the buildings page before changing contracts.
2. Define the canonical bed lifecycle and capacity response fields. Add indexes/invariants needed to keep `(room_id, bed_code)` unique and prevent invalid lifecycle/occupancy combinations; preserve a documented compatibility mapping for existing Vietnamese status values.
3. Refactor room creation so a request for `N` beds creates the room and exactly `N` beds (`G01..GN`) atomically or rolls the room creation back. Return the server-projected room rather than stale declared counters.
4. Implement safe capacity adjustment:
   - growth provisions only missing unique beds;
   - shrink retires explicitly selected eligible beds, or deterministically selects never-used/free beds when the API contract permits it;
   - reject shrink when insufficient eligible beds exist;
   - never hard-delete occupied or historically referenced beds.
5. Make room read/list, assignment suggestions, QR payloads, occupancy/dashboard reports, and room status derive their counts from beds using bounded aggregation rather than per-room query fan-out. Keep locked/maintenance room status protected from automatic occupancy status updates.
6. Guard building deletion when any room references the building. Preserve the existing room deletion guard and extend it to block deletion when active occupancy/contracts or protected bed history make deletion unsafe; retire/archive where required by the lifecycle contract.
7. Add an in-context `Quản lý giường` UI from each room row/detail. Show code, position, operational state, occupancy/student summary allowed by current permissions, and actions to add, edit, maintain/activate, or retire eligible beds. Disable invalid actions and show backend conflict messages.
8. Keep the room form as the normal fast path: entering `Số giường = 5` creates five beds automatically. Display room metrics as `Đang ở / Sức chứa`, available beds, and maintenance count; do not require manual creation of five separate beds.
9. Extend the existing capacity migration to report declared/persisted/lifecycle/occupancy mismatches, produce a reviewed backup manifest, idempotently backfill only unambiguous missing beds, and support verified rollback. Ambiguous surplus, occupied, duplicate, or historically referenced records must be reported for manual resolution rather than guessed.
10. Run focused tests, affected frontend/backend checks, dry-run migration against an approved development database only, independent review, and final diff/status inspection. Stop before any execute-mode data mutation until its Human Gate is approved.

# Acceptance Criteria

- AC1: Creating a room with desired quantity `5` leaves either no new room or one room with exactly five unique beds `G01`–`G05`; no partial room/bed state remains after an injected provisioning failure.
- AC2: Runtime physical, assignable, occupied, available, and maintenance counts are derived from persisted beds according to the documented lifecycle rules, not from stale room counters.
- AC3: Increasing a five-bed room to seven creates only `G06` and `G07`, remains idempotent on retry, and preserves all existing bed identifiers and assignments.
- AC4: Reducing capacity cannot retire/delete an occupied, maintenance-in-progress, or historically protected bed. An eligible free bed is retired predictably, remains auditable, and is excluded from physical/assignable capacity as defined.
- AC5: The room-management UI lists all beds and accurately disables invalid state changes. A normal user creates a five-bed room through one quantity input without manually creating five records.
- AC6: Assignment accepts only an active, available bed belonging to the requested assignable room and remains safe under concurrent attempts; maintenance/retired/occupied beds cannot be reserved.
- AC7: Building deletion is rejected while rooms reference it. Room deletion is rejected when active occupancy/contracts or protected bed history exist, with a clear conflict response.
- AC8: Buildings table and reports show consistent bed-derived values; a room with five physical beds, one maintenance bed, and three occupants reports physical `5`, assignable `4`, occupied `3`, available `1`.
- AC9: Room-list/report implementation avoids three per-room count queries; focused tests verify a bounded aggregation/query strategy for a multi-room page.
- AC10: Migration dry-run performs no writes, identifies every mismatch category, masks connection details, and produces deterministic proposed actions. Execute mode is idempotent, non-production guarded, backup-backed, and not run without approval.
- AC11: Existing registration/contract/QR consumers either receive backward-compatible fields or are updated together; backend build, frontend typecheck, and focused suites pass.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/rooms.service.spec.ts dormitory/services/room-assignment.service.spec.ts dormitory/services/buildings.service.spec.ts dormitory/services/beds.service.spec.ts dormitory/services/dormitory-reports.service.spec.ts` => provisioning rollback, lifecycle, capacity adjustment, reservation, deletion guards, and aggregation tests pass. Create missing focused spec files within the backend boundary.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/migration-capacity.spec.ts` => dry-run planning, mismatch handling, idempotency, backup, and rollback logic pass; use the actual focused migration spec path if repository convention places it elsewhere.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/buildings/page.test.tsx" "src/api/dormitory-api.test.ts"` => automatic quantity workflow, bed manager states/actions, count display, and conflict handling pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => TypeScript passes.
- `D:\PROJECT\manager_points\backend` :: `npm run migration:dormitory-capacity:dry-run` against an explicitly approved development connection => zero writes and reviewed deterministic report. Do not run if database access was not separately authorized/configured.
- Manual development check: create a five-bed room, grow to seven, mark one bed maintenance, assign students concurrently, attempt invalid shrink/delete operations, and confirm UI/API/report values remain consistent.
- Repository root :: `git diff --check` and `git status --short` => no malformed or unintended changes.

# Safety Gates

- Gate A — schema/index mutation in a database: approval required before applying indexes or lifecycle changes to persistent data. Review artifact: schema diff, compatibility notes, validation results, and rollback procedure.
- Gate B — migration execute: approval required after reviewing the dry-run report and backup manifest. Action: run the exact non-production execute command; impact: create/retire/reclassify bed records and synchronize derived room fields; rollback: verified manifest-based command; resume point: post-migration audit.
- Gate C — production/deployment: separate explicit approval required with environment, release plan, backup, monitoring, and rollback evidence.
- Source implementation, unit tests, builds, and migration dry-run logic do not themselves authorize any database write.

# Artifacts and Checkpoints

- Base checkpoint: commit `d0c46a3cb1832421f7db8e976d2fd62d141aed79`; clean worktree before this taskscope edit.
- Required review artifacts: API/lifecycle contract, schema/index diff, focused test output, query/aggregation evidence, migration dry-run report, redacted backup-manifest metadata, final diff/status, and independent review findings.
- Create a checkpoint before gated migration execution and record the reviewed script revision plus manifest path/hash. Never record credentials or student PII.

# Execution Budgets

- Dependency order: contract/tests -> backend invariants and atomic provisioning -> lifecycle/capacity adjustment -> projections/reports/deletion guards -> frontend UI -> migration dry-run -> independent review -> gated execute if separately approved.
- One writer per path; serialize schema/service/migration work that shares dormitory invariants. Parallelize only disjoint read-only review or frontend work after the API contract stabilizes.
- Step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
- Stop and amend scope for a new collection, asset-transfer workflow, public breaking API, production-only transaction dependency, modules outside the listed boundaries, ambiguous automated data repair, or any unapproved persistent-data mutation.
