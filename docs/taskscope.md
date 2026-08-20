# Taskscope: Restore pending review and eliminate multi-room meter duplicates

## Task Identity and Pipeline

- Task: `dormitory-unapprove-and-meter-duplicate`
- Pipeline: `bug_fix` / planning-only / Full
- Repository: `D:\PROJECT\manager_points`
- Base state: branch `main`, commit `3e62d329cbce40d2719c8bd8e1fc6d262af374c7`.
- Status: ready for implementation approval; this taskscope does not authorize implementation or database mutation.

## Risk Level

- Risk: high.
- Environment: development.
- Evidence: the change crosses frontend/backend Dormitory behavior, includes concurrent writes to two uniquely indexed MongoDB collections, and may require live index reconciliation.
- Reversibility: code/test changes are Git-reversible. Creating or dropping database indexes is persistent and gated.
- Blast radius: transfer-proof review states and electricity/water saving for Dormitory invoices only.

## Objective

After an approved transfer proof is unapproved, it returns to `pending`/“Chờ duyệt” and can be reviewed again. Saving readings for two or more distinct rooms in the same billing month completes without an exposed duplicate-key error or lost latest reading.

## Scope Boundaries

- Approved boundaries: `frontend/src/app/(dashboard)/dormitory/invoices/**`, `frontend/src/api/dormitory-api.ts`, `backend/src/dormitory/**`, `backend/scripts/*dormitory*meter*`, and the related backend package scripts.
- Expected write paths:
  - `backend/src/dormitory/services/invoices.service.ts`
  - `backend/src/dormitory/services/invoices.service.spec.ts`
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.test.tsx`
  - `frontend/src/app/(dashboard)/dormitory/invoices/meter-readings/page.tsx` only if regression evidence proves a remaining client scheduling defect
  - `frontend/src/app/(dashboard)/dormitory/invoices/meter-readings/page.test.tsx`
  - a guarded Dormitory meter/invoice index inspection-repair script under `backend/scripts/**` and `backend/package.json` if live index drift is confirmed
- Known targets: `InvoicesService.reviewPaymentProof`, `saveBulkMeterReadings`, `MeterReadingsPage.triggerAutoSave`, the `MeterReading` and `Invoice` compound indexes, and focused page/service specs.
- Excluded boundaries: proof upload rules, tariff calculations, room lifecycle, historical invoice deletion/backfill, deployment, non-Dormitory modules, and production/staging writes.

## Out of Scope

- Changing the meaning of an explicit “Không duyệt” action; rejection attempts continue to leave the proof reviewable according to existing behavior.
- Removing proofs or revocation audit metadata.
- Changing pricing, payment deadlines, or invoice collection rules.
- Running index repair against any database as part of planning or ungated implementation.
- Deleting the unrelated untracked invoice-proof upload files present at preflight.

## Context and Dependencies

- `reviewPaymentProof(..., 'revoked', ...)` currently writes `payment_review.status = 'rejected'` in both MongoDB and the returned invoice. The UI consequently renders a rejected state. Existing UI logic already renders “Chờ duyệt” and review actions when the API returns `pending`.
- The meter page sends one POST per room. Different rooms can save concurrently; repeated requests for the same room are queued client-side.
- The backend independently upserts `MeterReading` and then saves `Invoice`. Its catch block treats every MongoDB `E11000` as an invoice insert race, queries only `Invoice`, and may either expose the duplicate or return stale data as false success.
- Source schemas declare the intended unique compound keys `{ room_id, billing_month }`. A repeatable failure starting with room 2 is therefore consistent with a stale live single-field unique index or malformed/duplicated room IDs; the actual `E11000.index` and `keyValue` must be captured before selecting an index repair.
- Current service tests do not inject `meterReadingModel`, so the meter upsert path is untested. The frontend fixture covers only one room.

## Steps

1. Backend diagnosis owner: reproduce with two distinct room IDs in one billing month and record the redacted `E11000` collection, index name, key pattern, and `keyValue`. Add a default read-only index inspection command that compares live indexes with the named canonical compound indexes.
2. Review-state owner: change the atomic revoke update and returned object to `payment_review.status = 'pending'`; keep the proof, set invoice status to `Chưa thu`, retain revoker ID/time, and clear `paid_at`/`confirmed_by_id`.
3. Backend test owner: inject a meter-reading model into the service fixture. Cover two distinct rooms, same-room concurrent writes with different latest values, meter-index and invoice-index duplicate paths, and absence of partial/false-success results.
4. Persistence owner: classify duplicate errors by collection/index. Retry only same-key races through an atomic update that persists the latest validated payload; do not convert unrelated unique-index failures into success. Ensure meter and invoice outcomes cannot be reported successful with divergent readings; use a supported transaction or an explicitly tested compensation/retry sequence compatible with the configured MongoDB topology.
5. Index owner, conditional on Step 1: add a dry-run-first repair script that reports extra/missing/mismatched indexes and proposes only the exact Dormitory meter/invoice index changes. Add an execute mode only behind the Human Gate, with backup/rollback and a postcondition check.
6. Frontend test owner: model two room cards blurred/saved in quick succession and rapid same-room edits. Assert distinct room payloads persist independently and the same-room queue sends the latest values. Change production scheduling only if this regression fails independently of backend/index behavior.
7. Review/verification owners: verify the revoke state end-to-end in page/service tests, run focused meter tests and package static checks, independently review concurrency/index handling, then inspect final diff/status.

## Acceptance Criteria

- AC-01: Revoking an approved proof atomically stores and returns `payment_review.status = 'pending'`, invoice status `Chưa thu`, revoker audit fields, and no paid confirmation fields.
- AC-02: After revoke, the invoice modal displays “Chờ duyệt” and offers the normal review actions again; it does not display a rejected terminal state.
- AC-03: Explicit “Không duyệt” behavior and its audit attempt remain unchanged.
- AC-04: Two distinct valid rooms saved in the same month create/update distinct canonical meter readings and invoices without `E11000` reaching the user.
- AC-05: Concurrent or rapidly repeated saves for one room/month end with the latest valid submitted readings in both meter and invoice records; no stale invoice is returned as successful.
- AC-06: A duplicate from an unrelated or stale index is reported with a bounded diagnostic and is never misclassified as a successful invoice race.
- AC-07: Service tests execute the real meter-model branch and frontend tests cover at least two distinct rooms plus same-room coalescing.
- AC-08: Index inspection is read-only and deterministic. If repair is required, execution changes only reviewed Dormitory indexes and passes postcondition checks after explicit approval.
- AC-09: Existing proof-review, paid-invoice protection, tariff, partial-result, and single-room save tests remain green.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/invoices.service.spec.ts dormitory/controllers/invoices.controller.spec.ts` => review transitions, multi-room writes, duplicate classification, latest-write, and existing regressions pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => Nest build succeeds.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/invoices/page.test.tsx" "src/app/(dashboard)/dormitory/invoices/meter-readings/page.test.tsx"` => revoke UI and two-room/same-room save regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors introduced.
- `D:\PROJECT\manager_points\backend` :: new index inspection script in default dry-run mode => zero writes and an exact expected-versus-live index report.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended changed paths; unrelated upload files remain untouched.

## Safety Gates

- Trigger: executing any database index create/drop/rename/rebuild or other persistent-data mutation.
- Required artifact: redacted `E11000` evidence, live-versus-canonical index report, reviewed exact index operations/environment, backup confirmation, rollback command, and postcondition plan.
- Approval: explicit user approval is required immediately before execution in the named database environment. Dry-run and code generation do not grant execution authority.
- Rollback: recreate only the recorded pre-change index definitions; do not delete invoice or meter-reading documents.
- Resume point: after code/tests/build, dry-run, and independent review pass; before the first database write.

## Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Base commit: `3e62d329cbce40d2719c8bd8e1fc6d262af374c7`.
- Preflight unrelated files: `backend/uploads/invoice-proof-11d635af-2354-472d-8b35-4346790c2672.jpg` and `backend/uploads/invoice-proof-d7ad5f32-4d33-4e53-80ba-a148dba8721d.jpg`; preserve unchanged.
- Rule manifest version `3.2.0`; SHA-256:
  - safety: `6a3f283b835394b1af1f6380d94cba260acbed8a60d3065dd5365bb15806a772`
  - global: `67806f70a5f89adf42e3be88413cc76cc27a02c90fad0609ae71de34d046a43f`
  - operating contract: `51f3677c7e44121529cc0a4b17e5667bcbd2147ee63c6f30207c10d5deb51790`
  - orchestrator: `b782109e896b2fa48a6523358a788a9db9b81b72f3d8fc66f70019395738d716`
  - pipeline: `0419c072380887f96b37fe4eb48dae764306f46fb03190b176a43ebcea3f41f3`
- Material checkpoint: reviewed dry-run/index evidence and green code checks, immediately before the Human Gate.

## Execution Budgets

- Step deadline: 600 seconds default, 1,800 seconds maximum.
- Concurrency: at most four active agents; one writer per path; serialize service/spec and page/test ownership.
- Retry limits: two idempotent retries, three engineering mutation/verification iterations, and two review-remediation cycles shared across the task.
- Stop conditions: unidentified duplicate source, conflicting live index evidence, unsupported transaction topology without a tested alternative, overlapping dirty changes, scope expansion, or any unapproved database mutation.
