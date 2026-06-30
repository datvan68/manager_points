# Taskscope: Maintenance Mode Enforcement for Task-Linked Routes

## Objective
Fix the maintenance-mode access leak where non-admin users can open a maintained module by navigating from `/students/tasks` or from a task-linked destination. Maintenance mode must be enforced consistently for direct URL access, sidebar/module navigation, tab navigation, dashboard shortcuts, and task card links.

Only admin-level users may bypass maintenance mode. Normal teacher, student, supervisor, and permissioned non-admin accounts must be blocked from any module that is currently marked as under maintenance.

## Current Issue
The current maintenance implementation blocks some protected pages, but the task workflow can still reach maintained destinations.

Observed problem:
- A user opens `/students/tasks`.
- The user clicks a task card or external-link action.
- The app navigates to `task.linkedPage`, such as `/students/record`, `/grading/score`, `/grading/categories`, `/students`, `/dormitory`, `/club`, or a custom URL.
- If the destination module is under maintenance, the user can still access it in some cases.

Main suspected causes:
- `/students/tasks/page.tsx` bypasses `RouteGuard` entirely for student and teacher accounts, so maintenance checks do not run for those users on that page.
- Maintenance checking is currently page-level, so any dashboard route without `RouteGuard` can bypass maintenance.
- Task-linked custom destinations may point to routes that are not mapped to a module or are not wrapped by a guard.
- `/tasks` is a dashboard route but is not mapped to the `events` module.

## Expected Behavior
- Admin users can access maintained modules for management and verification.
- Teacher accounts cannot access a maintained module unless they also have admin-level bypass rights.
- Student accounts cannot access maintained modules.
- `/students/tasks` itself must be blocked when the `events` module is under maintenance.
- A task card must not allow navigation into a maintained destination module.
- Direct browser access to a maintained route must show the maintenance screen.
- Navigation from dashboard widgets, sidebar, subsystem popup, tabs, notifications, and task links must obey the same rule.

## Admin Bypass Rule
Use the existing `isAdminUser(user)` rule as the only maintenance bypass.

A user is treated as admin only when at least one of these is true:
- `role === "Admin"`
- `roleName === "Admin"`
- `roleCode === "ADMIN"`
- `permissions` includes `ADMIN_FULL`

A teacher with only teacher permissions must not bypass maintenance mode.

## Implementation Scope

### 1. Keep maintenance state server-backed
Continue using backend system settings as the source of truth for module maintenance states.

Required behavior:
- Any authenticated user can read module maintenance states.
- Only admin users can update module maintenance states.
- Frontend must not rely on `localStorage` as the source of truth.
- Same-tab and cross-tab updates should remain synchronized through the existing update notification mechanism.

### 2. Enforce maintenance at dashboard route level
Add a maintenance guard at the dashboard layout level so all dashboard child routes are covered, including routes that do not currently wrap their page content in `RouteGuard`.

Required behavior:
- The dashboard layout should check the current pathname against the route-to-module map.
- If the matching module is under maintenance and the user is not admin, show the maintenance screen instead of children.
- Existing per-page permission guards should continue to handle permission checks.
- Avoid duplicating permission denial behavior at the layout level.

Implementation note:
- If reusing `RouteGuard` in `frontend/src/app/(dashboard)/layout.tsx`, make sure it does not conflict with nested `RouteGuard` instances.
- If nested guards cause duplicate loading or duplicate API calls, extract maintenance checking into a focused `MaintenanceGuard` component and use it in the layout.

### 3. Fix `/students/tasks` bypass
Update `frontend/src/app/(dashboard)/students/tasks/page.tsx` so student and teacher users no longer bypass maintenance checks.

Required behavior:
- Student and teacher users may bypass only the permission requirement when business rules allow them to view tasks.
- They must still pass maintenance checks.
- The page should remain accessible to permitted non-admin users only when the `events` module is not under maintenance.

Suggested approach:
- Always render through a guard.
- Pass `anyPermission={undefined}` or no permission props for the student/teacher bypass case.
- Keep the existing permission requirement for other roles: `STUDENT_PAGE` or `READ_STUDENT_TASK`.

### 4. Expand route-to-module mapping
Update `frontend/src/utils/module-maintenance.util.ts` so every route reachable from tasks maps to the correct module.

