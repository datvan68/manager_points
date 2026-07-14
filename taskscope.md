# 1. Task ID + Pipeline

- Task ID: `ACTIVITIES-ROLE-ATTENDANCE-PAST-SCHEDULE-011`
- Pipeline: `feature_development`

# 2. Risk Level

- Risk level: `medium`
- Rationale: The task changes role-based attendance visibility and removes a destructive schedule action from the activity UI. It does not modify infrastructure, database schemas, stored attendance records, or backend authorization.

# 3. Objective

Make the activity schedule timeline show attendance information appropriate to each account type, remove activity-schedule deletion from this timeline, and visually de-emphasize schedules whose end time has passed. Advisors and administrators can inspect attendance membership details while activity members retain a private per-account status.

# 4. Scope

- `frontend/src/components/activities/ActivityScheduleTimeline.tsx`
  - Replace the staff summary with an expandable control displaying the `attendance_records` count and member details.
  - Render each detail row with `student_id.full_name`, `student_id.student_code`, and mapped attendance status.
  - Preserve private `my_attendance` status for member accounts.
  - Remove the delete callback prop, handler, confirmation, toast messages, icon import, and delete button.
  - Apply reduced opacity and muted colors when `new Date(schedule.end_time).getTime() < Date.now()`; today's highlight remains authoritative.
- `frontend/src/components/activities/ActivityScheduleTimeline.test.tsx`
  - Test member-only personal status, advisor count/details, administrator count/details with per-member statuses, deletion-control absence, and past-card styling.
- `frontend/src/components/activities/ActivityDetailWorkspace.tsx`
  - Remove `onDeleteSchedule` from its props, destructuring, and timeline invocation.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
  - Pass separate administrator, advisor, and member-view capabilities to the timeline.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
  - Verify correct attendance capabilities for administrator, advisor, and active-member accounts.
- `taskscope.md`
  - Record this implementation and verification contract.

# 5. Out of Scope

- Do not change backend timeline services, controllers, DTOs, schemas, or database queries; staff responses already contain the required records.
- Do not add an administrator's own `my_attendance`; administrator visibility means the total and detailed member list with every listed member's status.
- Do not remove schedule-deletion endpoints or API methods; remove deletion only from this UI and its local component contract.
- Do not change creation, registration, registration cancellation, QR/proximity attendance, or attendance-session workflows.
- Do not change `frontend/src/app/(dashboard)/club/clubs/[clubId]/ClubScheduleTimeline.tsx`.
- Do not modify attendance records, memberships, completion rules, recurrence generation, time-zone configuration, or database data.

# 6. Context & Dependencies

- `activityScheduleApi.getActivityTimeline(activityId)` supplies `my_attendance` for student mode and `attendance_records` for staff mode.
- `StaffActivityAttendanceRecord` in `frontend/src/api/activity-api.ts` already includes member name, student code, attendance status, check-in fields, approval status, and note.
- Status labels remain: `present` -> `Có mặt`, `late` -> `Đi trễ`, `absent` -> `Vắng`, `excused` -> `Nghỉ phép`, and missing -> `Chưa điểm danh`.
- Confirmed interpretation: administrators see the attendance total and detailed member list, including each member's status; they do not receive a personal attendance status.
- Advisor and administrator identity continues to derive from `isTeacherRole(user)` and `isAdminUser(user)`.
- A schedule is past only when its valid `end_time` is strictly earlier than the current browser timestamp; invalid timestamps are not past.
- Preserve existing user changes in scoped files and build on the current working tree.

# 7. Steps — PLAN → EXECUTE → VERIFY → REFINE

## PLAN

1. Inspect the timeline, its tests, `ActivityDetailWorkspace.tsx`, and the detail page to enumerate role props, attendance blocks, and the deletion callback chain.
2. Define capabilities so active members receive only `my_attendance`, advisors receive count plus expandable records, and administrators receive count plus expandable member records and statuses.
3. Define past state as a valid `end_time` strictly less than `Date.now()`.

## EXECUTE

