# Taskscope: Simplify invoice payment and support approval revocation

## Metadata

- Task: `dormitory-invoice-payment-ui-and-revoke-approval`
- Pipeline: planning-only / Full
- Risk: high
- Status: ready for implementation approval; this taskscope does not authorize implementation

## Objective

Simplify the Dormitory invoice payment modal, balance the invoice table layout, and allow an authorized reviewer to revoke an approved transfer proof so the member can upload a replacement proof for review.

## Verified baseline

- `Hóa đơn thanh toán` currently exposes both `Phương thức thanh toán` and `Ghi chú xác nhận`, and sends `payment_method` plus optional `notes` in the payment request.
- The transfer-proof flow already supports `pending`, `approved`, and `rejected`; approval changes the invoice to `Đã thu`.
- The backend review operation currently accepts only invoices in `pending`, so an `approved` proof cannot be revoked.
- Updating or replacing a proof sets its review state back to `pending`.
- Invoice amount cells use right alignment, status uses center alignment, and actions use right alignment. The supplied screenshot shows that the visual centers of headers and row values are inconsistent across the amount, status, and action columns.
- Relevant frontend/backend files already contain uncommitted work. Implementation must preserve those changes and avoid rewriting unrelated behavior.

## Functional scope

### 1. Simplify `Hóa đơn thanh toán`

- Remove the visible `Phương thức thanh toán` selector.
- Remove `Ghi chú xác nhận` and stop sending notes from this modal.
- Treat this member-facing upload flow as transfer-proof submission; send the repository's canonical `Chuyển khoản` value internally without exposing a redundant selector.
- Require a valid proof image before submission. A successful submission sets review state to `pending` and keeps the invoice at `Chưa thu` until approved.
- Update labels and submit feedback to describe submitting proof for review, not immediately collecting payment.
- Preserve existing file constraints and preview/error/loading behavior.
- Do not remove stored payment-method or historical-note fields from the schema because other flows and historical records may still use them.

### 2. Balance the invoice table

- Define explicit, stable width/alignment rules for the invoice columns instead of relying only on content width.
- Keep `Phòng` and `Kỳ thu` left aligned.
- Use one consistent alignment for each amount column (`Tiền điện`, `Tiền nước`, `Tổng tiền`) in both header and body; values must share the same visual axis.
- Center `Trạng thái` and `Thao tác` in both header and body so the badge/button sits directly beneath its label.
- Account for the selection-checkbox column without shifting the remaining headers away from their body cells.
- Keep reasonable minimum widths for status/action controls and allow horizontal scrolling at narrow desktop widths instead of compressing or overlapping content.
- Preserve the existing responsive card/mobile behavior outside the affected desktop table layout.

### 3. Revoke an approved proof

- Show `Bỏ duyệt` in `Kiểm tra chứng từ thanh toán` only when the proof is `approved` and the user has invoice-confirm permission.
- Require the shared confirmation modal before revocation; do not use a browser-native confirmation dialog.
- Add a guarded backend/API operation for the transition `approved -> rejected` (revoked):
  - change the invoice from `Đã thu` to `Chưa thu`;
  - clear the active collection markers that no longer apply (`paid_at` and `confirmed_by_id`);
  - record who revoked the approval and when;
  - retain the existing proof as review evidence until it is replaced;
  - allow the member to upload a replacement, which starts a new `pending` review.
- Do not treat revocation as deleting the proof or invoice.
- Reject revocation when the invoice is not transfer-based, has no proof, is not currently approved/collected, or the actor lacks permission.
- Make repeated revocation safe: a second request must fail without additional mutation.
- Return the updated invoice so the modal and table immediately show `Chưa thu`/rejected state and the replacement-upload action.
- Preserve auditability. If overwriting the existing reviewer fields would erase the original approval evidence, add focused revocation metadata (revoker and revoked time) rather than losing that evidence.

## Expected write boundary

