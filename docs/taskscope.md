## Task Identity and Pipeline

Task: `stabilize-dormitory-room-and-registration-data-flow` | Pipeline: `bug_fix` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `d5987579e09fe452cc2f5cbb8d7b099a8efe355c`

## Risk Level

Risk: high. The work spans frontend and backend authorization, registration linking, room/bed synchronization, and a MongoDB index repair. Database index mutation and reconciliation of partially linked registrations affect persistent data and require an explicit Human Gate.

## Objective

Make room creation/update reliable and make dormitory-registration editing consistent for students with or without a student code, without silently changing semesters, bypassing locked fields through the API, creating duplicate identities, or leaving partially linked records.

## Scope Boundaries

Approved code boundary: `backend/scripts/**`, `backend/package.json`, `backend/src/dormitory/**`, `frontend/src/api/dormitory-api.ts`, `frontend/src/api/dormitory-api.test.ts`, `frontend/src/app/(dashboard)/dormitory/buildings/**`, `frontend/src/components/dormitory/**`, and `frontend/src/components/students/StudentDormitoryCard*`.

Approved documentation boundary: `docs/taskscope.md`.

Persistent-data boundary, gated: one explicitly named non-production MongoDB database, limited to the `rooms` indexes and dormitory registrations selected by a reviewed reconciliation report.

Expected targets include the room service and tests, a rooms-only index-repair script and tests, registration DTO/service/policy tests, public-registration linking service and tests, the Buildings page and tests, the shared registration edit modal and tests, and student dormitory card tests. Exact discovered paths inside the approved boundary may be added during implementation.

## Out of Scope

Production execution; deleting registrations; changing student master identities; changing bed assignment or occupancy policy beyond preserving current safety rules; redesigning unrelated dormitory screens; changing unrelated collections; dependency upgrades; deployment; or automatically guessing a student match when the code is missing, invalid, duplicated, or conflicts with existing data.

## Current Findings

1. The stale unique MongoDB index `ma_phong_1` treats missing legacy values as `null`, so creating a second room can fail even though the current model uses `room_code`.
2. Room update already crosses room and bed data. A room-code or capacity change can leave inconsistent bed codes/statuses unless validation, synchronization, and rollback are covered end to end.
3. Registration behavior is determined by normalized `source`, not simply by whether `student_code` is present. A `PUBLIC` registration with a code remains public and may be classified as `MISSING_CLASS`; a `FORMAL` registration without a code remains formal.
4. The UI locks `full_name`, `student_code`, `room_type`, and `notes` for `FORMAL`, but backend edit policies are not expressed from one canonical source. API callers may bypass UI restrictions or receive different behavior between staff and self-update routes.
5. Editing a public registration's `student_code` only stores text. It does not normalize and validate the code, distinguish not-found/conflict/pending states, link immediately, or return actionable feedback.
6. Opening the edit modal replaces the registration's stored `semester` and `academic_year` with the active semester, and the payload sends them even when unchanged. Editing an unrelated field can therefore move a historical registration silently.
7. Missing or unknown `source` values normalize to `FORMAL`, which can hide malformed data and apply the wrong lock/routing policy.
8. Public and formal records retain duplicated personal and registration fields after linking, allowing later divergence without a declared canonical owner.
9. Linking saves the formal record and then marks the public record as linked without a MongoDB transaction, so an interruption can leave partial state.
10. Auto-linking scans pending registrations and performs sequential per-record lookups and writes, producing an unbounded N+1 workload.
11. The modal refetches the active semester on each open and submits broad payloads containing unchanged values, increasing latency, race/overwrite risk, and failure coupling.

## Target Data Rules

- `FORMAL`: `full_name`, `student_code`, `room_type`, and `notes` are immutable through both staff and self-update APIs and are disabled/read-only in the UI. Other fields remain editable only when authorized by the canonical server policy.
- `PUBLIC` and `ADMIN_TEMPORARY`: the four fields remain editable unless an explicit link state makes one canonical elsewhere. Student codes are trimmed/normalized and validated before persistence.
- Student-code state is explicit: `MISSING`, `PENDING_VALIDATION`, `NOT_FOUND`, `CONFLICT`, `LINKABLE`, or `LINKED`; a non-empty string alone does not imply a valid student relationship.
- Historical `semester` and `academic_year` values remain unchanged unless the user explicitly edits an authorized semester control.
- Linking defines one canonical post-link record/field owner and is atomic. Retries are idempotent and cannot create a second formal registration.
- Unknown/malformed registration sources are reported as data errors; they are not silently treated as `FORMAL`.

## Implementation Steps

