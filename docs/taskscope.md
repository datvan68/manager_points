## Task Identity and Pipeline

Task: `fix-room-legacy-index-and-lock-formal-registration-fields` | Pipeline: `bug_fix` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `d5987579e09fe452cc2f5cbb8d7b099a8efe355c`

## Risk Level

Risk: high. The UI change is reversible, but repairing a MongoDB unique index mutates persistent data/schema state. The application is in development; the target database environment is not yet authorized.

## Objective

Allow multiple rooms with distinct `room_code` values to be created without the stale `ma_phong_1` null collision, and prevent edits to `full_name`, `student_code`, `room_type`, and `notes` on class-student (`FORMAL`) registrations.

## Scope Boundaries

Approved: `backend/scripts/**`, `backend/package.json`, `backend/src/dormitory/**`, `frontend/src/components/dormitory/**`, and an explicitly approved non-production MongoDB `rooms` collection.

Write targets: `backend/scripts/repair-dormitory-room-index.ts` (new), `backend/package.json`, `backend/src/dormitory/room-index-repair.spec.ts` (new), `frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx`, and `frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx`.

## Out of Scope

Production execution; room/document renaming outside the targeted index; changing registration DTO/service allowlists; editing Student identity records; changing editable fields for `PUBLIC` or `ADMIN_TEMPORARY` registrations; dependencies or unrelated UI redesign.

## Context and Dependencies

`Room` now persists unique `room_code`; no current schema field uses `ma_phong`. The reported `ma_phong_1 dup { ma_phong: null }` therefore identifies a stale legacy unique index. The existing broad naming migration recognizes `ma_phong -> room_code`, but rerunning it would touch unrelated dormitory collections. For `FORMAL` registrations, backend `RegistrationsService.update` intentionally rejects the four reported top-level fields; the shared modal already renders identity read-only but still enables room type and notes.

## Steps

1. Add a rooms-only, dry-run-by-default index repair that inventories index definitions, detects `ma_phong` legacy keys and canonical-index conflicts, checks `room_code` missing/duplicate values, and refuses writes on unsafe findings or production connections.
2. On `--execute`, drop only verified legacy room indexes and ensure one canonical unique `room_code` index without recreating an equivalent conflicting index; emit before/after evidence and remain idempotent.
3. Add package scripts and focused tests for stale-only, stale-plus-canonical, collision, no-op, and repeated-run plans.
4. In the shared edit modal, render all four fields read-only/disabled for normalized `FORMAL` sources and omit them from the formal update payload; retain current editing/payload behavior for `PUBLIC` and `ADMIN_TEMPORARY`.
5. Extend modal tests for source-aware control state and payload exclusion, then review the final diff/status.
6. After the dry-run artifact is reviewed and the Human Gate is approved, execute against the named non-production database and verify the resulting indexes and two distinct room creations.

## Acceptance Criteria

- AC1: Dry-run reports `ma_phong_1`, the intended action, canonical-index state, and room-code collisions/missing values without mutation.
- AC2: Unsafe data or unexpected index definitions abort execution before any drop/create action.
- AC3: Approved execution removes every `ma_phong`-keyed room index, leaves exactly one unique canonical `room_code` index, and a repeated run is a no-op.
- AC4: Two rooms with different non-empty `room_code` values can be created consecutively; duplicate `room_code` remains rejected.
- AC5: For `FORMAL`, Họ và tên, Mã SV, Loại phòng, and Ghi chú cannot be changed and are absent from the update payload; other currently allowed fields still submit.
- AC6: `PUBLIC` and `ADMIN_TEMPORARY` retain editable versions of those four fields and existing payload shapes.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/room-index-repair.spec.ts dormitory/services/rooms.service.spec.ts dormitory/schemas/room.schema.spec.ts` => repair planning and room regressions pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/components/dormitory/DormitoryRegistrationEditModal.test.tsx" "src/components/students/StudentDormitoryCard.test.tsx"` => source-aware edit and caller regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend type-check passes.
- Approved non-production backend :: `npm run migration:dormitory-room-index:dry-run` => reviewed plan has no unsafe findings; after approval, `npm run migration:dormitory-room-index:execute` => post-report satisfies AC3, followed by the AC4 API check.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

## Safety Gates

Human approval is required immediately before `migration:dormitory-room-index:execute`. Provide the named environment, before-index snapshot, dry-run report, collision counts, expected drop/create operations, backup/restore readiness, and rollback procedure (restore the captured index definitions if post-verification fails). Resume at Step 6 only after approval. Production remains blocked by scope.

## Artifacts and Checkpoints

Record the base commit, dry-run output, redacted database/collection identity, before/after index snapshots, collision counts, focused test output, and final diff. Hash the dry-run and pre-execution index snapshot at the gate checkpoint.

## Execution Budgets

One writer per path; one database executor; up to 3 engineering iterations, 2 idempotent command retries, and 2 review-remediation cycles. Stop on dirty-path overlap, unexpected indexes/data, production targeting, failed verification, boundary expansion, or missing gate approval.
