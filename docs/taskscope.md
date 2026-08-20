# Taskscope: Keep meter invoices consistent and replace bulk deletion with review

## Task Identity and Pipeline

- Task: `dormitory-meter-invoice-consistency-and-bulk-review`
- Pipeline: `bug_fix` / planning-only / Full
- Repository: `D:\PROJECT\manager_points`
- Base state: branch `main`, commit `cca79fc08b4a8fc71aea1a869d8ee87877bc899d`.
- Status: ready for implementation approval. This taskscope authorizes neither code execution nor database mutation.

## Risk Level

- Risk: high.
- Environment: development.
- Evidence: the fix crosses the Dormitory frontend/API/backend, changes a destructive public action into payment-proof review, and must preserve consistency across `meterreadings` and `invoices` under duplicate/concurrent writes.
- Reversibility: code and tests are Git-reversible. Live index or persistent-data repair is gated.
- Blast radius: monthly Dormitory electricity/water readings and invoice payment-review actions only.

## Objective

Every successful room/month meter save has one matching invoice, including room 2 and later rooms. Selecting invoices offers `Duyệt`/`Không duyệt` for eligible pending proofs and cannot delete monthly meter/invoice data.

## Scope Boundaries

- Approved boundaries: `backend/src/dormitory/**`, relevant Dormitory permission definitions, `backend/scripts/*dormitory*meter*invoice*`, backend package scripts, `frontend/src/app/(dashboard)/dormitory/invoices/**`, and `frontend/src/api/dormitory-api.ts`.
- Expected write paths:
  - `backend/src/dormitory/services/invoices.service.ts`
  - `backend/src/dormitory/services/invoices.service.spec.ts`
  - `backend/src/dormitory/controllers/invoices.controller.ts`
  - `backend/src/dormitory/controllers/invoices.controller.spec.ts`
  - `backend/src/dormitory/dto/create-invoice.dto.ts` or a focused bulk-review DTO
  - `frontend/src/api/dormitory-api.ts`
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.test.tsx`
  - meter-reading page/test only if reproduction proves a remaining client scheduling defect
  - the existing read-only index inspection script and a guarded repair script/package command only if live index drift is confirmed
- Known targets: `InvoicesService.saveBulkMeterReadings`, `reviewPaymentProof`, `bulkDelete`, controller routes `meter-readings/bulk`, `bulk-delete`, and `:id/proof/review`, invoice selection state/FloatingActionBar, and Dormitory API methods.
- Excluded boundaries: tariff formulas, payment deadlines, room/roster lifecycle, historical data backfill, deployment, non-Dormitory modules, and production/staging writes.

## Out of Scope

- Deleting or rewriting historical meter/invoice documents during normal use.
- Changing single-invoice review semantics (`approved`, `rejected`, `revoked`) beyond reuse by the bulk action.
- Allowing selection to approve invoices without a transfer proof in `pending` status.
- Running index repair or persistent-data reconciliation without a separate Human Gate.
- Reusing `DORM_INVOICE_DELETE` as review authority; review remains protected by `DORM_INVOICE_CONFIRM`.

## Context and Dependencies

- `saveBulkMeterReadings` currently upserts `MeterReading` before creating/updating `Invoice`. If that upsert throws a canonical duplicate, the catch retries only the meter upsert and then emits a failed result; execution never resumes invoice creation. This can leave a room/month meter row without an invoice and explains why a later room can appear saved without a new invoice when the duplicate path is hit.
- A deterministic failure beginning at room 2 still points to a possible stale live unique index such as a single-field `billing_month` index. Source schemas correctly declare unique `{ room_id, billing_month }` indexes. The exact `E11000` collection, index, key pattern, and key value are required before any index repair.
- The current invoice duplicate branch updates only current readings on the competing invoice and does not recompute all derived fields, so it can report success with stale totals or divergent meter/invoice snapshots.
- `getMeterReadings` determines the current month's `recorded` state, values, total, and invoice metadata from `Invoice`. It only uses `MeterReading` to locate a prior month. Therefore deleting an unpaid invoice makes the current month's entered data disappear from this page even if an independent meter row remains.
- The invoice page currently exposes checkboxes only when `DORM_INVOICE_DELETE` is available and the FloatingActionBar calls `bulkDelete`. The backend endpoint physically deletes unpaid invoice documents.
- Single-item review already has an atomic status predicate and request UUID. The bulk operation should reuse those invariants and return per-ID results rather than introduce a second review state machine.
- Existing frontend tests cover two quick room saves, but backend tests do not prove two distinct room/month invoices, the successful meter-duplicate continuation, or full convergence after an invoice race.

## Steps

1. Reproduce/diagnose: save two distinct valid room IDs in one month; record for each room the request payload, result item, meter row, invoice row, and redacted `E11000` collection/index/key evidence. Run the existing index inspector in read-only mode.
2. Persistence fix: refactor one room/month save into an idempotent unit that either creates/updates both records consistently or returns failure without claiming success. After a same-key meter duplicate, continue through invoice persistence; after an invoice race, recompute and atomically persist the complete latest snapshot (readings, roster, exemption, calculated amounts, dates, and notes).
3. Duplicate classification: retry only canonical `{ room_id, billing_month }` races for the same submitted key. Surface stale/unrelated index errors with bounded diagnostics. Use a supported transaction, or a tested compensation/reconciliation path compatible with the configured MongoDB topology, to prevent a successful response with only one side updated.
4. Backend regression tests: exercise two distinct rooms in one payload and separate concurrent requests; assert two meter rows and two invoices. Cover canonical meter duplicate continuation, invoice duplicate convergence, latest-write behavior, unrelated/stale duplicate rejection, paid-invoice protection, and partial-result semantics.
5. Replace destructive selection behavior: make row selection available to `DORM_INVOICE_CONFIRM`; select only pending transfer-proof invoices (or clearly mark ineligible rows). Replace `Xóa` and its confirmation modal with `Duyệt` and `Không duyệt` actions.
6. Add a bulk-review contract accepting deduplicated invoice IDs, decision `approved|rejected`, and idempotency identifiers. Process each invoice through the existing atomic review invariants and return `approved/rejected/skipped/failed` per ID. Refresh the list, clear successful selections, and retain failed/ineligible selections with a precise summary.
7. Remove the normal destructive path: remove the invoice-page bulk-delete call/UI and retire or hard-disable the Dormitory `bulk-delete` route/service so direct API use cannot delete monthly invoices. Preserve permission history unless a separate authorization migration is approved.
8. Conditional index repair: only if Step 1 confirms drift, extend the dry-run report with exact extra/missing/mismatched indexes and prepare a guarded execute mode. Do not execute it in this task without the Human Gate.
9. Verification/review: run focused backend/frontend tests, package build/typecheck, inspect the final diff/status, and independently review persistence consistency, authorization, idempotency, and absence of deletion paths.

## Acceptance Criteria

- AC-01: Saving valid readings for two distinct rooms in the same billing month produces exactly one `MeterReading` and one `Invoice` per `{room_id, billing_month}` and returns success for both.
- AC-02: A canonical meter duplicate for the submitted room/month does not terminate before invoice persistence; the final meter and invoice snapshots agree.
- AC-03: An invoice insert race ends with all derived fields matching the latest accepted payload; no stale total or partial success is returned.
- AC-04: A stale or unrelated unique-index duplicate is not misclassified as success and includes a safe diagnostic identifying the collection/index/key.
- AC-05: Current-month meter data remains visible and `recorded` after list review actions because no invoice deletion occurs.
- AC-06: Selected eligible invoices expose only `Duyệt`, `Không duyệt`, and clear-selection actions; no delete action or delete confirmation is rendered.
- AC-07: Bulk approve/reject requires `DORM_INVOICE_CONFIRM`, is idempotent per invoice/request, and preserves the existing single-review state and audit rules.
- AC-08: Mixed selections return deterministic per-item outcomes; successful rows refresh, while failed/ineligible rows remain selected with an actionable message.
- AC-09: The Dormitory bulk-delete endpoint can no longer delete invoices through direct API access.
- AC-10: Existing single-invoice review, revoke-to-pending, paid-invoice protection, tariff, one-room save, and two-room frontend scheduling tests remain green.
- AC-11: Index inspection performs zero writes. Any confirmed repair changes only reviewed Dormitory indexes after explicit approval and passes postconditions.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/invoices.service.spec.ts dormitory/controllers/invoices.controller.spec.ts` => all meter consistency, bulk-review, authorization/delegation, and existing review regressions pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => Nest build succeeds.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/invoices/page.test.tsx" "src/app/(dashboard)/dormitory/invoices/meter-readings/page.test.tsx"` => selection shows review actions, no delete path exists, mixed bulk outcomes work, and two-room saving remains green.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors introduced.
- `D:\PROJECT\manager_points\backend` :: `npm run inspect:dormitory-meter-invoice-indexes` => read-only expected-versus-live report with `writes: 0`.
- Direct controller/API regression :: call the retired `bulk-delete` path with valid IDs => no invoice is deleted.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended changed paths.

