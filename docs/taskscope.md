# Task Identity and Pipeline

- Task ID: `dormitory-overview-realtime-performance`
- Pipeline: `feature_development`
- Profile: Full, planning-only
- Protocol/rules version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base/current commit: `b6e96165`
- Base state: clean worktree before this task artifact is written.

# Risk Level

- Risk: high.
- Evidence: the change spans frontend and backend, replaces polling with authenticated concurrent realtime delivery, and optimizes an aggregate that reads multiple dormitory collections.
- Environment: development source planning. No deployment, infrastructure, database migration, or production mutation is authorized.
- Reversibility: source changes are reversible in Git; blast radius is limited to the dormitory overview and the mutation services that invalidate its data.

# Objective

Make the dormitory `Tổng quan` tab load once and stay current through realtime invalidation, with background reconciliation that does not flash, reset interactions, create duplicate requests, or overload the dashboard endpoint when many accounts are connected.

# Scope Boundaries

- Approved boundaries: `frontend/src/app/(dashboard)/dormitory/overview/**`, `frontend/src/hooks/**`, `frontend/src/api/dormitory-api.ts`, `backend/src/dormitory/**`, and focused tests under those owners.
- Write boundaries and known targets:
  - `frontend/src/app/(dashboard)/dormitory/overview/page.tsx` and `page.test.tsx`.
  - A focused dormitory-overview realtime hook and test under `frontend/src/hooks/`.
  - `backend/src/dormitory/controllers/dormitory-reports.controller.ts` and its focused test.
  - `backend/src/dormitory/services/dormitory-reports.service.ts` and `dormitory-reports.service.spec.ts`.
  - `backend/src/dormitory/dormitory.module.ts` plus a focused overview event emitter/realtime service and tests under `backend/src/dormitory/`.
  - Mutation services whose successful commits change overview data: buildings, rooms, beds, contracts, roster/room assignment, invoices, and maintenance.
- Excluded boundaries: schema files, migrations, deployment/CI, permission registry semantics, unrelated dashboard/report pages, and UI redesign.

# Out of Scope

- Changing dormitory business formulas, room allocation rules, invoice calculations, permissions, or database schema/indexes.
- Adding Redis, a message broker, MongoDB change streams, or another dependency without a scope amendment.
- Removing the initial-load retry or manual refresh control; the request covers realtime and performance behavior only.
- Deployment, production configuration, and production performance testing.

# Context and Dependencies

- The page currently calls `dormitoryApi.reports.getDashboardStats()` on mount, every 30 seconds while visible, on visibility changes, and manually. `inFlightRef` prevents overlap but polling remains per browser session.
- Initial loading replaces the page with skeletons; refreshes retain existing data but expose a refresh state. Search, selected room, and responsive mode are local UI state.
- `DormitoryReportsService.getDashboardStats()` runs seven parallel database operations and loads full building, room, bed, contract, roster, and invoice result sets before reducing them in memory.
- Invoice-to-room aggregation performs a linear room search inside the invoice loop, and summaries repeatedly scan the same arrays; both amplify CPU cost as data grows.
- The dashboard endpoint is guarded by `DORM_PAGE`. The realtime endpoint must use the same permission and must not include sensitive row data in events.
- The repository already uses authenticated SSE with heartbeat, abort cleanup, reconnection, and bounded backoff. Dormitory invoice realtime events can be bridged into overview invalidation instead of duplicating invoice mutation logic.
- Student/class profile changes can alter populated member labels but their mutation owners are outside the approved dormitory boundary; coverage of those external changes requires a later scope amendment.
- Performance guidance applied: deduplicate client fetches, avoid waterfalls, keep stale data during reconciliation, coalesce frequent events, use transitions for non-urgent rendering, and avoid unnecessary list recomputation/rerenders.

# Steps