- `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx`
- `frontend/src/app/(dashboard)/dormitory/invoices/page.test.tsx`
- `frontend/src/components/ui/ResponsiveDataView.tsx` only if the alignment cannot be fixed through invoice column configuration without changing other consumers
- `frontend/src/api/dormitory-api.ts`
- `backend/src/dormitory/schemas/invoice.schema.ts`
- focused invoice DTO files under `backend/src/dormitory/dto/`
- `backend/src/dormitory/controllers/invoices.controller.ts`
- `backend/src/dormitory/controllers/invoices.controller.spec.ts`
- `backend/src/dormitory/services/invoices.service.ts`
- `backend/src/dormitory/services/invoices.service.spec.ts`

## Out of scope

- Removing payment-method or notes data from historical invoices or database schemas.
- Changing electricity/water calculations, billing periods, due dates, meter readings, invoice deletion, or room selection.
- Allowing members to approve, reject, or revoke their own proof unless they already hold the confirmation permission.
- Deleting old proof files, changing upload storage, backfilling historical invoices, deployment, or production data mutation.
- Redesigning `ResponsiveDataView` for unrelated pages.

## Implementation steps

1. Preserve the current dirty worktree and add focused tests for the payment modal, table alignment contract, and approved-proof revocation.
2. Simplify the payment modal to proof upload/submission with an internal transfer method and no notes payload.
3. Apply explicit invoice-column alignment and width rules; change the shared table only if a local column contract cannot express the required layout.
4. Add the authorized, validated revoke operation and audit metadata, then expose it through the frontend API.
5. Add the `Bỏ duyệt` confirmation flow and refresh the modal/table from the returned invoice.
6. Run focused frontend/backend tests, static checks, visual inspection, and final diff/status review.

## Acceptance criteria

- AC-01: `Hóa đơn thanh toán` contains neither a payment-method selector nor `Ghi chú xác nhận`.
- AC-02: The payment request from this modal uses `Chuyển khoản`, contains no notes from the removed field, and cannot submit without a valid proof image.
- AC-03: Successful proof submission leaves the invoice `Chưa thu` with review state `pending` and gives clear success feedback.
- AC-04: Every desktop table header aligns with its corresponding values; amount values share a consistent axis, and status/action controls are centered under their labels as shown necessary by the supplied screenshot.
- AC-05: Checkbox selection and narrow widths do not offset, overlap, or truncate the status/action columns incorrectly.
- AC-06: An authorized reviewer sees `Bỏ duyệt` only for an approved transfer proof and must confirm through the shared confirmation modal.
- AC-07: Confirmed revocation changes the invoice to `Chưa thu`, records revocation audit data, clears active paid/confirmed markers, and retains the old proof until replacement.
- AC-08: After revocation, a member can upload a new proof; successful replacement changes review state to `pending` and does not mark the invoice collected.
- AC-09: Invalid, unauthorized, and repeated revocation requests fail without partial mutation.
- AC-10: Historical invoices and non-transfer payment behavior remain compatible outside this member-facing proof flow.

## Verification

- Frontend :: `D:\PROJECT\manager_points\frontend` :: run the focused invoice page tests => removed controls/payload, mandatory proof, table classes, revoke confirmation, and resubmission behavior pass.
- Backend :: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/controllers/invoices.controller.spec.ts dormitory/services/invoices.service.spec.ts` => authorized transition, audit fields, cleared paid markers, invalid transitions, and idempotency pass.
- Static :: run repository-native frontend and backend type/lint checks for affected packages => no introduced errors.
- Visual :: inspect the invoice table with and without selected rows at desktop and narrow widths => headers and cells remain balanced; status/action controls are centered and do not overlap.
- Final :: `D:\PROJECT\manager_points` :: `git diff --check -- docs/taskscope.md` and `git status --short` => taskscope has no whitespace errors and no implementation file was changed by this planning step.

## Gates and assumptions

- Assumption: removing `Phương thức thanh toán` means the member-facing modal is transfer-only, because its required outcome is uploading a transfer proof for review.
- Assumption: `Bỏ duyệt` is a controlled reversal of collection, represented to the member as rejected/not collected while preserving approval and revocation audit evidence.
- Use the existing invoice-confirm permission for `Bỏ duyệt`; introducing or assigning a new permission requires a product authorization decision.
- Human Gate: schema migration/backfill, deletion of stored proof files, permission assignment changes, deployment, or production data mutation.
