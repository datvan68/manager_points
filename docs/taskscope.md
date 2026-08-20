# Taskscope: Bulk delete invoices and align Dormitory invoice UI

## Task Identity and Pipeline

- Task: `dormitory-invoice-bulk-delete-and-ui-alignment`
- Pipeline: `feature_development`
- Profile: Full; rules 3.2.0.
- Repository: `D:\PROJECT\manager_points`; current branch `main`.
- Authority: Planning only; this taskscope does not authorize implementation, migration, deletion, or production data changes.

## Risk Level

- Risk: high because the task introduces destructive invoice deletion and changes a payment confirmation modal.
- Blast radius: Dormitory invoice API/permissions, invoice table selection, payment modal, and meter-reading page layout.
- No database schema migration is expected. Any migration, backfill, production deletion, or deploy requires a Human Gate.

## Objective

1. Add row checkboxes to the `Hóa đơn` table/card view. Selecting invoices opens the shared `FloatingActionBar` with bulk delete protected by the shared `ConfirmModal`.
2. Restyle the invoice payment modal to match Figma node `540:5` in file `manage-point`.
3. Fix the visual alignment between `TỔNG TIỀN` and `TRẠNG THÁI` headers and their row values shown in the supplied screenshot.
4. Add consistent outer spacing on all sides of the `Ghi chỉ số điện - nước KTX` page.

## Current Evidence

- `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx` uses `ResponsiveDataView` without `selection`, `FloatingActionBar`, or `ConfirmModal`.
- `frontend/src/components/ui/ResponsiveDataView.tsx` already supports desktop/mobile row selection and select-all; reuse it instead of adding another checkbox system.
- Dormitory roster/building pages already demonstrate the repository pattern for `FloatingActionBar` plus danger `ConfirmModal`.
- The frontend API, invoice controller, and invoice service currently expose no invoice delete/bulk-delete operation.
- The permission registry has `DORM_INVOICE_READ`, `DORM_INVOICE_CREATE`, and `DORM_INVOICE_CONFIRM`, but no dedicated delete permission.
- Total uses right alignment and status uses center alignment. The supplied 447×127 screenshot shows inconsistent header/value axes; verify header and cell alignment together at the same viewport.
- `meter-readings/page.tsx` starts with `space-y-6 pb-16` but has no left/right/top outer padding, so content touches the layout edges.
- Figma node `https://www.figma.com/design/ziRilpb4uf42X4NJx73Hfa/manage-point?node-id=540-5&m=dev` is reachable but returns `Password required`; exact design tokens could not be inspected during planning.

## Scope Boundaries

### Backend and authorization

- Add a dedicated bulk-delete invoice endpoint and service operation.
- Add and enforce `DORM_INVOICE_DELETE`; update only the repository-native permission bootstrap/default role assignment required for intended Dormitory administrators.
- Accept an explicit non-empty array of invoice IDs, normalize duplicates, validate IDs, and return deterministic requested/deleted/not-found/rejected details.
- Use one bounded bulk database operation where possible; never accept table filters as deletion criteria.
- Define and test the paid-invoice rule before implementation. Default safety assumption: `Đã thu`/`Đã thanh toán` invoices are rejected unless the product owner explicitly authorizes deletion.
- Do not delete uploaded proof files from disk unless separately authorized.

### Invoice table and bulk action

- Add selected invoice state and wire `ResponsiveDataView.selection` for desktop table and mobile cards.
- Select-all applies only to loaded rows on the current page. Page, filter, search, or successful reload changes clear stale selection.
- Show `FloatingActionBar` only with selection. Include selected count, clear action, and permission-gated danger `Xóa` action.
- `Xóa` opens shared danger `ConfirmModal`; cancel makes no API call. Confirm prevents double submission, calls bulk delete once, reports partial failures, refreshes list/meta, and clears successfully deleted IDs.
- Preserve filters, pagination, payment/proof actions, responsive cards, and row actions outside selection handling.

### Payment modal and alignment

- Treat Figma node `540:5` as source of truth after access is available. Capture modal dimensions, regions, content order, padding/gaps, typography, colors, radius, shadows, controls, actions, proof/QR areas, and responsive behavior before coding.
- Map current data/actions into that design without changing payment validation, upload limits/types, methods, payload, status transition, toast, or proof behavior.
- Preserve accessible dialog title, focus trap, safe close/Escape behavior, labels, loading/disabled states, and viewport-safe scrolling.
- Fix total/status alignment at the column definition/render boundary so each header and value share the same axis and stable width. Include rows with the `Miễn thu` badge; do not apply a screenshot-specific offset.

### Meter-reading page spacing

- Add responsive outer page padding equivalent to the invoice page (`p-4 sm:p-6`, adapted only if the parent already supplies a side).
- Preserve internal card gaps and bottom clearance; avoid double padding/horizontal overflow across header, cards, skeleton, empty state, popover, and mobile viewport.

## Target Files

