# 1. Task ID + Pipeline

- Task ID: `ACTIVITIES-TODAY-TIMELINE-READONLY-012`
- Pipeline: `feature_development`

# 2. Risk Level

- Risk level: `medium`
- Rationale: This task changes the activity-detail schedule presentation and removes create/delete controls from one UI surface. It does not delete stored schedules, change backend authorization, alter database schemas, or deploy to an environment.

# 3. Objective

Restore today''s activity schedules in the activity-detail timeline so they are immediately visible and recognizable. Make this timeline read-only for schedule management by removing its create and delete capabilities while preserving registration, attendance, role-specific attendance details, and the display of schedules from every scheduled week.

# 4. Scope

- `frontend/src/components/activities/ActivityScheduleTimeline.tsx`
  - Derive the rendered collection from the complete `schedules` prop without filtering out past, current-day, or future items.
  - Sort every item with `is_today === true` before non-today items; sort within each group by valid `start_time` ascending and then by `_id` ascending as the deterministic tie-breaker.
  - Restore the `Hôm nay` badge and the existing blue highlighted card treatment for every item whose `is_today` value is `true`.
  - Remove `onCreateSchedule` and `onDeleteSchedule` from `ActivityScheduleTimelineProps` and from component destructuring.
  - Remove the `Tạo lịch mới` button, create-form state, create-form fields, submit handler, create success/error messages, and imports used only by schedule creation.
  - Remove the schedule trash button, deletion handler, deletion confirmation, deletion success/error messages, and imports used only by schedule deletion.
  - Preserve student registration/cancellation actions, today''s attendance action, role-specific attendance output, past-schedule fading, the empty state, and all non-management schedule metadata.
- `frontend/src/components/activities/ActivityScheduleTimeline.test.tsx`
  - Add or revise assertions that today''s schedules render, appear before all non-today schedules, display `Hôm nay`, and retain the blue highlighted card classes.
  - Add assertions that admin/advisor rendering contains neither `Tạo lịch mới` nor a schedule deletion button.
  - Keep regression coverage for all-week rendering, deterministic ordering, attendance status/count/details, attendance actions, past-schedule fading, and the empty state.
- `frontend/src/components/activities/ActivityDetailWorkspace.tsx`
  - Remove `onCreateSchedule` and `onDeleteSchedule` from `ActivityDetailWorkspaceProps`, component destructuring, and the `ActivityScheduleTimeline` invocation so the legacy workspace compiles with the reduced timeline contract.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
  - Pass the `onOpenAttendance` callback (using `handleTabChange('attendance')`) to `ActivityScheduleTimeline` inside the schedule tab.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
  - Verify that the timeline response containing a schedule with `is_today: true` renders that schedule in the activity-detail schedule tab.
  - Verify that the primary activity-detail schedule tab exposes no create-schedule or delete-schedule control to an admin/advisor account.
- `taskscope.md`
  - Replace the previous implementation scope with this exact twelve-section execution contract.

# 5. Out of Scope

- Do not change `frontend/src/app/(dashboard)/activities/schedule/page.tsx` or `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`; the dedicated schedule-management page keeps its authorized creation and management workflow.
- Do not change activity schedule API methods, backend routes, controllers, services, database models, migrations, or stored schedule records.
- Do not call a delete API, remove an API endpoint, or delete any existing schedule data.
- Do not add a second API request dedicated to today''s schedules; use the items returned by `activityScheduleApi.getActivityTimeline(activityId)`.
- Do not filter the timeline to the current week. Schedules from every week returned for the activity must remain visible.
- Do not change member registration/cancellation behavior, attendance recording, attendance permissions, completion rules, activity membership, or navigation outside the schedule tab.
- Do not modify the legacy club timeline under `frontend/src/app/(dashboard)/club/clubs/[clubId]/`.

# 6. Context & Dependencies

- The primary page loads schedule data through `activityScheduleApi.getActivityTimeline(activityId)` in `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx` and passes the returned `items` array to `ActivityScheduleTimeline` without a separate today request.
- The timeline response already identifies current-day entries with `is_today`; UI ordering and highlighting must consume that field directly.
- Multiple schedules may have `is_today: true`; all of them must render at the beginning of the timeline in chronological order.
- Previous decisions remain active: show schedules from all scheduled weeks, omit week-range headings, show today first, show role-appropriate attendance information, and fade schedules whose valid `end_time` is strictly earlier than the browser time.
- `ActivityDetailWorkspace.tsx` still forwards create/delete callbacks to the shared timeline even though the primary detail page does not; its local interface and invocation must be reduced together with the timeline props.
- Removing create/delete from this timeline is a presentation boundary only. The dedicated `/activities/schedule` workflow and existing API/backend capabilities remain available and unchanged.
- Preserve unrelated uncommitted work in the current working tree; do not overwrite or revert user changes outside the exact scope in Section 4.

# 7. Steps — PLAN → EXECUTE → VERIFY → REFINE

## PLAN

1. Inspect `ActivityScheduleTimeline.tsx`, its test file, `ActivityDetailWorkspace.tsx`, and the activity-detail page test to identify every create/delete prop, state variable, handler, import, rendered control, and assertion.
2. Record the existing timeline behaviors for today ordering/highlighting, past fading, attendance, registration, empty state, and all-week rendering before editing so retained behavior has explicit regression coverage.

## EXECUTE

