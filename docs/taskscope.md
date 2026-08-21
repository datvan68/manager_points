# Task Identity and Pipeline

- Task ID: `dormitory-member-room-fee-collection`
- Pipeline: `feature_development`
- Profile: Full, planning-only
- Protocol/rules version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base/current commit: `5ace537a9117bbb111f1047bd068b682434313ae`
- Base state: clean worktree before this task artifact is written.

# Risk Level

- Risk: high.
- Evidence: the feature creates persistent per-member financial records, adds MongoDB schemas/indexes and API contracts, uploads/displays payment QR/proofs, and introduces approval state transitions across backend and frontend.
- Environment: development source planning. Source edits are reversible through Git; persisted charge generation and production index/application are not automatically reversible.
- Blast radius: Dormitory invoice UI/API, roster-to-room membership snapshots, payment configuration, and payment review audit history.

# Objective

Add a second, clearly separated room-fee collection view inside `Hóa đơn` so staff can generate and manage one charge per currently assigned dormitory member, configure standard/air-conditioned monthly rates, QR and collection duration, and record or review payments without changing the existing electricity/water workflow.

# Scope Boundaries

- Approved boundaries:
  - `frontend/src/app/(dashboard)/dormitory/invoices/**`
  - `frontend/src/components/dormitory/invoices/**` (new)
  - `frontend/src/api/dormitory-api.ts` and its focused test
  - `backend/src/dormitory/**`
  - `docs/taskscope.md`
- Expected backend write paths:
  - `backend/src/dormitory/schemas/room-fee-config.schema.ts` (new)
  - `backend/src/dormitory/schemas/room-fee-invoice.schema.ts` (new)
  - `backend/src/dormitory/dto/room-fee-invoice.dto.ts` (new)
  - `backend/src/dormitory/services/room-fee-invoices.service.ts` and `.spec.ts` (new)
  - `backend/src/dormitory/controllers/room-fee-invoices.controller.ts` and `.spec.ts` (new)
  - `backend/src/dormitory/dormitory.module.ts`
