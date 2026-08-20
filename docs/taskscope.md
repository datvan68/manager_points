# Task Identity and Pipeline

- Task: `restore-dormitory-invoice-bulk-actions-and-trim-tabs`
- Pipeline: `feature_development`
- Profile: Full, planning-only
- Rules/protocol: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Branch/base commit: `main` / `dc9bce4c5118fd2e3be8f9f8458fab7003cf6ba7`
- Base state: clean before this taskscope update.

## Risk Level

- Risk: high.
- Environment: development.
- Evidence: the change crosses frontend and backend, restores a destructive invoice action, and changes permission-dependent navigation and selection behavior.
- Reversibility: source changes are Git-reversible; deleted invoice documents require database backup/restore.
- Blast radius: Dormitory invoice list/actions and Dormitory tab navigation. Meter-reading documents must remain untouched.

## Objective

Selecting Dormitory invoices opens one `FloatingActionBar` with permission-aware **Delete** and **Approve** actions, while the Dormitory navigation no longer offers **Violations**, **Maintenance**, or **Reports**.

## Scope Boundaries

- Approved boundaries: `frontend/src/app/(dashboard)/dormitory/**`, `frontend/src/api/dormitory-api.ts`, `frontend/src/components/ui/FloatingActionBar.tsx`, `backend/src/dormitory/**`, and `docs/taskscope.md`.
- Expected write paths:
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.test.tsx`
  - `frontend/src/app/(dashboard)/dormitory/layout.tsx`
  - `frontend/src/app/(dashboard)/dormitory/layout.test.tsx`
  - `backend/src/dormitory/services/invoices.service.ts`
  - `backend/src/dormitory/services/invoices.service.spec.ts`
  - `backend/src/dormitory/controllers/invoices.controller.spec.ts`
- Known read/unchanged interfaces: `frontend/src/api/dormitory-api.ts`, `frontend/src/components/ui/FloatingActionBar.tsx`, `backend/src/dormitory/controllers/invoices.controller.ts`, and `backend/src/dormitory/dto/create-invoice.dto.ts`.
- Excluded boundaries: meter-reading deletion, invoice schema/index work, single-invoice review semantics, Dormitory route/page deletion, permission-registry changes, deployment, and unrelated navigation.

## Out of Scope

- Do not delete or disable `/dormitory/violations`, `/dormitory/maintenance`, or `/dormitory/reports` or their backend APIs; remove only their tabs from shared Dormitory navigation.
- Do not add bulk **Reject** to the restored bar; the requested bulk actions are **Delete** and **Approve**.
- Do not delete `meterreadings` when an invoice is deleted.

## Context and Dependencies

- The invoice page already owns `selected` state and renders `FloatingActionBar`, but selection is restricted to invoices with a pending payment proof and the bar currently exposes **Reject/Approve** only.
- The existing `POST /dormitory/invoices/bulk-delete` contract, DTO, frontend client, and `DORM_INVOICE_DELETE` guard remain available. `InvoicesService.bulkDelete` is currently hard-disabled before its guarded unpaid-invoice deletion logic.
- Bulk approval already uses `POST /dormitory/invoices/proof/review/bulk` under `DORM_INVOICE_CONFIRM`.
- The three unused tabs are static entries in `dormitory/layout.tsx`; direct routes can remain reachable outside the tab bar.
- Deleting only an invoice preserves the independent monthly `MeterReading`, allowing meter history to survive and a later invoice to be regenerated through the established save flow.

## Steps

1. Establish focused test baselines for the invoice page, Dormitory layout, invoice service, and controller.
2. Redesign invoice selection eligibility around the union of available actions: show checkboxes when the user has delete or confirm permission; keep selection stable across a partial result and clear it on filter/page changes as today.
3. Render one `FloatingActionBar` when at least one row is selected. Show **Delete** only with `DORM_INVOICE_DELETE` (or existing admin overrides) and **Approve** only with `DORM_INVOICE_CONFIRM` (or existing admin overrides). Each action processes only selected rows eligible for that action and gives clear feedback when none qualify.
4. Restore the delete confirmation flow and re-enable `InvoicesService.bulkDelete`. Normalize/deduplicate IDs, reject malformed/not-found/paid invoices, delete only unpaid invoice documents, return deterministic partial results, and never delete the associated `MeterReading`.
5. Preserve existing bulk-approval request IDs and partial-result handling for selected pending-proof invoices. Do not change single-review or revoke behavior.
6. Remove the three unused entries from `baseDormitoryTabs`, preserve all remaining tabs and conditional PDF behavior, and update layout assertions.
7. Add regression tests for permissions, mixed eligibility, confirmation/cancel, partial delete/approval, meter-history preservation, tab absence, and direct child rendering; then run affected builds/checks and review the final diff.

## Acceptance Criteria

- AC-01: With either relevant permission, selecting an eligible visible row opens one bar showing the selected count; clearing selection closes it.
- AC-02: **Delete** is visible only to delete-authorized users, requires confirmation, and calls the existing bulk-delete API with delete-eligible selected IDs.
- AC-03: The backend deletes unpaid invoices only; paid, malformed, and missing IDs are reported without being deleted, with deterministic partial-result counts.
- AC-04: Invoice deletion never calls a delete operation on `MeterReading`; the same room/month meter record remains available for invoice regeneration.
- AC-05: **Approve** is visible only to confirm-authorized users and submits only selected invoices with a pending uploaded payment proof; mixed/ineligible selections cannot approve invalid invoices.
- AC-06: Admin override behavior remains consistent with current invoice actions. Users with neither permission see no bulk-action selection controls.
- AC-07: The bar contains only the requested bulk actions **Delete** and **Approve**, plus its existing clear-selection control.
- AC-08: **Violations**, **Maintenance**, and **Reports** are absent from Dormitory tabs for every permission set; remaining tabs, active-tab resolution, navigation, and conditional PDF tab still work.
- AC-09: The three direct routes/pages and their backend APIs are not deleted or modified.
- AC-10: Focused frontend/backend tests, frontend typecheck, and both affected builds pass.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/invoices/page.test.tsx" "src/app/(dashboard)/dormitory/layout.test.tsx"` => invoice actions and trimmed tabs pass.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/invoices.service.spec.ts dormitory/controllers/invoices.controller.spec.ts` => deletion/review contracts pass and no meter deletion occurs.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors.
- `D:\PROJECT\manager_points\frontend` :: `npm run build` => Next.js build passes.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => Nest build passes.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

## Safety Gates

- Implementation and automated tests need a separate implementation request because this is planning-only.
- Human Gate trigger: any manual smoke test that deletes real invoice documents, any database restore, or deployment enabling the destructive action.
- Required artifact: named environment, selected disposable invoice IDs/statuses, confirmation that meter records are backed up/preserved, expected API result, backup reference, and rollback/restore plan.
- Approval: explicit approval immediately before the first real database deletion or deployment.
- Resume point: after code, mock/unit tests, typecheck, builds, and review pass; before live deletion/deployment.

## Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Review evidence: focused test outputs and final diff/status.
- Checkpoint: current base commit plus final scoped diff; no intermediate checkpoint required during planning.
- Effective Rules Manifest (SHA-256):
  - `safety.md`: `6a3f283b835394b1af1f6380d94cba260acbed8a60d3065dd5365bb15806a772`
  - `global.md`: `67806f70a5f89adf42e3be88413cc76cc27a02c90fad0609ae71de34d046a43f`
  - `antigravity-operating-contract.md`: `51f3677c7e44121529cc0a4b17e5667bcbd2147ee63c6f30207c10d5deb51790`
  - `orchestrator.md`: `b782109e896b2fa48a6523358a788a9db9b81b72f3d8fc66f70019395738d716`
  - `pipeline.md`: `0419c072380887f96b37fe4eb48dae764306f46fb03190b176a43ebcea3f41f3`

## Execution Budgets

- Step deadline: 600 seconds; maximum 1,800 seconds when builds require it.
- Concurrency: one writer per path; serialize overlapping frontend/backend edits.
- Idempotent retries: 2; engineering loops: 3; review remediation cycles: 2.
- Stop on scope expansion, permission-contract changes, meter-data mutation, destructive live testing without approval, or unrelated failures.
