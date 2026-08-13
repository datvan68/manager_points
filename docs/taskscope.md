# Task Identity and Pipeline

- Task: `redesign-dormitory-overview-and-refine-bed-modal`; pipeline: `feature_development`; profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; base commit: `a3a9905a6d7cce68497c0ffe5d7d2e2383b2c229`; initial worktree: clean.

# Risk Level

- Risk: high. The work crosses frontend/backend modules, changes a persisted-record deletion interaction, and adds financial/occupancy aggregation whose counting semantics must remain deterministic.
- Source changes are Git-revertible. No live deletion, migration, deployment, or production mutation is authorized by this planning task.

# Objective

Deliver a homepage-inspired dormitory overview as the first tab, with accurate current KPI breakdowns and six-month comparisons, while making bed deletion immediate and keeping the bed-management modal open after success.

# Scope Boundaries

- Dormitory ordering/default route and tests: `frontend/src/app/(dashboard)/dormitory/layout.tsx`, `layout.test.tsx`, and `page.tsx`.
- Bed-modal behavior and regression tests: `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx` and `page.test.tsx`.
- Overview UI, loading/error/empty states, chart components if separation is useful, and tests: `frontend/src/app/(dashboard)/dormitory/overview/page.tsx` plus a focused `page.test.tsx`; use the visual language of `frontend/src/app/(dashboard)/page.tsx` and existing `frontend/src/components/dashboard/**` as read-only design references.
- Typed client contract and tests: `frontend/src/api/dormitory-api.ts` and `dormitory-api.test.ts`.
- Dashboard aggregation/API and focused tests: `backend/src/dormitory/services/dormitory-reports.service.ts`, `backend/src/dormitory/controllers/dormitory-reports.controller.ts`, and new or existing focused specs for those units.

# Out of Scope

- Redesigning the main homepage or other dormitory tabs; changing room, registration, contract, invoice, or payment workflows; partial-payment support; database schema/index changes; historical snapshot backfill; deletion-policy changes in the backend; deployment; and deletion of real records during verification.
- Room/bed history charts are excluded because the current models do not preserve monthly capacity snapshots. The comparison chart uses date-backed registration, residency, and invoice activity only.

# Context and Dependencies

- Tab order is currently `Registrations -> Overview -> Rooms...`, the fallback tab is `registrations`, and `/dormitory` redirects to registrations; all three must change together.
- Bed deletion currently sets `bedToDelete`, opens `ConfirmModal`, then refreshes the room and clears both deletion and room state. Only the bed-delete confirmation path is removed; room-delete confirmation remains unchanged.
- Current dashboard data exposes six coarse counts. Rooms provide `available_bed_count` and `amenities`; beds expose statuses; active contracts represent residents; registrations have timestamps/status; invoice items distinguish `Phí phòng`, `Điện`, and `Nước`, while payment status is invoice-wide.
- KPI counting contract: occupied rooms have at least one used bed; available rooms have at least one free bed; air-conditioned rooms contain the canonical `Điều hòa` amenity and remaining active rooms are standard. Beds count `Đang sử dụng` versus `Trống`. Student registration and active-resident counts remain separate. A fee or utility invoice is counted once in its category and split into paid versus unpaid/overdue by invoice status.
- The monthly API returns six chronological calendar buckets, including zero-filled months. Registrations use creation time, resident move-ins use contract `start_date`, and paid/unpaid fee and utility activity uses `billing_period` with a documented fallback only when the period is invalid. Amounts and record counts must not be mixed in one series.

# Steps