1. Establish focused regression tests for the reported room-create failure, room update behavior, source-aware registration editing, historical semester preservation, and the student-code state matrix.
2. Add a rooms-only, dry-run-by-default index repair that inventories definitions, detects all `ma_phong` legacy keys and canonical conflicts, checks missing/duplicate `room_code` values, rejects unsafe/production execution, and produces before/after evidence.
3. Under the database gate, drop only verified legacy room indexes and ensure exactly one canonical unique `room_code` index. Keep the operation idempotent and provide restoration commands from the captured definitions.
4. Harden room updates: normalize and validate `room_code` and `building_id`, prevent duplicate submissions, synchronize canonical bed codes and capacity safely, preserve occupied/history-bearing beds, and restore the original room/bed state if synchronization fails.
5. Centralize registration editability in one backend policy keyed by validated source/link state. Return allowed/editable fields to clients or apply an equivalent shared contract, and enforce it in staff and self-update endpoints.
6. Update the shared edit modal to render controls from that policy, exclude locked and unchanged fields, preserve stored semester/year by default, and avoid blocking an edit on an unnecessary active-semester request.
7. Validate an edited public/temporary `student_code`: normalize it, check student existence and conflicts, return an explicit state/message, and invoke linking only when the match is unambiguous and policy-authorized.
8. Make linking transactional across formal creation/update and public link markers. Add a unique/idempotency guard and define recovery for pre-existing partial links.
9. Replace unbounded sequential auto-linking with cursor/batch processing, indexed normalized lookup keys, batched reads, and bounded writes. Record counts for linked, skipped, not found, conflicts, and failures.
10. Add a dry-run reconciliation report for existing malformed sources, invalid codes, duplicate candidates, divergent linked records, and partial links. Do not mutate these records without the persistent-data Human Gate.
11. Run focused tests, affected package builds/type checks, review the final diff/status, then perform only the approved non-production database verification.

## Acceptance Criteria

- AC1: Dry-run identifies `ma_phong_1`, canonical index state, missing/duplicate room codes, and planned actions without mutation; unexpected definitions or unsafe data abort execution.
- AC2: Approved execution leaves exactly one unique `room_code` index, removes verified `ma_phong` indexes, and a repeated run is a no-op.
- AC3: Two rooms with distinct non-empty codes can be created consecutively; a duplicate normalized code is rejected.
- AC4: Room editing preloads current values, sends one normalized request, refreshes/closes on success, stays open with the backend error on failure, and cannot double-submit.
- AC5: Valid room metadata/code/capacity updates keep room and bed data consistent; invalid building/code/capacity changes and synchronization failures cause no partial mutation.
- AC6: For `FORMAL`, the four protected fields cannot be changed through UI, staff API, or self API and are absent from the effective update operation.
- AC7: `PUBLIC` and `ADMIN_TEMPORARY` retain authorized editing, but a changed student code is normalized and receives an explicit validation/link state rather than being treated as linked by presence alone.
- AC8: Editing any unrelated registration field does not change `semester` or `academic_year`; only an explicit authorized semester edit can do so.
- AC9: Missing/unknown `source` is surfaced as invalid data and cannot silently acquire formal permissions or routing.
- AC10: A successful link is atomic and idempotent, has one declared canonical data owner, and cannot leave only one side updated. Injected mid-link failure rolls back all writes.
- AC11: Batch auto-linking is bounded, uses indexed/batched lookups, reports outcome counts, and produces the same result on retry without duplicates.
- AC12: Reconciliation dry-run reports malformed, invalid, conflicting, divergent, and partial-link records; no reconciliation write occurs without explicit approval.

## Verification

- `D:\PROJECT\manager_points\backend` :: focused Jest tests for room index repair, room service update/rollback, registration update policy, student-code validation, and transactional/idempotent linking => all pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles.
- `D:\PROJECT\manager_points\frontend` :: focused tests for Buildings room editing, dormitory API payloads, registration modal source/dirty-field/semester behavior, and student dormitory card behavior => all pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend type-check passes.
- Named non-production backend :: room-index and registration-reconciliation dry-runs => reviewed reports contain no unhandled unsafe findings.
- After Human Gate approval only: execute the named index repair/reconciliation plan, inspect before/after snapshots, create two distinct rooms, update one representative room, and retry one representative registration link => AC2-AC5 and AC10 hold.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

## Safety Gates

Human approval is required immediately before any index mutation or registration reconciliation write. The gate package must name the non-production environment and database, include redacted before snapshots, dry-run reports and counts, exact operations, transaction/backup readiness, rollback/recovery procedure, and expected post-checks. Production remains outside scope.

## Artifacts and Checkpoints

Record the base commit, focused baseline failures, dry-run outputs, redacted database identity, before/after index snapshots, reconciliation state counts, representative room/bed and link evidence, verification output, and final diff. Hash the approved dry-run reports and before snapshots at the database gate.

## Execution Budgets

One writer per path and one database executor. Allow up to four engineering iterations, two idempotent command retries, and two review-remediation cycles. Stop on dirty-path overlap, unknown database target, unexpected data/index definitions, production targeting, inability to use transactions where required, boundary expansion, failed verification, or missing gate approval.