- Expected frontend write paths:
  - `frontend/src/api/dormitory-api.ts`
  - `frontend/src/api/dormitory-api.test.ts`
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.test.tsx`
  - `frontend/src/components/dormitory/invoices/RoomFeeCollection.tsx` and `.test.tsx` (new)
- Excluded boundaries: Contracts tab/service, electricity/water formulas or meter-reading persistence, student-facing payment portal/payment gateway, permissions registry, accounting exports, notifications, deployment, production data/index mutation, and deletion of collected financial records.

# Out of Scope

- Do not derive payers from active contracts; use assigned `DormitoryRosterEntry` records.
- Do not merge room fees into utility invoices or reuse their `{ room_id, billing_month }` uniqueness, because utility charges are per room while room fees are per member.
- Do not split a whole-room price among occupants. For this task, `Giá phòng thường/tháng` and `Giá phòng máy lạnh/tháng` mean the configured charge for one member per month. If product intent is a room-total price, amend the scope before implementation.
- Do not alter existing room `room_price`, retroactively recalculate issued charges, hard-delete collected charges, or expose raw upload filesystem paths.

# Context and Dependencies

- The current `Hóa đơn` page renders only the room-level electricity/water table and already provides search, month/status filters, payment modal, proof upload, pending/approved/revoked review flow, bulk approval, pagination, and an advanced utility-config icon.
- Existing legacy invoice creation is contract-based and therefore cannot satisfy this feature while the Contracts tab is unused.
- `DormitoryRosterEntry` contains the authoritative assigned `room_id`, member identity/name, semester, and requested room type; `Room.room_type` has canonical values `Thường` and `Máy lạnh`.
- The new room-fee model needs immutable payer/room/rate/period snapshots plus references for lookup. A named partial unique index must prevent issuing the same member the same configured collection period twice, including concurrent requests.
- Reuse `DORM_INVOICE_READ`, `DORM_INVOICE_CREATE`, and `DORM_INVOICE_CONFIRM`; no permission expansion is authorized.
- Reuse the current image restrictions (PNG/JPEG/WebP, maximum 5 MB), payment status vocabulary, request-id idempotency, optimistic state checks, and reviewer/revoker audit metadata.

# Steps

1. Capture focused frontend/backend baselines and document the current utility table/payment behavior that must remain unchanged.
2. Add `RoomFeeConfig` with non-negative standard and air-conditioned per-member monthly rates, `months_to_collect` as a bounded positive integer, optional validated transfer QR metadata, and updater audit fields. Add read/update and QR-upload endpoints guarded by existing invoice permissions.
3. Add a separate `RoomFeeInvoice` model containing a generated non-null unique code; roster/student/room references; immutable member name/code, room code/name/type, monthly rate, start/end month, month count, line description and total snapshots; payment/proof/review/audit fields; timestamps; and named lookup/partial uniqueness indexes.
4. Implement a preview/create-period command. It selects only roster entries currently assigned to valid rooms, maps canonical room type to configured rate, calculates `total_amount = monthly_rate * months_to_collect`, previews created/skipped/invalid counts, then creates one charge per eligible member with concurrency-safe idempotency. Reject unsupported room types or incomplete assignments explicitly and never leave a partially reported result ambiguous.
5. Implement paginated/searchable room-fee listing with filters for period, status, and room. Return the exact table fields: `Họ tên`, `Phòng`, `Kỳ thu`, `Khoản thu`, `Trạng thái`, `Thao tác`, plus stable IDs and pagination metadata.
6. Implement payment transitions for room fees: cash `Đóng ngay` marks collected immediately; transfer shows configured QR, accepts a validated proof, enters `Chờ duyệt`, supports `Duyệt`/`Không duyệt`, and allows approved proof revocation back to pending. Use atomic preconditions and idempotent request IDs; preserve proof and rejection/revocation audit history.
7. Add an internal `Thu điện nước` / `Thu phí phòng` view switch under the existing `Hóa đơn` navigation. Keep the current utility table as the default and mount the new table without mixing filters, selection, pagination, requests, or modal state between views.
8. Build the room-fee toolbar and table/card view: search and filters, create-period action with preview/confirmation, refresh, and an advanced icon opening configuration for both room-type rates, QR, and number of months. Restrict create/config/payment/review controls by existing permissions and provide loading, empty, error, retry, and partial-create feedback.
9. Reuse the established payment modal interaction and responsive data patterns. Display configured QR only for transfers; expose `Đóng ngay`, proof replacement, approve/reject/revoke actions only in valid states; prevent duplicate submits and reload the affected row/list after success.
10. Add service/controller/API/UI regression tests for calculations, roster snapshots, uniqueness/races, permission guards, validation/upload constraints, filters/pagination, all payment transitions, view isolation, responsive rendering, and preservation of the utility workflow. Run affected verification and review the final diff/status.

# Acceptance Criteria

- AC-01: `Hóa đơn` exposes separate `Thu điện nước` and `Thu phí phòng` views; opening, filtering, selecting, or paging one view does not mutate the other view's state, and the existing utility behavior remains green.
- AC-02: The room-fee table/card view displays `Họ tên`, `Phòng`, `Kỳ thu`, `Khoản thu`, `Trạng thái`, and `Thao tác`, with server pagination, search by member or room, period/status filters, and explicit loading/empty/error/retry states.
- AC-03: Authorized staff can configure per-member monthly rates for `Thường` and `Máy lạnh`, a positive bounded month count, and an optional validated QR image; invalid types, negative values, invalid files, oversized files, and server-owned metadata are rejected.
- AC-04: Before issuing a period, the UI shows start/end period, eligible count, skipped-existing count, invalid-assignment count, configured rates/month count, and expected total. Creation requires confirmation and reports deterministic per-category results.
- AC-05: Period creation uses only currently assigned roster members and creates one immutable charge snapshot per eligible member. Amount equals the applicable configured per-member monthly rate multiplied by month count; later roster moves or config changes do not change issued rows.
- AC-06: Repeating or concurrently submitting the same member/period request cannot create duplicate charges. Every created record has a non-null unique code; invalid/unassigned members are reported without corrupting successful rows.
- AC-07: `Đóng ngay` with cash changes an unpaid charge to `Đã thu` once and records payer method, confirmer, and timestamp. An already collected charge cannot be paid again.
- AC-08: Transfer payment displays the room-fee QR, stores a valid proof, and moves to `Chờ duyệt`. Approve moves atomically to `Đã thu`; reject records an audit attempt and remains pending for replacement/re-review; revoke returns an approved charge to pending without deleting proof or charge data.
- AC-09: Read/create/config/confirm actions enforce existing `DORM_INVOICE_*` permissions in both API and UI; unauthorized users cannot invoke hidden actions directly through the endpoints.
- AC-10: Existing utility invoice creation, meter readings, configuration, list filters, payment, review, bulk approval, and responsive display pass unchanged.
- AC-11: Focused tests, frontend typecheck/build, backend build, whitespace check, and changed-path review pass before completion.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/room-fee-invoices.service.spec.ts dormitory/controllers/room-fee-invoices.controller.spec.ts dormitory/services/invoices.service.spec.ts dormitory/controllers/invoices.controller.spec.ts` => configuration, issuance, snapshot, uniqueness/concurrency, authorization wiring, payment state machine, and utility regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/api/dormitory-api.test.ts" "src/components/dormitory/invoices/RoomFeeCollection.test.tsx" "src/app/(dashboard)/dormitory/invoices/page.test.tsx"` => API contract, table/config/create/payment interactions, permissions, view isolation, and existing utility behavior pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors.
- `D:\PROJECT\manager_points\frontend` :: `npm run build` => Next.js production build passes.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS build passes.
- Manual development inspection at 375 px, 768 px, 1024 px, and desktop widths => both invoice views, advanced config, preview, table/cards, QR/proof, and review actions remain usable without horizontal page overflow.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

