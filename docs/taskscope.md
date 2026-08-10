# Task Identity and Pipeline

- Task: `dormitory-room-bed-assignment`
- Pipeline: `feature_development` + `bug_fix`
- Profile: Full; rules version `3.2.0`
- Repository: `D:\PROJECT\manager_points`; branch `main`; base commit `e83912a0c473ffe197d1be8e157da97614558937`; initial worktree clean.

# Risk Level

- Risk: medium; development environment.
- Evidence: coordinated frontend/backend behavior and concurrent MongoDB updates across room, bed, and registration collections. No schema migration, deployment, or production data mutation is included.
- Reversibility: source/test changes are Git-revertible; blast radius is limited to the dormitory module.

# Objective

Creating a room persists exactly its declared number of beds; each bed can be assigned to at most one student; the room table no longer offers “Mở trang phòng”; and valid room assignment completes without an unhandled 500 or partial persisted state.

# Scope Boundaries

- Approved: `frontend/src/app/(dashboard)/dormitory/**`, `frontend/src/api/dormitory-api.ts`, `frontend/src/api/dormitory-api.test.ts`, `backend/src/dormitory/**`.
- Write: room/building UI and focused tests; dormitory room/bed/assignment services and focused tests; API client only if the verified backend contract requires it.
- Known targets: `buildings/page.tsx::saveRoom` and room actions; `registrations/page.tsx::RoomAssignmentPopover`; `RoomsService.create/ensureRoomBeds/update`; `BedsService.autoCreateBeds`; `RoomAssignmentService.assignRoom`; their existing/new focused specs.

# Out of Scope

- Database/schema migrations, production data repair, deployment, unrelated KTX screens, contracts/invoices, and removal of the public QR room route. Only the management-table action “Mở trang phòng” is removed.

# Context and Dependencies

- `RoomsService.create()` already calls idempotent `ensureRoomBeds`; frontend must not call legacy auto-create again.
- Room updates currently do not reconcile `bed_count`; shrinking must never remove occupied beds.
- Assignment already atomically reserves a free bed, but exceptions during registration update or availability synchronization can return 500 after partial persistence.
- The failing production/dev payload and stack trace are unavailable; implementation must first reproduce a concrete failing branch with a regression test and preserve `{registration_id, room_id, bed_id}` unless evidence disproves the contract.

# Steps

1. Baseline the focused frontend/backend tests and capture the failing assignment request/log when available; otherwise encode the two verified failure branches as tests.
2. Keep room creation server-owned and idempotently provision `bed_count` uniquely coded beds; make the legacy auto-create path idempotent or retire its use. Define room-capacity update behavior: grow safely and reject shrinking below occupied/existing protected beds.
3. Make assignment atomic with a Mongo transaction when supported, or complete compensation/idempotency otherwise; map expected conflicts to actionable 4xx responses and keep room availability derived from persisted bed state.
4. Remove the “Mở trang phòng” action/import. Keep one explicit free `bed_id` per student assignment and show backend errors without optimistic row mutation.
5. Add regression/concurrency coverage, run affected checks, and review the final diff for unrelated changes.

# Acceptance Criteria

- AC1: Creating a room with `bed_count = N` yields exactly N unique beds and a matching derived available count; retries/legacy calls do not duplicate beds.
- AC2: Capacity growth is deterministic; an unsafe shrink is rejected without deleting occupied beds or corrupting counts.
- AC3: Two concurrent requests cannot assign one bed to two students or assign one registration twice.
- AC4: Any failed assignment leaves bed, registration, and room availability consistent; expected validation/conflict cases return a clear 4xx, not an unhandled 500.
- AC5: The room-management table has no “Mở trang phòng” action; edit/delete behavior and the public QR route remain unchanged.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/rooms.service.spec.ts dormitory/services/room-assignment.service.spec.ts` => creation, idempotency, capacity, rollback, and concurrency cases pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/registrations/page.test.tsx" "src/api/dormitory-api.test.ts" "src/app/(dashboard)/dormitory/buildings/page.test.tsx"` => room UI/API/assignment regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => TypeScript passes.
- Manual development check: create a room with multiple beds, assign distinct students until full, retry a conflict, and confirm no partial assignment or “Mở trang phòng” action.

# Safety Gates

- Gate: None for implementation and development verification.
- Any migration, persistent-data repair, deployment, or production mutation requires a separate scope and explicit approval. Resume only after that approval and a reviewed plan/rollback artifact.

# Artifacts and Checkpoints

- Base checkpoint: commit `e83912a0c473ffe197d1be8e157da97614558937` and clean initial status.
- Review artifacts: focused test output, final `git diff`, and—if obtainable—a redacted failing request/stack trace. Validate the final commit/status before completion; no intermediate artifact hashes are required unless execution becomes resumable.

# Execution Budgets

- One writer per path; serialize backend invariant changes before frontend contract alignment.
- Step deadline: 600 seconds (maximum 1,800); retries: 2; engineering loops: 3; review-remediation cycles: 2.
- Stop and amend scope for a schema migration, fourth material module/service, public API break, persistent-data repair, production effect, or security-sensitive expansion.