4. In `ActivityScheduleTimeline.tsx`, introduce a shared status-label renderer for the member status and expanded staff records.
5. Add per-schedule expansion state keyed by `_id`; render a Vietnamese count/detail toggle and show name, student code, and status after expansion.
6. Calculate `isPast` from `end_time`; add reduced opacity and muted border/background/text classes to past non-today cards without changing ordering or hiding non-delete actions.
7. Remove `onDeleteSchedule`, `handleDeleteClick`, the `Trash2` import, deletion messages, and trash button.
8. In `ActivityDetailWorkspace.tsx`, remove the obsolete deletion prop and timeline argument.
9. In the activity detail page, derive and pass separate administrator, advisor, and member capabilities while preserving tab access and attendance-button authorization.
10. Extend scoped tests with deterministic role, expansion, deletion-absence, and past-card cases; use fake time and restore real timers.

## VERIFY

11. Run the focused tests in Section 9.
12. Run frontend type checking and the complete frontend test suite.
13. Inspect the scoped diff and confirm no backend, API contract, database, legacy club timeline, or unrelated file changed.

## REFINE

14. If focused tests fail, change only the responsible scoped component, page, or test and rerun focused tests.
15. If type checking finds stale props, remove each stale scoped caller or align scoped prop types without restoring deletion.
16. Stop after three iterations and report exact remaining failures; do not broaden scope.

# 8. Acceptance Criteria

- Active members see only their own `Trạng thái điểm danh` and not the staff member list.
- Advisors see the exact record count for every schedule and can expand it to view each member's full name, student code, and mapped status.
- Administrators see the exact record count and can expand it to view the member list with each member's mapped status.
- Empty records render count `0` and an explicit empty-detail message.
- No schedule card displays deletion controls, and the timeline exposes no deletion callback.
- No delete confirmation or delete request can originate from the timeline or detail workspace.
- A schedule with valid `end_time` earlier than now has reduced opacity and muted styling.
- Current and future schedules are not styled as past.
- An `is_today` schedule keeps today's highlight even if inconsistent fixture data has a past end time.
- Today's-first ordering, chronological partition ordering, registration controls, and attendance-tab button remain unchanged.
- Focused tests, type checking, and the complete frontend test suite pass.

# 9. Verification Commands

Run from `D:\PROJECT\manager_points\frontend`:

```powershell
npm test -- --runInBand src/components/activities/ActivityScheduleTimeline.test.tsx 'src/app/(dashboard)/activities/[activityId]/page.test.tsx'
npm run typecheck
npm test -- --runInBand
```

Run from `D:\PROJECT\manager_points`:

```powershell
git diff --check -- taskscope.md frontend/src/components/activities/ActivityScheduleTimeline.tsx frontend/src/components/activities/ActivityScheduleTimeline.test.tsx frontend/src/components/activities/ActivityDetailWorkspace.tsx 'frontend/src/app/(dashboard)/activities/[activityId]/page.tsx' 'frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx'
git status --short
git diff -- taskscope.md frontend/src/components/activities/ActivityScheduleTimeline.tsx frontend/src/components/activities/ActivityScheduleTimeline.test.tsx frontend/src/components/activities/ActivityDetailWorkspace.tsx 'frontend/src/app/(dashboard)/activities/[activityId]/page.tsx' 'frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx'
```

# 10. Safety Gates

- These local frontend changes are `medium` risk and need no Human Gate before implementation.
- Trigger a Human Gate before production deployment/configuration, database mutation, schema migration, bulk deletion, backend authorization changes, or expansion beyond Section 4.
- Trigger a Human Gate if implementation would expose emails, credentials, or attendance data outside users already authorized by the staff timeline endpoint.
- Trigger a Human Gate if removing the backend deletion endpoint becomes necessary.
- Stop immediately on a safety violation; do not use REFINE to bypass a gate.

# 11. Artifacts to Review

- Final scoped diff for every file in Section 4.
- Focused timeline and activity-page test output.
- Frontend type-check output.
- Complete frontend test output.
- For a Human Gate, attach the proposed out-of-scope diff, affected data flow, rollback procedure, and exact failing verification output.

# 12. loop_iterations Override

- No override. Use the default `3` iterations defined by `global.md` and `safety.md`.
