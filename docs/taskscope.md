# Task Identity and Pipeline

- Task: `activity-attendance-owner-isolation`
- Pipeline: `bug_fix`
- Profile: Full
- Rule manifest: canonical rules `3.2.0`
- Repository: `D:\PROJECT\manager_points`
- Base: branch `main`, commit `57014a9878621831ea29b50b094cbe151791f387`
- Planning state: `docs/taskscope.md` was the only dirty path and its replacement was explicitly approved.

# Risk Level

- Risk: high.
- Environment: development implementation; production migration is separately gated.
- Evidence: the change affects concurrent session identity, MongoDB unique indexes, authorization, and realtime delivery.
- Blast radius: activity attendance sessions only. QR/proximity behavior and canonical attendance results must remain unchanged.

# Objective

Make every `manual_class` attendance session independent per opener while preserving one canonical attendance result per student and schedule. A teacher must resume their own active class session after reload, and opening it must not activate or transfer session controls in another teacher's or Admin's UI.

# Scope Boundaries

- Approved:
  - `backend/src/attendance-sessions/**`
  - `backend/src/system/attendance-event-emitter.ts`
  - `backend/scripts/**`
  - `frontend/src/api/activity-api.ts`
  - `frontend/src/hooks/useAttendanceSession.ts`
  - `frontend/src/hooks/useAttendanceRealtime.ts`
  - `frontend/src/app/(dashboard)/activities/[activityId]/**`
- Expected writes:
  - attendance session service/schema/realtime service and focused specs;
  - a dry-run-first attendance-session index migration script;
  - frontend attendance API, session/realtime hooks, activity detail page, and focused tests.
- Known targets:
  - `AttendanceSessionsService.openSession/getActiveSession/closeSession/getManualRoster/manualCheckin`
  - manual-session partial unique index
  - `AttendanceRealtimeService`
  - `attendanceSessionApi.getActiveSession`
  - `useAttendanceSession.applyRealtimeEvent/fetchActiveSession`
  - `ActivityAttendanceTab`

# Out of Scope

- QR/proximity session identity, student QR/GPS UX, attendance grants, scoring, activity membership, and unrelated activity-detail layout.
- Changing canonical `ActivityAttendance` idempotency by schedule and student.
- Executing a database migration or deployment without approval.

# Context and Dependencies

- Current manual uniqueness is `(context_id, schedule_id, class_id)` and intentionally omits `opened_by`.
- The unfiltered active-session lookup excludes `manual_class`, causing reload to return no session before a duplicate-open rejection.
- Realtime session lifecycle is broadcast by activity context, so another authorized account adopts the opened session in local state.
- This scope supersedes the earlier shared-session/realtime-convergence behavior from commit `d85526ac`.
- Backend filtered active lookup already accepts `method`, `class_id`, and `schedule_id`; frontend does not currently send them.

# Steps

1. Establish regression baselines for owner isolation, reload hydration, duplicate handling, and QR/proximity preservation.
2. Change manual active identity and its partial unique index to include `opened_by`; add a dry-run-first migration that reports existing indexes and conflicting active records before replacement.
3. Enforce owner-scoped manual lookup and session-control operations. Admin may continue receiving canonical attendance/reporting updates but must not control another opener's manual session.
4. Include owner/method/class/schedule scope in lifecycle events and restrict manual open/close lifecycle delivery to the owner; keep shared QR/proximity lifecycle behavior.
5. Extend the frontend active-session query contract and model separate self-service and owner/class manual session lanes.
6. Hydrate each manual lane with `method=manual_class`, `class_id`, and today's `schedule_id`; reconcile a same-owner duplicate response by refetching the existing session.
7. Filter realtime events before mutating a lane. Render resume/close/roster state for the owner's active class session without blocking independent lanes.
8. Run focused backend/frontend tests, migration dry-run against an approved non-production database, then final diff/status review.

# Acceptance Criteria

- AC1: Teacher A opens a manual session for a class; Admin and Teacher B do not enter that session or receive its controls.
- AC2: Reloading Teacher A's page restores the same active manual session and roster; the UI does not offer a second open action for that lane.
- AC3: A repeated same-owner open is idempotently reconciled or rejected without losing the recoverable active session.
- AC4: Different authorized openers may hold independent manual sessions for the same activity, schedule, and class.
- AC5: Only the opener can hydrate, close, or mutate their manual session; Admin retains reporting visibility without session takeover.
- AC6: Attendance writes remain idempotent per schedule/student across concurrent manual sessions.
- AC7: QR/proximity active lookup, lifecycle broadcasting, check-in, and uniqueness remain unchanged.

# Verification

- AC1–AC7 backend:
  - `D:\PROJECT\manager_points\backend :: npm test -- --runInBand attendance-sessions/attendance-sessions.service.spec.ts attendance-sessions/attendance-sessions.controller.spec.ts attendance-sessions/attendance-realtime.service.spec.ts`
  - Expected: owner, concurrent-session, authorization, realtime, and QR/GPS regressions pass.
- AC1–AC3 and AC7 frontend:
  - `D:\PROJECT\manager_points\frontend :: npm test -- "src/hooks/useAttendanceSession.test.tsx" "src/app/(dashboard)/activities/[activityId]/page.test.tsx"`
  - Expected: filtered hydration, realtime isolation, reload resume, and activity-tab regressions pass.
- Migration safety:
  - `D:\PROJECT\manager_points\backend :: <repository-native dry-run command added by the implementation>`
  - Expected: exact old/new index plan and conflict count are reported with no mutation.
- Final:
  - `D:\PROJECT\manager_points :: git diff --check`
  - Expected: clean scoped diff with no unintended paths.

# Safety Gates

- Gate: explicit approval before executing the MongoDB index migration in staging or production.
- Approval artifact: dry-run output, conflicting-record report, old/new index definitions, database/environment identity, backup confirmation, and rollback procedure.
- Rollback: stop new session creation, close/reconcile extra owner-specific active sessions, then restore the prior shared manual-session index and application version.
- Resume point: execute the reviewed migration, verify indexes, then run post-migration owner-isolation smoke tests.

# Artifacts and Checkpoints

- Checkpoint 1: passing regression baseline plus pinned base commit.
- Checkpoint 2: reviewed code diff and migration dry-run artifact/hash before the Human Gate.
- Checkpoint 3: post-migration index listing and smoke-test evidence.

# Execution Budgets

- One writer per path; serialize schema, service, migration, and frontend contract changes.
- Maximum retries: 2; engineering loops: 3; review remediation cycles: 2.
- Independent review is required for authorization, concurrency, realtime, and migration behavior.
