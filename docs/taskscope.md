## Task Identity and Pipeline

Task: `activity-create-schedule-highlight`

Profile: Full

Pipeline: `bug_fix`

Repository: `D:\PROJECT\manager_points`

Base branch/commit: `main` / `6a419a9e261ec0e45bcf1d3813b3fb8bcecce5e4`

## Risk Level

Risk: medium. Development-only frontend behavior, reversible through Git, with no persistent-data, API, deployment, or external-system change. Full profile is used because the navigation and scheduler regressions require four owned source/test files.

## Objective

After an activity is created, open the schedule workspace without the “Lên lịch sinh hoạt mới” dialog and visually guide the user to the newly created activity until it is placed on the schedule.

## Scope Boundaries

Approved boundary: `frontend/src/app/(dashboard)/activities/**`, `frontend/src/components/activities/**`.

Write:

- `frontend/src/app/(dashboard)/activities/page.tsx`
- `frontend/src/app/(dashboard)/activities/page.test.tsx`
- `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`
- `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx`

Targets: create-success route, `initialActivityId`, `sourceActivities.isScheduled`, source activity-card classes, and focused navigation/drag-drop regressions.

## Out of Scope

Backend/API contracts, activity creation payloads, schedule persistence rules, other schedule-entry dialogs, unrelated activity-card designs, and deployment.

## Context and Dependencies

Create success currently routes with `activityId` and `openCreate=1`; the latter auto-opens the schedule form. The workspace already receives the created activity ID and computes `isScheduled` from saved plus pending schedules for the displayed week. That existing state is the stop condition for the highlight.

## Steps

1. Update create-success navigation to retain `activityId` but omit the auto-create flag.
2. Mark only the matching, unscheduled source card with a blinking yellow border/ring.
3. Remove the highlight as soon as drag/drop creates a pending schedule placement; keep normal scheduled-card behavior unchanged.
4. Update focused tests for navigation, initial highlight, and highlight removal.
5. Perform independent diff review and affected verification.

## Acceptance Criteria

- AC-1: Successful activity creation navigates to `/activities/schedule?activityId=<created-id>` and does not open “Lên lịch sinh hoạt mới”.
- AC-2: The matching new activity under “Kéo hoạt động xếp lịch” has a visible blinking yellow border while unscheduled.
- AC-3: The highlight is absent once that activity is placed into the schedule, including the immediate pending state.
- AC-4: Other activity cards and existing scheduling flows are unchanged.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/activities/page.test.tsx" "src/components/activities/ActivityScheduleWorkspace.test.tsx"` => AC-1 through AC-4 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no affected TypeScript errors.
- `D:\PROJECT\manager_points` :: `git diff --check` => clean diff.

## Safety Gates

None.

## Artifacts and Checkpoints

Task scope and final Git diff only; no checkpoint or artifact hash is required before implementation.

## Execution Budgets

One implementation worker and one independent read-only review step; one writer per path; up to three implementation/verification iterations and two review-remediation cycles.
