## Task Identity and Pipeline

- Task: `migrate-attendance-session-owner-index-completion`
- Pipeline: `bug_fix`
- Profile: Full
- Rule version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base state: branch `main`, commit `5a20490e2e1d4fd77891527fab3f117946d1aa44`.
- Authority: planning-only. This scope does not authorize implementation, a migration dry-run against a database, `--execute`, database mutation, commit, push, or deployment.

## Risk Level

- Risk: high because the script manages unique partial MongoDB indexes and a wrong candidate match or drop can change persistent-data constraints.
- Environment: local development and database-free mocked verification only.
- Reversibility: source/test edits are Git-reversible; an applied index drop/create is not authorized here and requires a separate Human Gate.
- Blast radius: active attendance-session uniqueness for manual and QR/GPS (`qr`/`proximity`) sessions.

## Objective

Make `migrate-attendance-session-owner-index.ts` deterministically inspect, plan, create/retain, and fully verify both owner-scoped unique indexes, while allowing removal of only each exact corresponding legacy index and exposing the complete behavior through database-free regression tests and dry-run report assertions.

## Scope Boundaries

### Approved Boundary

- Attendance-session owner-index migration logic, its regression coverage, and this planning artifact.
- Read-only reference to the attendance-session schema, service behavior, Git history, and backend test/tool configuration.

### Write Boundary

- `backend/scripts/migrate-attendance-session-owner-index.ts`
- `backend/src/attendance-sessions/migrate-attendance-session-owner-index.spec.ts` (new)
- `docs/taskscope.md`

### Known Index Targets

| Lane | Exact legacy definition | Exact owner-scoped definition |
| --- | --- | --- |
| Manual | name `context_id_1_schedule_id_1_class_id_1`; key `{ context_id: 1, schedule_id: 1, class_id: 1 }`; unique; partial `{ status: 'active', method: 'manual_class' }` | name `manual_active_session_per_owner`; same key plus `opened_by: 1`; same unique partial options |
| QR/GPS | name `context_id_1_schedule_id_1`; key `{ context_id: 1, schedule_id: 1 }`; unique; partial `{ status: 'active', method: { $in: ['qr', 'proximity'] } }` | name `qr_proximity_active_session_per_owner`; same key plus `opened_by: 1`; same unique partial options |

For all four definitions, approved options additionally require no collation, sparse flag, hidden flag, or TTL.

## Out of Scope

- Running either `migration:attendance-session-owner-index:dry-run` or `migration:attendance-session-owner-index:execute`.
- Connecting to, reading from, or mutating any local, test, staging, or production database.
- Repairing duplicate/ownerless attendance records, changing schema declarations or service behavior, renaming `proximity`, or altering unrelated indexes.
- Package/dependency changes, deployment, rollback execution, or production validation.

## Context and Dependencies

- The current script handles only the manual legacy/owner pair and only manual duplicate and missing-owner records.
- The schema already declares the desired QR/GPS owner index `qr_proximity_active_session_per_owner`.
- Git history establishes the corresponding unnamed-schema legacy QR/GPS index as MongoDB's generated name `context_id_1_schedule_id_1`.
- QR/GPS application lookup already includes `opened_by`; the migration must align the stored uniqueness constraint with that behavior.
- Current post-verification is insufficient: it accepts the manual replacement by name alone and treats every remaining legacy-key index as equivalent.
- The normal dry-run connects to MongoDB. Tests must invoke exported/injected logic with mocked collection/client behavior and prevent CLI `main` from running on import.

## Steps

1. `code-agent` captures the current report shape and extracts or exposes testable migration orchestration without changing CLI defaults, environment-label validation, URI sanitization, or secret handling.
2. `code-agent` models manual and QR/GPS as separate exact index specifications containing legacy name/key/options, replacement name/key/options, active filter, and owner-scoped duplicate grouping fields.
3. `code-agent` extends preflight inspection to classify candidates for both lanes, report duplicate groups and missing `opened_by` records per lane, and set readiness false before any write when data conflicts, duplicate candidates, reserved-name collisions, or definition mismatches exist.
4. `code-agent` makes dry-run JSON expose both lanes, their exact old/new definitions, readiness/blockers, and ordered retain/create/drop/no-op operations without performing index writes.
5. `code-agent` makes execute-mode logic create or retain each exact owner index, then drop only the exact approved corresponding legacy name whose key and complete options also match. Lookalike indexes must never be dropped.
6. `code-agent` strengthens post-verification to compare full name, ordered key, uniqueness, partial filter, and disallowed options for both replacements; verify only the exact approved legacy definitions are absent; and accurately report installed/retained and removed names.
7. `test-agent` adds mocked regression cases for dry-run output, both create/retain paths, each exact legacy drop, absent legacy indexes, lookalike/reserved-name blockers, duplicate groups, missing owners, no-write-on-blocker, and post-verification failure. Tests must assert that no real `MongoClient.connect` or database operation occurs.
8. `review-agent` independently reviews candidate classification, operation ordering, exact-drop safety, idempotency, report accuracy, secret redaction, failure-before-write behavior, and full-definition post-verification.
9. The orchestrator runs only database-free checks, inspects the final diff/status, and maps results to every acceptance criterion.

