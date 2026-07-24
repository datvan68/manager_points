# Task Identity and Pipeline

- Task: `activity-detail-attendance-controls-and-responsible-access`
- Pipeline: `bug_fix`
- Profile: Full
- Risk: Medium
- Status: Planning only; implementation is not authorized by this document.

# Objective

Update the activity detail attendance experience so that:

1. an attendance session can be opened only during the current, non-cancelled schedule interval;
2. the method selector uses an intrinsic-width `Quay lại` button;
3. the activity owner is labelled `Phụ trách`;
4. the user assigned as the activity's `advisor_id` can administer attendance grants; and
5. buttons and selects in the affected attendance UI consume the repository's shared UI components and established design variants.

# Scope Boundaries

## Approved write paths

- `backend/src/attendance-sessions/attendance-sessions.service.ts`
- `backend/src/attendance-sessions/attendance-sessions.service.spec.ts`
- `backend/src/activities/activity-attendance-grants.service.ts`
- `backend/src/activities/activity-attendance-grants.service.spec.ts`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- `frontend/src/components/attendance/AttendanceGrantManager.tsx`
- `frontend/src/components/attendance/AttendanceGrantManager.test.tsx`

## Read-only references

- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/attendance/AttendanceMethodSelector.tsx`
- `frontend/src/api/activity-api.ts`
- `backend/src/activities/activity-attendance-grants.controller.ts`

New write paths or changes outside the approved boundary require a scope amendment.

# Out of Scope

- A global redesign of buttons, selects, inputs, search fields, or the Activities menu.
- Changes to the shared `Button` or `Select` APIs or visual tokens.
- Renaming the persisted `advisor_id` field, database migration, role migration, or global replacement of the terms `advisor` and `Cố vấn`.
- Granting attendance administration to all teachers or all users with an advisor-like role.
- Changing delegated teacher defaults, supported attendance methods, class ownership rules, or grant persistence semantics.
- Deployment, production data changes, or dependency upgrades.

# Context and Dependencies

- The authoritative activity owner remains the user referenced by `activity.advisor_id`; `Phụ trách` is the activity-detail UI label for that relationship.
- Current grant-service logic already treats an administrator or matching `advisor_id` as an attendance-grant administrator. Implementation must verify and preserve this behavior, close any frontend visibility gap, and avoid adding a parallel permission model.
- Backend authorization remains authoritative. Hiding or showing `AttendanceGrantManager` from the capabilities response is only a frontend UX control.
- Existing shared controls are `Button` from `@/components/ui/button` and the `Select` family from `@/components/ui/select`.
- The attendance opening window is interpreted as an inclusive interval in absolute time: `start_time <= now <= end_time`, for the current non-cancelled activity schedule. If the intended rule includes an early-opening or late-closing buffer, the exact duration must be supplied and this scope amended before implementation.

# Steps

1. Establish focused baselines for activity-detail attendance rendering, schedule validation, and attendance-grant authorization.
2. Make schedule validation authoritative in the attendance-session service:
   - require a valid schedule belonging to the requested activity/context;
   - reject cancelled schedules;
   - reject requests before `start_time` and after `end_time`;
   - accept the exact start and end boundaries;
   - evaluate time consistently using stored absolute timestamps and a deterministic test clock.
3. Align the activity-detail attendance UI with the same window:
   - disable `Mở điểm danh` outside the valid interval;
   - show a concise reason when the action is unavailable;
   - retain backend rejection handling for stale clients or clock drift.
4. In `Chọn hình thức điểm danh`, render `Quay lại` with the shared outline/secondary `Button`, a left-chevron icon, and intrinsic width (`w-auto`/content-sized layout), not `w-full`.
5. Render the activity metadata label as `Phụ trách` only on activity detail, without changing the underlying `advisor_id` contract.
6. Verify attendance-grant administration for the assigned activity owner:
   - `capabilities.can_administer_grants` is true when the authenticated user ID equals `activity.advisor_id`;
   - candidates/list/upsert remain allowed for that user;
   - unrelated teachers remain forbidden;
   - admins retain access;
   - the grant manager is visible to the assigned owner based on backend capabilities.
7. Standardize controls inside the affected attendance sections:
   - replace locally styled native buttons with shared `Button` variants and sizes;
   - continue using the shared `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, and `SelectValue`;
   - preserve pressed state, disabled state, focus treatment, accessible names, pending/error behavior, and responsive layout;
   - do not modify shared component implementations unless a separately approved defect is found.
8. Run focused tests, affected package checks, then review the final diff and repository status for unintended changes.

# Acceptance Criteria

- Before the schedule start and after its end, opening attendance is rejected by the backend and disabled in the activity detail UI.
- At the exact start, during the interval, and at the exact end, an otherwise valid manager can open attendance.
- Cancelled, mismatched, missing, or invalid schedules cannot be used to open attendance.
- `Quay lại` is a semantic shared `Button`, includes the left-chevron icon, returns to the previous attendance state, and occupies only the width required by its content.
- The activity detail metadata displays `Phụ trách: <name>` and preserves the existing fallback for an unassigned activity.
- A user whose ID matches the activity's `advisor_id` can see and use `Phân quyền điểm danh`, including loading candidates and updating allowed methods.
- An unrelated teacher cannot administer attendance grants, even if that teacher has delegated attendance methods.
- Admin attendance-grant access and existing delegated-teacher behavior remain unchanged.
- Affected attendance buttons and selects use the shared UI components; no duplicate local button/select design system is introduced.
- Existing async grant reconciliation, accessibility attributes, disabled states, and error feedback continue to work.

# Verification

Run only commands that are available in the repository and record their actual results.

1. Backend attendance-window tests:
   - Working directory: `backend`
   - Command: `npm test -- --runInBand src/attendance-sessions/attendance-sessions.service.spec.ts`
   - Expected: before/start/inside/end/after and invalid-schedule cases pass.
2. Backend attendance-grant authorization tests:
   - Working directory: `backend`
   - Command: `npm test -- --runInBand src/activities/activity-attendance-grants.service.spec.ts`
   - Expected: assigned owner and admin are allowed; unrelated teacher is denied.
3. Frontend focused tests:
   - Working directory: `frontend`
   - Command: `npm test -- "src/app/(dashboard)/activities/[activityId]/page.test.tsx" "src/components/attendance/AttendanceGrantManager.test.tsx"`
   - Expected: window gating, content-sized back button, `Phụ trách`, owner visibility, and shared-control behavior pass.
4. Backend build:
   - Working directory: `backend`
   - Command: `npm run build`
   - Expected: successful Nest build.
5. Frontend static check:
   - Working directory: `frontend`
   - Command: `npm run typecheck`
   - Expected: no TypeScript errors.
6. Final repository checks:
   - Working directory: repository root
   - Commands: `git diff --check` and `git status --short`
   - Expected: no whitespace errors and only intended scoped files are modified.

# Safety Gates

- No human gate is required for planning or local implementation within the approved paths.
- Stop and request clarification if the attendance window differs from the exact schedule interval, especially if an early/late buffer is required.
- Stop and amend scope if correct authorization requires schema changes, role changes, migration, or writes outside the approved boundary.
- Do not weaken backend authorization to solve a frontend visibility issue.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`
- Implementation evidence: focused test output, build/typecheck output, final diff, and final status.
- No commit, push, deployment, migration, or production mutation is included.

# Execution Budgets

- Prefer the smallest coherent changes within the eight approved write paths.
- Add no dependencies.
- Keep verification focused before running package-level build/static checks.
- Repair only scoped failures introduced or exposed by this task; report unrelated pre-existing failures without expanding scope.
