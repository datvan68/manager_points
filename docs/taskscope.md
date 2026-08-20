# Taskscope: Repair the stale invoice code index

## Task Identity and Pipeline

- Task: `repair-dormitory-invoice-code-index`
- Pipeline: `bug_fix` / planning-only / Full
- Repository: `D:\PROJECT\manager_points`
- Base state: branch `main`, commit `79560d38eda3c11c5e78f210233a68c5b3e7fd26`.
- Status: ready for implementation approval. This scope does not authorize a database write.

## Risk Level

- Risk: high.
- Environment: development unless a later approval names another environment.
- Evidence: the code fix is small, but correcting a unique MongoDB index is a persistent schema mutation and requires a Human Gate.
- Reversibility: scripts/tests are Git-reversible; an index change is reversible only from a captured definition.
- Blast radius: writes to the Dormitory `invoices` collection.

## Objective

New invoices can be created when the obsolete `ma_hoa_don` field is absent, while uniqueness remains enforced on canonical `invoice_code` and on `{room_id, billing_month}`.

## Scope Boundaries

- Approved boundaries: `backend/scripts/**`, `backend/src/dormitory/**`, `backend/package.json`, and `docs/taskscope.md`.
- Expected write paths:
  - `backend/scripts/inspect-dormitory-meter-invoice-indexes.ts`
  - a focused guarded repair script such as `backend/scripts/repair-dormitory-invoice-code-index.ts`
  - `backend/src/dormitory/invoice-index-repair.spec.ts`
  - `backend/package.json`
- Known schema: `backend/src/dormitory/schemas/invoice.schema.ts`.
- Excluded boundaries: frontend, invoice business calculations, API contracts, meter-reading behavior, document deletion/backfill, deployment, and non-Dormitory collections.

## Out of Scope

- Assigning or rewriting invoice codes in existing documents.
- Dropping `_id_`, canonical `invoice_code_1`, or `{room_id, billing_month}` indexes.
- Executing any repair against a database as part of planning.
- Treating every `E11000` as the legacy-index case.

## Context and Dependencies

- The reported error identifies `manager-point.invoices`, unique index `ma_hoa_don_1`, and duplicate value `{ ma_hoa_don: null }`.
- The existing inspector was run in dry-run mode against the configured development database and confirmed `ma_hoa_don_1` is unique/non-sparse with key `{ma_hoa_don: 1}`. It also confirmed valid unique `invoice_code_1` and unique sparse `{room_id, billing_month}` indexes; the report recorded `writes: 0`.
- Current source has no `ma_hoa_don` property. `Invoice.invoice_code` is required and unique, and the schema also declares unique sparse `{room_id, billing_month}`.
- Git history shows `ma_hoa_don` was renamed to `invoice_code`. MongoDB index definitions are not renamed automatically with application fields, so the live collection retained the obsolete unique index.
- Under a non-sparse unique single-field index, documents missing `ma_hoa_don` occupy the indexed `null` value. The first canonical invoice may insert; the next fails with `E11000`. This explains the room-2 symptom and is separate from a legitimate duplicate `{room_id, billing_month}` race.
- The existing read-only inspector reports indexes but does not classify `ma_hoa_don_1`, validate canonical invoice-code readiness, or repair it.

## Steps

1. Extend read-only inspection to report the exact `invoices` index definitions, whether `ma_hoa_don_1` has key `{ma_hoa_don: 1}`, presence/options of `invoice_code_1` and the room/month compound index, counts of missing/null canonical codes, and duplicate non-null `invoice_code` groups. Redact document contents.
2. Add unit tests for clean state, exact legacy index, same-name/wrong-key safety stop, missing canonical index, duplicate/missing canonical data, dry-run zero writes, and post-repair verification.
3. Add an idempotent guarded repair script. Dry-run is the default. Execute mode must require an explicit environment approval flag, reject production-like connections by default, capture rollback `createIndex` commands, and drop only the verified `{ma_hoa_don: 1}` index.
4. Before any drop, require canonical readiness: no duplicate non-null `invoice_code`; the expected `invoice_code` uniqueness and `{room_id, billing_month}` protections are present or can be created safely. Stop instead of mutating documents when readiness fails.
5. After an approved execute, re-read indexes and prove `ma_hoa_don_1` is absent, canonical indexes remain valid, and a controlled development smoke test can create invoices for two different rooms/month keys without the legacy-null error.
6. Run focused tests, backend build, dry-run inspection, and final diff/status review.