## Safety Gates

- Trigger: any live database index create/drop/rename/rebuild, document repair, or other persistent-data mutation.
- Required artifact: redacted reproduction evidence, live-versus-canonical index report, affected document counts, exact environment/operations, backup confirmation, rollback commands, and postcondition queries.
- Approval: explicit user approval immediately before the first database write in the named environment. Planning, dry-run, code, and tests do not grant this authority.
- Rollback: restore only recorded pre-change index definitions or documents from the reviewed backup; never broadly delete meter/invoice collections.
- Resume point: after code/tests/build, dry-run report, and independent review pass; before persistent mutation.

## Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Base commit: `cca79fc08b4a8fc71aea1a869d8ee87877bc899d`.
- Effective Rules Manifest: version `3.2.0`; SHA-256:
  - safety: `6a3f283b835394b1af1f6380d94cba260acbed8a60d3065dd5365bb15806a772`
  - global: `67806f70a5f89adf42e3be88413cc76cc27a02c90fad0609ae71de34d046a43f`
  - operating contract: `51f3677c7e44121529cc0a4b17e5667bcbd2147ee63c6f30207c10d5deb51790`
  - orchestrator: `b782109e896b2fa48a6523358a788a9db9b81b72f3d8fc66f70019395738d716`
  - pipeline: `0419c072380887f96b37fe4eb48dae764306f46fb03190b176a43ebcea3f41f3`
- Material checkpoint: green code verification plus reviewed index/reproduction evidence immediately before any Human Gate.

## Execution Budgets

- Step deadline: 600 seconds default, 1,800 seconds maximum.
- Concurrency: at most four active agents and one writer per path; serialize service/spec and page/test mutations.
- Retry limits: two idempotent retries, three engineering mutation/verification iterations, and two review-remediation cycles shared across the task.
- Stop conditions: duplicate source cannot be identified, live data contradicts the model, unsupported transaction topology lacks a tested compensation path, dirty changes overlap write paths, permission/public-contract scope expands, or a database mutation lacks approval.