Required mappings:
- `/students/tasks` -> `events`
- `/tasks` -> `events`
- `/students/record` -> `attendance`
- `/students` -> `sv-profile`
- `/grading` -> `grading`
- `/grading/score` -> `grading` through prefix matching
- `/grading/categories` -> `grading` through prefix matching
- `/dormitory` -> `dormitory`
- `/club` -> `club`
- `/permissions` -> `security`
- `/system` -> `config`
- `/reports` -> `reports`
- `/notifications` -> `notifications`

Mapping must normalize query strings and trailing slashes before matching if the guard receives a full linked URL or query-bearing pathname.

### 5. Block task-linked navigation before route change
Add a pre-navigation check inside task link handlers so users get immediate feedback instead of briefly entering a blocked page.

Relevant files:
- `frontend/src/components/students/tasks/StudentTasksTab.tsx`
- Any dashboard task panel that navigates to `task.linkedPage`

Required behavior:
- Before `router.push(task.linkedPage)`, resolve the destination module.
- Read the latest maintenance states or use a short-lived shared cache.
- If the destination module is under maintenance and the user is not admin, show a maintenance toast or redirect to the maintenance view instead of pushing the route.
- The route-level guard remains the final enforcement layer even if the pre-navigation check is missed.

### 6. Protect unguarded placeholder routes
Ensure currently unguarded dashboard pages still obey maintenance mode:
- `/tasks`
- `/dormitory`
- `/club`

Preferred solution:
- Dashboard-level maintenance guard covers these routes automatically.

Fallback solution:
- Wrap each route with a dedicated guard, but this is more error-prone and should not be the primary fix.

## Out of Scope
- Changing permission policy for who can view or manage tasks.
- Changing task assignment logic, task progress logic, or task-linked page modes.
- Changing grading, attendance, or student record business rules.
- Adding a new database table for maintenance state.
- Blocking global login during maintenance. This scope only blocks maintained modules/pages after login.

## Acceptance Criteria
- A teacher account cannot access `/students/tasks` when the `events` module is under maintenance.
- A teacher account cannot access `/students/record` from a task link when the `attendance` module is under maintenance.
- A teacher account cannot access `/grading/score` or `/grading/categories` from a task link when the `grading` module is under maintenance.
- A student account cannot access maintained modules through direct URL or task card navigation.
- An admin account can still access maintained modules.
- Direct URL access and in-app navigation produce the same maintenance behavior.
- `/tasks`, `/dormitory`, and `/club` are covered by maintenance enforcement even if they do not define their own page-level `RouteGuard`.
- Maintenance state changes made by admin are reflected in other tabs or sessions without relying on localStorage as the source of truth.
- Existing permission-denied behavior remains unchanged when a module is not under maintenance.

## Test Plan

### Automated checks
- Run frontend typecheck or build.
- Run backend build if maintenance API changes are touched.
- Add or update frontend tests for:
  - `getModuleIdByPath()` matching `/students/tasks`, `/tasks`, `/grading/score`, query strings, and trailing slashes.
  - non-admin users being blocked when a mapped module is maintained.
  - admin users bypassing maintenance.
  - `/students/tasks` using guard-based maintenance checks even when permission props are bypassed.

### Manual verification
Use at least one admin account and one teacher account.

1. Log in as admin.
2. Turn on maintenance for `events`.
3. Log in as teacher in another browser/session.
4. Open `/students/tasks` directly and confirm the maintenance screen appears.
5. Turn off `events`, turn on `attendance`.
6. As teacher, open `/students/tasks`, click a task linked to `/students/record`, and confirm access is blocked.
7. Turn on `grading`.
8. As teacher, click a task linked to `/grading/score` or `/grading/categories`, and confirm access is blocked.
9. Open the same routes as admin and confirm access is allowed.
10. Test `/tasks`, `/dormitory`, and `/club` directly with their modules under maintenance.

## Deliverable
A consistent maintenance-mode enforcement layer that prevents teacher, student, and other non-admin accounts from entering maintained modules through `/students/tasks`, task-linked routes, direct URLs, or unguarded dashboard pages, while preserving admin bypass and existing permission behavior.