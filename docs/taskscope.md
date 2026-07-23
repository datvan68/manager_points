## Task Identity and Pipeline

- Task: `activity-registration-optional-attendance`
- Pipeline: `feature_development`
- Profile/rules: Full / 3.2.0
- Repository: `D:\PROJECT\manager_points`, branch `main`, base `fb173b54c20b482d6d0c1355b6d2dd44a536a11c`
- Base state: only `docs/taskscope.md` is modified (the previous scope is absent); this task replaces it.

## Risk Level

- Risk: high. The feature changes the eligibility boundary for creating student attendance records and spans the activity API, attendance service, and student UI.
- Environment: development. Source changes are Git-reversible; no data migration or external mutation is planned.
- Blast radius: activity create/edit settings plus QR/proximity session discovery and check-in for students.

## Objective

Allow each activity to choose one of two attendance policies: require an active registration as today, or let any authenticated student with a resolvable student profile enter the activity and check in without registering.

## Scope Boundaries

- Approved: `backend/src/activities/**`, `backend/src/attendance-sessions/**`, `frontend/src/api/activity-api.ts`, `frontend/src/components/activities/**`, `frontend/src/app/(dashboard)/activities/**`, and `docs/taskscope.md`.
- Write: activity settings schema/DTO, `attendance-sessions.service.ts` and its spec, activity API type, `ActivityForm.tsx` plus a focused form test, activity detail page plus its test, and this scope.
- Known targets: `ActivitySettings`, `ActivitySettingsDto`, `AttendanceSessionsService.validateMembership`, activity form state/settings controls, and detail-page `canCheckInAttendance`/attendance launch logic.
- Excluded: paths outside the approved boundaries and unrelated dirty changes.

## Out of Scope

- Automatic membership creation, member counts/slots, registration approval rules, attendance session creation rules, QR expiry, GPS distance, duplicate/max check-ins, schedules, scoring formulas, migrations, deployment, and historical data rewrites.
- Anonymous users and users without a linked student profile remain ineligible.

## Context and Dependencies

- Current QR, proximity, active-session, and check-in-list paths all call `validateMembership`, which requires an `ActivityMember` with `status: active`.
- The detail page separately requires `memberStatus === 'active'` before exposing the student check-in action.
- Activity settings already travel through the Mongoose subdocument, create/update DTOs, frontend `Activity` type, and `ActivityForm`; no new dependency is needed.
- Add `require_registration_for_attendance` under activity settings with default `true`. Missing values must resolve to `true` so existing activities retain current behavior without a migration.

## Steps

1. Code owner: add and expose the boolean setting across backend schema/DTO and frontend type/form, presenting two mutually exclusive, clearly labelled attendance policies; preserve the default registration-required policy.
2. Code owner: centralize attendance eligibility so managers retain current access; students under the default policy still require active membership, while direct-attendance activities resolve the requester's student profile without creating membership.
3. Code owner: apply the same policy to active-session discovery, check-in list visibility, QR check-in, and proximity check-in; retain all existing session, schedule, duplicate, capacity, location, and sync checks.
4. Code owner: let eligible non-member students see and launch the existing activity timeline check-in action when direct attendance is enabled; keep staff tabs and member-management visibility unchanged.
5. Test owner: add backend regressions for both policies and both check-in methods, plus frontend coverage for form payload/defaults and member/non-member check-in presentation.
6. Review owner: independently review identity resolution, authorization boundaries, backward compatibility, API/UI consistency, tests, and final diff; repair only scoped failures.

## Acceptance Criteria

- AC-1: New activities default to `require_registration_for_attendance: true`; activities missing the field behave identically to the current registration-required flow.
- AC-2: With the setting `true`, pending/rejected/inactive/left/missing memberships cannot discover or submit attendance; active members can.
- AC-3: With the setting `false`, an authenticated student linked to a Student record can discover the active session and check in by QR or proximity without an activity membership.
- AC-4: Direct attendance does not create membership or occupy a member slot, and all existing schedule/session, QR, GPS, duplicate, maximum, and attendance-sync rules still apply.
- AC-5: The activity form visibly offers exactly the two policies and sends the selected value for create/update.
- AC-6: A non-member student sees the check-in action only for a direct-attendance activity; registration-required UI behavior and staff/member permissions remain unchanged.
- AC-7: Focused tests pass and the final diff contains no unintended paths.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- attendance-sessions.service.spec.ts --runInBand` => AC-1 through AC-4 pass for active-session, QR, and proximity paths.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/activities/ActivityForm.test.tsx` => AC-1 and AC-5 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/activities/[activityId]/page.test.tsx"` => AC-6 passes and existing detail behavior remains covered.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/activities/ActivityScheduleTimeline.test.tsx` => the existing timeline action remains functional.
- Repository root :: `git diff --check` and `git status --short`, followed by final diff inspection => AC-7.

## Safety Gates

- Trigger: None for development source changes and focused tests.
- Artifact/approval/rollback/resume: None. Stop before any migration, persistent-data rewrite, deployment, broader attendance authorization, or write outside the approved boundary.

## Artifacts and Checkpoints

- Required artifacts: focused test results and final diff/status summary.
- Checkpoint: revalidate base/current commit and dirty-path preservation before implementation; validate scoped files at backend/frontend synchronization. No intermediate commit is required.

## Execution Budgets

- Step deadline: 600 seconds; maximum 1,800 seconds for a legitimate focused test run.
- Concurrency: one writer per path; serialize shared activity-contract changes before attendance/UI consumers.
- Retries: at most 2 idempotent retries; engineering loop at most 3 iterations; review remediation at most 2 cycles.
