# Task Identity and Pipeline

- Task ID: `dormitory-individual-room-fee-mobile-infinite-scroll`
- Pipeline: `feature_development`
- Profile: Full, planning-only
- Protocol/rules version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base/current commit: `3421416c3a3aaa78381b05896fd8c1e1ad6e0725`
- Base state: clean worktree before this task artifact is written.

# Risk Level

- Risk: high.
- Evidence: the change creates persistent financial records with staff-adjustable price and duration, extends protected backend/API behavior, and changes responsive loading/selection state in two invoice views.
- Environment: development source planning. Source changes are Git-reversible; room-fee records created in a shared or production database require an explicit gate.
- Blast radius: dormitory room-fee issuance, invoice API contracts, and the electricity/water and room-fee list experiences on compact screens.

# Objective

Allow authorized staff to issue a room-fee charge for one assigned dormitory member with an independently adjustable month count and monthly price, and make both `Thu điện nước` and `Thu phí phòng` use infinite loading plus card virtualization instead of pagination on mobile/tablet while preserving desktop pagination and existing payment workflows.

# Scope Boundaries

- Approved boundaries:
  - `backend/src/dormitory/controllers/room-fee-invoices.controller.ts` and focused spec
  - `backend/src/dormitory/services/room-fee-invoices.service.ts` and focused spec
  - `backend/src/dormitory/dto/room-fee-invoice.dto.ts`
  - `frontend/src/api/dormitory-api.ts` and focused test
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx` and focused test
  - `frontend/src/components/dormitory/invoices/RoomFeeCollection.tsx` and focused test
  - `frontend/src/components/ui/ResponsiveDataView.tsx` and focused test only if its existing mobile hooks are insufficient
  - `docs/taskscope.md`
- Excluded boundaries: utility calculations/meter persistence, room-fee configuration semantics, payment/review state machines, permission registry, Contracts, student self-service/payment gateway, exports, notifications, deployment, migration, production mutation, and deletion of financial records.

# Out of Scope

- Do not create a new fee type, change the global standard/air-conditioned rates, or update previously issued room-fee rows.
- Do not replace desktop server pagination; infinite scrolling is limited to the compact responsive mode.
- Do not load the full collection in one request or simulate virtualization over an unbounded DOM list.
- Do not permit free-text payer creation or issue a charge to an unassigned roster entry.
- For this task, editable `Giá tiền` means the selected member's non-negative monthly rate; `Tổng tiền = đơn giá/tháng × số tháng`. If the product intends an editable final total instead, amend the scope before implementation.

# Context and Dependencies

- `RoomFeeCollection` currently supports only whole-roster `preview-period` / `create-period`; it seeds price from room type and lets staff adjust only the period month count.
- The room-fee schema already stores immutable member, room, monthly-rate, period, month-count, and total snapshots and has the named unique index `room_fee_roster_period_unique` on `{ roster_entry_id, start_month, end_month }`.
- Both invoice views currently request one server page and render `CustomPagination`. Neither passes `hidePaginationOnMobile`, `mobileScrollRef`, `mobileFooter`, or `mobileVirtualization` to `ResponsiveDataView`.
- `ResponsiveDataView` already uses `@tanstack/react-virtual` for compact cards. Dormitory roster/building pages provide the repository pattern for `(max-width: 1023px)`, guarded appended-page loading, `IntersectionObserver`, retry, deduplication, and stale-request protection.
- Existing room-fee list pagination metadata is sufficient for infinite loading; no list endpoint contract change is required.
- Reuse `DORM_INVOICE_CREATE` for individual preview/create and existing read/confirm/delete permissions elsewhere.

# Steps

1. Record focused frontend/backend baselines for whole-roster issuance, both paginated lists, selection, payment, proof review, and bulk actions.
2. Add validated individual preview/create DTOs containing `roster_entry_id`, `start_month`, `months_count` (1–36), `monthly_rate` (finite and non-negative), optional due date, and optional notes. Do not accept client-owned member/room/total snapshots.
3. Add protected individual preview/create endpoints and service methods. Resolve the selected roster entry and its current room server-side, reject missing/unassigned/unsupported-room records, calculate the end month and total, and return a single-member preview before confirmation.
4. On create, re-read the roster assignment, persist the existing immutable snapshots with the custom monthly rate and calculated total, attribute the creator, and preserve the existing invoice/payment lifecycle. Treat the current unique index as the concurrency authority: an exact duplicate member/start/end request returns a clear conflict/existing-charge result and never creates or reports a second charge. A custom price must not mutate `RoomFeeConfig`.
5. Add an authorized `Lập đợt thu cá nhân` flow to `RoomFeeCollection`: searchable assigned-member selection by name/code/room, current room/type summary, start month, editable month count and monthly rate, optional due date/notes, computed total, preview, confirmation, success/error feedback, and refresh of the affected list. Disable repeat submits and invalidate the preview whenever an input or selected member changes.
6. In both invoice views, detect compact mode with the repository convention `(max-width: 1023px)`. On compact entry or any filter/search change, reset to page 1; append later API pages when the internal scroll sentinel intersects; deduplicate by invoice ID; and ignore stale/out-of-order responses with request and query-generation guards.
7. Enable `ResponsiveDataView` compact-card virtualization, pass its scroll container and a mobile footer containing loading-more, retry, and end-of-list states, and hide `CustomPagination` below the desktop breakpoint. Keep desktop requests, page-size controls, and page replacement behavior unchanged.
8. Preserve selection only for currently loaded/visible-query records; clear it on filter, page-mode, or tab-context reset. Prevent duplicate next-page calls, do not erase accumulated rows after a load-more failure, and make manual refresh deterministically rebuild compact data from page 1.
9. Add API/service/controller/UI regression tests for individual validation/calculation/snapshots/permissions/duplicate races and, for both sub-tabs, breakpoint switching, first-page reset, ordered append, deduplication, stale-response rejection, observer re-entry guards, retry/end states, virtualization, hidden compact pagination, retained desktop pagination, and unchanged financial/payment behavior.
10. Run focused tests, affected type/build checks, responsive manual inspection, and final diff/status review.

# Acceptance Criteria

- AC-01: A user with `DORM_INVOICE_CREATE` can choose exactly one currently assigned roster member and preview the member, room/type, start/end period, month count, monthly rate, calculated total, due date, and notes before creation; unauthorized calls are rejected.
- AC-02: Month count accepts only integers from 1 through 36 and monthly rate accepts only finite non-negative values. The backend calculates `end_month` and `total_amount`; client-supplied identity, room, or total snapshots cannot override server data.
- AC-03: Confirming an individual preview creates exactly one unpaid room-fee invoice with immutable current roster/room snapshots, the adjusted monthly rate, and `total_amount = monthly_rate × months_count`; the shared room-fee configuration remains unchanged.
- AC-04: If the member becomes unassigned or invalid between preview and create, creation fails without a partial record. Concurrent or repeated creation for the same member/start/end period cannot create duplicates and returns an actionable conflict.
- AC-05: Existing whole-roster issuance, filters, payment/proof review, bulk approve/delete eligibility, and invoice status behavior pass unchanged.
- AC-06: At widths up to 1023 px, both `Thu điện nước` and `Thu phí phòng` show no pagination controls, fetch page 1 initially, automatically append subsequent pages near the list end, and expose loading-more, retry, empty, and end-of-list states.
- AC-07: Compact lists render only a bounded virtual window plus overscan even after multiple pages are loaded. Appended records remain in API sort order, duplicate IDs are not rendered, and rapid observer/filter events do not cause duplicate requests or stale rows.
- AC-08: At 1024 px and above, both sub-tabs retain the current table and server pagination/page-size controls; switching responsive mode or changing search/filter resets paging consistently without cross-tab state leakage.
- AC-09: Checkbox and floating bulk-action behavior operates on loaded eligible records only and never silently selects an unloaded page; a failed load-more preserves already loaded rows and can be retried.
- AC-10: Focused tests, frontend typecheck/build, backend build, whitespace check, and changed-path review pass before completion.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/room-fee-invoices.service.spec.ts dormitory/controllers/room-fee-invoices.controller.spec.ts` => individual issuance validation, calculation, assignment recheck, immutable snapshots, authorization wiring, and duplicate/concurrency behavior pass alongside batch issuance.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/api/dormitory-api.test.ts" "src/components/dormitory/invoices/RoomFeeCollection.test.tsx" "src/app/(dashboard)/dormitory/invoices/page.test.tsx"` => API contracts, individual modal, both infinite lists, virtualization wiring, observer/error states, compact selection, and desktop regression pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` and `npm run build` => TypeScript and Next.js production build pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS build passes.
- Manual development inspection at 375 px, 768 px, 1023 px, and 1024 px => compact cards infinitely load without pagination or horizontal page overflow; desktop pagination remains usable; individual preview/create interaction is complete.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

