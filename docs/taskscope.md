# Task Identity and Pipeline

- Task: `activity-detail-attendance-window-and-copy`
- Pipeline: `bug_fix`
- Profile: Full
- Rules: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base state: branch `main`, commit `1bd03d4c`; `docs/taskscope.md` is the only observed dirty path and is replaced by this planning artifact.

# Risk Level

- Risk: medium.
- Environment: development.
- Evidence: the work changes attendance-session opening rules in the backend and the corresponding activity-detail UI; it does not migrate data, deploy, or alter existing attendance records.

# Objective

Make `activities/[activityId]` allow a new attendance session only during the selected schedule's current time window, present “Quay lại” as a proper button in “Chọn hình thức điểm danh”, and rename the activity-detail label “Cố vấn” to “Phụ trách”.

# Scope Boundaries

- Approved/write:
  - `backend/src/attendance-sessions/attendance-sessions.service.ts`
  - `backend/src/attendance-sessions/attendance-sessions.service.spec.ts`
  - `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
  - `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
  - `frontend/src/components/attendance/AttendanceMethodSelector.tsx` and its focused test only if the back action is moved into the selector component
- Known targets: `ensureTodaySchedule`, activity-detail `todaySchedule`/open-session state, the “Mở điểm danh” action, the method-selector back action, and the activity hero metadata label.

# Out of Scope

- Changing schedule creation/editing, stored schedule times, timezone configuration, closing an already-open session, check-in eligibility after a session opens, QR/GPS/manual attendance behavior, permissions, member roles, or API payload shapes.
- Renaming “Cố vấn” globally outside this activity-detail presentation.
- Database migration, dependency changes, deployment, and implementation during this planning task.

# Context and Dependencies

- The backend currently accepts any non-cancelled activity schedule occurring on the same `Asia/Ho_Chi_Minh` calendar date; it does not enforce `start_time` and `end_time`.
- For this scope, “khung giờ mới” means the live schedule interval: opening is allowed when `start_time <= now <= end_time` in absolute time, with both boundaries inclusive. If the intended rule includes an early/late buffer, its exact duration must be supplied before implementation and this scope amended.
- Backend validation remains authoritative; frontend gating is user feedback and must not replace server enforcement.
- The supplied reference image identifies the activity hero text `Cố vấn: <name>` beside `Phòng: <room>`; only the label changes to `Phụ trách`.
- The existing back action is a full-width plain-text button rendered below `AttendanceMethodSelector`; it should become a visually recognizable shared `Button` with a `ChevronLeft` icon, label `Quay lại`, keyboard focus, and unchanged return behavior.

# Steps

1. Add backend regression tests for before-window, exact-start, within-window, exact-end, after-window, cancelled schedule, mismatched activity, and invalid schedule cases using a deterministic clock.
2. Replace the date-only opening guard with an explicit current-window guard while retaining schedule/activity/status validation and `Asia/Ho_Chi_Minh` date semantics where relevant.
3. Derive the same openability state from the current activity schedule in the detail page; disable “Mở điểm danh” outside the window and show a concise reason without hiding the schedule.
4. Keep the backend error visible through the existing toast path for stale clients, clock drift, or direct API calls.
5. Restyle the method-selector “Quay lại” action as a shared secondary/outline button with `ChevronLeft`; preserve `setShowMethodSelector(false)` and responsive layout.
6. Change the activity hero metadata copy from `Cố vấn:` to `Phụ trách:` without changing `advisor_id`, permissions, or fallback value.
7. Add/update focused frontend tests for time-window button state, back-button role/click behavior, and the new label.
8. Run focused backend/frontend tests, static checks, and final diff/status review.

# Acceptance Criteria

- AC-01: A new activity attendance session can be opened only when the server time is inclusively between the selected schedule's `start_time` and `end_time`.
- AC-02: Attempts before the start, after the end, for cancelled/mismatched/invalid schedules, or through a direct API request are rejected without creating a session.
- AC-03: The activity-detail “Mở điểm danh” action is enabled only in the valid window and otherwise communicates why it is unavailable.
- AC-04: Exact start and exact end boundary cases behave consistently in frontend tests and backend enforcement.
- AC-05: In “Chọn hình thức điểm danh”, `Quay lại` is exposed as a keyboard-accessible styled button with a left-chevron icon and returns to the preceding attendance state.
- AC-06: The detail hero displays `Phụ trách: <name or fallback>` and no longer displays the `Cố vấn:` label there.
- AC-07: Existing active-session display, attendance methods, permissions, schedule data, and labels elsewhere remain unchanged.

# Verification

- Backend AC-01/02/04/07: `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/attendance-sessions/attendance-sessions.service.spec.ts` => focused schedule-window and existing attendance-session tests pass.
- Frontend AC-03/04/05/06/07: `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/activities/[activityId]/page.test.tsx" "src/components/attendance/AttendanceMethodSelector.test.tsx"` => focused activity-detail and selector regressions pass.
- Static: `D:\PROJECT\manager_points\backend :: npm run build` and `D:\PROJECT\manager_points\frontend :: npm run typecheck` => both exit successfully.
- Final: `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => whitespace-clean, scoped diff with no unintended paths.

# Safety Gates

- Gate: confirm and amend the scope before implementation if “khung giờ mới” means anything other than the inclusive schedule `start_time`–`end_time` interval, especially an early-open or late-open buffer.
- Stop before deployment, production mutation, dependency addition, API breaking change, or any write outside the approved boundary.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`.
- Implementation checkpoints: backend time-window regressions passing; frontend interaction/copy regressions passing; final scoped diff reviewed.
- Git remains the recovery mechanism; no data rollback artifact is required because this task creates no migration.

# Execution Budgets

- One writer per path; implement backend authority before frontend gating.
- Maximum retries: 2; engineering loops: 3; review remediation cycles: 2.
- Step deadline: 600 seconds, maximum 1800 seconds.