## Acceptance Criteria

- `AC-01`: The script recognizes the exact manual and QR/GPS legacy and owner-scoped definitions listed in this scope.
- `AC-02`: Mocked dry-run output contains separate manual and QR/GPS candidates, conflicts, blockers, readiness, exact definitions, and planned operations.
- `AC-03`: With clean mocked state, execute-mode logic creates each missing owner index or retains its exact approved instance before considering its matching legacy drop.
- `AC-04`: A legacy index is droppable only when its name, ordered key, uniqueness, partial filter, and remaining approved options exactly match its lane; wrong-name, wrong-key, wrong-option, and reserved-name lookalikes are preserved and block writes.
- `AC-05`: Duplicate owner-scoped active groups or active records without `opened_by` in either lane stop the run before every `createIndex` or `dropIndex`.
- `AC-06`: Post-verification accepts both replacements only when their complete definitions match, rejects incomplete/mismatched results, and verifies absence only of the exact approved legacy definitions.
- `AC-07`: Completion output accurately distinguishes created/retained owner indexes and removed legacy indexes for both lanes, including idempotent no-op cases.
- `AC-08`: Focused tests and static checks pass without loading runtime secrets, opening a MongoDB connection, or executing a migration against any database.

## Verification

- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand migrate-attendance-session-owner-index`
  - Expected: all mocked planning, safety, execution-order, exact-drop, and post-verification regressions pass; no real database connection is attempted.
- `D:\PROJECT\manager_points\backend :: npx eslint scripts/migrate-attendance-session-owner-index.ts src/attendance-sessions/migrate-attendance-session-owner-index.spec.ts`
  - Expected: no lint errors and no source mutation.
- `D:\PROJECT\manager_points\backend :: npx tsc --noEmit --incremental false`
  - Expected: the script, regression test, and affected backend TypeScript compile without errors.
- `D:\PROJECT\manager_points\backend :: npx ts-node scripts/migrate-attendance-session-owner-index.ts --help`
  - Expected: help documents both index lanes and exits before `.env` loading or MongoDB connection.
- `D:\PROJECT\manager_points :: git diff --check`
  - Expected: no whitespace errors.
- `D:\PROJECT\manager_points :: git status --short` and `git diff --stat`
  - Expected: only the three write-boundary paths are changed.
- Forbidden verification: every `npm run migration:attendance-session-owner-index:*` command and every direct script invocation other than `--help`.

## Safety Gates

- No Human Gate is required to implement and run the database-free checks within the write boundary.
- Any real dry-run requires new explicit authority to connect to the named database environment.
- Any `--execute`, index create/drop, persistent-data repair, staging/production action, or rollback requires a separate Human Gate stating target environment, impact, reviewed dry-run artifact, rollback procedure, and exact resume point.
- On any unexpected candidate, ownerless/duplicate record, partial write, schema mismatch, or ambiguous legacy identity, stop without dropping an index.

## Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`.
- Discovery baseline: branch/base commit above, current script/schema definitions, and sanitized read-only findings; no database snapshot or credentials.
- Implementation checkpoint: scoped diff, focused test/static-check summaries, current commit ID, and hashes of retained review artifacts before independent review.
- Review checkpoint: acceptance-to-test mapping plus review findings before final verification.
- Final evidence: final diff/status, exact commands run, database-connection mock assertions, and unresolved risks.

## Execution Budgets

- One writer per path; implementation, test completion, and independent review are sequential where paths overlap.
- Maximum concurrent workers: 3, with no concurrent writes to the same file.
- Maximum idempotent retries: 2.
- Maximum implementation/verification loops: 3.
- Maximum review-remediation cycles: 2.
- Default step deadline: 600 seconds; maximum step deadline: 1800 seconds.
- Stop on write-boundary expansion, a new dependency, database access, stale/conflicting worktree state, failed required verification, or a new Human Gate.