# Safety Gates

- Planning-only: implementation and automated verification require a later implementation request.
- Human Gate before creating an individual room-fee record in any shared or production database. Artifact: selected member/room, period, monthly rate, total, environment, duplicate/overlap result, and reconciliation procedure. Resume only after approval of that exact preview.
- Stop and amend scope for editable final-total semantics, overlapping-period policy changes, new permissions, new collections/indexes, legacy migration, online payment, deletion, deployment, or production mutation.

# Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Implementation evidence: endpoint/DTO diff, individual preview payload, focused test output, compact virtualization/infinite-scroll evidence at specified widths, and final scoped diff/status.
- Checkpoints: base commit above; checkpoint after backend individual issuance tests pass and before frontend integration; final scoped diff. Validate the task artifact hash before execution handoff.
- Effective Rules Manifest (SHA-256):
  - `safety.md`: `6a3f283b835394b1af1f6380d94cba260acbed8a60d3065dd5365bb15806a772`
  - `global.md`: `67806f70a5f89adf42e3be88413cc76cc27a02c90fad0609ae71de34d046a43f`
  - `antigravity-operating-contract.md`: `51f3677c7e44121529cc0a4b17e5667bcbd2147ee63c6f30207c10d5deb51790`
  - `orchestrator.md`: `b782109e896b2fa48a6523358a788a9db9b81b72f3d8fc66f70019395738d716`
  - `pipeline.md`: `0419c072380887f96b37fe4eb48dae764306f46fb03190b176a43ebcea3f41f3`

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for builds or concurrency/responsive verification.
- Concurrency: one writer per path; serialize backend controller/service integration and the two frontend invoice-view changes.
- Idempotent retries: 2; engineering loops: 3; review remediation cycles: 2.
- Independent review is mandatory for financial calculation/persistence, authorization, duplicate handling, and async infinite-scroll state.
- Stop on gate, dirty overlap, new dependency, shared component behavior outside the two invoice consumers, ambiguous price semantics, or unrelated failing baseline.
