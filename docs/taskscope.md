# Task Identity and Pipeline

Task: `repair-formal-registration-code-legacy-index` | Pipeline: `bug_fix` | Profile: Full | Rules: Fast and Accurate Coding Instructions v3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `1a13955f03a6b88ff4c02c6c977c7877ced32d76` | Planning state: taskscope only; implementation and database execution are not authorized by this request.

# Risk Level

Risk: high. The application writes formal KTX registrations to MongoDB collection `registrations`, while the reported database retains legacy unique index `ma_dk_1`. Repairing a database index is a persistent schema mutation affecting direct registration creation and public-to-formal linking. Repository changes are reversible; any database execute requires a separate Human Gate.

# Objective

Provide one fail-closed, target-aware registration-code index repair that safely removes verified stale `{ ma_dk: 1 }` indexes from `registrations`, preserves unique `{ registration_code: 1 }`, and retains the hardened behavior already used for `publicregistrations`, so distinct formal KTX registrations no longer collide on `{ ma_dk: null }`.

# Scope Boundaries

Approved/read: formal/public registration schemas and creation paths, the committed public-registration index repair and tests, dormitory field mapping/naming migration, backend package scripts, and redacted MongoDB index metadata for an explicitly approved target.

Write:

- `backend/scripts/repair-public-registration-code-index.ts`
- `backend/src/dormitory/public-registration-code-index-repair.spec.ts`
- `backend/package.json`

Additional implementation paths require a scope amendment. `docs/taskscope.md` is the planning artifact only.

# Out of Scope

Changing registration schemas, DTOs, services, linking behavior, UI/API responses, or code generation; catching/suppressing `E11000`; mutating/deleting/backfilling registration documents; changing the partial unique `student_id` index; running the general naming migration; deployment; and executing against any database under this request.

# Context and Dependencies

- `RegistrationSchema` requires unique `registration_code`; `RegistrationsService.create` and `PublicRegistrationLinkService.newFormalRegistration` both generate that canonical value before saving.
- The reported `registrations` error names index `ma_dk_1` and duplicate key `{ ma_dk: null }`. This identifies a stale database index on the removed field, not a missing canonical code in current creation payloads.
- `dormitory-field-map.ts` maps `registrations.ma_dk` to `registrations.registration_code`; Mongoose schema changes do not reliably delete obsolete database indexes.
- Commit `1a13955f` contains a hardened, dry-run-first repair for `publicregistrations`: canonical-first ordering, complete legacy signature checks, fresh post-data validation, approval/production guards, restore evidence, and no raw code logging. Its focused baseline is 29 passing tests.
- Collection `registrations` also owns unrelated indexes, including a partial unique active-registration index on `student_id`; target classification and mutation must leave every unrelated index byte-for-byte unchanged.

# Steps

1. Parameterize the existing repair engine with an explicit immutable target descriptor: collection, legacy field/key, canonical field/key, and canonical index name. Define supported targets for public (`publicregistrations`, `ma_dk_public`, `public_registration_code`) and formal (`registrations`, `ma_dk`, `registration_code`).
2. Require an explicit CLI target for direct script execution and update the existing public package commands to pass it. Add `migration:dormitory-formal-registration-code-index:dry-run` and `migration:dormitory-formal-registration-code-index:execute`; reject missing/unknown targets before connecting.
3. Apply the existing classification to the selected target by exact key/signature, never by name alone. For formal repair, identify exact legacy `{ ma_dk: 1 }`, exact canonical `{ registration_code: 1 }`, conflicts containing either field, and unrelated indexes that must remain untouched.
4. Read only the selected legacy/canonical code-field projection and report aggregate totals: legacy-only, canonical-only, both-fields, missing/blank canonical, and duplicate canonical groups. Never log code values or document contents.
5. Fail closed before mutation on unsafe documents, unsafe/conflicting indexes, stale target signatures, or ambiguous target selection. If safe and needed, create and verify the plain unique canonical index before any legacy drop.
6. Reuse the hardened latest-snapshot target validation immediately before each name-based drop. Abort if name, key, uniqueness, or accepted options differ from the reviewed formal legacy signature. Preserve restore commands from the complete pre-change definitions.
7. After mutation, freshly re-read formal indexes and code data. Return `completed` only with exactly one valid canonical unique index, no index containing `ma_dk`, no unsafe data, and all unrelated pre-change indexes unchanged. Repeated execute must be a no-op.
8. Extend focused tests for formal target selection, reported `ma_dk_1` state, canonical-first ordering, unrelated/partial index preservation, unsafe data/index blocking, stale signature protection, fresh post-data failure, no-op, redacted logs, missing/unknown target rejection, and public-target regression coverage.
9. Run focused tests, backend build, both no-database dry-runs, diff/status review, and independent persistence-safety review. Database execution remains separately gated.

