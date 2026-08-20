# Taskscope: Stabilize dormitory utility configuration and meter readings

## Task Identity and Pipeline

- Task: `dormitory-utility-config-and-meter-reading-stability`
- Pipeline: `bug_fix` / planning-only / Full
- Repository: `D:\PROJECT\manager_points`
- Base branch/commit: `main` / `b1af39159a08532f42436bab66de7dacee50ace8`
- Rule manifest: canonical rules version `3.2.0`; SHA-256 values recorded under Artifacts and Checkpoints.
- Status: ready for implementation approval; this document does not authorize implementation.

## Risk Level

- Risk: high.
- Environment: development.
- Evidence: the change crosses the frontend and backend Dormitory modules and must preserve meter baselines independently from deletable invoices. Introducing a durable meter-reading record/index or backfill changes persistent schema/data and requires a Human Gate.
- Blast radius: Dormitory invoice configuration, invoice payment availability, utility autosave, invoice deletion, and historical meter baselines. Existing paid invoices and unrelated invoice types must remain unchanged.

## Objective

Administrators can configure the invoice deadline with `CustomCalendar`, save an existing transfer QR without DTO validation failure, record each room's electricity/water readings exactly once without requiring a payment deadline, retain the last recorded baseline after an unpaid invoice is deleted, and expose invoice payment only when a valid deadline is configured.

## Scope Boundaries

