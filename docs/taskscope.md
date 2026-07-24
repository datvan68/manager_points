# Task Identity and Pipeline

- Task: `activity-detail-attendance-controls-and-admin-only-grants`
- Pipeline: `bug_fix`
- Profile: Full
- Risk: Medium
- Status: Planning only; implementation is not authorized by this document.

# Objective

Update the activity detail attendance experience so that:

1. an attendance session can be opened only during the current, non-cancelled schedule interval;
2. the method selector uses an intrinsic-width `Quay lại` button;
3. the activity owner is labelled `Phụ trách`;
4. `Phân quyền điểm danh` is visible and usable only by administrators;
5. selecting `Theo lớp` hides the introductory `Điểm danh hoạt động` card while the class picker is open; and
6. buttons and selects in the affected attendance UI consume the repository's shared UI components and established design variants.

The administrator-only grant rule in this scope supersedes the earlier requirement that the activity's responsible user could administer attendance grants.

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
- Granting attendance-grant administration to the activity's responsible user, teachers, class owners, presidents, or delegated users.
- Removing the responsible user's existing ability to open attendance when separately allowed by attendance capabilities.
- Changing delegated attendance methods, supported methods, class ownership rules, or grant persistence semantics beyond administrator-only grant administration.
- Deployment, production data changes, dependency upgrades, commits, or pushes.

# Context and Decisions

- The authoritative activity owner remains the user referenced by `activity.advisor_id`; `Phụ trách` is only the activity-detail label for that relationship.
- Attendance-grant administration is administrator-only. Backend authorization is authoritative; frontend hiding is an additional UX control, not the security boundary.
- `capabilities.can_administer_grants` must be true only for an authenticated administrator and false for every non-admin, including a matching `activity.advisor_id`.
- The introductory `Điểm danh hoạt động` card is the no-session entry state containing the `Mở điểm danh` action. It must not render while `classPickerOpen` is true.
- Selecting `Theo lớp` may transition from the method selector to the class picker without opening a session. During that state, only the class-selection workflow and other independently valid status content may remain visible.
- Cancelling the class picker returns to the normal no-session entry state and clears the selected class.
- Existing shared controls are `Button` from `@/components/ui/button` and the `Select` family from `@/components/ui/select`.
- The attendance opening window is interpreted as the inclusive absolute-time interval `start_time <= now <= end_time` for the current non-cancelled activity schedule. A requested early/late buffer requires an amended scope with an exact duration.

# Implementation Steps

1. Establish focused baselines for activity-detail attendance states, schedule validation, and attendance-grant authorization.
2. Make schedule validation authoritative in the attendance-session service:
   - require a valid schedule belonging to the requested activity/context;
   - reject cancelled, missing, mismatched, or invalid schedules;
   - reject requests before `start_time` and after `end_time`;
   - accept the exact start and end boundaries;
   - use stored absolute timestamps and a deterministic test clock.
3. Align the activity-detail attendance action with the same schedule window:
   - disable `Mở điểm danh` outside the valid interval;
   - show a concise reason when unavailable;
   - preserve backend error handling for stale clients or clock drift.
4. In `Chọn hình thức điểm danh`, render `Quay lại` with the shared outline/secondary `Button`, a left-chevron icon, and intrinsic width (`w-auto`/content-sized), not `w-full`.
5. Render the activity metadata label as `Phụ trách` without changing the underlying `advisor_id` contract.
6. Enforce administrator-only attendance-grant management:
   - calculate `can_administer_grants` from administrator status only;
   - allow grant candidate/list/upsert operations for admins;
   - reject the assigned responsible user and all other non-admin users;
   - render `AttendanceGrantManager` only when the authenticated user is an admin and the authoritative capability permits it;
   - do not infer access from `advisor_id`, delegated methods, class ownership, or frontend state.
7. Correct the `Theo lớp` transition:
   - close the method selector and open the class picker as one state transition;
   - suppress the introductory `Điểm danh hoạt động` card whenever the class picker is open;
   - prevent duplicate entry cards or simultaneous `Mở điểm danh` and `Chọn lớp điểm danh` actions;
   - on cancel, close the picker, reset its selected class, and restore the normal entry state;
   - preserve the existing session-opening behavior after a valid class is selected.
8. Standardize controls inside the affected attendance sections:
   - replace locally styled native buttons with shared `Button` variants and sizes;
   - continue using the shared `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, and `SelectValue`;
   - preserve disabled state, focus treatment, accessible names, pending/error feedback, and responsive layout;
   - do not modify shared component implementations unless a separate defect is approved.
9. Run focused tests, affected package checks, then inspect the final diff and repository status for unintended changes.

# Acceptance Criteria

- Before the schedule start and after its end, opening attendance is rejected by the backend and disabled in the activity detail UI.
- At the exact start, during the interval, and at the exact end, an otherwise authorized manager can open attendance.
- Cancelled, mismatched, missing, or invalid schedules cannot be used to open attendance.
- `Quay lại` is a shared semantic `Button`, includes the left-chevron icon, returns to the previous attendance state, and occupies only the width required by its content.
- Activity detail displays `Phụ trách: <name>` and preserves the existing fallback for an unassigned activity.
- Only an administrator receives `can_administer_grants: true`, sees `Phân quyền điểm danh`, loads candidates, and updates allowed methods.
- The assigned `advisor_id` user and every other non-admin receive no grant-management UI and are rejected by grant-management endpoints.
- Administrator-only grant visibility does not remove any independently authorized attendance-opening methods from responsible or delegated users.
- After selecting `Theo lớp`, `Chọn lớp điểm danh` is shown and the introductory `Điểm danh hoạt động` card is absent.
- The class-picker state never displays a duplicate `Mở điểm danh` entry action.
- Cancelling class selection clears the selected class and restores the standard no-session attendance entry state.
- A valid class selection still opens the intended manual-class attendance session.
- Affected buttons and selects use shared UI components; no duplicate local button/select design system is introduced.
- Existing async reconciliation, accessibility attributes, disabled states, and error feedback continue to work.

# Verification

Run only repository-native commands and record their actual results.

1. Backend attendance-window tests:
   - Working directory: `backend`
   - Command: `npm test -- --runInBand src/attendance-sessions/attendance-sessions.service.spec.ts`
   - Expected: before/start/inside/end/after and invalid-schedule cases pass.
2. Backend attendance-grant authorization tests:
   - Working directory: `backend`
   - Command: `npm test -- --runInBand src/activities/activity-attendance-grants.service.spec.ts`
   - Expected: admin operations pass; assigned responsible and unrelated non-admin users are denied.
3. Frontend focused tests:
   - Working directory: `frontend`
   - Command: `npm test -- "src/app/(dashboard)/activities/[activityId]/page.test.tsx" "src/components/attendance/AttendanceGrantManager.test.tsx"`
   - Expected: schedule gating, intrinsic back button, `Phụ trách`, admin-only grant UI, class-picker transition, cancellation, and shared-control behavior pass.
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
- Stop and amend scope if administrator identification requires schema changes, role migrations, or writes outside the approved boundary.
- Do not solve administrator-only access solely by hiding frontend content; backend endpoints and capability calculation must enforce the same rule.

# Artifacts and Execution Budget

- Planning artifact: `docs/taskscope.md`
- Implementation evidence: focused test output, build/typecheck output, final diff, and final status.
- Prefer the smallest coherent changes within the approved write paths.
- Add no dependencies.
- Repair only scoped failures introduced or exposed by this task; report unrelated pre-existing failures without expanding scope.
- No implementation, commit, push, deployment, migration, or production mutation is included in this planning task.
