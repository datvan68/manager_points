# Task Identity and Pipeline

- Task ID: `dormitory-invoice-realtime-permissions`
- Pipeline: `feature_development`
- Profile: Full, planning-only
- Protocol/rules version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base/current commit: `7e9732a8`
- Base state: clean worktree before this task artifact is written.

# Risk Level

- Risk: high.
- Evidence: the change spans frontend and backend, introduces concurrent realtime updates, and closes authorization gaps around financial invoice data and actions.
- Environment: development source planning. No deployment, permission assignment, or production mutation is authorized.
- Blast radius: the two invoice sub-tabs `Thu điện nước` and `Thu phí phòng`, their list/read and mutation APIs, and accounts granted dormitory invoice permissions.

# Objective

Make both invoice tables update in realtime for every independently authenticated and authorized account, without clearing or flashing the current table, while enforcing invoice read/create/confirm/delete permissions consistently in the UI and API and removing both manual refresh buttons.

# Scope Boundaries

- Approved backend boundaries:
  - `backend/src/dormitory/controllers/invoices.controller.ts` and focused spec
  - `backend/src/dormitory/controllers/room-fee-invoices.controller.ts` and focused spec
  - `backend/src/dormitory/services/invoices.service.ts` and focused spec
  - `backend/src/dormitory/services/room-fee-invoices.service.ts` and focused spec
  - `backend/src/dormitory/dormitory.module.ts`
  - new focused realtime emitter/service files under `backend/src/dormitory/`
- Approved frontend boundaries:
  - `frontend/src/app/(dashboard)/dormitory/layout.tsx` and focused test
  - `frontend/src/app/(dashboard)/dormitory/invoices/page.tsx` and focused test
  - `frontend/src/components/dormitory/invoices/RoomFeeCollection.tsx` and focused test
  - `frontend/src/app/(dashboard)/dormitory/invoices/meter-readings/page.tsx` and focused test only where access/action guards are required
  - one new focused hook under `frontend/src/hooks/` and its test
  - `docs/taskscope.md`
- Excluded boundaries: invoice formulas, schemas/indexes, historical data, role/group definitions, assigning permissions to real accounts, notifications, exports, deployment, and production data.

# Out of Scope

- Do not introduce polling or keep the manual refresh buttons as fallback UI.
- Do not broaden any account's permissions or alter the meaning of `DORM_INVOICE_READ`, `DORM_INVOICE_CREATE`, `DORM_INVOICE_CONFIRM`, or `DORM_INVOICE_DELETE`.
- Do not reset filters, search, pagination, selection, scroll position, open dialogs, or unsaved form input when a realtime event arrives.
- Do not expose full invoice/payment-proof data through a realtime event unless the subscriber is authorized for that data.
- Do not add a database migration, collection, index, or third-party realtime dependency.

# Context and Dependencies

- Both tables currently use request-based loading only. `InvoicesPage.load` and `RoomFeeCollection.loadInvoices` set foreground `loading` for normal loads; no dormitory realtime hook, stream, or emitter exists.
- The two refresh buttons are in `page.tsx` and `RoomFeeCollection.tsx`; both import `RefreshCw` and maintain `refreshing` state.
- Permission codes already exist and are included in the dormitory manager group. Most write endpoints use the matching permission guards.
- Authorization gaps found: both list and detail endpoints use only `JwtAuthGuard`; the `Hóa đơn` sub-tab is always visible; utility configuration and meter-entry actions and room-fee configuration remain visible without `DORM_INVOICE_CREATE`.
- Existing project realtime uses authenticated Server-Sent Events (SSE), heartbeat, reconnect/backoff, and cleanup. Reuse that pattern.
- “Independent per account” means every browser/account owns its own authenticated stream and local table state. An action from one account updates other currently connected accounts that hold `DORM_INVOICE_READ`; reconnect/logout/account change must not reuse another account's token, stream, cache, or state.
- Realtime events are invalidation signals scoped by invoice kind (`utility` or `room_fee`) and mutation (`created`, `updated`, `deleted`). Clients reconcile only the affected active query, coalesce bursts, and ignore stale responses.

# Steps

1. Capture focused frontend/backend baselines for list loading, actions, guards, and current refresh controls.
2. Add an authenticated SSE endpoint for dormitory invoices guarded by `DORM_INVOICE_READ`. Validate the requested invoice kind, send heartbeat/connected events, unsubscribe on disconnect, and emit no sensitive row payload beyond stable IDs/kind/action needed for reconciliation.
3. Emit realtime invalidation after successful create, update, pay/proof/review, bulk review, and delete operations for utility and room-fee invoices. Emit once after persistence succeeds; bulk operations must be coalescible and must not announce failed items as changed.
4. Add a frontend realtime hook using the current access token, one independently cleaned-up connection per mounted account/view, bounded exponential reconnect, event parsing, burst coalescing, and abort on unmount/logout/token change.
5. Connect both tables to the hook. On an event, perform background reconciliation for the current filters/page without setting foreground `loading`, replacing the table with an empty skeleton, or disturbing table/UI state. Protect against request races and deduplicate mobile/infinite-scroll rows.
6. Preserve the last successful rows during background refresh and transient stream/API failure. Show errors non-destructively and recover automatically when the stream reconnects.
7. Remove the two refresh buttons plus their `RefreshCw` imports and refresh-only state/branches. Keep internal background reconciliation callable by mutations and realtime events.
8. Enforce `DORM_INVOICE_READ` on both list/detail API families and the SSE endpoint. Keep create/config/meter-entry under `DORM_INVOICE_CREATE`, payment/proof/review under `DORM_INVOICE_CONFIRM`, and deletion under `DORM_INVOICE_DELETE`.
9. On the frontend, hide/block the `Hóa đơn` tab and direct route without read permission; render configuration, meter-entry, create, confirm/review, and delete controls only for their matching permission. Treat frontend checks as UX only; API guards remain authoritative.
10. Add regression tests for two-account propagation/isolation, reconnect/cleanup, burst coalescing, no-flash background updates, preserved filters/page/selection/dialog state, removed refresh controls, and API/UI permission matrices.
11. Run focused tests, builds/typecheck, a manual two-account scenario, security review, and final diff/status inspection.

