Task: activity-detail-and-owner-scoped-attendance | bug_fix | Risk: high | Profile: Full

## Objective

Deliver consistent activity controls and correct attendance behavior so that:

1. Attendance can be opened only during the exact configured schedule window.
2. The attendance-method back action is a shared `Button` whose width fits `← Quay lại`.
3. Activity detail uses the label `Phụ trách` instead of `Cố vấn`.
4. `Phân quyền điểm danh` is visible and usable only by administrators.
5. Selecting `Theo lớp` hides the generic `Điểm danh hoạt động` introduction while the class picker is open.
6. Creating a new activity allows the responsible account to remain unselected; when it is omitted, the backend assigns the signed-in administrator who creates the activity as the default responsible account.
7. Active QR and GPS management sessions are isolated by opener account, so opening a session as account A does not make an administrator or account B control or display that same session as their own.
8. Existing shared `Button` and `Select` components remain the design source for activity controls.

## Current Evidence

- `frontend/src/components/activities/ActivityForm.tsx` initializes `advisor_id` from `initialData` or an empty value, but currently blocks submission when it is empty. Create mode must allow the empty value to reach the backend.
- `backend/src/activities/dto/create-activity.dto.ts` currently requires `advisor_id`, and `backend/src/activities/activities.service.ts` validates every supplied advisor as a `TEACHER`. Create handling must distinguish an explicitly selected teacher from the administrator fallback.
- `backend/src/attendance-sessions/attendance-sessions.service.ts` currently scopes active `manual_class` sessions by `opened_by`, while QR/GPS duplicate detection and active-session lookup are shared across openers.
- `backend/src/attendance-sessions/schemas/attendance-session.schema.ts` currently has a QR/GPS active-session unique index on `context_id + schedule_id`, without `opened_by`.
- `backend/src/attendance-sessions/attendance-realtime.service.ts` filters manual lifecycle events by opener but broadcasts QR/GPS lifecycle events to other managers in the same activity.
- `frontend/src/hooks/useAttendanceSession.ts` stores QR/GPS in one session lane and accepts any QR/GPS lifecycle event for the activity.

## Approved Boundary

Planning authorizes only this document. A later implementation is limited to the activity create form, activity-detail attendance UI, attendance authorization/session/realtime services, the attendance-session index migration, and directly corresponding tests.

### Planned Write Paths

- `frontend/src/components/activities/ActivityForm.tsx`
- `frontend/src/components/activities/ActivityForm.test.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- `frontend/src/hooks/useAttendanceSession.ts`
- `frontend/src/hooks/useAttendanceSession.test.ts`
- `backend/src/attendance-sessions/attendance-sessions.service.ts`
- `backend/src/attendance-sessions/attendance-sessions.service.spec.ts`
- `backend/src/attendance-sessions/attendance-realtime.service.ts`
- `backend/src/attendance-sessions/attendance-realtime.service.spec.ts`
- `backend/src/attendance-sessions/schemas/attendance-session.schema.ts`
- `backend/scripts/migrate-attendance-session-owner-index.ts`
- `backend/package.json`
- `backend/src/activities/dto/create-activity.dto.ts`
- `backend/src/activities/activities.service.ts`
- `backend/src/activities/activities.service.spec.ts`
- `backend/src/activities/activity-attendance-grants.service.ts`
- `backend/src/activities/activity-attendance-grants.service.spec.ts`

### Read-only References

- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/attendance/AttendanceMethodSelector.tsx`
- `frontend/src/api/activity-api.ts`
- `backend/src/activities/activities.controller.ts`

## Implementation Steps