## Acceptance Criteria

- AC-01: Inspection identifies `ma_hoa_don_1` by both name and key and performs zero writes.
- AC-02: Dry-run prints the proposed operation, affected index definition, rollback command, readiness findings, and `writes: 0`.
- AC-03: Execute refuses wrong environment/approval, same-name wrong-key indexes, duplicate canonical codes, or unsafe/missing canonical uniqueness.
- AC-04: Approved execute drops only the verified obsolete `ma_hoa_don_1` and is idempotent when rerun.
- AC-05: Postconditions retain unique `invoice_code` and unique sparse `{room_id, billing_month}` indexes.
- AC-06: No invoice documents are deleted or rewritten.
- AC-07: In a controlled development test, two valid distinct invoice inserts no longer fail on `{ma_hoa_don: null}`; genuine canonical duplicates still fail.
- AC-08: Existing Dormitory invoice tests and backend build remain green.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/invoice-index-repair.spec.ts` => all inspection, refusal, repair, idempotency, and postcondition tests pass.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/invoices.service.spec.ts` => existing invoice behavior remains green.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => Nest build succeeds.
- `D:\PROJECT\manager_points\backend` :: `npm run inspect:dormitory-meter-invoice-indexes` => read-only report includes legacy and canonical invoice-index readiness with zero writes.
- Guarded dry-run command added to `backend/package.json` => proposes only the exact legacy-index removal and rollback command.
- After separately approved development execution: rerun inspection and controlled two-invoice smoke test => no `ma_hoa_don_1` error and canonical duplicate protections remain active.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

## Safety Gates

- Trigger: dropping, creating, or rebuilding any live MongoDB index.
- Required artifact: named environment, redacted index/readiness report, exact proposed operations, affected document counts, backup confirmation, rollback commands, and smoke-test plan.
- Approval: explicit user approval immediately before the first database write in the named environment.
- Rollback: recreate only the captured `ma_hoa_don_1` definition if rollback is required; do not delete or rewrite invoice documents.
- Resume point: after scripts, tests, build, and dry-run review pass; before execute mode.

## Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Base commit: `79560d38eda3c11c5e78f210233a68c5b3e7fd26`.
- Effective Rules Manifest: version `3.2.0`; SHA-256:
  - safety: `6a3f283b835394b1af1f6380d94cba260acbed8a60d3065dd5365bb15806a772`
  - global: `67806f70a5f89adf42e3be88413cc76cc27a02c90fad0609ae71de34d046a43f`
  - operating contract: `51f3677c7e44121529cc0a4b17e5667bcbd2147ee63c6f30207c10d5deb51790`
  - orchestrator: `b782109e896b2fa48a6523358a788a9db9b81b72f3d8fc66f70019395738d716`
  - pipeline: `0419c072380887f96b37fe4eb48dae764306f46fb03190b176a43ebcea3f41f3`
- Material checkpoint: reviewed green dry-run artifact immediately before the Human Gate.

## Execution Budgets

- Step deadline: 600 seconds default, 1,800 seconds maximum.
- Concurrency: one writer per path.
- Retry limits: two idempotent retries, three engineering iterations, and two review-remediation cycles.
- Stop conditions: live index key/options differ from the report, canonical data is not ready, an implementation needs document mutation, dirty changes overlap write paths, or database execution lacks approval.
