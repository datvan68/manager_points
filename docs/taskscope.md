## Task Identity and Pipeline

Task: `fix-room-create-update-and-lock-formal-registration-fields` | Pipeline: `bug_fix` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `d5987579e09fe452cc2f5cbb8d7b099a8efe355c`

## Risk Level

Risk: high. The UI change is reversible, but repairing a MongoDB unique index mutates persistent data/schema state. The application is in development; the target database environment is not yet authorized.

## Objective

Allow rooms to be created and updated reliably—including validated room-code, building, capacity, and bed-code changes—without the stale `ma_phong_1` null collision, and prevent edits to `full_name`, `student_code`, `room_type`, and `notes` on class-student (`FORMAL`) registrations.

## Scope Boundaries

Approved: `backend/scripts/**`, `backend/package.json`, `backend/src/dormitory/**`, `frontend/src/api/dormitory-api.ts`, `frontend/src/api/dormitory-api.test.ts`, `frontend/src/app/(dashboard)/dormitory/buildings/**`, `frontend/src/components/dormitory/**`, and an explicitly approved non-production MongoDB `rooms` collection.

Write targets: `backend/scripts/repair-dormitory-room-index.ts`, `backend/package.json`, `backend/src/dormitory/room-index-repair.spec.ts`, `backend/src/dormitory/services/rooms.service.ts`, `backend/src/dormitory/services/rooms.service.spec.ts`, `frontend/src/api/dormitory-api.test.ts`, `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx`, `frontend/src/app/(dashboard)/dormitory/buildings/page.test.tsx`, `frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx`, and `frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx`.

## Out of Scope

Production execution; room/document renaming outside the targeted room update and index repair; changing registration DTO/service allowlists; editing Student identity records; changing editable fields for `PUBLIC` or `ADMIN_TEMPORARY` registrations; bed assignment/occupancy policy changes; dependencies or unrelated UI redesign.

## Context and Dependencies

`Room` now persists unique `room_code`; no current schema field uses `ma_phong`. The reported `ma_phong_1 dup { ma_phong: null }` therefore identifies a stale legacy unique index. The existing broad naming migration recognizes `ma_phong -> room_code`, but rerunning it would touch unrelated dormitory collections. The Buildings page already opens an edit dialog and calls `PATCH /dormitory/rooms/:id`; backend update logic also changes capacity and renames canonical bed codes when `room_code` changes. Current focused frontend tests do not exercise the edit interaction or request, and backend tests do not cover duplicate room codes, invalid target buildings, room-code/bed-code rename, or update rollback. For `FORMAL` registrations, backend `RegistrationsService.update` intentionally rejects the four reported top-level fields; the shared modal already renders identity read-only but still enables room type and notes.

## Steps

1. Add a rooms-only, dry-run-by-default index repair that inventories index definitions, detects `ma_phong` legacy keys and canonical-index conflicts, checks `room_code` missing/duplicate values, and refuses writes on unsafe findings or production connections.
2. On `--execute`, drop only verified legacy room indexes and ensure one canonical unique `room_code` index without recreating an equivalent conflicting index; emit before/after evidence and remain idempotent.
3. Add package scripts and focused tests for stale-only, stale-plus-canonical, collision, no-op, and repeated-run plans.
4. Verify and harden room update end to end: populate the edit dialog from the selected room, normalize the mutation payload, call the room `PATCH` endpoint once, refresh the list on success, preserve the dialog and show the backend error on failure, and prevent duplicate submissions while saving.
5. Add backend update guards and regression coverage for a missing room, normalized/duplicate `room_code`, nonexistent `building_id`, valid scalar changes, safe capacity growth/shrink, canonical bed-code rename, and rollback when bed synchronization fails. Preserve the existing rules that occupied or historical beds cannot be removed implicitly.
6. Add focused frontend tests for edit-form prefill, update request/payload, success refresh/close, validation, backend failure, and saving-state behavior.
7. In the shared registration edit modal, render all four fields read-only/disabled for normalized `FORMAL` sources and omit them from the formal update payload; retain current editing/payload behavior for `PUBLIC` and `ADMIN_TEMPORARY`.
8. Extend modal tests for source-aware control state and payload exclusion, then review the final diff/status.
9. After the dry-run artifact is reviewed and the Human Gate is approved, execute against the named non-production database and verify the resulting indexes, two distinct room creations, and one representative room update.

## Acceptance Criteria

- AC1: Dry-run reports `ma_phong_1`, the intended action, canonical-index state, and room-code collisions/missing values without mutation.
- AC2: Unsafe data or unexpected index definitions abort execution before any drop/create action.
- AC3: Approved execution removes every `ma_phong`-keyed room index, leaves exactly one unique canonical `room_code` index, and a repeated run is a no-op.
- AC4: Two rooms with different non-empty `room_code` values can be created consecutively; duplicate `room_code` remains rejected.
- AC5: Editing a room preloads its current values and submits one normalized `PATCH` request; success closes the dialog and refreshes displayed data, while failure keeps the dialog open and displays the returned error without a duplicate request.
- AC6: Room update rejects a duplicate normalized `room_code`, a missing room, and a nonexistent target building without partially changing the room or its beds.
- AC7: Valid room metadata updates persist; changing `room_code` renames every canonical bed code consistently, and capacity changes add/reactivate or retire only eligible beds while protecting occupied/history-bearing beds.
- AC8: A bed-synchronization failure restores the original room fields, capacity, bed codes, and eligible bed statuses.
- AC9: For `FORMAL`, Họ và tên, Mã SV, Loại phòng, and Ghi chú cannot be changed and are absent from the update payload; other currently allowed fields still submit.
- AC10: `PUBLIC` and `ADMIN_TEMPORARY` retain editable versions of those four fields and existing payload shapes.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/room-index-repair.spec.ts dormitory/services/rooms.service.spec.ts dormitory/schemas/room.schema.spec.ts` => repair planning plus room create/update, bed synchronization, validation, and rollback regressions pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/buildings/page.test.tsx" "src/api/dormitory-api.test.ts" "src/components/dormitory/DormitoryRegistrationEditModal.test.tsx" "src/components/students/StudentDormitoryCard.test.tsx"` => room edit interaction/API and source-aware registration regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend type-check passes.
- Approved non-production backend :: `npm run migration:dormitory-room-index:dry-run` => reviewed plan has no unsafe findings; after approval, `npm run migration:dormitory-room-index:execute` => post-report satisfies AC3, followed by the AC4 and AC5-AC8 API checks.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

## Safety Gates

Human approval is required immediately before `migration:dormitory-room-index:execute`. Provide the named environment, before-index snapshot, dry-run report, collision counts, expected drop/create operations, backup/restore readiness, and rollback procedure (restore the captured index definitions if post-verification fails). Resume at Step 6 only after approval. Production remains blocked by scope.

## Artifacts and Checkpoints

Record the base commit, dry-run output, redacted database/collection identity, before/after index snapshots, collision counts, focused room-update test output, representative before/after room-and-bed evidence, and final diff. Hash the dry-run and pre-execution index snapshot at the gate checkpoint.

## Execution Budgets

One writer per path; one database executor; up to 3 engineering iterations, 2 idempotent command retries, and 2 review-remediation cycles. Stop on dirty-path overlap, unexpected indexes/data, production targeting, failed verification, boundary expansion, or missing gate approval.
