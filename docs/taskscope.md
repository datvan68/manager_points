# Task Identity and Pipeline

- Task: `activity-attendance-manual-class-entry`
- Pipeline: `feature_development`
- Profile: Full
- Rules: `3.2.0`
- Repository: `D:\PROJECT\manager_points`
- Base: branch `main`, commit `e330f9dc`; `docs/taskscope.md` is the only dirty path and is the authorized planning artifact.

# Risk Level

- Risk: high.
- Environment: development.
- Evidence: role-dependent attendance entry affects which class ID is submitted. Existing server authorization remains authoritative.
- Blast radius: activity detail Attendance tab and focused frontend tests.

# Objective

In `activities/[activityId] > Điểm danh`, remove the persistent unopened class cards. Clicking `Theo lớp` opens the teacher’s class session immediately, while Admin or the assigned activity advisor must select an authorized class first.

# Scope Boundaries

- Approved/write:
  - `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
  - `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- Conditional write only if the existing selector contract cannot support the flow:
  - `frontend/src/components/attendance/AttendanceMethodSelector.tsx`
  - `frontend/src/components/attendance/AttendanceMethodSelector.test.tsx`
- Known targets: `ActivityAttendanceTab`, `handleOpenSession`, manual-lane rendering, role/capability-derived class selection.

# Out of Scope

- Attendance grants, backend authorization, session ownership/uniqueness, QR/GPS, scoring, realtime protocol, and unrelated activity layout.
- Showing classes that the current backend does not authorize.

# Context and Dependencies

- `AttendanceMethodSelector` already emits `manual_class`.
- `capabilities.classes` supplies classes owned by the requester; Admin can use the existing `classApi.getClasses()` list while backend checks remain authoritative.
- An assigned activity advisor is a chooser even when their account role is `TEACHER`; a delegated/non-advisor teacher uses the direct-open flow.
- Direct open requires exactly one authorized teacher class. Zero or ambiguous classes must show a clear error instead of guessing.
- Active manual sessions must retain close controls and `ManualAttendanceGrid`; only unopened class cards are removed.

# Steps

1. Add focused regressions for delegated teacher, Admin, and assigned-advisor flows.
2. Replace unopened manual class lanes with one `Theo lớp` action.
3. Resolve a delegated teacher’s single owned class and open it immediately with today’s schedule.
4. For Admin/assigned advisor, show a class picker, validate selection, then open the selected class session.
5. Render only active manual session content, preserving close, roster, loading, error, and reload behavior.
6. Run focused tests, typecheck, independent role/authorization-boundary review, and final diff inspection.

# Acceptance Criteria

- AC1: No “Lớp … / Chưa có phiên…” cards appear before a manual session is opened.
- AC2: A delegated teacher clicks `Theo lớp` once and the request contains their sole authorized `class_id` without a second selection step.
- AC3: Admin and the assigned activity advisor cannot open `manual_class` until selecting an authorized class.
- AC4: The selected class ID and today’s schedule ID are submitted; canceling the picker opens nothing.
- AC5: Missing today schedule, zero classes, or ambiguous teacher ownership produces a visible error and no request.
- AC6: An active manual session still shows its class roster and close action; QR/GPS behavior is unchanged.

# Verification

- AC1–AC6: `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/activities/[activityId]/page.test.tsx" "src/components/attendance/AttendanceMethodSelector.test.tsx"` => focused attendance UI tests pass.
- Static: `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors.
- Final: `D:\PROJECT\manager_points :: git diff --check` and `git diff -- docs/taskscope.md frontend/src/app/(dashboard)/activities/[activityId]` => scoped, whitespace-clean diff with no unrelated changes.

# Safety Gates

- Gate: None. No deployment, migration, persistent-data mutation, or authorization expansion is authorized.

# Artifacts and Checkpoints

- Required artifact: focused test output and final diff.
- Checkpoint: implementation diff before independent review.

# Execution Budgets

- One writer per path; maximum retries 2, engineering loops 3, review remediation cycles 2.
- Stop and amend scope if backend/API authorization or additional modules must change.