# Acceptance Criteria

- AC-01: Formal dry-run selects only collection `registrations`, classifies exact `{ ma_dk: 1 }` as legacy regardless of name, and performs no create/drop call.
- AC-02: Current direct and public-link creation paths remain unchanged and continue supplying nonblank `registration_code` values.
- AC-03: Execute is refused for missing/blank/duplicate canonical codes, legacy-only/both-field documents, conflicting definitions, stale signatures, missing approval, production detection, or missing/unknown target.
- AC-04: On safe formal data without a canonical index, the plain unique `{ registration_code: 1 }` index is created and revalidated before the verified legacy index is dropped.
- AC-05: A valid existing canonical index is reused; canonical creation/validation failure leaves the legacy index untouched.
- AC-06: No unrelated `registrations` index is created, dropped, renamed, or option-modified, including the partial unique active-registration index on `student_id`.
- AC-07: Final completion uses fresh formal data/index snapshots, contains no `ma_dk` index, retains exactly one valid canonical unique index, exposes only aggregate evidence, and a repeat is a no-op.
- AC-08: Existing public-registration repair commands and all 29 focused baseline behaviors remain passing with explicit public target selection.
- AC-09: In a separately approved disposable database matching the report, two distinct formal registrations save after repair without `ma_dk: null`, while a duplicate `registration_code` is still rejected.
- AC-10: No registration document, application behavior, general naming migration, or database target is changed under this planning request.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/public-registration-code-index-repair.spec.ts` => AC-01 through AC-08 and AC-10 pass for both target descriptors.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => target-aware script and existing backend compile.
- `D:\PROJECT\manager_points\backend` :: remove `MONGO_URI` from the command environment, then run `npm run migration:dormitory-public-registration-index:dry-run` and `npm run migration:dormitory-formal-registration-code-index:dry-run` => both select the intended target and exit without database reads/writes.
- Separately approved disposable non-production MongoDB :: formal dry-run, reviewed execute, repeat execute, exact index comparison, and focused insert assertions => AC-04 through AC-09 pass; no raw codes enter artifacts.
- `D:\PROJECT\manager_points` :: `git diff --check -- backend/scripts/repair-public-registration-code-index.ts backend/src/dormitory/public-registration-code-index-repair.spec.ts backend/package.json docs/taskscope.md` plus scoped status/diff review => no unintended changes.

# Safety Gates

Gate 1 — Execution authority: this request authorizes only this taskscope update. A separate implementation request is required before backend changes.

Gate 2 — Database index mutation: before formal `--execute`, provide the exact environment/target, implementation commit, timestamped reviewed dry-run, redacted complete pre-index definitions, aggregate data-safety counts, restore commands, concurrency/maintenance-window control, expected impact, rollback procedure, and resume point. Obtain explicit approval for that exact database.

Gate 3 — Data remediation: if legacy-only, both-field, missing/blank, or duplicate formal codes exist, stop. Backfill, rename, deduplication, deletion, or general migration requires a separate Full taskscope and explicit persistent-data approval.

Rollback: preserve the exact legacy index definitions and restore commands. Any restore is a separately approved schema mutation; never drop canonical uniqueness, alter unrelated indexes, or mutate registration documents automatically.

# Artifacts and Checkpoints

Implementation review requires the taskscope, target-aware script/test/package diff, focused test/build/dry-run evidence, and independent persistence-safety review. Before an approved database run, capture target identity, base/current commit, redacted pre/post index snapshots, aggregate pre/post data summaries, restore commands, concurrency controls, and artifact hashes. Store no registration codes or personal data.

# Execution Budgets

Deadline per step: 600 seconds, maximum 1800 seconds. One writer per path. Dependency order: baseline -> target parameterization -> formal safety tests -> package commands -> independent review -> final verification -> Human Gate -> optional database run. Idempotent retries: 0..2; engineering loop: 0..3; review remediation: 0..2. Stop on target ambiguity, unsafe data, unexpected/stale indexes, unrelated-index drift, unsupported targeting, production detection, approval absence, or post-check failure.
