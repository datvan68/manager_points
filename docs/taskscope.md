# Task Identity and Pipeline

- Task: `fix-registration-edit-room-display-live-assignment-and-bed-regrowth`
- Pipeline: `bug_fix`; Profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; base commit: `4fe355b02a5add51d3d188a626271fdbca512edf`; initial worktree: clean.

# Risk Level

- Risk: high. The fix crosses frontend/backend boundaries and changes persisted registration assignment and room-capacity behavior.
- Source changes are Git-revertible. No database migration, deployment, or production mutation is authorized.

# Objective

Temporary registrations can be edited without a `preference` field error; the registrations table consistently shows the room name and updates assignment state in place without a white flash; and a room whose capacity was reduced can later be increased while preserving valid bed identities and occupancy.

# Scope Boundaries

- Backend registration contract, enrichment, and tests: `backend/src/dormitory/dto/update-registration.dto.ts`, `backend/src/dormitory/services/registrations.service.ts`, `backend/src/dormitory/services/registrations.service.spec.ts`.
- Backend capacity reconciliation and tests: `backend/src/dormitory/services/rooms.service.ts`, `backend/src/dormitory/services/rooms.service.spec.ts`.
- Frontend registrations state/payload/display and tests: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `page.test.tsx`, `frontend/src/api/dormitory-api.ts`, and `dormitory-api.test.ts` only if the API contract changes.
- Buildings UI tests may be updated only to cover the existing room edit flow; no visual redesign is included.

# Out of Scope

- Schema/index migration, manual data repair, deployment, unrelated dormitory tabs, redesign of registrations/buildings, deletion of occupied or historical beds, and changes to contract transfer/cancellation behavior.

# Context and Dependencies

- Formal edits own nested `preference`; public/admin-temporary records own flat `room_type` and `notes`. Backend source validation currently rejects `preference` for temporary records, so client serialization and server normalization must agree and remain backward-compatible where safe.
- Formal rows already derive `assigned_room_name` from populated registration/active-contract rooms. Public rows fall back to stored `room_code`; their `room_id` must be enriched to obtain the current `room_name`.
- Assignment uses a local row patch, but unassign currently supplies the released bed to the same patch shape, which can leave `bed_id` truthy. Assignment results must distinguish an assigned bed from release metadata and must not trigger list-level loading.
- Capacity reduction retires eligible free, history-free beds. Growth counts those beds as inactive but also reserves their canonical suffixes, so it can create later suffixes and then fail the exact `ROOM-G1..Gn` postcondition. Reconciliation must reactivate eligible canonical retired beds before inserting new ones.

# Steps

1. Add regression baselines for temporary-edit payload validation, room-name enrichment, immediate assign/unassign row transitions, and reduce-then-grow capacity.
2. Align registration update serialization and source-aware backend normalization so temporary edits persist flat fields and unsupported fields still fail clearly.
3. Enrich public/admin-temporary rows from their referenced room and expose `assigned_room_name` as the room name, using the room code only as a missing-name fallback.
4. Make assign/unassign UI updates atomic and explicit: patch only the affected row, clear both `room_id` and `bed_id` on unassign, retain released-bed data only for availability handling, and keep existing rows rendered during any background reconciliation.
5. Reconcile room growth by reactivating the required eligible canonical retired beds first, then creating only genuinely missing canonical beds; preserve occupied, maintenance, historical, and unrelated custom beds and compensate partial failure.
6. Run focused tests, affected builds/type checks, and final diff/status review.

# Acceptance Criteria

- AC1: Editing an `ADMIN_TEMPORARY` registration succeeds without sending or rejecting `preference`; `room_type` and `notes` persist correctly. Formal nested-preference editing remains valid.
- AC2: The `PHÒNG` column and export use `room_name` for formal, public, and admin-temporary assignments; `room_code` is only a fallback when the name is absent.
- AC3: Successful assign/reassign updates the affected row immediately without clearing or replacing the table, and shows the selected room name.
- AC4: Successful unassign immediately clears `room_id`, `bed_id`, and the displayed room from the affected row; the released bed is not treated as still assigned, and no white loading frame appears.
- AC5: Background refresh, stale response, or API failure cannot overwrite a newer assignment state; failure retains the prior row and shows an actionable error.
- AC6: Reducing a room from `N` to `M` and increasing it back to `N` succeeds with exactly canonical active beds `ROOM-G1..ROOM-GN`, preferring safe reactivation over insertion.
- AC7: Growth is idempotent and never changes occupied, maintenance, historical, or unrelated-room beds; a partial failure restores the previous capacity/status state.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/registrations.service.spec.ts dormitory/services/rooms.service.spec.ts` => AC1, AC2, AC6, and AC7 pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/registrations/page.test.tsx" "src/app/(dashboard)/dormitory/buildings/page.test.tsx" src/api/dormitory-api.test.ts` => AC1-AC5 and the room-edit regression pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => assignment/result and registration types compile.
- Repository root :: `git diff --check` and `git status --short` => only scoped changes exist.

# Safety Gates

- None for scoped source implementation and development verification.
- Any database migration/data repair or deployment discovered during implementation requires a separate taskscope amendment and explicit approval before execution.

# Artifacts and Checkpoints

- Record focused test/build/typecheck results and final diff/status. Checkpoint after backend behavior/tests before frontend integration.
- Stop for a required schema migration, occupied/historical-bed mutation, contract behavior change, or non-isolatable concurrency/rollback defect.

# Execution Budgets

- Order: regression baseline -> backend fixes/tests -> frontend fixes/tests -> affected verification -> independent review.
- One writer per path; step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
