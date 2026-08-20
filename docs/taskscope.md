# Taskscope: Complete invoice payment review, due-date configuration, and transfer QR

## Metadata

- Task: `dormitory-invoice-payment-review-due-date-and-transfer-qr`
- Pipeline: planning-only / Full
- Risk: high
- Status: ready for implementation approval; this taskscope does not authorize implementation

## Objective

Complete the shared Dormitory `Hóa đơn thanh toán` flow, make rejection return the proof to the review queue, replace the relative automatic-collection-day setting with an explicit payment deadline, use a configurable default transfer-QR image without offering a QR download action, and compact the modal so its actions remain visible without avoidable vertical scrolling.

## Verified baseline

- `Hóa đơn thanh toán` currently exposes both `Phương thức thanh toán` and `Ghi chú xác nhận`, and sends `payment_method` plus optional `notes` in the payment request.
- The transfer-proof flow already supports `pending`, `approved`, and `rejected`; approval changes the invoice to `Đã thu`.
- The backend review operation currently accepts only invoices in `pending`, so an `approved` proof cannot be revoked.
- Updating or replacing a proof sets its review state back to `pending`.
- Invoice amount cells use right alignment, status uses center alignment, and actions use right alignment. The supplied screenshot shows that the visual centers of headers and row values are inconsistent across the amount, status, and action columns.
- The current invoice page still renders `Hóa đơn thanh toán` and `Kiểm tra chứng từ thanh toán` as two separate dialogs with substantially duplicated invoice, proof, and action content.
- The current `Thao tác` column uses centered header/content and `min-w-[150px]`; it does not deliberately anchor the column content to the table's right edge.
- `Không duyệt` currently persists `payment_review.status = rejected`; the requested behavior is to keep the proof available and return it to `pending` so an authorized reviewer can confirm it again.
- The payment QR is currently generated in the browser from a hard-coded MBBank/account payload (`1234567890`) instead of using an administrator-uploaded default QR image.
- The shared modal has a `max-h` container with vertical scrolling, while the proof actions remain in the long left column and the QR card reserves a large square/right column. This can force users to scroll to reach actions.
- The electricity/water configuration currently stores `configured_collection_days` and explains the deadline as the meter-reading date plus that number of days. Automatic invoice creation applies the same relative-day calculation.
- `Hóa đơn thanh toán` currently exposes `Tải mã QR chuyển khoản` and downloads the configured QR as a local image file.
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

### 2. Balance the invoice table and right-align `Thao tác`

- Define explicit, stable width/alignment rules for the invoice columns instead of relying only on content width.
- Keep `Phòng` and `Kỳ thu` left aligned.
- Use one consistent alignment for each amount column (`Tiền điện`, `Tiền nước`, `Tổng tiền`) in both header and body; values must share the same visual axis.
- Center `Trạng thái` in both header and body.
- Place `Thao tác` as the final column and align its header and every row action to the right. The action control must sit close to the table container's right padding instead of being centered in a reserved column.
- Keep a consistent right-side inset between the `Thao tác` header, its buttons, and the table edge; do not introduce a large empty trailing area.
- Account for the selection-checkbox column without shifting the remaining headers away from their body cells.
- Keep reasonable minimum widths for status/action controls and allow horizontal scrolling at narrow desktop widths instead of compressing or overlapping content.
- Preserve the existing responsive card/mobile behavior outside the affected desktop table layout.

### 3. Reuse `Hóa đơn thanh toán` for proof review

- Remove the separate `Kiểm tra chứng từ thanh toán` dialog implementation and open the existing `Hóa đơn thanh toán` modal in a review mode when the table action is `Duyệt` or `Kiểm tra`.
- Reuse one shared modal shell and shared invoice summary/proof presentation; do not duplicate the complete modal JSX under a second dialog.
- In payment/submission mode, retain the member-facing proof-upload behavior and its applicable submit/close actions.
- In review mode, show the current proof and add two footer actions for a pending proof:
  - `Không duyệt` with the existing rejection behavior;
  - `Duyệt` with the existing approval behavior.
- Show the two review actions only to users with invoice-confirm permission and only while review state is `pending`; disable both while a review request is running to prevent duplicate submissions.
- The modal title remains `Hóa đơn thanh toán`; use status text/badges and action labels to distinguish submission, pending review, approved, and rejected/revoked states.
- A successful approve/reject operation must update the shared modal and table immediately without opening another dialog or leaving stale status/action content.
- Keep image fallback, full-size image access, replacement upload, loading, error, and close behavior in the shared modal.

