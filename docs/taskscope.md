# Task Identity and Pipeline

Task: `harden-public-registration-index-repair-concurrency` | Pipeline: `bug_fix` | Profile: Full | Rules: Fast and Accurate Coding Instructions v3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `7595908516abbd7d09cde55890cae70d1617c1c4` | Planning state: taskscope only; implementation and database execution are not authorized by this request.

# Risk Level

Risk: high. The existing repair can drop a MongoDB index and reports completion from index/data snapshots. A stale name-based drop could remove an unrelated concurrently replaced index, while a stale final data summary could miss an unsafe registration-code change. Repository edits are reversible; any database execution is a separately gated persistent schema mutation.

# Objective

Make the public-registration index repair fail closed under index/data changes: it must never drop an index based on a stale name, and it must validate a fresh post-repair registration-code summary before reporting `completed`.

# Scope Boundaries

Approved/read: the committed repair script, focused repair tests, package commands, public-registration schema/creation paths, and existing MongoDB migration conventions.

Write:

- `backend/scripts/repair-public-registration-code-index.ts`
- `backend/src/dormitory/public-registration-code-index-repair.spec.ts`

Additional implementation paths require a scope amendment. `docs/taskscope.md` is the planning artifact only.

# Out of Scope

Changing registration DTOs, schemas, services, UI, API responses, code generation, package commands, or the general naming migration; adding locks or new collections; repairing/backfilling/deleting documents; deployment; and executing the repair against any database under this request.

# Context and Dependencies

- Commit `75959085` already provides dry-run/execute commands, data/index classification, canonical-index-first ordering, environment guards, restore commands, and focused tests.
- `runMigration` captures the initial `plan.legacyIndexes`, later re-reads indexes, but drops using names from the initial plan. A concurrent replacement under the same name can therefore make the mutation target stale.
- Post-repair `buildRepairPlan(after, data, 'execute')` reuses the initial data summary. Unsafe data introduced after the pre-drop check can be omitted from the completion decision.
- MongoDB index mutation and concurrent DDL cannot be treated as an atomic compare-and-swap unless the selected driver/server operation proves exact-key targeting. Unsupported or ambiguous targeting must fail closed; it must not fall back to a stale name-only drop.
- Do not log registration-code values or document contents.

# Steps

1. Capture the existing focused test baseline and preserve current dry-run, approval, production-detection, canonical-first, restore, and no-op behavior.
2. Introduce a pure index-signature/target validation helper covering name, exact key, uniqueness, and accepted options. Rebuild the actionable legacy target list from the latest index snapshot after canonical validation and the latest safe data check; reject additions, removals, replacements, or option changes relative to the reviewed plan.
3. Make each destructive drop target the verified exact legacy key identity rather than an index name from the initial snapshot. Use an exact-key-capable operation only when supported and unambiguous. If only name-based mutation is available, require proof that the current name still resolves to the approved exact signature immediately before mutation and document the remaining exclusive-DDL assumption; never drop an unrelated same-name index.
4. After all drops, re-read both indexes and the registration-code projection. Build the final plan from the fresh data summary, require one plain unique canonical index, no index containing `ma_dk_public`, and no unsafe data finding before returning `completed`.
5. Include the fresh post-repair data summary in the result/evidence without exposing code values. On final verification failure, exit unsuccessfully and retain the captured restore commands; do not automatically mutate documents or recreate indexes.
6. Add regression tests for a same-name/different-key replacement between snapshots, legacy signature/options changing before drop, a newly unsafe document at final verification, fresh post-data evidence on success, and preservation of existing success/no-op/failure behavior.
7. Run focused tests, backend build, no-target dry-run, diff check, and final scoped review. Database verification remains separately gated.

# Acceptance Criteria

- AC-01: A legacy index replaced by an unrelated index under the same name is never dropped; execution fails closed before that destructive call.
- AC-02: Any change to the planned legacy target's key, name, uniqueness, or accepted options between reviewed and actionable snapshots prevents the drop unless the latest exact signature is independently reviewed by the same execution plan.
- AC-03: The destructive operation targets the exact verified `{ ma_dk_public: 1 }` identity; unsupported or ambiguous exact targeting fails instead of falling back to a stale name-only mutation.
- AC-04: Canonical index creation/validation still completes before any legacy drop, and a canonical failure leaves legacy indexes untouched.
- AC-05: Completion uses a newly read post-repair data summary. A new legacy-only, both-field, missing/blank, or duplicate canonical state makes execution fail rather than report `completed`.
- AC-06: A successful result exposes fresh aggregate post-data evidence, exactly one valid canonical unique index, and no legacy-key index, without logging registration-code values.
- AC-07: Dry-run performs no writes; an already repaired safe state remains an idempotent no-op; environment and approval guards remain enforced.
- AC-08: Existing focused tests and backend build pass, with no application behavior, package command, schema, or registration document mutation change.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/public-registration-code-index-repair.spec.ts` => AC-01 through AC-08 pass, including sequenced snapshot/data-change regressions.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => script and test imports compile with the existing backend.
- `D:\PROJECT\manager_points\backend` :: remove `MONGO_URI` from the command environment, then run `npm run migration:dormitory-public-registration-index:dry-run` => exits successfully with no database reads/writes.
- Separately approved disposable non-production MongoDB :: dry-run, reviewed execute, repeat execute, exact index inspection, and focused insert assertions => AC-03 through AC-07 pass; this taskscope does not authorize that run.
- `D:\PROJECT\manager_points` :: `git diff --check -- backend/scripts/repair-public-registration-code-index.ts backend/src/dormitory/public-registration-code-index-repair.spec.ts docs/taskscope.md` plus scoped status/diff review => no unintended changes.

# Safety Gates

Gate 1 — Execution authority: this request authorizes only this taskscope update. A separate implementation request is required before script/test changes.

Gate 2 — Database index mutation: before any `--execute`, provide the exact environment, commit, reviewed dry-run, redacted current index definitions, pre-data counts, restore commands, concurrency/maintenance-window controls, expected impact, rollback procedure, and resume point. Obtain explicit approval for that exact target.

Gate 3 — Data remediation: stop if any unsafe document state is found. Backfill, rename, deduplication, or deletion requires a separate Full taskscope and explicit persistent-data approval.

Rollback: preserve the pre-change legacy definitions and restore commands. Any restore is a separately approved index mutation; never drop the canonical uniqueness constraint or mutate registration documents as an automatic rollback.

# Artifacts and Checkpoints

Implementation review requires the updated script/test diff, focused test/build/dry-run evidence, and independent persistence-safety review. Before a separately approved database run, capture target identity, base/current commit, timestamped redacted pre/post index snapshots, aggregate pre/post data summaries, restore commands, concurrency controls, and artifact hashes. Store no registration codes or personal data.

# Execution Budgets

Deadline per step: 600 seconds, maximum 1800 seconds. One writer per path. Dependency order: baseline -> signature/target hardening -> fresh post-data verification -> regression tests -> independent review -> final verification -> Human Gate -> optional database run. Idempotent retries: 0..2; engineering loop: 0..3; review remediation: 0..2. Stop on stale target identity, unsupported exact targeting, unsafe data, unexpected indexes, target ambiguity, production detection, approval absence, or post-check failure.
