# Task Identity and Pipeline

- Task: `activity-manual-attendance-toggle-and-class-select`
- Pipeline: `feature_development`
- Profile: Full
- Rule manifest: canonical rules `3.2.0`
- Repository: `D:\PROJECT\manager_points`
- Base: branch `main`, commit `f6350a6a`; `docs/taskscope.md` is the authorized dirty planning artifact.

# Risk Level

- Risk: high.
- Environment: development.
- Evidence: the change adds role-dependent class access and reverses approved attendance, academic-record sync, completion evaluation, counts, and UI state.
- Blast radius: activity `manual_class` attendance only.

# Objective

Make `activities/[activityId] > Điểm danh > Theo lớp` a focused manual-attendance workspace: hide the method selector after entry; let a teacher toggle attendance by clicking a student card; require Admin or the assigned activity advisor to select and confirm a class before students appear.

# Scope Boundaries

- Approved/write:
  - `backend/src/activities/activity-attendance-grants.service.ts`
  - `backend/src/activities/activity-attendance-grants.service.spec.ts`
  - `backend/src/attendance-sessions/attendance-sessions.controller.ts`
  - `backend/src/attendance-sessions/attendance-sessions.service.ts`
  - focused attendance-session controller/service specs and DTOs under `backend/src/attendance-sessions/**`
  - `frontend/src/api/activity-api.ts`
  - `frontend/src/hooks/useAttendanceSession.ts`
  - `frontend/src/hooks/useAttendanceSession.test.tsx`
  - `frontend/src/components/attendance/ManualAttendanceGrid.tsx`
  - new focused `ManualAttendanceGrid` test
  - `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
  - `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- Known targets: manual capability classes, class-access assertion, roster filtering, manual check-in/cancel endpoints, hook optimistic toggle, `ActivityAttendanceTab`.

# Out of Scope

- QR/GPS check-in and cancellation, non-activity attendance, grants UI, session ownership/uniqueness, migrations, deployment, and unrelated activity-detail layout.
- Canceling attendance created through another method or by an unrelated session owner.

# Context and Dependencies

- Opening `manual_class` requires `class_id`; therefore Admin/advisor entry hides the method selector and shows an empty class-selection state, but creates the backend session only after confirmation.
- Delegated teachers may access only their assigned class; Admin and the activity’s assigned advisor receive selectable valid classes for this activity.
- The current roster treats any stored attendance as present and must instead recognize only approved `present`/`late` records.
- The existing unique `(schedule_id, student_id)` record must be reactivated on a later toggle-on rather than duplicated.
- Cancellation must revoke the linked academic record and re-evaluate completion after the attendance no longer counts.

# Steps

1. Add backend regressions for class authorization, toggle-off, toggle-on reactivation, method isolation, counts, sync revocation, and completion re-evaluation.
2. Return role-appropriate selectable classes and enforce the same rule on every manual session/roster/check-in/cancel operation.
3. Add an owner-scoped manual cancellation endpoint. Mark the canonical manual record non-counting, revoke its academic sync, recalculate completion, and set the session count accurately.
4. Update manual check-in to reactivate an eligible canceled manual record and resync it idempotently.
5. Filter roster presence to approved `present`/`late` attendance.
6. Add frontend API/hook toggle behavior with per-student pending state, optimistic updates, rollback, and repeated-click protection.
7. Make the entire student card keyboard-accessible and clickable; first click checks in, second click cancels, with clear selected/pending/error states.
8. Hide the method selector immediately after `Theo lớp`. Teacher opens their sole authorized class directly. Admin/advisor sees class select plus Confirm/Cancel and no student roster until confirmation succeeds.
9. Keep the active manual session panel above the roster and preserve close/reload behavior.
10. Run focused backend/frontend verification, independent authorization/data-integrity review, and final diff inspection.

# Acceptance Criteria

- AC1: Entering `Theo lớp` removes the method-selector panel shown in the reference image.
- AC2: A delegated teacher with one authorized class opens that class immediately; zero or ambiguous classes produce an error without guessing.
- AC3: Admin/activity advisor sees no students before selecting a valid class and confirming; cancel opens no backend session.
- AC4: Confirm creates/resumes the selected class session and renders its active-session panel before the roster.
- AC5: Clicking an unmarked student card records approved manual attendance; clicking the marked card again cancels it; a third click can mark it again without a duplicate row.
- AC6: Pending cards ignore repeated clicks, failures roll back the optimistic state, and keyboard activation matches pointer behavior.
- AC7: Toggle-off cannot cancel QR/GPS, another activity/schedule/class, another opener’s manual record, or a student outside the selected class.
- AC8: Roster and session count reflect only counting attendance after each toggle and reload.
- AC9: Toggle-off revokes linked academic attendance output and re-evaluates completion awards; toggle-on resyncs idempotently.
- AC10: Existing QR/GPS and owner-scoped manual-session behavior remains unchanged.

# Verification

- Backend AC2–AC10:
  - `D:\PROJECT\manager_points\backend :: npm test -- --runInBand activities/activity-attendance-grants.service.spec.ts attendance-sessions/attendance-sessions.service.spec.ts attendance-sessions/attendance-sessions.controller.spec.ts`
  - Expected: authorization, toggle lifecycle, data-integrity, count, sync, and method-isolation regressions pass.
- Frontend AC1–AC6, AC8, AC10:
  - `D:\PROJECT\manager_points\frontend :: npm test -- "src/hooks/useAttendanceSession.test.tsx" "src/components/attendance/ManualAttendanceGrid.test.tsx" "src/app/(dashboard)/activities/[activityId]/page.test.tsx"`
  - Expected: role flows, selection/confirmation, card toggle, optimistic rollback, and layout regressions pass.
- Static:
  - `D:\PROJECT\manager_points\backend :: npm run build`
  - `D:\PROJECT\manager_points\frontend :: npm run typecheck`
  - Expected: both complete without errors.
- Final:
  - `D:\PROJECT\manager_points :: git diff --check`
  - Expected: scoped, whitespace-clean diff with no unrelated changes.

# Safety Gates

- Gate: None for development implementation and tests.
- Stop and request approval before deployment or running the new mutation against staging/production data.

# Artifacts and Checkpoints

- Checkpoint 1: backend toggle and authorization tests passing.
- Checkpoint 2: frontend interaction tests and static checks passing.
- Required review artifact: final scoped diff plus focused test output.

# Execution Budgets

- One writer per path; serialize backend contract before frontend integration.
- Maximum retries: 2; engineering loops: 3; review remediation cycles: 2.
- Independent review is required for authorization, persistent attendance reversal, academic sync, and completion recalculation.
