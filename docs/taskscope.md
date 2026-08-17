# Task Identity and Pipeline

Task: `repair-public-registration-code-legacy-index` | Pipeline: `bug_fix` | Profile: Full | Rules: Fast and Accurate Coding Instructions v3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `f2d05d8b884d9703d22eca1dc346648778c07a56` | Planning state: taskscope only; implementation and database execution are not authorized by this request.

# Risk Level

Risk: high. The application now writes `public_registration_code`, while an existing MongoDB unique index may still target legacy field `ma_dk_public`. Repair changes persistent database indexes and can affect all public/admin KTX registrations. The code artifact is reversible from a captured index definition; running it against any database requires the applicable Human Gate.

# Objective

Provide an idempotent, fail-closed index repair that removes the verified stale `ma_dk_public` unique index only after canonical registration-code data and the canonical unique index are safe, so multiple new KTX member registrations can be saved without `E11000 ... ma_dk_public: null` while registration-code uniqueness remains enforced.

# Scope Boundaries

Approved/read: public-registration schema and creation paths, dormitory naming migration, existing index-repair conventions, backend scripts/tests/package commands, and MongoDB index metadata for an explicitly approved target environment.

Write:

- new `backend/scripts/repair-public-registration-code-index.ts`
- new `backend/src/dormitory/public-registration-code-index-repair.spec.ts`
- `backend/package.json`

Additional implementation paths require a scope amendment if they change application behavior, registration payloads, data fields, or migration ownership.

# Out of Scope

Changing registration DTOs/UI/API responses; suppressing or broadly catching `E11000`; changing code generation; deleting registrations; automatically renaming/backfilling document fields; resolving duplicate or missing canonical codes; running the general dormitory naming migration; deployment; and executing against development, staging, or production data under this planning request.

# Context and Dependencies

- `PublicRegistrationSchema` requires unique `public_registration_code`.
- Both admin temporary registration and public QR registration generate and save `public_registration_code`.
- The reported error names index `ma_dk_public_1` and key `{ ma_dk_public: null }`, proving the failing database index still keys the removed legacy field rather than the value currently written by the application.
- MongoDB unique single-field indexes index a missing field as `null`; the second new canonical-only document therefore collides.
- Mongoose schema/index declaration does not reliably remove obsolete database indexes. Existing `migrate-dormitory-naming.ts` can transform indexes when executed, but deployment state shows this legacy index was not removed/transformed in the affected database.
- Follow the repository's dry-run-first, non-production guard, explicit approval variable, restore-command capture, and post-repair verification conventions.

# Steps

1. Implement a dedicated script with pure planning helpers and a database runner for collection `publicregistrations`. Default to dry-run; `--execute` is the only mutation mode.
2. Read index definitions and classify by index key, not name: exact legacy `{ ma_dk_public: 1 }`, exact canonical `{ public_registration_code: 1 }`, and unexpected compound/options conflicts. Never drop an index solely because its name matches.
3. Inspect only code-field projections and report counts without logging code values or document contents: total documents, legacy-only, canonical-only, both-fields, missing/blank canonical values, and duplicate canonical groups.
4. Fail closed before writes if any document is legacy-only, contains both fields, lacks a nonblank canonical code, has a duplicate canonical code, or if legacy/canonical index definitions are unexpected. Direct operators to the separately gated naming/data-reconciliation workflow; do not repair documents in this task.
5. Require exactly one valid unique canonical index. If absent and data is safe, create `{ public_registration_code: 1 }` with a stable canonical name and `unique: true` before dropping any legacy index. If a valid canonical index already exists under any name, reuse it.
6. Drop only verified exact single-field legacy indexes after canonical index creation/validation succeeds. Capture executable restore commands from the complete pre-change legacy index definitions before mutation.
7. Re-read indexes after execution and fail verification unless one valid canonical unique index remains and no legacy-key index remains. A repeated execute on the repaired state must return `no-op` without writes.
8. Add package scripts for dry-run and execute. Block execute without `MONGO_URI`, on a detected production connection, or unless `DORMITORY_MIGRATION_APPROVED=YES`; always disconnect cleanly.
9. Add focused tests for the reported stale-index state, dry-run no-write behavior, canonical-first ordering, unsafe data/index blocking, create failure preserving the legacy index, exact-key protection, restore commands, post-check failure, and idempotent repeat.
10. Run focused tests, backend build, script dry-run without a database, and scoped diff/status review. Database execution remains a separate gated operation.

