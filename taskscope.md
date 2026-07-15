# 1. Task ID + Pipeline

- Task ID: `ACTIVITY-DETAIL-20260715-003`
- Pipeline: `feature_development`

# 2. Risk Level

- Risk level: `low`
- Human Gate Request Schema classification: frontend display and read-only API consumption only; no production deployment, database mutation, permission change, secret handling, or destructive operation is included.

# 3. Objective

Correct the activity detail page so the **Lịch sinh hoạt** tab displays the room assigned to each schedule and the **Học kỳ:** field displays the semester whose status is `active`. This prevents the activity-level semester or classroom metadata from overriding the values that are authoritative for the current view.

# 4. Scope

Only the following files may be changed:

- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- `frontend/src/components/activities/ActivityScheduleTimeline.tsx`
- `frontend/src/components/activities/ActivityScheduleTimeline.test.tsx`

# 5. Out of Scope

- Do not change schedule creation, recurring schedule generation, attendance, registration, or completion-rule behavior.
- Do not change backend controllers, services, DTOs, schemas, database records, or migrations.
- Do not change the activity create/edit form or the activity list/card UI.
- Do not change the semester status lifecycle or automatically activate/deactivate semesters.
- Do not redesign the activity detail page, tab navigation, or schedule timeline layout.
- Do not replace `activity_id` with another identifier and do not reintroduce `club_id`.

# 6. Context & Dependencies

- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx` currently loads the activity, members, timeline schedules, completion rules, and criteria, but it does not load the semester list through `semesterApi.getSemesters()`.
- The **Học kỳ:** value currently reads `activity.semester_id.semester_name`. This produces `—` when `semester_id` is an ID or when the populated object uses a different shape, and it does not satisfy the requirement to display the currently active semester.
- `frontend/src/api/semester-api.ts` already exposes `semesterApi.getSemesters()` and the `Semester` type with `_id`, `semester_name`, and `status`; this API file does not require modification.
- `ActivitySchedule` exposes `location`, and `ActivityScheduleTimeline` already renders schedule rows. The canonical room for a specific session is `schedule.location`; `activity.classroom` is only the activity default and may be used as a fallback when the schedule location is empty.
- The activity detail test suite already mocks activity and schedule API calls. It must also mock `semesterApi.getSemesters()` so the active-semester selection is deterministic.

# 7. Steps

## PLAN

1. Inspect the `loadActivityData` Promise list and hero metadata section in `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx` to identify where semester data must be loaded and rendered.
2. Inspect the schedule item location block in `frontend/src/components/activities/ActivityScheduleTimeline.tsx` and define the display precedence as `schedule.location` first, then the activity default classroom passed from the detail page, then `Chưa có địa điểm`.
3. Inspect the mocks and fixtures in both scoped test files and identify the cases for an active semester, a non-active activity semester, a schedule-specific room, and a missing schedule room.

## EXECUTE

1. In `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`, import `semesterApi` and the `Semester` type from `@/api/semester-api`.
2. Add state for the resolved active semester and include `semesterApi.getSemesters()` in `loadActivityData`; select the single item whose `status === 'active'` and store it, or store `null` when no active semester exists.
3. Replace the hero **Học kỳ:** expression with the active semester's `semester_name`; render `—` when the semester endpoint returns no active semester.
4. Pass `activity.classroom` to `ActivityScheduleTimeline` through an explicitly named optional prop such as `defaultClassroom`.
5. In `frontend/src/components/activities/ActivityScheduleTimeline.tsx`, add the optional `defaultClassroom` prop to the component contract and render each schedule room using `schedule.location || defaultClassroom || 'Chưa có địa điểm'`.
6. In `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`, mock `semesterApi.getSemesters()` and add a regression case proving that the displayed **Học kỳ:** value comes from the semester with `status: 'active'`, even when `activity.semester_id` points to a different semester or is an unpopulated ID.
7. In `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`, add a regression case proving that the **Lịch sinh hoạt** tab displays each schedule's `location` instead of the activity's default `classroom`.
8. In `frontend/src/components/activities/ActivityScheduleTimeline.test.tsx`, add assertions for both location branches: a non-empty `schedule.location` takes precedence, and an empty location falls back to `defaultClassroom`.

## VERIFY

1. Run the two scoped Vitest files with the exact command in section 9.
2. Run the frontend TypeScript compiler check with the exact command in section 9 to validate the new prop and semester state types.
3. Confirm the tests cover the no-active-semester fallback and do not rely on the order of semesters returned by the API.

## REFINE

1. If a test fails because the semester API mock is missing, define the mock before importing the page module and reset it in the existing test setup.
2. If duplicate room text makes a page-level query ambiguous, scope the assertion to the active schedule tab or the schedule timeline container instead of weakening the expected value.
3. If TypeScript reports a prop mismatch, update only the `ActivityScheduleTimeline` props interface and its activity-detail call site; do not broaden the prop to `any`.
4. Re-run all commands in section 9 after each refinement, for at most the default three loop iterations.

# 8. Acceptance Criteria

- The activity detail page requests the semester list when loading its data.
- **Học kỳ:** displays `semester_name` from the semester whose `status` is exactly `active`.
- **Học kỳ:** displays `—` when no semester has `status: 'active'`.
- The displayed active semester is independent of `activity.semester_id` and independent of semester array order.
- Every schedule row in **Lịch sinh hoạt** displays its own non-empty `schedule.location`.
- A schedule with an empty or missing `location` displays `activity.classroom` as the fallback.
- A schedule with neither `location` nor an activity classroom displays `Chưa có địa điểm`.
- Existing schedule ordering, today highlighting, registration controls, and attendance controls remain unchanged.
- Both scoped Vitest files pass and the frontend TypeScript check completes without errors.

# 9. Verification Commands

Run from the repository root:

```powershell
cd frontend
npm test -- --run "src/app/(dashboard)/activities/[activityId]/page.test.tsx" "src/components/activities/ActivityScheduleTimeline.test.tsx"
npm run type-check
```

# 10. Safety Gates

- Human approval is required before any production deployment or production configuration change.
- Human approval is required if implementation would require a backend contract change, database migration, or data correction, because those actions are outside this task scope.
- Human approval is required before modifying files not listed in section 4.
- Stop and request clarification if more than one semester can legitimately have `status: 'active'`; this task assumes the existing semester lifecycle guarantees at most one active semester.
- Stop immediately if verification exposes secrets or requires writing to any `.env*` file; do not print or modify environment-file contents.

# 11. Artifacts to Review

- Git diff for the four files listed in section 4.
- Vitest output for `page.test.tsx` and `ActivityScheduleTimeline.test.tsx`.
- Output from `npm run type-check`.
- Screenshot of activity detail showing the active semester in the hero metadata and schedule-specific room values in the **Lịch sinh hoạt** tab, if a Human Gate is triggered for UI review.

# 12. Loop_iterations Override

- No override. Use the default `3` PLAN → EXECUTE → VERIFY → REFINE iterations defined by the project safety rules.


