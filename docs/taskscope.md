# Task Identity and Pipeline

Task: `delegated-concurrent-activity-attendance`

Profile: Full

Pipeline: `feature_development`

Rule manifest: `3.2.0`

Repository: `D:\PROJECT\manager_points`

Base state: branch `main`, commit `db7ac45f1228e641ff314c3fd33756717d0cb34d`, clean worktree at planning preflight.

# Risk Level

Risk: high.

This change crosses frontend and backend modules, introduces activity-scoped authorization and additive persistent schemas, permits concurrent writes by multiple teachers, affects realtime attendance state, and feeds approved attendance into training-point synchronization. Development changes are Git-reversible. Production deployment, database backfill, or index application is excluded without a Human Gate.

# Objective

Allow an Admin or the activity’s single assigned advisor to grant selected homeroom teachers one or more attendance methods (`qr`, `proximity`, `manual_class`) for that activity. Authorized teachers can open permitted sessions, manually mark their own class through a realtime student-card grid, and work concurrently without blocking other classes. Admins receive the current attendance roster immediately in “Schedule & timeline”, including each student’s class, without full-page reloads or white flashes.

# Scope Boundaries

Approved boundaries:

- `backend/src/activities/**`
- `backend/src/attendance-sessions/**`
- `backend/src/activity-attendance/**`
- `backend/src/activity-schedules/**`
- `backend/src/system/attendance-event-emitter.ts`
- `frontend/src/api/activity-api.ts`
- `frontend/src/api/activity-api.test.ts`
- `frontend/src/hooks/useAttendanceSession.ts`
- `frontend/src/hooks/useAttendanceSession.test.ts` (new)
- `frontend/src/components/attendance/**`
- `frontend/src/components/activities/ActivityScheduleTimeline.tsx`
- `frontend/src/components/activities/ActivityScheduleTimeline.test.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`

Known backend write targets:

- `activities.controller.ts`, `activities.service.ts`, `activities.module.ts`, and their existing specs.
- New activity attendance-grant schema/DTO owned by `backend/src/activities/**`.
- `attendance-sessions.controller.ts`, `attendance-sessions.service.ts`, `attendance-sessions.module.ts`, `dto/open-session.dto.ts`, session/check-in schemas, new manual-attendance DTOs, and existing specs.
- `activity-attendance/schemas/activity-attendance.schema.ts`, `activity-attendance-sync.service.ts`, and a focused sync spec if none exists.
- `activity-schedules.service.ts` and `activity-schedules.service.spec.ts`.

Known frontend write targets:

- Attendance API contracts, session hook, method selector, activity detail attendance workspace, and timeline.
- New focused grant-manager and manual-class grid components/tests under `frontend/src/components/attendance/**`.

# Out of Scope

- Adding another `activity.advisor_id` or changing the single-advisor rule.
- Granting delegated teachers activity editing, member administration, schedule editing, grant administration, or access to another teacher’s class.
- Changing student QR/GPS self-check-in behavior, activity registration rules, completion rules, or unrelated activity pages.
- Replacing the existing SSE transport or adding Redis/Bull/external infrastructure.
- Production migration, backfill, deployment, or historical class reconstruction where no reliable class can be resolved.

# Context and Dependencies

- `Activity.advisor_id` currently identifies one assigned teacher. Admin and that teacher must be the only grant administrators; an activity president must not manage grants.
- `ClassesService` and `StudentsService` already scope ordinary teacher reads by `Class.advisor_id`. A dedicated grant-candidate endpoint is still required because an assigned activity advisor cannot use the ordinary teacher-scoped class list to discover other homeroom teachers.
- `AttendanceMethodSelector` currently supports only `qr` and `proximity`.
- The attendance-session schema contains an unused `manual` value, while the open-session DTO and attendance-checkin schema reject it. Normalize the new method to `manual_class` across schema, DTO, API, events, and UI.
- Active sessions are currently exclusive per activity context. Manual sessions must instead be isolated by activity schedule and class, while QR/Proximity remain one shared active self-check-in session per activity schedule.
- `ActivityAttendance` already has a unique `(schedule_id, student_id)` index. Manual writes must use an atomic idempotent upsert against this invariant, not a read-then-create race or the current sequential batch loop.
- Existing SSE sends attendance session/check-in events. Extend the existing event contract and client merge path; do not reload the activity page after a click.
- Approved attendance currently invokes training-point synchronization. The click response and realtime event must not wait for heavy synchronization; reuse the existing idempotent sync state/service and provide retryable catch-up for unsynced approved records.
- The staff timeline already fetches attendance with the initial timeline call, but records contain only student name/code and the UI remains collapsed. Persist an optional attendance `class_id` snapshot, return class ID/name in the staff response, and fall back to the student’s current class for legacy records.
- The activity page currently treats only Admin, assigned advisor, and active president as attendance managers. Delegated capabilities must come from a server-authoritative endpoint, not a role-only frontend condition.
- Existing dependencies (`Mongoose`, Nest scheduling, SSE, React, and `@tanstack/react-virtual`) are sufficient; no new package is approved.