1. Add regression tests for tab order/default redirect, immediate bed deletion with an open modal, current KPI semantics, six zero-filled monthly buckets, API serialization, and overview loading/error/empty/responsive rendering.
2. Reorder tabs to `Overview -> Registrations -> Rooms -> ...`, change the layout fallback and `/dormitory` redirect to overview, and preserve nested-route activation.
3. Replace the bed-delete `ConfirmModal` state/flow with a direct, loading-safe delete action. On success, update/refetch the bed list and room counters without clearing `bedRoom`; on failure keep the row/modal and show the existing actionable error. Prevent duplicate requests while deletion is pending.
4. Extend `GET /dormitory/reports/dashboard` with typed snapshot groups and a six-month trend contract. Implement database-side bounded aggregations where practical, normalize invoice categories/statuses once, and avoid loading unbounded collections into memory.
5. Redesign the overview using the homepage's max-width layout, translucent cards, spacing, typography, refresh treatment, responsive grids, skeletons, and non-blocking refresh. Render five KPI groups: rooms, beds, students, dormitory fees, and electricity/water; add an accessible responsive monthly comparison chart with legend, labels/tooltips, zero and error states.
6. Run focused frontend/backend tests, type/build checks, independent review of aggregation semantics and destructive UI behavior, then inspect the final diff/status.

# Acceptance Criteria

- AC1: The first visible tab is `Tổng quan`, followed by `Đăng ký` and `Phòng`; `/dormitory` and the layout fallback resolve to overview, while nested routes select their correct tab.
- AC2: Clicking `Xóa` for an eligible bed calls delete directly without rendering or invoking `ConfirmModal`; rapid repeated clicks cannot send duplicate deletes.
- AC3: After successful deletion, `Quản lý giường` remains open for the same room, the deleted row disappears, and room/bed counts refresh consistently. Failure keeps the modal and row visible with an actionable message.
- AC4: The overview reports room occupied/available/air-conditioned/standard, bed used/free, student registered/currently residing, dormitory-fee paid/unpaid, and electricity/water paid/unpaid values using the documented mutually consistent rules.
- AC5: The endpoint returns exactly six ordered, zero-filled monthly buckets and separate count-based series for registrations, move-ins, dormitory-fee paid/unpaid, and utility paid/unpaid; tests cover mixed invoice items, overdue status, invalid periods, and empty data.
- AC6: The page follows the main homepage's design system without copying unrelated homepage business panels, remains usable from mobile through desktop, and provides accessible headings, chart legend/tooltips, refresh, skeleton, empty, and retry states.
- AC7: Initial loading does not show stale zero KPIs as real data; refresh retains the current dashboard instead of flashing a blank page, and stale or duplicate responses cannot overwrite newer data.
- AC8: Existing report consumers remain compatible or are updated atomically; room deletion still uses its existing confirmation flow and backend bed-deletion safety rules are unchanged.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/dormitory-reports.service.spec.ts dormitory/controllers/dormitory-reports.controller.spec.ts` => AC4, AC5, and the dashboard endpoint contract pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/layout.test.tsx" "src/app/(dashboard)/dormitory/buildings/page.test.tsx" "src/app/(dashboard)/dormitory/overview/page.test.tsx" src/api/dormitory-api.test.ts` => AC1-AC3 and AC6-AC8 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => modified navigation, UI, and API types compile.
- Repository root :: `git diff --check` and `git status --short` => only scoped changes exist and unrelated work is preserved.

# Safety Gates

- Development implementation with mocked/in-memory verification requires no additional gate. Do not exercise deletion against persistent user data.
- Any migration, historical backfill, production deployment, live-data correction/deletion, or broadened payment semantics requires a scope amendment and explicit approval before execution.

# Artifacts and Checkpoints

- Record the KPI/counting contract, representative aggregation fixtures, focused test/build/typecheck results, and final diff/status. Checkpoint after backend contract tests before frontend integration.
- Stop for inconsistent canonical Vietnamese enum values, inability to distinguish invoice categories, a required schema migration, or a conflict with unrelated edits in scoped paths.

# Execution Budgets

- Order: regression baseline -> aggregation contract -> navigation/bed behavior -> overview UI -> affected verification -> independent review.
- One writer per path; step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