- Approved boundaries: `frontend/src/app/(dashboard)/dormitory/invoices/**`, `frontend/src/api/dormitory-api.ts`, `backend/src/dormitory/**`, and a narrowly scoped Dormitory migration/backfill script if the approved persistence design requires it.
- Write boundaries:
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.test.tsx`
  - `frontend/src/app/(dashboard)/dormitory/invoices/meter-readings/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/invoices/meter-readings/page.test.tsx`
  - `frontend/src/api/dormitory-api.ts`
  - `backend/src/dormitory/dto/utility-config.dto.ts`
  - `backend/src/dormitory/schemas/invoice.schema.ts` only if making pre-payment `due_date` optional is necessary
  - new/updated Dormitory meter-reading schema, module registration, service, controller, and focused specs under `backend/src/dormitory/**`
  - a new `backend/scripts/*dormitory*meter*` backfill/verification script only after the Human Gate
- Known targets: `InvoicesPage.openConfigModal`, `InvoicesPage.handleSaveConfig`, the utility-config modal date field, `MeterReadingsPage.triggerAutoSave`, `handleInputChange`, `handleInputBlur`, `InvoicesService.getMeterReadings`, `saveBulkMeterReadings`, `pay`, `bulkDelete`, `UpdateUtilityConfigDto`, and the unique `{ room_id, billing_month }` invoice index.
- Excluded boundaries: room deletion semantics, paid-invoice deletion rules, tariff formula/quota behavior, payment-proof review workflow, non-utility invoice types, deployment, and production execution.

## Out of Scope

- Changing electricity/water pricing formulas, roster occupancy rules, invoice statuses, or historical paid invoices.
- Deleting or rewriting existing invoice history.
- Deploying, executing a database migration, or mutating staging/production data.
- Refactoring shared `CustomCalendar`; consume its current single-date API through the existing Popover pattern.

## Context and Dependencies

- The configuration modal currently uses native `<input type="date">`; the repository already provides `frontend/src/components/calendar/CustomCalendar.tsx` and working single-date Popover examples.
- `openConfigModal` stores the API's full `transfer_qr_image` in `configForm`. Saving without uploading a replacement sends server-owned `uploaded_at`; `TransferQrImageDto` does not allow that property, producing `transfer_qr_image.property uploaded_at should not exist` under whitelist validation.
- Meter inputs schedule an 800 ms autosave and also save immediately on blur. Once a timer callback has started, blur can launch another request for the same room. Both requests can observe no current invoice and race to insert against the unique `{ room_id, billing_month }` index, leaking a duplicate-key failure.
- `getMeterReadings` derives the previous baseline only from invoices. `bulkDelete` physically removes unpaid invoices, so deleting the only invoice that contains a reading also removes the baseline.
- `saveBulkMeterReadings` currently throws before processing any room when `UtilityConfig.payment_deadline` is absent or expired, and writes that deadline into the invoice. This incorrectly couples meter capture to payment availability.
- The invoice schema currently requires `due_date`; payment service and UI currently do not enforce the new rule that fee payment is closed until configuration supplies a valid deadline.

## Steps

1. Backend owner: add focused regression tests reproducing concurrent same-room saves, baseline lookup after unpaid-invoice deletion, recording without a deadline, and backend payment rejection without a valid deadline.
2. Persistence owner: introduce a canonical per-room/per-billing-month meter-reading record (unique key, readings, reading timestamp, room/roster snapshot linkage as needed). Make meter saving atomically upsert this record and derive prior readings from it rather than from deletable invoices. Keep invoice creation/update idempotent under concurrent requests and translate residual duplicate-key races into the existing successful record/update path.
3. Persistence owner: define a dry-run backfill from existing utility invoices into the canonical meter-reading records, report conflicts without overwriting divergent readings, and execute it only after the Human Gate. Invoice deletion must not delete canonical meter readings.
4. Backend owner: remove the deadline precondition from `saveBulkMeterReadings`. Permit a utility invoice to exist before collection opens; apply the configured deadline when collection becomes available and reject `pay` server-side when no valid deadline is configured. Preserve due dates already stored on historical invoices.
5. Frontend owner: serialize/coalesce saves per room so debounce and blur cannot create overlapping requests; ensure the latest dirty values are saved after an in-flight request completes.
6. Frontend owner: replace the configuration deadline input with `CustomCalendar` inside the established Popover pattern, keeping `YYYY-MM-DD` form state and an appropriate minimum date.
7. Frontend owner: map API QR metadata to an explicit update payload containing only `url`, `file_name`, `mime_type`, and `size`; do not send `uploaded_at`. Disable or replace `Đóng ngay` with a clear configuration-required state until a valid deadline exists.
8. Test/review owners: run focused frontend/backend suites, type checks, migration dry-run against fixtures or an approved development database, independently review persistence/concurrency/payment behavior, then inspect the final diff and status.

## Acceptance Criteria

- AC-01: The configuration modal renders `CustomCalendar`, selects one date, stores it as local `YYYY-MM-DD`, closes correctly on confirm/cancel, and disallows invalid past deadlines according to the existing payment rule.
- AC-02: Opening an existing configuration with a QR and saving it unchanged succeeds; the update request never contains `transfer_qr_image.uploaded_at`. Replacing the QR also succeeds with allowed metadata only.
- AC-03: Debounce plus blur, rapid edits, or two concurrent API calls for one room/month produce one canonical meter record and one invoice, with no duplicate-key error exposed to the user and with the latest submitted valid readings persisted.
- AC-04: After recording readings and deleting the related unpaid invoice, reopening the meter-reading page retains those readings as the prior/default baseline. A later period continues from that baseline. Paid-invoice deletion behavior is unchanged.
- AC-05: Valid readings can be saved when `payment_deadline` is missing or expired; calculation, roster snapshot, and recorded status still succeed.
- AC-06: Without a valid configured deadline, the frontend does not offer an actionable `Đóng ngay`, and direct payment API calls fail with a bounded business error while reading/editing remains available.
- AC-07: After saving a valid deadline, eligible unpaid utility invoices expose payment; the backend applies a consistent effective due date without rewriting historical paid-invoice deadlines.
- AC-08: Existing tariff calculation, empty-room handling, partial bulk failures, paid-invoice edit protection, QR file restrictions, and payment-proof review tests remain green.
- AC-09: Backfill dry-run is idempotent, reports counts/conflicts, and does not mutate data; execution is separately gated and preserves invoice history.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/invoices/page.test.tsx" "src/app/(dashboard)/dormitory/invoices/meter-readings/page.test.tsx"` => all focused UI regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors introduced.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/invoices.service.spec.ts dormitory/controllers/invoices.controller.spec.ts` => concurrency, persistence, deadline, DTO, and existing Dormitory invoice regressions pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => Nest build succeeds.
- `D:\PROJECT\manager_points\backend` :: approved migration dry-run command defined by the implementation => zero writes; deterministic created/skipped/conflict counts.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

## Safety Gates

- Gate trigger: adding/indexing the canonical meter-reading collection and backfilling persistent data.
- Required artifact: reviewed schema/index diff, dry-run report with redacted counts/conflicts, exact execute command/environment, backup/rollback procedure, and final verification plan.
- Approval: explicit user approval is required before schema/index application or backfill execution in any database. Planning and code generation alone do not grant execution authority.
- Rollback: retain invoice data as the source history; remove only newly backfilled meter records by a bounded migration marker if rollback is approved. Never delete invoice history.
- Resume point: after code/tests/build and dry-run artifact pass; before any database write.

## Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Base commit: `b1af39159a08532f42436bab66de7dacee50ace8`.
- Rule hashes:
  - `.agents/Rules/safety.md`: `6a3f283b835394b1af1f6380d94cba260acbed8a60d3065dd5365bb15806a772`
  - `.agents/Rules/global.md`: `67806f70a5f89adf42e3be88413cc76cc27a02c90fad0609ae71de34d046a43f`
  - `antigravity-operating-contract.md`: `51f3677c7e44121529cc0a4b17e5667bcbd2147ee63c6f30207c10d5deb51790`
  - `.agents/Workflows/orchestrator.md`: `b782109e896b2fa48a6523358a788a9db9b81b72f3d8fc66f70019395738d716`
  - `.agents/Workflows/pipeline.md`: `0419c072380887f96b37fe4eb48dae764306f46fb03190b176a43ebcea3f41f3`
- Material implementation checkpoint: after focused tests/build and migration dry-run artifacts are complete, before requesting the Human Gate.

## Execution Budgets

- Step deadline: 600 seconds default, 1,800 seconds maximum.
- Concurrency: at most four active agents; one writer per path; serialize schema/service edits and frontend page/test edits by ownership.
- Retry limits: two idempotent retries, three engineering mutation/verification iterations, and two review-remediation cycles shared across the task.
- Stop conditions: overlapping dirty changes, scope expansion outside Dormitory, a divergent backfill conflict requiring product policy, a public contract change, or any unapproved persistent-data mutation.
