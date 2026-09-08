---
slot_id: "taskscope-01"
generation: 1
task_id: "20260908-140925-stabilize-dashboard-navigation"
scope_file: "docs/task/taskscope-01.md"
status: in_progress
scope_revision: 2
created_at: "2026-09-08T14:09:25+07:00"
updated_at: "2026-09-08T14:18:30+07:00"
base_commit: "db2e3451f2629652e2052a9102f6f5558503daed"
task: "Remove dashboard and navigation flicker"
pipeline: bug_fix
profile: Full
risk: medium
environment: development
objective: "Keep the dashboard shell and usable content visually stable during client navigation, maintenance revalidation, and repeat visits to the home page without weakening maintenance or session isolation."
coordination:
  depends_on: []
  warnings:
    - "docs/task/taskscope.md is an unmigrated zero-byte legacy file; slot 00 remains reserved and untouched."
    - "V-03/AC-04 remains blocked: the verified localhost dev UI has no authenticated dev session; production session reuse and credential entry are out of scope."
    - "Independent review for identity-scoped in-memory caching is not available in this execution context."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "DashboardPage initializes without metrics and replaces its whole content with a centered spinner on every mount. MaintenanceGuard resets maintenanceCheckDone on pathname changes and also replaces all routed content while its cached/network check resolves. Sidebar navigation already uses next/link, so the visible flash is a client-render state replacement rather than a hard document reload."
  expected_behavior: "Initial loading has a layout-stable state; returning home for the same authenticated identity renders safe cached dashboard content immediately while refreshing; ordinary client navigation does not blank settled content during maintenance revalidation."
  root_cause: "frontend/src/app/(dashboard)/page.tsx:DashboardPage and frontend/src/components/guards/MaintenanceGuard.tsx:MaintenanceGuard independently replace the routed content tree with full-area spinners during normal remount/path transitions."
scope:
  inspect:
    - "frontend/src/app/(dashboard)/layout.tsx"
    - "frontend/src/components/layout/Sidebar.tsx"
    - "frontend/src/utils/module-maintenance.util.ts"
    - "frontend/src/api/auth-api.ts"
    - "frontend/src/api/system-api.ts"
  write:
    - "frontend/src/app/(dashboard)/page.tsx"
    - "frontend/src/app/(dashboard)/page.test.tsx"
    - "frontend/src/components/guards/MaintenanceGuard.tsx"
    - "frontend/src/components/guards/MaintenanceGuard.test.tsx"
  preserve:
    - "Maintenance mode still blocks non-admin users before protected module content is considered usable; admin bypass and current fail-open behavior on check failure remain unchanged."
    - "Dashboard metrics, semester selection, manual refresh, student/staff visibility, deferred panels, pagination, notification refresh, and timeout/error handling remain compatible."
    - "Dashboard data is memory-only and isolated by the effective auth identity and user; logout, auth epoch change, impersonation change, or user switch must never display another identity's cached payload."
  out:
    - "Backend/API changes, route redesign, persistent browser storage, permission changes, dependency installation, commit/push/deployment, and unrelated page-loading refactors."
acceptance_criteria:
  - "AC-01: After the first maintenance-state resolution, navigating between two non-maintenance dashboard routes never replaces the settled content area with the full-area maintenance spinner; a delayed refresh keeps the correct settled state, while an updated maintenance=true state still blocks the destination and admin bypass remains valid."
  - "AC-02: The first home visit uses a layout-stable loading state, and returning home under the same auth identity shows the last successful dashboard snapshot immediately while one background refresh runs; refresh failure retains prior content and exposes the existing error/retry feedback."
  - "AC-03: No cached dashboard snapshot crosses user, session/auth epoch, or impersonation boundaries; semester switching, explicit refresh, notification refresh, request coalescing, and stale-response protection remain correct."
  - "AC-04: In the verified dev UI, home-to-module-to-home navigation and ordinary in-page clicks show no blank/full-area spinner flash, no hard document reload, no console error, and maintenance blocking still works for an available test state."