1. Preserve an empty `advisor_id` in activity create mode and make the field optional for create submission. Keep eligible `TEACHER` accounts as the explicit selection options, remove the all-users fallback, and retain the populated responsible account in edit mode.
2. Make `advisor_id` optional in the create DTO. In `ActivitiesService.create`, validate an explicitly supplied ID as an eligible `TEACHER`; when the field is absent, verify the requester is an administrator and persist the requester's user ID as `advisor_id`. Do not trust a client-supplied admin ID as the fallback, and reject an omitted advisor for any non-admin requester that may hold create permission.
3. Add form and service tests proving an empty create selection is submitted successfully, the creating administrator becomes responsible by default, an explicitly selected teacher takes precedence, a client cannot explicitly select an admin through the teacher path, a non-admin cannot use the fallback, and edit mode retains its existing responsible account.
4. Keep the attendance-opening rule as an inclusive interval: current time must be greater than or equal to the schedule start and less than or equal to its end. Use the schedule selected for the current activity occurrence and reject opening outside that interval on the server.
5. Render `← Quay lại` with the shared `Button` component and intrinsic content width. Use the shared `Select` for class selection and do not introduce page-local button/select primitives.
6. Replace activity-detail advisor copy with `Phụ trách`.
7. Make attendance-grant administration administrator-only in both layers: `can_administer_grants` is true only for admin, the manager is not rendered for any non-admin, and grant endpoints reject assigned teachers/responsible users as well as all other non-admin users.
8. When `Theo lớp` is selected, close the method selector, open the class picker, and suppress the generic `Điểm danh hoạt động` card while `classPickerOpen` is true. Cancelling clears the class selection and returns to the normal no-session state; confirming a valid class opens only that account's manual class lane.
9. Extend QR/GPS session ownership to `opened_by`:
   - duplicate detection permits one active QR/GPS session per opener, activity context, and schedule;
   - staff/manager active-session hydration returns only the requester's QR/GPS session;
   - opening or closing one account's session cannot replace, close, or hydrate another account's session;
   - session-control operations remain owner-only, while participant check-in continues to target the concrete QR token or `session_id`;
   - participant discovery remains activity-aware and deterministic and must not grant control over the opener's session.
10. Filter QR/GPS realtime lifecycle and manager check-in updates by `openedBy` for manager clients. Keep participant self-check-in notifications available only for the participant's own check-in. On the frontend, ignore non-manual manager lifecycle events whose `openedBy` does not match `currentUserId`.
11. Replace the legacy active QR/GPS unique index with an owner-scoped partial unique index containing `context_id`, `schedule_id`, and `opened_by` for methods `qr` and `proximity`. Extend the existing dry-run-first migration to report conflicting/ownerless active records, create the exact new index, remove only the exact approved legacy index, and verify the installed definition.
12. Add regression tests for simultaneous account A/admin QR and GPS sessions, owner-scoped hydration, duplicate rejection for the same opener, cross-account close/control rejection, realtime isolation, and participant QR/GPS check-in compatibility.

## Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run src/components/activities/ActivityForm.test.tsx "src/app/(dashboard)/activities/[activityId]/page.test.tsx" src/hooks/useAttendanceSession.test.ts`
  Expected: focused activity-form, detail, and attendance-hook tests pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck`
  Expected: no TypeScript errors.
- `D:\PROJECT\manager_points\frontend :: npm run build`
  Expected: production build succeeds.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/activities/activities.service.spec.ts src/attendance-sessions/attendance-sessions.service.spec.ts src/attendance-sessions/attendance-realtime.service.spec.ts src/activities/activity-attendance-grants.service.spec.ts`
  Expected: focused backend tests pass.
- `D:\PROJECT\manager_points\backend :: npm run build`
  Expected: Nest build succeeds.
- `D:\PROJECT\manager_points\backend :: npm run migration:attendance-session-owner-index:dry-run -- --environment <approved-environment>`
  Expected: sanitized report shows no conflicting or ownerless active records and `readyToExecute: true`; no index is changed.
- `D:\PROJECT\manager_points :: git diff --check`
  Expected: no whitespace errors.
- `D:\PROJECT\manager_points :: git status --short` and `git diff --stat`
  Expected: only approved implementation paths are changed.

## Acceptance Criteria

- A new activity may be submitted with no responsible account selected; the backend then assigns the authenticated administrator who created it as `advisor_id`.
- An explicitly selected eligible teacher overrides the fallback. An explicitly supplied admin ID is not accepted through the teacher-selection path, and a non-admin requester cannot acquire the fallback behavior.
- Account A and an administrator/account B can independently open and manage separate QR or GPS sessions for the same activity schedule.
- Refresh, polling, and realtime events never hydrate account A's QR/GPS manager session into another manager account.
- A manager cannot close or control another opener's session; students can still check in using a valid QR token or GPS `session_id`.
- Attendance grants are shown and accepted only for administrators.
- `Theo lớp` hides the generic attendance introduction until the class flow is cancelled or completed.
- The attendance window, `Phụ trách` label, intrinsic back button, and shared Button/Select design requirements are covered by regression tests.
- No unrelated behavior or files change.

## Gates and Exclusions

- This is planning-only. Do not implement, run a migration, change persistent data, commit, push, deploy, or publish under this request.
- Executing the index migration against any database requires separate explicit migration authority and an approved environment label after a successful dry run.
- No dependency upgrades, schema fields beyond the required index, role-model redesign, or unrelated activity UI refactor.
