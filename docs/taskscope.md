# Task Identity and Pipeline

- Task: `activities-global-attendance-draft-finalization`
- Pipeline: `feature_development`
- Profile/rules: Full, protocol `3.2.0`
- Repository/base state: `D:\PROJECT\manager_points`, branch `main`, base `e4663138`; `docs/taskscope.md` was intentionally empty before this scope.

# Risk Level

- Risk: high.
- Environment: development.
- Evidence: the feature spans frontend/backend, changes persisted attendance approval timing, triggers training-point synchronization, and requires scheduled, idempotent processing under possible concurrent sessions/replicas.
- Reversibility/blast radius: code is reversible; incorrect finalization can affect every `manual_class` attendance record and downstream academic records.

# Objective

Add a `Điểm danh` action to the Activities toolbar that opens a permission-protected, paginated overview of attendance across activities; records created by class-based attendance remain drafts during the attendance window and become official automatically after that window ends.

# Scope Boundaries

- Approved: `frontend/src/app/(dashboard)/activities/**`, `frontend/src/components/activities/**`, `frontend/src/api/activity-api.ts`, focused frontend tests; `backend/src/attendance-sessions/**`, `backend/src/activity-attendance/**`, `backend/src/activity-schedules/schemas/activity-schedule.schema.ts`, focused backend tests.
- Write: verified files above plus a new frontend attendance page/component and a new backend finalizer service/spec under their owning modules.
- Known targets: `ActivitiesPage`, `ActivityListWorkspace`, `activityAttendanceApi.getAll`, `ActivityAttendanceService.findAll`, `AttendanceSessionsService.getManualRoster/manualCheckin/cancelManualCheckin/closeSession`, `AttendanceSession`, `ActivityAttendance`, `ActivitySchedule.end_time`, `AttendanceSessionsModule`.

# Out of Scope

- QR/proximity approval behavior, existing manual approval endpoints, activity completion rules, scoring formulas, unrelated report pages, historical-data migration, deployment, and production-data repair.
- Adding a new database index unless measured evidence shows the existing indexes are insufficient; that requires a scope amendment and database gate.

# Context and Dependencies

- Backend draft semantics are `approval_status: 'pending'`; official semantics are `approval_status: 'approved'`. Do not add a second `draft` enum.
- `manualCheckin` currently writes `approved`, sets approver metadata, counts only approved records, and immediately queues academic-record sync.
- The authoritative window end is `ActivitySchedule.end_time`; `AttendanceSession.auto_close_at` is optional and is not authoritative.
- `GET /activity-attendance` and the typed frontend client already support a global paginated list. Preserve `ACTIVITY_ATTENDANCE_READ` authorization and add only verified query/population fields needed by the page.
- The finalizer must be safe across overlapping runs and multiple application replicas. Only pending `manual_class` records belonging to ended, non-cancelled schedules may transition.

# Steps

1. Backend/API: baseline current query shape and permission behavior; extend `findAll` only as needed for stable pagination, filters, and populated activity/schedule/student/class display data.
2. Draft creation: change `manualCheckin` upsert to persist `pending` without `approved_by/approved_at` and without scoring sync. Update manual roster and `checkin_count` logic so pending selections remain visible/editable during the active window.
3. Window enforcement: reject class-attendance mutations after `ActivitySchedule.end_time`; keep session close/expiry transitions conditional and idempotent.
4. Automatic finalization: add a bounded scheduled worker following the existing Nest scheduler pattern. Atomically claim/transition only eligible pending `manual_class` records, set official metadata using a documented actor policy, and enqueue each transitioned record for existing academic-record sync/retry. Repeated or concurrent runs must produce no duplicate transition or score.
5. Frontend navigation: add an adjacent `Điểm danh` button in `ActivityListWorkspace`, wire it from `ActivitiesPage` to `/activities/attendance`, and expose it only when the user can read activity attendance.
6. Overview page: add a responsive, paginated list showing activity, schedule/time, student/class, attendance status/method, draft/official state, and recorded time; support loading, empty, error, filters, and authorization states.
7. Tests/review: add focused unit/UI/API coverage, run affected checks, review the final diff for unrelated changes, then perform independent review of persistence, authorization, scheduler concurrency, and sync behavior.

# Acceptance Criteria

- AC-01: An authorized user can click `Điểm danh` from the Activities toolbar and reach `/activities/attendance`; an unauthorized user cannot access the overview or its data.
- AC-02: The overview lists attendance across activities with correct server pagination and clearly labels `pending` as `Bản nháp` and `approved` as `Chính thức`.
- AC-03: A class-based check-in created before `end_time` is persisted as `pending`, is immediately visible in the manual roster/count, remains editable while the window is active, and does not create/sync training points.
- AC-04: After `end_time`, eligible pending class-attendance records become approved automatically, receive consistent approval metadata, and enter the existing academic-record sync flow.
- AC-05: Cancelled/rejected records, QR/proximity records, non-ended schedules, and already approved records are not finalized by the worker.
- AC-06: Concurrent/repeated finalizer runs are idempotent and cannot duplicate approval or academic records; failures remain retryable by the existing catch-up path.
- AC-07: Existing per-activity attendance, manual approval, QR, and proximity tests remain passing.

# Verification

- AC-01/02: `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/activities/page.test.tsx" "src/components/activities/ActivityListWorkspace.test.tsx" "src/app/(dashboard)/activities/attendance/page.test.tsx" "src/api/activity-api.test.ts"` => navigation, access, rendering, filters, and pagination pass.
- Frontend static check: `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors.
- AC-03/05/07: `D:\PROJECT\manager_points\backend :: npm test -- attendance-sessions.service.spec.ts --runInBand` => draft/manual-session regressions pass.
- AC-04/05/06: `D:\PROJECT\manager_points\backend :: npm test -- attendance-draft-finalizer.service.spec.ts --runInBand` => timing, exclusions, atomic idempotency, retries, and sync handoff pass.
- Backend build: `D:\PROJECT\manager_points\backend :: npm run build` => Nest compilation succeeds.
- Final: inspect `git diff --check`, `git diff --stat`, and `git status --short`; manually verify the responsive page and an attendance window crossing `end_time` with a development clock fixture.

# Safety Gates

- Code implementation and local tests: None.
- Gate trigger: any database index/schema migration, historical backfill/repair, deployment, or production execution. Required artifact: reviewed migration/dry-run or deployment plan with impact and rollback. Resume only after explicit approval.

# Artifacts and Checkpoints

- Required artifacts: implementation diff, focused test outputs, manual verification note, and independent review result mapped to AC-01–AC-07.
- Checkpoint: record base/current commit and hashes of reviewed implementation/test artifacts before independent review; invalidate review if those artifacts change.

# Execution Budgets

- Step deadline: 600 seconds; maximum 1,800 seconds.
- Concurrency: one writer per path; parallelize only independent read-only checks or disjoint writes with proven ownership.
- Retries: at most 2 idempotent retries; at most 3 implementation/verification loops; at most 2 review-remediation cycles.