execution:
  - "E-01 [AC-01] MaintenanceGuard.tsx -> retain the last resolved maintenance-state snapshot across pathname changes, derive the active module state from that snapshot, and revalidate in the background without resetting settled content; block only the unresolved initial check or an actually maintained module. Preserve subscriptions, focus/interval refresh, timeout, cleanup, admin bypass, and current failure fallback."
  - "E-02 [AC-02,AC-03] page.tsx:DashboardPage -> replace the full-area repeat-mount spinner with a typed, memory-only dashboard snapshot keyed by tokenStorage.getAuthIdentity plus user id. Seed the same identity synchronously, refresh in the background, update the snapshot only from the current identity/request, retain successful metrics on refresh errors, and use a layout-stable skeleton only when no safe snapshot exists."
  - "E-03 [AC-01,AC-02,AC-03] MaintenanceGuard.test.tsx and page.test.tsx -> add behavioral deferred-promise tests for pathname rerender, maintenance updates, unmount/remount cache reuse, identity switch isolation, refresh failure, coalescing, and stale response rejection; replace source-string-only coverage where it cannot prove rendered stability."
  - "E-04 [AC-04] Run verified-dev browser scenarios with read-only navigation and delayed requests where available; compare visible shell/content before, during, and after navigation and inspect console/navigation entries."
verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix frontend test -- \"src/components/guards/MaintenanceGuard.test.tsx\" \"src/app/(dashboard)/page.test.tsx\" -> all focused behavioral tests pass with no transient full-area spinner after settled state."
  - "V-02 [AC-01,AC-02,AC-03] npm --prefix frontend run typecheck -> exits successfully."
  - "V-03 [AC-04] Verified dev browser: navigate home -> two permitted modules -> home, repeat the active home control, exercise an in-page dashboard action, and validate one available maintenance=true route -> shell/content stays stable except the intentional maintenance screen; performance navigation entries show client navigation rather than document reload and console has no new error."
  - "V-04 [AC-01,AC-02,AC-03,AC-04] git diff --check -- \"frontend/src/app/(dashboard)/page.tsx\" \"frontend/src/app/(dashboard)/page.test.tsx\" \"frontend/src/components/guards/MaintenanceGuard.tsx\" \"frontend/src/components/guards/MaintenanceGuard.test.tsx\"; inspect the scoped diff and Git status -> no whitespace errors or unrelated writes."
runtime_test:
  targets: "Before UI testing, verify the effective frontend/API/database and maintenance-state destination are development and isolated from production using non-secret metadata."
  resources: "Existing authenticated dev session and permitted read-only routes; use an existing maintenance test state only when already available."
  operations: "Read-only navigation, refresh, console/performance inspection, and transient client-side request delay; do not mutate maintenance settings, roles, permissions, or persistent data."
  scenarios:
    - "First home load, leave and return home, then use refresh and semester/in-page controls."
    - "Navigate between two mapped non-maintenance modules with maintenance response delayed beyond one render."
    - "Verify an already available maintained route and a changed auth/impersonation identity without exposing the prior snapshot."
  cleanup: "Remove transient browser interception/delay, restore the starting route/session selection, and report residual state; no persistent data change is expected."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "A global dashboard cache not keyed to auth identity could expose personal or operator data across session or impersonation changes."
  - "Keeping old guard output without deriving it from the destination module could briefly show the wrong maintenance state."
  - "A cosmetic skeleton-only change would hide symptoms without preventing repeat-mount content replacement."
stop_conditions:
  - "Apply exact-file pin, ownership/conflict, freshness, and release-boundary checks before execution."
  - "Stop if another active task reserves any write path, if identity-safe reuse needs writes outside this scope, or if dev isolation cannot be verified for runtime checks."
  - "Do not weaken maintenance enforcement, persist dashboard payloads, or claim runtime success from unit tests alone."
---