- `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx`
- `frontend/src/app/(dashboard)/dormitory/invoices/page.test.tsx`
- `frontend/src/app/(dashboard)/dormitory/invoices/meter-readings/page.tsx` and its focused test (create beside the page only if absent)
- `frontend/src/api/dormitory-api.ts`
- `backend/src/dormitory/controllers/invoices.controller.ts`
- `backend/src/dormitory/controllers/invoices.controller.spec.ts`
- `backend/src/dormitory/services/invoices.service.ts`
- `backend/src/dormitory/services/invoices.service.spec.ts`
- `backend/src/auth/permissions.registry.ts` and only verified native bootstrap/default-role files required for `DORM_INVOICE_DELETE`

## Out of Scope

- Invoice calculation, meter-reading persistence, billing dates, statuses, reports, or payment-proof storage changes.
- Single-row delete UI or selecting/deleting all records across every pagination page/filter query.
- Physical proof-file deletion, migrations, historical backfill, deployment, or production cleanup.
- Shared component changes unless a reproducible shared-component defect makes them unavoidable and the boundary is re-approved.

## Implementation Steps

1. Obtain read access/password for Figma node `540:5`; inspect desktop and intended responsive state and record measurable modal tokens.
2. Add backend tests for missing/paid/mixed invoices, duplicate/invalid IDs, permission guard, and deterministic bulk-delete response.
3. Implement `DORM_INVOICE_DELETE`, guarded bulk-delete route, and bounded service deletion with the approved paid rule.
4. Add typed frontend bulk-delete API and partial-result contract.
5. Wire current-page selection; add permission-gated `FloatingActionBar`, danger `ConfirmModal`, pending state, partial failure handling, refresh, and reset rules.
6. Refactor only payment modal markup/styles needed to reproduce Figma node `540:5`, retaining payment/upload/QR behavior.
7. Normalize total/status header and cell alignment and test their shared alignment contract.
8. Add responsive outer padding to the meter-reading page and verify all page states for overflow/double padding.
9. Run focused tests, builds/typechecks, visual comparison at desktop/mobile viewports, and final diff/status review.

## Acceptance Criteria

- AC-01: Every loaded invoice row/card has an accessible checkbox; select-all affects exactly the current page and reflects state correctly.
- AC-02: Selection shows `FloatingActionBar` with correct count and permission-gated `Xóa`; clearing or changing page/filter/search removes stale selection.
- AC-03: Delete opens shared danger `ConfirmModal` with exact count. Cancel does not mutate; confirm sends one request and cannot double-submit.
- AC-04: Bulk deletion requires `DORM_INVOICE_DELETE`, rejects empty/invalid input, deduplicates IDs, never deletes outside submitted IDs, and returns tested partial-result details.
- AC-05: Paid behavior is approved and tested. Until approved otherwise, paid invoices remain and are reported rejected; valid unpaid invoices may be deleted.
- AC-06: After success/partial success, rows and totals refresh, successful IDs clear, rejected IDs remain observable, and a clear Vietnamese result appears.
- AC-07: Payment modal matches accessible Figma node `540:5` in structure, size, spacing, typography, colors, controls, proof/QR areas, actions, and responsive stacking, with visual evidence.
- AC-08: Payment submission, proof upload/preview, constraints, method, notes, status update, loading/errors, and accessibility retain existing behavior.
- AC-09: `TỔNG TIỀN` and `TRẠNG THÁI` headers align with corresponding cells on desktop; normal, paid/unpaid, and exempt rows keep stable axes.
- AC-10: Meter-reading page has consistent top/bottom/left/right spacing at mobile and desktop, without clipping, double padding, or regressions.

## Verification

- Backend :: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/controllers/invoices.controller.spec.ts dormitory/services/invoices.service.spec.ts` => delete contract, permission, validation, paid rule, and partial results pass.
- Backend :: `D:\PROJECT\manager_points\backend` :: `npm run build` => Nest compiles.
- Frontend :: `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/invoices/page.test.tsx"` plus focused meter-reading test => selection, confirmation, deletion states, modal regression, alignment, and spacing pass.
- Frontend :: `D:\PROJECT\manager_points\frontend` :: repository-native typecheck/build command => compile succeeds.
- Visual :: compare payment modal with Figma node `540:5` at reference and mobile viewports; inspect supplied table misalignment case and meter page loading/empty/populated states.
- Final :: repository root :: `git diff --check`, scoped diff review, `git status --short` => no unintended changes; preserve user-owned changes.

## Safety Gates and Open Decisions

- Gate: Figma node `540:5` is password-protected. Do not claim visual parity or finalize modal CSS until read access or a dimensioned export is provided.
- Gate: Confirm whether paid invoices may ever be deleted. Default is rejection to preserve financial audit history.
- Human Gate: migration, persistent permission/data backfill, physical proof deletion, deployment, or production mutation.
- Stop if deletion must cascade to reports, receipts, transactions, or other records not evidenced in the invoice service.

## Artifacts and Budgets

- Planning artifact: `docs/taskscope.md`.
- Step deadline 600 seconds; build maximum 1,800 seconds; retry 2; engineering loop 3; review remediation 2.
- One writer per path; serialize backend delete contract before frontend integration.