# Acceptance Criteria

- AC-01: Creating, editing, paying/reviewing, or deleting an invoice in one authorized account updates the matching table in a second authorized account without manual refresh.
- AC-02: Utility events update only `Thu điện nước`; room-fee events update only `Thu phí phòng`. Each account uses its own token, stream lifecycle, and local state; logout/account switching closes the old stream and leaks no prior-account data.
- AC-03: Realtime reconciliation keeps existing rows visible and preserves search, filters, page/page size, selection, scroll, open dialogs, and unsaved form input. No full-page/table flash or foreground skeleton occurs.
- AC-04: Event bursts are coalesced, stale responses cannot overwrite newer data, duplicate rows are prevented, disconnected streams reconnect with bounded backoff, and cleanup leaves no duplicate connections/listeners.
- AC-05: Both manual `Tải lại` buttons and unused refresh icon/state code are absent. Realtime and post-mutation background reconciliation remain functional.
- AC-06: Accounts without `DORM_INVOICE_READ` cannot see the `Hóa đơn` tab, open its direct routes, read list/detail APIs, or subscribe to invoice realtime.
- AC-07: `DORM_INVOICE_CREATE`, `DORM_INVOICE_CONFIRM`, and `DORM_INVOICE_DELETE` independently control their matching controls and APIs for both invoice kinds. Possessing read permission alone never authorizes a mutation.
- AC-08: Admin compatibility follows the existing `admin`/`ADMIN_FULL` policy, while non-admin accounts receive no implicit fallback access.
- AC-09: SSE events contain only the minimum authorized invalidation data and are emitted only after successful persistence. Failed/forbidden mutations do not publish a successful change.
- AC-10: Focused frontend/backend tests, frontend typecheck/build, backend build, manual two-account verification, security review, whitespace check, and scoped changed-path review pass.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/controllers/invoices.controller.spec.ts dormitory/controllers/room-fee-invoices.controller.spec.ts dormitory/services/invoices.service.spec.ts dormitory/services/room-fee-invoices.service.spec.ts` => permission matrix, SSE access/lifecycle, and mutation emission tests pass.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/invoices/page.test.tsx" "src/components/dormitory/invoices/RoomFeeCollection.test.tsx" "src/app/(dashboard)/dormitory/invoices/meter-readings/page.test.tsx" "src/app/(dashboard)/dormitory/layout.test.tsx"` plus the new hook test target => both tables, permission UI, no-flash reconciliation, cleanup, and removed refresh buttons pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` and `npm run build` => TypeScript and Next.js production build pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS build passes.
- Manual development check with two separate browser profiles/accounts: account A mutates each invoice kind; account B sees the matching filtered table update without flashing; revoke read/action permissions and confirm route, stream, controls, and API fail closed as specified.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

# Safety Gates

- Planning-only: implementation and automated verification require a later implementation request.
- Human Gate before assigning/revoking permissions on real accounts or validating against shared/production data. Artifact: target environment/accounts, permission delta, expected access matrix, and rollback assignment. Resume only after approval.
- Stop and amend scope if deployment is multi-instance and the existing in-process event pattern cannot broadcast between instances; a Redis/pub-sub transport or infrastructure change requires separate design and authorization.
- Stop for permission-registry semantic changes, persistent-data changes, new dependencies, deployment, or production mutation.

# Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Implementation evidence: API permission matrix, redacted SSE event examples, focused test output, two-account video/screenshots or log, security review, and final scoped diff/status.
- Checkpoints: base commit above; checkpoint after backend permission/event tests; checkpoint after both clients pass realtime/no-flash tests; final scoped diff. Validate the task artifact before execution handoff.
- Effective Rules Manifest: canonical rules version 3.2.0 (`safety.md`, `global.md`, `antigravity-operating-contract.md`, `orchestrator.md`, `pipeline.md`).

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for builds/manual two-account verification.
- Concurrency: one writer per path; serialize backend event contract before frontend integration.
- Idempotent retries: 2; engineering loops: 3; review remediation cycles: 2.
- Independent security/concurrency review is mandatory for authorization, SSE isolation, event payloads, cleanup, races, and financial UI consistency.
- Stop on gate, dirty overlap, cross-instance transport requirement, new dependency, scope expansion, or unrelated failing baseline.