### 4. Revoke an approved proof

- Show `Bỏ duyệt` in the shared `Hóa đơn thanh toán` review mode only when the proof is `approved` and the user has invoice-confirm permission.
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

### 5. Return `Không duyệt` to the review queue

- Change the pending-proof `Không duyệt` action so the invoice remains `Chưa thu` and the proof ends in `pending`, not `rejected`.
- Keep the submitted proof and its submission timestamp; do not require the member to upload the same image again before another review.
- Record the unsuccessful review attempt separately (reviewer and time, and decision history if the existing embedded review object cannot preserve it) without presenting the active proof as rejected.
- After the request succeeds, refresh the shared modal and table immediately. The authorized reviewer must again see `Không duyệt` and `Duyệt` for that proof.
- Keep `Bỏ duyệt` behavior distinct: revoking an already approved payment may remain the rejected/revoked state that allows the member to replace the proof.
- Prevent concurrent or repeated clicks while the request is running; each completed `Không duyệt` action records at most one review attempt.

### 6. Configure and display a default transfer QR image

- Add a transfer-QR image field to the existing invoice electricity/water configuration modal, using the existing proof-image upload conventions where practical.
- Allow an authorized configuration user to select, preview, replace, and save one default QR image. Accept PNG, JPEG/JPG, or WebP and enforce the repository's canonical image size/type validation.
- Persist only the stored image metadata/URL in the invoice configuration; do not store a browser object URL or base64 payload in the database.
- Load the saved QR image into `Hóa đơn thanh toán` for every invoice by default. Remove the hard-coded account number/bank QR payload and the client-generated placeholder QR from this flow.
- When no default QR has been configured or the image cannot load, show a compact, explicit unavailable state; do not display incorrect fallback banking details.
- Remove `Tải mã QR chuyển khoản` and its client-side fetch/blob/download handling from `Hóa đơn thanh toán`. The QR remains visible for scanning only.
- Restrict QR configuration changes to the existing invoice-configuration permission. Viewing the configured QR follows the existing invoice access rules.

### 7. Compact the QR and action area

- Reduce the QR card's vertical footprint while preserving a scannable, undistorted image and readable unavailable state.
- Move the context-appropriate action buttons into the QR/right-side area on desktop so they remain visible alongside the QR and do not sit below the long proof column.
- Keep only actions valid for the current state: upload/send, replace/save, `Không duyệt`/`Duyệt`, `Bỏ duyệt`, and close as applicable; do not duplicate the same action in both columns and do not expose a QR download action.
- Use a compact or sticky action arrangement at narrow widths so buttons remain reachable without covering content. The modal may scroll for genuinely tall proof images, but ordinary payment/review states at common desktop viewport heights must not require vertical scrolling just to reach actions.
- Preserve keyboard focus order, visible focus states, disabled/loading states, and touch-friendly targets after moving the buttons.

### 8. Replace automatic collection days with `Hạn thanh toán`

- In `Cấu hình định mức & đơn giá điện - nước`, remove the visible `Số ngày thu tự động (ngày)` number input and its relative-date explanation.
- Add a required `Hạn thanh toán` date control using the repository's existing date/calendar conventions. Store and submit a canonical date value rather than deriving the deadline in the browser from a number of days.
- Treat the selected deadline as the deadline for the upcoming meter-reading/billing batch. Every invoice created by that completed batch receives this same explicit `due_date`, regardless of the order or exact time at which each room's meter reading is saved.
- Require the deadline to be on or after the batch/payment start date. Show a clear validation error and prevent saving/creating invoices when it is earlier.
- Update the utility configuration DTO/schema/API contract and automatic invoice-generation service so `configured_collection_days` is no longer the source of new invoice deadlines.
- Preserve each existing invoice's stored `due_date`; changing the configured deadline must not retroactively rewrite previously created invoices.
- Define compatibility for an existing configuration that only has `configured_collection_days`: allow it to load without crashing, but require an explicit `Hạn thanh toán` before the next new billing batch. Do not silently continue generating new deadlines from the legacy value.
- Keep manual advanced invoice editing capable of displaying and updating the individual invoice `due_date` under its existing validation rules.