# Steps

1. Backend grant ownership: add an auditable, unique activity/teacher grant model with `allowed_methods`, active/revoked state, grant/revoke actor and timestamps. Add candidate/list/upsert/revoke endpoints. Enforce Admin-or-assigned-advisor administration and return only homeroom teachers as candidates.
2. Backend capabilities: add a server-authoritative activity attendance-capabilities response containing effective methods, grant status, grant-administration permission, and the current teacher’s homeroom classes. The assigned advisor and Admin retain current methods; delegated teachers receive exactly the active grant methods.
3. Session contract: add `manual_class` plus required `class_id`; validate the activity, today’s non-cancelled schedule, active grant, permitted method, class ownership, and revocation state on every open/read/write/close action.
4. Concurrency: allow one active manual session per `(activity, schedule, class)` and multiple distinct classes concurrently. Keep one global QR/Proximity session per `(activity, schedule)`. Add database-supported uniqueness or an equivalent atomic invariant and deterministic conflict responses.
5. Optimized roster: add one authorized manual-roster endpoint returning the selected class, all class students with status metadata, and their attendance state for the schedule in bounded queries. Do not issue one query per student. Use pagination/virtualization metadata if the complete roster exceeds the UI render window.
6. Atomic manual marking: add a manual check-in endpoint that atomically records `present`, auto-approves it, stores `attendance_method=manual_class` and the class snapshot, tolerates duplicate retries, updates counts, emits realtime only after persistence, and returns the canonical record.
7. Synchronization: remove training-point synchronization from the manual click critical path. Queue or schedule idempotent processing using existing sync markers/service, retry unsynced approved records, and prove a retry cannot award points twice.
8. Realtime: extend the existing activity attendance SSE payload with activity, schedule, session, class, student, canonical attendance, and count identifiers. Merge by `(schedule_id, student_id)` in every teacher/admin client; reconnect/refetch must reconcile rather than duplicate.
9. Timeline: fetch the Admin-visible roster with the initial activity timeline load, include class snapshot/name and attendance method, and render the current/selected schedule’s “Attendance list” immediately. Historical lists may stay collapsed/virtualized but must use already cached or paginated data without an N+1 request pattern.
10. Grant UI: add an Admin/assigned-advisor panel to select a homeroom teacher and one or more methods, inspect current grants, update methods, and revoke access. Do not expose this panel to delegated teachers or presidents.
11. Delegated UI: show only methods returned by capabilities. For `manual_class`, select among the teacher’s own classes and render every roster member as a stable card with avatar, name, student code, student status, and attendance state.
12. Interaction quality: apply an optimistic checked state only to the clicked card, keep previous data during background reconciliation, disable duplicate clicks per student, use first-load skeletons instead of replacing populated content, and surface per-card failures without clearing the grid.
13. Regression and load coverage: add authorization, revocation, concurrent-session, atomic duplicate, realtime merge, class snapshot, timeline eager-load, optimistic UI, background refetch, and legacy QR/GPS tests.
14. Independent review: review authorization boundaries, IDOR resistance, concurrent index/upsert behavior, sync idempotency, personal-data exposure, query counts, final diff, and schema compatibility before broad verification.

# Acceptance Criteria