# Acceptance Criteria

- AC-01: Dry-run identifies `{ ma_dk_public: 1 }` as stale regardless of index name and performs no create/drop calls.
- AC-02: The plan blocks all writes when canonical codes are missing/blank/duplicate, legacy document fields remain, both legacy and canonical fields coexist, or index definitions/options are unsafe.
- AC-03: On a safe collection without the canonical index, execute creates and verifies the canonical unique index before dropping the verified legacy index.
- AC-04: If canonical index creation or validation fails, the legacy index is not dropped and the command exits unsuccessfully.
- AC-05: An existing valid unique `{ public_registration_code: 1 }` index is reused; after repair no `{ ma_dk_public: 1 }` index remains.
- AC-06: Repeated execute after successful repair is a no-op and never weakens canonical code uniqueness.
- AC-07: The script never logs registration-code values or mutates/deletes registration documents.
- AC-08: Execute is blocked without an explicit non-production target and approval flag; dry-run and restore evidence are available before approval.
- AC-09: In a disposable database matching the reported state, two distinct new public/admin registrations can be saved after repair without the legacy-null duplicate error, while duplicate `public_registration_code` is still rejected.
- AC-10: Existing registration creation behavior and the general dormitory naming migration remain unchanged.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/public-registration-code-index-repair.spec.ts` => AC-01 through AC-08 and AC-10 pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => the repair script and existing backend compile.
- `D:\PROJECT\manager_points\backend` :: `npm run migration:dormitory-public-registration-index:dry-run` with no `MONGO_URI` => exits without database reads/writes and explains that no target was supplied.
- Separately approved disposable non-production MongoDB :: dry-run, reviewed execute, repeated execute, then focused insert/index assertions => AC-03 through AC-09 pass; no raw registration codes are captured in artifacts.
- `D:\PROJECT\manager_points` :: `git diff --check -- backend/scripts/repair-public-registration-code-index.ts backend/src/dormitory/public-registration-code-index-repair.spec.ts backend/package.json` and scoped status/diff review => no unintended changes.

# Safety Gates

Gate 1 — Execution authority: this request authorizes taskscope creation only. A separate implementation request is required before repository code changes.

Gate 2 — Database index mutation: before `--execute`, provide the exact environment, dry-run report, redacted pre-change index definitions, data-safety counts, restore commands, expected impact, and resume point. Obtain explicit approval for that target. Production remains blocked by the script and requires a separately approved production procedure/change.

Gate 3 — Data remediation: if legacy-only/both-field/missing/duplicate documents are found, stop. Backfill, rename, deduplication, deletion, or general naming migration requires a separate taskscope, rollback plan, and explicit persistent-data approval.

Rollback: recreate only the captured legacy index definition if operational rollback is approved and canonical data/index remain intact; do not drop the canonical uniqueness constraint as part of rollback. Resume after approval at Step 5 using the reviewed dry-run artifact.

# Artifacts and Checkpoints

Required for implementation review: taskscope, focused test/build evidence, scoped diff, and independent persistence-safety review. Required before database execution: target identity, timestamped/redacted dry-run report, pre-index snapshot, data count summary, restore commands, base/current commit, and artifact hashes. Do not store registration codes or personal data.

# Execution Budgets

Deadline per step: 600 seconds, maximum 1800 seconds. One writer per path. Dependency order: script planning helpers -> focused tests -> package commands -> independent review -> final verification -> Human Gate -> optional database execute/post-check. Idempotent retries: 0..2; engineering loop: 0..3; review remediation: 0..2. Stop on unsafe data, unexpected indexes, target ambiguity, production detection, approval absence, or post-check failure.