## Expected write boundary

- `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx`
- `frontend/src/app/(dashboard)/dormitory/invoices/page.test.tsx`
- `frontend/src/components/ui/ResponsiveDataView.tsx` only if the alignment cannot be fixed through invoice column configuration without changing other consumers
- `frontend/src/api/dormitory-api.ts`
- `backend/src/dormitory/schemas/invoice.schema.ts`
- the existing invoice configuration schema/service files under `backend/src/dormitory/`
- focused invoice DTO files under `backend/src/dormitory/dto/`
- `backend/src/dormitory/controllers/invoices.controller.ts`
- `backend/src/dormitory/controllers/invoices.controller.spec.ts`
- `backend/src/dormitory/services/invoices.service.ts`
- `backend/src/dormitory/services/invoices.service.spec.ts`

## Out of scope

- Removing payment-method or notes data from historical invoices or database schemas.
- Changing electricity/water calculations, billing periods, meter readings, invoice deletion, or room selection beyond assigning the configured explicit deadline to newly generated invoices.
- Allowing members to approve, reject, or revoke their own proof unless they already hold the confirmation permission.
- Deleting old proof files, changing upload storage, backfilling historical invoices, deployment, or production data mutation.
- Generating VietQR data dynamically from bank-account fields, integrating a payment gateway, supporting multiple QR images per building/room, or downloading the displayed QR from the payment modal.
- Redesigning `ResponsiveDataView` for unrelated pages.
- Changing the visual design of unrelated dialogs or introducing a new generic modal framework.

## Implementation steps

1. Preserve the current dirty worktree and add focused tests for the shared payment/review modal, action-column alignment, review-queue return, default QR configuration, and approved-proof revocation.
2. Simplify the payment modal to proof upload/submission with an internal transfer method and no notes payload.
3. Consolidate proof viewing and review into `Hóa đơn thanh toán`, parameterizing its mode/state instead of maintaining a second complete dialog.
4. Apply explicit invoice-column alignment and width rules, with `Thao tác` anchored to the right edge; change the shared table only if local column configuration cannot express the required layout.
5. Change `Không duyệt` to an audited `pending -> pending` review attempt while keeping revocation as a separate approved-proof transition.
6. Extend the existing invoice configuration and upload/API flow to store one default transfer-QR image, replace the hard-coded generated QR in the shared modal, and remove its download action and download-only code.
7. Replace `configured_collection_days` in the configuration and automatic-generation flow with an explicit required payment deadline for the upcoming batch, while retaining historical invoice deadlines.
8. Move state-specific actions into a compact QR/right-side action area and refresh the modal/table from every returned invoice.
9. Run focused frontend/backend tests, static checks, visual inspection, and final diff/status review.

## Acceptance criteria