# Safety Gates

- Planning-only: implementation and automated verification require a later implementation request.
- Human Gate before applying new collection/index definitions to any shared or production database. Artifact: reviewed schema/index diff and dry-run/index inspection output. Impact: creates persistent room-fee financial storage and uniqueness indexes. Rollback: stop writes, remove only confirmed new empty indexes/collection or use an approved data-preserving rollback. Resume: after explicit environment-specific approval.
- Human Gate before generating room-fee records in any shared/production database. Artifact: preview counts/totals, target period, configuration snapshot, environment, and rollback/reconciliation procedure. Resume: after explicit approval of that exact preview.
- Stop and amend scope for room-total allocation, new permissions, online payment gateway, student self-service, schema/data migration of legacy invoices, deletion of financial records, deployment, or production mutation.

# Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Implementation evidence: API/schema diff, named-index definition, focused test outputs, manual responsive evidence, and final diff/status.
- Checkpoints: base commit above; checkpoint after backend model/API/tests pass and before frontend integration; final scoped diff. Validate the task artifact hash before execution handoff.
- Effective Rules Manifest (SHA-256):
  - `safety.md`: `6a3f283b835394b1af1f6380d94cba260acbed8a60d3065dd5365bb15806a772`
  - `global.md`: `67806f70a5f89adf42e3be88413cc76cc27a02c90fad0609ae71de34d046a43f`
  - `antigravity-operating-contract.md`: `51f3677c7e44121529cc0a4b17e5667bcbd2147ee63c6f30207c10d5deb51790`
  - `orchestrator.md`: `b782109e896b2fa48a6523358a788a9db9b81b72f3d8fc66f70019395738d716`
  - `pipeline.md`: `0419c072380887f96b37fe4eb48dae764306f46fb03190b176a43ebcea3f41f3`

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for builds or race-focused verification.
- Concurrency: one writer per path; serialize module/controller integration and invoice page/API changes.
- Idempotent retries: 2; engineering loops: 3; review remediation cycles: 2.
- Independent review is mandatory for financial persistence, uniqueness/concurrency, upload validation, authorization, and payment state transitions.
- Stop on gate, dirty overlap, new dependency, public-contract expansion beyond listed endpoints, ambiguous financial calculation, or unrelated failing baseline.
