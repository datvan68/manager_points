## Task Identity and Pipeline

- Task: `teacher-assigned-activity-view-and-info-timeline`
- Pipeline: `bug_fix`
- Profile/rules: Full / 3.2.0
- Repository: `D:\PROJECT\manager_points`, branch `main`, base `cd629116928cad54aacdd9c8c229366322ba96dd`
- Base state: `docs/taskscope.md` and unrelated `frontend/next-env.d.ts` are modified; preserve the latter.

## Risk Level

- Risk: high. The list change affects role-based read visibility; the UI change spans the activity detail presentation.
- Environment: development. Changes are source-only and reversible through Git; no persistent-data or external mutation.
- Blast radius: Activities API list results for teachers and the activity detail tabs/layout.

## Objective

For a `TEACHER` account, `/activities` exposes only activities assigned to that teacher through `advisor_id`; in an activity detail page, “Lịch trình & dòng thời gian” is the first section of “Thông tin chung” instead of a separate schedule tab.

## Scope Boundaries

- Approved: `backend/src/activities/**`, `frontend/src/components/activities/**`, `frontend/src/app/(dashboard)/activities/**`, `docs/taskscope.md`.
- Write: `backend/src/activities/activities.service.ts`, `backend/src/activities/activities.service.spec.ts`, `frontend/src/components/activities/ActivityDetailWorkspace.tsx`, `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`, `docs/taskscope.md`.
- Known targets: `ActivitiesService.findAll`; `ActivityDetailWorkspace` tab list and `info` panel.

## Out of Scope

- Activity creation/assignment, membership, attendance, schedule CRUD, database schema/data, API contracts, and unrelated dirty files.
- Admin list visibility and existing student visibility/membership behavior must not change.

## Context and Dependencies

- `ActivitiesService.findAll` currently applies `{ status: 'active' } OR { advisor_id: requester }` to every non-admin, allowing teachers to see unassigned active activities.
- Backend role utilities provide `isTeacher`; requester identity may be `userId`, `_id`, or `id` per existing service conventions.
- `ActivityDetailWorkspace` currently renders `ActivityScheduleTimeline` only under the separate `schedules` tab; timeline data is already loaded by the detail page.
- No new dependency is required.

## Steps

1. Code owner: add a teacher-specific `findAll` query constrained to the authenticated teacher’s `advisor_id`, retaining optional `activityType`; leave admin and student branches unchanged.
2. Code owner: add service regression cases for assigned/unassigned teacher visibility and preserved admin/student query behavior.
3. Code owner: relocate the existing timeline card to the top, full-width row of the `info` panel and remove the redundant schedule tab/panel without changing timeline capabilities.
4. Test owner: update detail-page coverage to prove timeline content appears immediately in “Thông tin chung”, precedes general information, and no separate schedule tab remains.
5. Review owner: independently review role boundaries, identity normalization, UI accessibility/state, tests, and final diff; repair only scoped failures.

## Acceptance Criteria

- AC-1: A teacher receives only activities whose `advisor_id` equals their authenticated user ID; with one assignment, exactly that one activity is shown.
- AC-2: Admin results remain unrestricted and student results retain the existing active-or-associated policy.
- AC-3: Activity-type filtering composes with the teacher advisor constraint.
- AC-4: “Lịch trình & dòng thời gian” is the first visible section in “Thông tin chung”; description/details follow it.
- AC-5: The separate “Lịch hoạt động” tab/panel is absent, while existing timeline rendering and permissions remain functional.
- AC-6: Focused tests pass and the final diff contains no unrelated changes.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- activities.service.spec.ts --runInBand` => AC-1 through AC-3 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/activities/[activityId]/page.test.tsx"` => AC-4 and AC-5 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/activities/ActivityScheduleTimeline.test.tsx` => timeline behavior remains intact.
- Repository root :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths; inspect the final diff for AC-6.

## Safety Gates

- Trigger: None for development implementation and tests.
- Artifact/approval/rollback/resume: None; stop if work requires schema/data mutation, broader authorization changes, deployment, or paths outside the approved boundary.

## Artifacts and Checkpoints

- Required artifacts: focused test output and final diff/status summary.
- Checkpoint: validate base/current commit and dirty-path preservation before mutation; no intermediate hash checkpoint required unless state changes externally.

## Execution Budgets

- Step deadline: 600 seconds; maximum 1,800 seconds when a focused test legitimately needs it.
- Concurrency: one writer per path; backend and frontend implementation may be independent only with disjoint ownership.
- Retries: at most 2 idempotent retries; engineering loop at most 3 iterations; review remediation at most 2 cycles.