- AC-01: `Hóa đơn thanh toán` contains neither a payment-method selector nor `Ghi chú xác nhận`.
- AC-02: The payment request from this modal uses `Chuyển khoản`, contains no notes from the removed field, and cannot submit without a valid proof image.
- AC-03: Successful proof submission leaves the invoice `Chưa thu` with review state `pending` and gives clear success feedback.
- AC-04: Every desktop table header aligns with its corresponding values; amount values share a consistent axis and status remains centered.
- AC-05: `Thao tác` is the final column; its header and controls are right-aligned close to the table's right padding with no unintended trailing gap.
- AC-06: Checkbox selection and narrow widths do not offset, overlap, or truncate the status/action columns incorrectly.
- AC-07: Clicking `Duyệt` or `Kiểm tra` opens `Hóa đơn thanh toán`; no separate `Kiểm tra chứng từ thanh toán` dialog remains.
- AC-08: For a pending proof, an authorized reviewer sees exactly `Không duyệt` and `Duyệt` review actions in the shared modal; unauthorized users do not see them.
- AC-09: `Duyệt` updates the shared modal and invoice table immediately, with duplicate submission prevented while loading.
- AC-10: An authorized reviewer sees `Bỏ duyệt` only for an approved transfer proof and must confirm through the shared confirmation modal.
- AC-11: Confirmed revocation changes the invoice to `Chưa thu`, records revocation audit data, clears active paid/confirmed markers, and retains the old proof until replacement.
- AC-12: After revocation, a member can upload a new proof; successful replacement changes review state to `pending` and does not mark the invoice collected.
- AC-13: Invalid, unauthorized, and repeated review/revocation requests fail without partial mutation.
- AC-14: Historical invoices and non-transfer payment behavior remain compatible outside this member-facing proof flow.
- AC-15: `Không duyệt` keeps the invoice `Chưa thu`, retains the proof, records one review attempt, and returns the active review state to `pending` so the same proof can be reviewed again.
- AC-16: After `Không duyệt`, the authorized reviewer immediately sees both `Không duyệt` and `Duyệt` again without requiring a replacement upload.
- AC-17: An authorized user can upload, preview, replace, and persist one valid default transfer-QR image from the invoice configuration modal; invalid files are rejected.
- AC-18: `Hóa đơn thanh toán` displays the persisted QR image by default and contains no hard-coded bank/account QR payload. Missing or broken QR images show an explicit unavailable state.
- AC-19: `Hóa đơn thanh toán` contains no `Tải mã QR chuyển khoản` button and no user-triggered QR download behavior; the configured QR remains visible for scanning.
- AC-20: At common desktop viewport heights, ordinary submission and pending-review modal states expose their applicable buttons without vertical scrolling; narrow layouts remain usable and accessible.
- AC-21: `Cấu hình định mức & đơn giá điện - nước` contains a required `Hạn thanh toán` date control and no `Số ngày thu tự động` input or relative-day helper text.
- AC-22: Completing a meter-reading batch assigns the configured explicit deadline to every newly generated room invoice; invoice creation does not add `configured_collection_days` to each room's reading timestamp.
- AC-23: A deadline earlier than the batch/payment start date is rejected with a visible validation message and creates no partially updated invoices.
- AC-24: Updating the configured deadline affects only a subsequent billing batch and does not modify `due_date` on existing invoices.
- AC-25: Legacy configurations without an explicit deadline load safely but cannot generate the next batch until an authorized user supplies a valid `Hạn thanh toán`.

## Verification

- Frontend :: `D:\PROJECT\manager_points\frontend` :: run the focused invoice page tests => shared modal modes, pending return, default QR upload/display without download, explicit deadline configuration/validation, compact actions, right-aligned action column, revoke confirmation, and resubmission behavior pass.
- Backend :: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/controllers/invoices.controller.spec.ts dormitory/services/invoices.service.spec.ts` plus focused invoice-configuration tests => pending-return audit, QR metadata persistence/permission/validation, explicit batch deadline propagation, legacy-config handling, historical deadline preservation, authorized transitions, cleared paid markers, invalid transitions, and idempotency pass.
- Static :: run repository-native frontend and backend type/lint checks for affected packages => no introduced errors.
- Visual :: inspect the invoice table with and without selected rows at desktop and narrow widths => headers and cells remain balanced; `Thao tác` stays against the right edge and does not overlap. Inspect payment, pending-review, approved, and rejected/revoked states with configured, missing, and broken QR images; ordinary states expose actions without avoidable vertical scrolling.
- Final :: `D:\PROJECT\manager_points` :: `git diff --check -- docs/taskscope.md` and `git status --short` => taskscope has no whitespace errors and no implementation file was changed by this planning step.

## Gates and assumptions

- Assumption: removing `Phương thức thanh toán` means the member-facing modal is transfer-only, because its required outcome is uploading a transfer proof for review.
- Assumption: `Bỏ duyệt` is a controlled reversal of collection, represented to the member as rejected/not collected while preserving approval and revocation audit evidence.
- Assumption: "tải ảnh mã QR chuyển khoản để xác nhận mặc định" means an authorized user uploads one persistent default transfer-QR image in the existing invoice configuration modal, and all invoice payment modals display that image.
- Assumption: `Không duyệt` is a non-terminal review attempt (`pending -> pending`), while `Bỏ duyệt` remains the action that reopens an approved payment for proof replacement.
- Assumption: replacing `Số ngày thu tự động` with `Hạn thanh toán` means selecting one explicit calendar date for the upcoming monthly meter-reading batch, shared by invoices generated from that batch; it is not a renamed relative number-of-days field.
- Use the existing invoice-confirm permission for `Bỏ duyệt`; introducing or assigning a new permission requires a product authorization decision.
- Human Gate: schema migration/backfill, deletion of stored proof files, permission assignment changes, deployment, or production data mutation.