- `AUTH-1`: An activity still has exactly one `advisor_id`.
- `AUTH-2`: Only Admin or that assigned advisor can list candidates and create, change, or revoke attendance grants.
- `AUTH-3`: A delegated teacher sees and can open exactly the granted methods; an ungranted or revoked method is rejected by the backend even if called directly.
- `AUTH-4`: `manual_class` access is limited to classes whose current `advisor_id` is the requesting teacher, and only students belonging to that class can be marked.
- `AUTH-5`: Presidents retain existing attendance behavior but cannot administer grants or use delegated class access.
- `SESSION-1`: Two teachers can hold active manual sessions for different classes on the same activity schedule concurrently.
- `SESSION-2`: A duplicate manual session for the same activity/schedule/class and conflicting global QR/GPS sessions return deterministic conflicts without duplicate active sessions.
- `ATT-1`: One card click creates or idempotently returns one auto-approved `present` attendance record and stores method plus class snapshot.
- `ATT-2`: Simultaneous/retried clicks for the same schedule/student never create duplicate attendance or duplicate training points.
- `ATT-3`: The manual response and realtime event are not blocked by training-point synchronization; failed sync remains retryable and idempotent.
- `RT-1`: The initiating teacher, other authorized teachers, Admin timeline, session count, and roster converge in realtime without full-page reload.
- `UI-1`: The manual grid exposes the complete selected-class roster, with stable cards and student status, while only the affected card enters loading/error/success state.
- `UI-2`: Background refresh keeps existing content visible; no populated activity, timeline, or roster area flashes white.
- `TL-1`: On initial Admin render, the current/selected schedule’s “Attendance list” is populated and visible without a user-triggered fetch.
- `TL-2`: Every Admin attendance row shows student name, student code, class name, attendance status/method, and check-in time.
- `TL-3`: Historical attendance retains its stored class after a later student transfer; legacy records use the current-class fallback without failing.
- `PERF-1`: Roster/timeline loading uses bounded aggregate/populate queries with no per-student request/query loop.
- `REG-1`: Existing QR, GPS, student membership checks, advisor access, and legacy timeline responses remain compatible.

# Verification

Backend focused tests:

```text
D:\PROJECT\manager_points\backend :: npm test -- --runInBand activities/activities.service.spec.ts activities/activities.controller.spec.ts attendance-sessions/attendance-sessions.service.spec.ts attendance-sessions/attendance-sessions.controller.spec.ts attendance-sessions/attendance-realtime.service.spec.ts activity-schedules/activity-schedules.service.spec.ts activity-attendance/activity-attendance-sync.service.spec.ts
```

Expected: grant authorization/revocation, manual method validation, concurrent class sessions, global-session conflicts, idempotent manual upserts, class snapshots, eager staff timeline data, realtime payloads, and sync retries pass.

Backend affected package:

```text
D:\PROJECT\manager_points\backend :: npm run build
```

Expected: Nest/TypeScript build succeeds with schemas, DTOs, modules, controllers, and services wired.

Frontend focused tests:

```text
D:\PROJECT\manager_points\frontend :: npm test -- src/api/activity-api.test.ts src/hooks/useAttendanceSession.test.ts src/components/attendance/AttendanceMethodSelector.test.tsx src/components/attendance/ActivityAttendanceGrantManager.test.tsx src/components/attendance/ManualClassAttendancePanel.test.tsx src/components/activities/ActivityScheduleTimeline.test.tsx "src/app/(dashboard)/activities/[activityId]/page.test.tsx"
```

Expected: method filtering, grant management, class selection, complete grid, per-card optimistic/realtime reconciliation, revocation, no-flicker refresh, and immediate Admin timeline roster pass.

Frontend affected package:

```text
D:\PROJECT\manager_points\frontend :: npm run typecheck
D:\PROJECT\manager_points\frontend :: npm run build
```

Expected: no affected TypeScript or Next.js build failures.

Final repository checks:

```text
D:\PROJECT\manager_points :: git diff --check
D:\PROJECT\manager_points :: git status --short
```

Expected: clean diff formatting; only approved paths are changed and unrelated user work is preserved.

# Safety Gates

- No gate is required to implement and verify the development-only code.
- Human approval is required before applying a database migration/backfill, creating production indexes, deploying, or mutating production data.
- The additive grant collection and optional class/method fields should avoid mandatory backfill. If implementation proves a backfill or external queue/infrastructure dependency necessary, stop at the reviewed migration/architecture artifact and request a scope amendment plus approval.
- Rollback before deployment: revert the scoped code and indexes; legacy QR/GPS data remains readable because new attendance fields are optional and legacy class fallback is defined.

# Artifacts and Checkpoints

- `CP-0`: base commit `db7ac45f1228e641ff314c3fd33756717d0cb34d` and approved scope.
- `CP-1`: reviewed backend grant/session/API contract, schema/index plan, focused test results, and hash of the backend diff before frontend integration.
- `CP-2`: frontend integration results, concurrency/realtime evidence, final diff hash, and independent review findings.
- Store long test/load output outside `taskscope.md`; reference only concise command results and hashes in the execution report.

# Execution Budgets

- One writer per path; serialize shared API/schema ownership.
- Backend contract and authorization precede frontend integration; disjoint tests/UI may proceed only after `CP-1`.
- Maximum three implementation/verification loops, two review-remediation cycles, and two retries for idempotent commands.
- Default step deadline: 600 seconds; maximum bounded step deadline: 1,800 seconds.
- Stop for schema expansion, new dependency/infrastructure, migration/backfill, production action, authorization ambiguity, or unrelated dirty-path overlap.