3. In `ActivityScheduleTimeline.tsx`, create a non-mutating ordered array from `schedules` by copying it before sorting; compare `is_today` first, valid `start_time` timestamps second, and `_id` strings third.
4. Render the ordered array instead of the raw `schedules` array, add the literal `Hôm nay` badge for `is_today === true`, and apply the blue today border/background classes before evaluating past-card classes so today highlighting wins for inconsistent fixture data.
5. Delete the timeline''s create-schedule props, `showCreateForm`, `submitting`, `newSchedule`, `handleCreateSubmit`, header action, form markup, create-only icons/imports, and create toast branches.
6. Delete the timeline''s delete-schedule prop, `handleDeleteClick`, trash button, delete-only icon/import, confirmation text, and delete toast branches.
7. In `ActivityDetailWorkspace.tsx`, delete the two schedule-management callback fields from its props interface, destructuring, and timeline invocation; leave unrelated workspace callbacks unchanged.
8. In `ActivityScheduleTimeline.test.tsx`, use fixtures containing multiple today schedules plus past and future schedules; assert complete rendering, today-first ordering, chronological/tie-break ordering, today badges/highlights, absence of create/delete controls, and preservation of existing non-management behavior.
9. In `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`, extend the activity-detail schedule-tab scenario to assert a timeline API item marked `is_today: true` is visible and no create/delete control is rendered for staff viewers.

## VERIFY

10. Run the focused Vitest files in Section 9 and require every assertion to pass.
11. Run the frontend TypeScript check in Section 9 and require zero type errors caused by removed props or imports.
12. Run the diff checks in Section 9; confirm that only Section 4 files changed for this task and that no create/delete schedule control remains in `ActivityScheduleTimeline.tsx`.

## REFINE

13. If a focused test fails, change only the scoped implementation or fixture responsible for that failure, then rerun the failed command and the complete focused test command.
14. If the type check finds another caller of removed timeline props, remove only those obsolete prop arguments and their now-unused local declarations; add the caller file to Section 4 before implementation proceeds if it is not already listed.
15. Stop after three PLAN → EXECUTE → VERIFY iterations and request direction with the failing command and relevant diff if the acceptance criteria still cannot be met.

# 8. Acceptance Criteria

- Every schedule returned in the timeline `items` array renders exactly once, including every entry with `is_today: true` and schedules belonging to past or future weeks.
- All today schedules appear before all non-today schedules; today schedules are ordered by `start_time` ascending and `_id` ascending for equal start times.
- Every today schedule displays the literal Vietnamese badge `Hôm nay` and the blue highlighted card treatment.
- No week-range heading such as `Tuần 06/07/2026 - 12/07/2026` is rendered.
- Admin and advisor viewers do not see `Tạo lịch mới`, the inline creation form, or a schedule deletion button in the activity-detail timeline.
- `ActivityScheduleTimeline` exposes neither `onCreateSchedule` nor `onDeleteSchedule` in its TypeScript props.
- `ActivityDetailWorkspace` no longer requires or forwards timeline create/delete callbacks.
- No frontend action in this timeline calls a schedule create or delete API.
- Student registration/cancellation, today''s attendance action, private member attendance status, staff attendance count/details, and past-schedule fading continue to work.
- The dedicated `/activities/schedule` management page and backend/API schedule-management capabilities are unchanged.
- Focused tests and the frontend TypeScript check pass.

# 9. Verification Commands

Run from `D:\PROJECT\manager_points\frontend`:

```powershell
npm test -- --runInBand src/components/activities/ActivityScheduleTimeline.test.tsx ''src/app/(dashboard)/activities/[activityId]/page.test.tsx''
npm run typecheck
```

Run from `D:\PROJECT\manager_points`:

```powershell
rg -n "onCreateSchedule|onDeleteSchedule|Tạo lịch mới|handleCreateSubmit|handleDeleteClick|Trash2" frontend/src/components/activities/ActivityScheduleTimeline.tsx frontend/src/components/activities/ActivityDetailWorkspace.tsx
git diff --check -- taskscope.md frontend/src/components/activities/ActivityScheduleTimeline.tsx frontend/src/components/activities/ActivityScheduleTimeline.test.tsx frontend/src/components/activities/ActivityDetailWorkspace.tsx ''frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx''
git diff -- taskscope.md frontend/src/components/activities/ActivityScheduleTimeline.tsx frontend/src/components/activities/ActivityScheduleTimeline.test.tsx frontend/src/components/activities/ActivityDetailWorkspace.tsx ''frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx''
git status --short
```

Expected result for the `rg` command: no output and exit code `1`, because none of the removed create/delete identifiers or labels may remain in the two scoped timeline consumers.

# 10. Safety Gates

- No Human Gate is required for the documented local frontend changes while risk remains `medium` and no production operation is performed.
- Trigger a Human Gate before any production deployment, production configuration change, database mutation, deletion of stored schedule data, removal of a backend/API endpoint, or expansion beyond the exact files in Section 4.
- Trigger a Human Gate if implementation requires changing authorization rules or removing schedule management from the dedicated `/activities/schedule` page.
- Stop and request clarification if the timeline API does not return today''s schedule items; do not invent records, merge another endpoint, or change backend filtering without approval and a revised scope.
- Preserve `.env*` files and never print, modify, or transmit credentials or secrets.

# 11. Artifacts to Review

- Final diff for every file listed in Section 4.
- Focused Vitest output showing the timeline and activity-detail page tests passed.
- Frontend TypeScript check output.
- `rg` output proving removed timeline create/delete identifiers and labels are absent.
- `git diff --check` output and `git status --short` output.
- If a Human Gate is triggered, attach the proposed expanded file list, exact commands, affected environment, reason the expansion is necessary, and any relevant failing test or API-response evidence.

# 12. loop_iterations Override

- No override. Use the default `loop_iterations: 3` defined by `global.md` and `safety.md`.