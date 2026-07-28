# Task Identity and Pipeline

Task: `pwa-location-consent-and-dashboard-performance`
Pipeline: `bug_fix` | Profile: Full | Rules: 3.2.0
Repository: `D:\PROJECT\manager_points` | Branch: `main` | Base: `fb8d5ae207f77a59f8d39c51719ed88683ba7c3d` | Initial status: clean

# Risk Level

Risk: high. The work spans the frontend and backend and changes browser geolocation consent behavior plus a role-scoped dashboard aggregation. Development-only, reversible in Git, with no deployment, migration, or new location storage.

# Objective

After authentication in the installed mobile PWA, reuse an existing GPS grant and present one user-initiated first-use request only when permission is still `prompt`; reduce Dashboard time-to-data by removing redundant reloads and parallelizing independent database work without changing returned metrics.

# Scope Boundaries

Approved: `frontend/src/**`, `backend/src/system/**`
Write:

- `frontend/src/hooks/useLocationPermission.ts`
- `frontend/src/hooks/useLocationPermission.test.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Header.test.tsx`
- `frontend/src/app/(dashboard)/page.tsx`
- `frontend/src/app/(dashboard)/page.test.tsx`
- `backend/src/system/system.service.ts`
- `backend/src/system/system.service.spec.ts`

Targets: permission-state synchronization and first-use CTA; Dashboard request lifecycle and `notifications-updated` handling; `SystemService.getDashboardMetrics`.

# Out of Scope

Silently granting or resetting OS/browser permissions; repeatedly prompting after denial; background location tracking; storing or transmitting new coordinates; API response changes; database indexes, schema, migration, caching infrastructure, deployment, and unrelated mojibake.

# Context and Dependencies

Geolocation permission is controlled by iOS/browser settings. The app can query or request it but cannot grant it automatically. `useLocationPermission` already maps `prompt`, `granted`, and `denied`; `Header` already exposes a manual location control. Dashboard currently reloads the full metrics endpoint on notification events, while `getDashboardMetrics` executes many independent MongoDB queries sequentially.

# Steps

1. Add regression baselines for permission-state transitions, first-use presentation, Dashboard request coalescing, response compatibility, and independent query scheduling.
2. Synchronize permission state on PWA resume/authenticated render. Reuse `granted`; show one user-action request when `prompt`; show settings guidance when `denied`.
3. Prevent redundant/concurrent full Dashboard reloads and preserve manual refresh and semester changes.
4. Group independent role-scoped MongoDB reads with bounded `Promise.all` stages after required semester/user context is resolved, preserving filters and payload shape.
5. Run focused frontend/backend tests, type/build checks, and final diff review.

# Acceptance Criteria

- AC1: An existing GPS grant is reused after login without another prompt.
- AC2: A first-use request requires a user action and is not repeated in the same authenticated PWA session.
- AC3: Denied permission is never auto-requested and displays actionable iOS/settings guidance.
- AC4: Initial, manual, and semester Dashboard loads remain correct; notification events do not trigger duplicate full loads.
- AC5: Dashboard metrics retain their existing role filters and response structure while independent reads execute concurrently.
- AC6: No coordinate persistence, permission bypass, migration, or unrelated behavior is introduced.

# Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run src/hooks/useLocationPermission.test.tsx src/components/layout/Header.test.tsx "src/app/(dashboard)/page.test.tsx"` => AC1-AC4 pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => frontend types pass.
- `D:\PROJECT\manager_points\backend :: npm test -- system.service.spec.ts --runInBand` => AC5-AC6 and existing system-service tests pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => backend compiles.
- `D:\PROJECT\manager_points :: git diff --check` => patch formatting is valid.

# Safety Gates

Gate: None. Stop and request approval if implementation adds location persistence/transmission, schema/index changes, migration, deployment, or other production mutation.

# Artifacts and Checkpoints

Artifacts: focused test output and final diff/status. Checkpoints and hashes: None before implementation; Git provides recovery.

# Execution Budgets

One frontend/backend implementation worker with one writer per path; deadline 1,800 seconds; at most 2 tool retries, 3 engineering loops, and 2 review-remediation cycles. Promote/amend scope if additional modules, dependencies, public contracts, or sensitive-data handling are required.
