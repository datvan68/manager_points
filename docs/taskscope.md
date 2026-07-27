# Task Identity and Pipeline

- Task: `admin-mobile-tablet-data-performance-and-navigation`
- Pipeline: `bug_fix`
- Profile: Full
- Rule version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base state: branch `main`, commit `80eb95560bef1cbb7e067b6731aaa6f073070d53`.
- Planning baseline: the worktree already contains uncommitted responsive-shell changes in `frontend/src/app/layout.tsx`, `frontend/src/app/(dashboard)/layout.tsx`, `frontend/src/globals.css`, `frontend/src/components/layout/Header.tsx`, `frontend/src/components/layout/Sidebar.tsx`, and their tests. These changes must be preserved and reconciled before implementation.
- Authority: planning-only. This scope does not authorize implementation, commit, push, deployment, or production mutation.
- Effective rules manifest:
  - `safety.md` SHA-256 `6A3F283B835394B1AF1F6380D94CBA260ACBED8A60D3065DD5365BB15806A772`
  - `global.md` SHA-256 `67806F70A5F89ADF42E3BE88413CC76CC27A02C90FAD0609AE71DE34D046A43F`
  - `antigravity-operating-contract.md` SHA-256 `51F3677C7E44121529CC0A4B17E5667BCBD2147EE63C6F30207C10D5DEB51790`
  - `orchestrator.md` SHA-256 `B782109E896B2FA48A6523358A788A9DB9B81B72F3D8FC66F70019395738D716`
  - `pipeline.md` SHA-256 `0419C072380887F96B37FE4EB48DAE764306F46FB03190B176A43EBCEA3F41F3`
- Selected skill: `vercel-react-best-practices` 1.0.0.

# Risk Level

- Risk: medium.
- Environment: frontend development only.
- Reversibility: all planned changes are Git-reversible.
- Blast radius: authenticated admin navigation and the initial/perceived loading behavior of the four retained admin destinations on mobile and tablet.
- Full profile is required because performance investigation and regression coverage span shared navigation and four dashboard routes.

# Objective

Reduce measured initial and repeat-navigation data wait on admin mobile/tablet views while making both admin navigation variants contain exactly `Trang chủ`, `Học sinh`, `Hoạt động`, and `Thông báo`, without changing route authorization or non-admin menus.

# Scope Boundaries

## Approved Boundary

- Frontend admin navigation derivation and rendering.
- Frontend data-loading, request orchestration, rendering, and bundle behavior for `/`, `/students`, `/activities`, and `/notifications`.
- Focused tests and this planning artifact.

## Write Boundary

- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/Sidebar.test.tsx`
- `frontend/src/app/(dashboard)/page.tsx`
- `frontend/src/app/(dashboard)/page.test.tsx` (new if required)
- `frontend/src/app/(dashboard)/students/page.tsx`
- `frontend/src/app/(dashboard)/students/page.test.tsx` (new if required)
- `frontend/src/app/(dashboard)/activities/page.tsx`
- `frontend/src/app/(dashboard)/activities/page.test.tsx` (new if required)
- `frontend/src/app/(dashboard)/notifications/page.tsx`
- `frontend/src/app/(dashboard)/notifications/page.test.tsx` (new if required)
- Existing frontend API modules or route-owned components imported by those pages only when profiling identifies a concrete bottleneck; add each discovered path to the implementation manifest before mutation.
- `docs/taskscope.md`

## Known Targets

- `allMenuItems`, admin menu selection, route-permission loading effect, desktop footer, and mobile notification/profile rendering in `Sidebar`.
- `DashboardPage.loadData` and below-the-fold dashboard component loading.
- `StudentsPageContent.fetchDepartments`, `fetchClasses`, `fetchClassSummaries`, and the artificial department-change loading delay.
- `ActivitiesPage.loadData`, semester loading, realtime refresh behavior, and modal/below-the-fold imports.
- `NotificationsPageContent.loadCounts`, `loadPaginated`, and `notifications-updated` refresh behavior.

# Out of Scope

- Backend/API/database changes, endpoint contract changes, pagination redesign, new caching infrastructure, or new dependencies.
- Removing routes, revoking permissions, or blocking direct URL access; this task changes admin navigation visibility only.
- Non-admin sidebar/mobile-menu contents or role-resolution semantics.
- Visual redesign, breakpoint changes, responsive safe-area implementation from the existing dirty worktree, deployment, or production profiling with personal data.
- Optimizing dashboard routes other than the four retained admin destinations.

# Context and Dependencies

- The frontend uses Next.js 16.1.6, React 19, Tailwind CSS 4, Vitest, and Testing Library; no client data-cache library is installed.
- `Sidebar` currently calls `getRoutePermissionsPublic` before returning all menu items for an admin, delaying navigation even though admin menu visibility does not depend on that response.
- The current admin desktop list includes six primary items plus a settings footer. The mobile list appends notification and profile controls, so neither variant matches the requested four-item contract.
- `/students` currently awaits departments before classes, starts class summaries afterward, and adds a 300 ms loading state when the selected department changes.
- `/activities` starts activity and semester requests independently, but realtime events can trigger a full list reload.
- `/notifications` loads counts and the page list independently, then refreshes both for each global update event.
- `/` uses one aggregated metrics endpoint but blocks the entire page until it completes and statically imports several panels while only two panels are lazy-loaded.
- Optimization must follow measured evidence, prioritizing removal of request waterfalls and redundant requests, route-level code splitting, stable callbacks/state updates, and progressive rendering.

# Steps

1. `code-agent` records the current dirty diff, confirms ownership of overlapping responsive changes, and captures a baseline for the four routes at `390x844`, `768x1024`, and `1024x768` under the same authenticated admin session and throttling profile.
2. `code-agent` records per route: navigation-to-first-useful-content time, data-ready time, request count, duplicate requests, longest request chain, transferred JavaScript, and visible loading behavior. Use redacted test data only.
3. `code-agent` derives the admin menu before any route-permission request. For admin only, render exactly four destinations in this order: `/`, `/students`, `/activities`, `/notifications`; omit grading, reports, system, settings, and profile from both desktop and mobile navigation. Preserve direct-route authorization and all non-admin behavior.
4. `code-agent` removes only evidence-confirmed loading bottlenecks: parallelize independent requests, deduplicate refreshes, avoid full reloads when a local update is sufficient, remove artificial wait states, and retain stale usable data during non-destructive refreshes.
5. `code-agent` reduces initial mobile/tablet rendering cost only where the baseline proves impact, using route-owned dynamic imports for heavy non-critical panels/modals and progressive loading boundaries without delaying primary content.
6. `code-agent` preserves cancellation/stale-response safety, error states, retry behavior, pagination/filter state, realtime updates, authorization, and mutation refresh correctness.
7. `test-agent` adds focused regression tests for exact admin menus on desktop/mobile, unchanged non-admin menus, skipped admin route-permission fetch, parallel/deduplicated loading behavior, and retained error/refresh states.
8. `review-agent` checks the diff against the Vercel priorities for waterfalls, bundle size, client fetching, rerenders, and rendering; it also checks that existing responsive-shell changes were not lost.
9. The orchestrator runs focused tests, type-check, production build, repeat profiling, and final diff/status inspection.

# Acceptance Criteria

- `AC-01`: For an `ADMIN` user, desktop and mobile/tablet navigation expose exactly four ordered destinations: `Trang chủ`, `Học sinh`, `Hoạt động`, and `Thông báo`.
- `AC-02`: Admin navigation does not request public route-permission mappings before it becomes usable.
- `AC-03`: Grading, reports, system, settings, and profile are absent from the admin navigation UI, while direct-route permissions and route guards remain unchanged.
- `AC-04`: Student, teacher, and supervisor navigation behavior remains unchanged from the captured baseline.
- `AC-05`: Independent initial requests on each scoped route start concurrently; no artificial delay or duplicate request remains in the critical data-ready path.
- `AC-06`: Notification and realtime events cause at most one required refresh per event burst and do not clear already usable content while refreshing.
- `AC-07`: At each measured viewport, the median warm navigation-to-data-ready time over five runs improves by at least 25% on every route whose baseline is frontend-bound; a backend-bound route must instead show no added frontend waterfall and a documented unchanged server wait.
- `AC-08`: The optimized build does not increase the initial JavaScript transferred by any scoped route by more than 5%; any route receiving code splitting must show a smaller initial route chunk in the build evidence.
- `AC-09`: Loading, empty, error, filtering, pagination, manual refresh, and successful mutation/realtime update behavior remain correct.
- `AC-10`: Focused tests, TypeScript checking, production build, and final diff checks pass without dependency or backend changes.

# Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run src/components/layout/Sidebar.test.tsx "src/app/(dashboard)/page.test.tsx" "src/app/(dashboard)/students/page.test.tsx" "src/app/(dashboard)/activities/page.test.tsx" "src/app/(dashboard)/notifications/page.test.tsx"`
  - Expected: exact admin navigation, unchanged non-admin behavior, request orchestration, refresh, and error-state regressions pass. Omit optional test paths not created and record the final exact command.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck`
  - Expected: no TypeScript errors.
- `D:\PROJECT\manager_points\frontend :: npm run build`
  - Expected: production build succeeds and route chunk evidence satisfies `AC-08`.
- Browser performance comparison at `390x844`, `768x1024`, and `1024x768`, five baseline and five post-change warm navigations per route using the same admin account, dataset, cache mode, and throttling profile.
  - Expected: request timeline satisfies `AC-05`/`AC-06`; median timing satisfies `AC-07`; screenshots confirm `AC-01`.
- `D:\PROJECT\manager_points :: git diff --check`
  - Expected: no whitespace errors.
- `D:\PROJECT\manager_points :: git status --short` and `git diff --stat`
  - Expected: all implementation changes stay within the write boundary and pre-existing responsive changes remain present.

# Safety Gates

- Gate: None for local implementation and verification after the overlapping dirty changes are attributed and accepted as the implementation baseline.
- Stop before implementation if the current uncommitted sidebar/layout changes cannot be safely distinguished or preserved.
- Any backend/API contract change, dependency installation, breakpoint change, production profiling, deployment, or expansion beyond the approved frontend routes requires a scope amendment and applicable explicit authority.
- Do not capture tokens, student personal data, notification contents, or other sensitive payloads in performance artifacts.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`.
- Baseline artifact: redacted route performance table and request waterfall screenshots for the three viewport sizes.
- Implementation checkpoint: scoped diff plus focused-test results after navigation and data-loading changes.
- Review checkpoint: acceptance-criteria matrix, before/after median measurements, request counts, and route chunk comparison.
- Final evidence: exact commands run, final diff/status, and remaining backend-bound waits.

# Execution Budgets

- One writer per path; serialize writes to `Sidebar.tsx`, its test, and any file already modified in the worktree.
- Maximum concurrent workers: 3, with no overlapping writes.
- Maximum idempotent retries: 2.
- Maximum implementation/verification loops: 3.
- Maximum review-remediation cycles: 2.
- Baseline and post-change profiling: five warm runs per route/viewport; use medians.
- Default step deadline: 600 seconds; maximum step deadline: 1800 seconds.
- Stop on dirty-change conflict, scope expansion, new dependency, backend requirement, sensitive-data exposure, failed mandatory check, or a new Human Gate.