1. **Backend contract and baseline — code/test agent:** record the current query count/shape and response contract; define a minimal event such as `dormitory_overview.invalidated` with event ID, timestamp, and changed domain only.
2. **Backend realtime delivery — code agent:** add a `DORM_PAGE`-guarded SSE endpoint with heartbeat, subscriber cleanup, and bounded per-connection state. Publish only after successful mutations affecting dashboard output; bridge existing invoice events.
3. **Backend load optimization — code/test agent:** replace full-document reads with verified projections/lean queries, replace invoice-to-room linear searches with indexed maps, and consolidate avoidable repeated passes. Add a short-lived single-flight snapshot cache shared across concurrent requests, invalidated by successful domain events, without changing response values.
4. **Frontend data lifecycle — code agent:** replace the 30-second interval and visibility-trigger polling with one authenticated realtime connection. Perform one initial fetch, then coalesce event bursts into one background reconciliation; prevent stale responses, duplicate in-flight calls, and reconnect storms.
5. **No-flash rendering — code agent:** retain the last successful snapshot while reconnecting/refetching, keep search text, scroll position, and room dialog state, and apply non-urgent updates without remounting the page or showing the initial skeleton again.
6. **Tests and performance evidence — test agent:** cover initial load, event-driven refresh, burst coalescing with one queued trailing refresh, stale-response ordering, retry/backoff, cleanup, authorization, failed-mutation silence, cache invalidation, response parity, and correct partial-response detection.
7. **Independent review and final verification — review agent:** review concurrency, permission isolation, event coverage, query amplification, client rendering, and the final scoped diff before affected-package checks.

# Acceptance Criteria

- **AC-01:** Opening `Tổng quan` performs one initial dashboard request and establishes one authenticated realtime stream; no 30-second or visibility-change polling remains.
- **AC-02:** A successful change to buildings, rooms/beds, contracts/assignments/roster, utility invoices, or maintenance triggers an overview invalidation and visible data reconciliation without manual reload.
- **AC-03:** Multiple events inside a defined coalescing window cause at most one dashboard request; events arriving during an in-flight request queue at most one trailing reconciliation, and an older response cannot overwrite a newer snapshot.
- **AC-04:** Background refresh/reconnect never replaces populated content with the initial skeleton, clears search, closes the selected-room dialog, resets scroll, or flashes the page.
- **AC-05:** Each signed-in account owns an independent authenticated stream and cleanup lifecycle; stream access requires `DORM_PAGE`, and event payloads contain no student, room-member, invoice, or account-sensitive records.
- **AC-06:** Disconnect, unmount, token change, and logout abort the stream and scheduled retries. Reconnection uses heartbeat plus bounded exponential backoff with jitter and does not create parallel streams.
- **AC-07:** The optimized dashboard endpoint returns the same response contract and calculated values as the baseline while using explicit projections and single-flight/coalesced snapshot work for concurrent callers.
- **AC-08:** Failed or rolled-back mutations emit no successful invalidation; every successful mutation that changes a displayed metric/row has focused event coverage.
- **AC-09:** Initial, empty, partial, stale-data error, and retry states remain accessible and deterministic; no new console error or unhandled rejection occurs.
- **AC-10:** Representative cold/warm measurements record query count, response bytes, latency, and concurrent-client rebuild count; one invalidation burst causes one shared snapshot rebuild per backend process rather than one rebuild per connected client.

# Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run "src/app/(dashboard)/dormitory/overview/page.test.tsx" "src/hooks/useDormitoryOverviewRealtime.test.ts"` => AC-01, AC-03, AC-04, AC-06, and AC-09 pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => affected frontend types pass.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand dormitory-reports dormitory-overview-realtime` => AC-02, AC-05, AC-07, and AC-08 pass with response-parity and query/cache assertions.
- `D:\PROJECT\manager_points\backend :: npm run build` => backend compiles with the SSE service and mutation publishers.
- Manual development verification with two authenticated browser accounts: keep both overview tabs open, mutate one source domain, confirm one smooth update per account, then disconnect/reconnect one account and confirm the other remains unaffected.
- Final repository root checks: `git diff --check` and `git status --short`; only scoped implementation/tests and this task artifact may differ.

# Safety Gates

- Gate: None for development implementation and verification inside the approved boundaries.
- Stop and amend scope if multi-instance delivery requires Redis/pub-sub or another infrastructure/dependency change; provide topology evidence and resume from backend realtime design after approval.
- Stop for schema/index changes, permission changes, persistent-data mutation, deployment, production load tests, or unrelated dirty-path overlap.

# Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Required execution evidence: baseline/optimized query count, response bytes and cold/warm latency, concurrent-client rebuild count, response-parity test, redacted SSE example, focused test output, two-account manual evidence, independent review, and final diff/status.
- Material checkpoints: backend event/permission tests complete; frontend realtime/no-flash tests complete; final affected verification complete. Record commit identity and task artifact hash at handoff.
- Effective Rules Manifest: canonical rules version 3.2.0; selected performance skill `vercel-react-best-practices` version 1.0.0.

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for builds/manual verification.
- Concurrency: one writer per path; serialize event contract before publishers and frontend integration.
- Idempotent retries: 2; engineering loops: 3; review remediation cycles: 2.
- Independent concurrency/performance/security review is mandatory. Stop on gate, boundary expansion, dependency change, or unrelated failing baseline.
