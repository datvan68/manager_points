# Task Identity and Pipeline

Task: `pwa-mobile-loading-and-navigation-width`

Pipeline: `bug_fix` | Profile: Full | Rules: 3.2.0

Repository: `D:\PROJECT\manager_points` | Branch: `main` | Base: `e57ee898`

Base state: dirty; preserve the existing backend activity-schedule changes and frontend activity-page changes.

# Risk Level

Risk: medium. Development-only, reversible frontend changes. The loading path spans authentication, maintenance checks, dashboard data, and PWA navigation, so it exceeds Quick scope. No persistent-data, deployment, credential, or external-state mutation is authorized.

# Objective

On an installed/mobile PWA, authenticated content must leave its initial loading state within a bounded, observable time or show a recoverable error, and the mobile bottom navigation must use a narrower centered footprint without clipping labels, active state, or touch targets.

# Scope Boundaries

Approved: `frontend/src/**`, `frontend/public/sw.js`, focused frontend tests, and `docs/taskscope.md`.

Write candidates after diagnosis:

- `frontend/src/providers/auth-provider.tsx`
- `frontend/src/components/guards/MaintenanceGuard.tsx`
- `frontend/src/app/(dashboard)/page.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- their focused `*.test.tsx` files
- `frontend/public/sw.js` only if service-worker evidence identifies it as causal

Known targets: `AuthProvider.checkAuth/loadUserPermissions`, maintenance-state resolution, dashboard `loadData`, and `.mobile-bottom-nav`.

# Out of Scope

Backend/API mutation, database changes, authentication policy changes, desktop sidebar behavior, visual redesign, deployment, and unrelated dirty files. Amend this scope before backend work if endpoint timing proves causal.

# Context and Dependencies

The root UI can wait sequentially on auth, `MaintenanceGuard`, and dashboard metrics. Some raw auth fetches have no local timeout, while the dashboard keeps a full-screen loader when metrics remain null. Mobile navigation is rendered by `Sidebar.tsx` with fixed `left-4 right-4`. API availability, iOS standalone mode, safe-area insets, and online/offline transitions must be distinguished during diagnosis.

# Steps

1. Capture installed-PWA and mobile-browser timings for auth, maintenance, dashboard metrics, service-worker navigation, and loading-state transitions.
2. Identify the first unresolved request/state; add bounded timeout/error/retry behavior and remove avoidable serialized blocking without weakening authentication or permission checks.
3. Preserve cached authenticated UI when safe, while making offline, timeout, and unauthorized outcomes explicit and recoverable.
4. Reduce and center the mobile bottom-navigation width; retain safe-area clearance, all permitted items, accessible names, active indication, and at least 44px touch targets.
5. Add focused regressions for settled loading/error paths and mobile navigation classes/semantics; review the final diff for unrelated changes.

# Acceptance Criteria

- AC-1: Auth, maintenance, and dashboard initial loads each settle on success, timeout, offline failure, and definitive auth failure; no indefinite spinner remains.
- AC-2: Valid cached sessions render safely while background refresh proceeds; invalid sessions still redirect to login.
- AC-3: At 390x844 and 430x932 in standalone and browser modes, the bottom navigation is visibly narrower and centered, remains inside safe areas, and every visible action is usable and readable.
- AC-4: Desktop sidebar widths and behavior are unchanged.
- AC-5: Existing unrelated worktree changes remain untouched.

# Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run src/providers/auth-provider.test.tsx src/components/guards/MaintenanceGuard.test.tsx src/components/layout/Sidebar.test.tsx` => all focused regressions pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors.
- Production build served as an installed PWA; inspect 390x844 and 430x932 under normal, throttled, offline, expired-session, and API-failure conditions => AC-1 through AC-4 pass with recorded request/state timings.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => clean patch formatting and no unintended paths.

# Safety Gates

None for scoped frontend implementation. Stop and amend scope before backend mutation, deployment, authentication-policy change, or any persistent-data operation.

# Artifacts and Checkpoints

Keep browser timing/network evidence and mobile screenshots as verification artifacts. Record the implementation-start commit and final diff; no mutation checkpoint is required before execution.

# Execution Budgets

One writer per path; maximum three implementation/verification loops, two review-remediation cycles, and two idempotent retries. Stop on scope expansion, overlapping dirty edits, or a required Human Gate.
