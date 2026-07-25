Task: activity-form-and-owner-scoped-attendance | bug_fix | Risk: high | Profile: Full

## Objective

Deliver consistent activity creation, update, detail, and attendance behavior so that:

1. The responsible-teacher selector provides an explicit `Không chọn (mặc định tài khoản admin)` option.
2. On create or update, choosing that option assigns the authenticated administrator performing the operation as the responsible account.
3. The `Chủ nhiệm sinh viên (President)` field is removed from both create and update forms and is not submitted by either flow.
4. The `Học kỳ áp dụng` selector is removed from both forms. The active semester is used implicitly and its name is rendered inline with the create/update dialog title.
5. Attendance can be opened only during the exact configured schedule window.
6. The attendance-method back action is a shared `Button` whose width fits `← Quay lại`.
7. Activity detail uses the label `Phụ trách` instead of `Cố vấn`.
8. `Phân quyền điểm danh` is visible and usable only by administrators.
9. Selecting `Theo lớp` hides the generic `Điểm danh hoạt động` introduction while the class picker is open.
10. Active QR and GPS management sessions are isolated by opener account.
11. Existing shared `Button`, `Input`, and `Select` components remain the design source for activity controls.

## Current Evidence

- `frontend/src/components/activities/ActivityForm.tsx` is shared by create and edit modes. It still loads students and renders `Chủ nhiệm sinh viên (President)` in edit mode.
- The same form still renders `Học kỳ áp dụng` as an editable `Select` in edit mode, while create mode silently selects the active semester.
- The responsible selector has an empty placeholder but no selectable reset/default-admin item. Edit validation currently requires a non-empty `advisor_id`.
- `frontend/src/app/(dashboard)/activities/page.tsx` owns the create and update dialog titles, so it must receive or derive the active-semester display text.
- `backend/src/activities/activities.service.ts` already falls back to the authenticated creating administrator when create omits `advisor_id`, but update currently treats omitted `advisor_id` as “leave unchanged” and has no explicit default-admin/reset contract.
- `UpdateActivityDto` is derived from `CreateActivityDto`; the update API needs to distinguish an absent responsible field from an explicit request to use the current administrator.
- QR/GPS ownership code has been changed toward opener-scoped behavior, but the database can still retain the legacy unique index on `context_id + schedule_id`. That stale index produces MongoDB `E11000`, surfaced as `An active attendance session already exists for this schedule and class.`
- The existing attendance-session owner-index migration covers manual-class indexes only and does not yet migrate the legacy QR/GPS unique index.

## Approved Boundary

Planning authorizes only this document. A later implementation is limited to the shared activity form and dialog header, activity create/update contracts, activity-detail attendance UI, attendance authorization/session/realtime services, the attendance-session index migration, and directly corresponding tests.

### Planned Write Paths

- `frontend/src/components/activities/ActivityForm.tsx`
- `frontend/src/components/activities/ActivityForm.test.tsx`
- `frontend/src/app/(dashboard)/activities/page.tsx`
- `frontend/src/app/(dashboard)/activities/page.test.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- `frontend/src/hooks/useAttendanceSession.ts`
- `frontend/src/hooks/useAttendanceSession.test.ts`
- `backend/src/activities/dto/create-activity.dto.ts`
- `backend/src/activities/dto/update-activity.dto.ts`
- `backend/src/activities/activities.service.ts`
- `backend/src/activities/activities.service.spec.ts`
- `backend/src/activities/activity-attendance-grants.service.ts`
- `backend/src/activities/activity-attendance-grants.service.spec.ts`
- `backend/src/attendance-sessions/attendance-sessions.service.ts`
- `backend/src/attendance-sessions/attendance-sessions.service.spec.ts`
- `backend/src/attendance-sessions/attendance-realtime.service.ts`
- `backend/src/attendance-sessions/attendance-realtime.service.spec.ts`
- `backend/src/attendance-sessions/schemas/attendance-session.schema.ts`
- `backend/scripts/migrate-attendance-session-owner-index.ts`
- `backend/package.json`

### Read-only References

- `frontend/src/components/ui/button.tsx`
- `frontend/src/components/ui/Input.tsx`
- `frontend/src/components/ui/select.tsx`
- `frontend/src/components/attendance/AttendanceMethodSelector.tsx`
- `frontend/src/api/activity-api.ts`
- `frontend/src/api/semester-api.ts`
- `backend/src/activities/activities.controller.ts`
- `backend/src/semesters/schemas/semester.schema.ts`

## Implementation Steps

1. Define one responsible-selector contract for create and edit:
   - show eligible `TEACHER` accounts as explicit choices;
   - add a selectable `Không chọn (mặc định tài khoản admin)` item using a UI sentinel that is never persisted as an ID;
   - keep the existing responsible teacher selected when edit mode first opens;
   - treat selecting the default-admin item as an explicit action, not as an omitted update field.
2. Normalize the responsible payload:
   - create sends no `advisor_id` when the default-admin item is selected;
   - update sends an explicit nullable/default-admin signal when the admin selects that item;
   - update omission continues to mean “leave the current responsible account unchanged”;
   - never send an empty string or the UI sentinel as an ObjectId.
3. Enforce the responsible fallback on the server:
   - create without a selected teacher persists the authenticated creating administrator as `advisor_id`;
   - update with the explicit default-admin signal persists the authenticated updating administrator as `advisor_id`;
   - an explicitly supplied ID must resolve to an eligible `TEACHER`;
   - only an administrator may invoke the default-admin behavior; non-admin callers cannot clear or self-assign through it.
4. Remove the President form concern from both modes:
   - remove the student-options request and local student state when they are no longer used elsewhere in the form;
   - remove the `Chủ nhiệm sinh viên (President)` control;
   - exclude `president_id` from create and update payloads so editing other fields cannot overwrite existing legacy President data;
   - keep the backend/schema field intact for backward compatibility outside this form.
5. Replace the semester selector with implicit active-semester behavior:
   - load the active semester once for the dialog/form flow;
   - render its display name inline on the same row as `Tạo hoạt động mới`, `Tạo câu lạc bộ mới`, or `Cập nhật hoạt động`;
   - use the active semester ID for create and update submissions without exposing a selector;
   - block submission with a clear error when no active semester exists;
   - do not silently fall back to the first inactive semester.
6. Keep dialog and form behavior responsive: the title and semester text stay on one row when space permits and wrap cleanly on narrow screens. Reuse the existing typography and shared form-control styling.
7. Add activity form/page tests for create and edit:
   - default-admin option is visible and selectable;
   - create fallback and explicit teacher selection produce the correct payload;
   - edit preserves the existing teacher until changed;
   - edit default-admin selection uses the explicit update signal;
   - President and semester selectors are absent;
   - active-semester text appears beside both dialog titles;
   - create/update use the active semester ID and reject a missing active semester.
8. Add service tests proving create/update default-admin assignment, explicit teacher precedence, invalid/admin IDs rejected through the teacher path, non-admin fallback rejection, and omission-on-update preserving the existing responsible account.
9. Keep the attendance-opening rule as an inclusive interval: current time must be greater than or equal to the selected schedule start and less than or equal to its end. Reject opening outside that interval on the server.
10. Render `← Quay lại` with the shared `Button` and intrinsic content width. Use shared `Select` controls for attendance choices and do not add page-local button/select primitives.
11. Replace activity-detail advisor copy with `Phụ trách`.
12. Make attendance-grant administration administrator-only in both layers: expose `can_administer_grants` only for admins, hide the manager for non-admins, and reject all non-admin grant mutations at the API.
13. When `Theo lớp` is selected, close the method selector, open the class picker, and suppress the generic `Điểm danh hoạt động` card until the class flow is cancelled or completed.
14. Complete QR/GPS ownership isolation by including `opened_by` in duplicate detection, active-session hydration, lifecycle/control authorization, realtime routing, and frontend event acceptance.
15. Extend the dry-run-first index migration to:
   - inspect and report exact installed manual and QR/GPS attendance indexes;
   - report conflicting or ownerless active records;
   - create the owner-scoped QR/GPS partial unique index on `context_id + schedule_id + opened_by`;
   - drop only the exact approved legacy QR/GPS index;
   - verify the final definitions;
   - preserve the dry-run path as non-mutating.
16. Map duplicate-key failures by index/key pattern so the stale-index or same-owner conflict is diagnosed precisely instead of masking every `E11000` behind the generic English error.
17. Add regression tests for simultaneous account A/admin QR and GPS sessions, same-opener duplicate rejection, owner-scoped hydration, cross-account control rejection, realtime isolation, and participant QR/GPS check-in compatibility.

## Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run src/components/activities/ActivityForm.test.tsx "src/app/(dashboard)/activities/page.test.tsx" "src/app/(dashboard)/activities/[activityId]/page.test.tsx" src/hooks/useAttendanceSession.test.ts`
  Expected: focused activity create/update, detail, and attendance-hook tests pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck`
  Expected: no TypeScript errors.
- `D:\PROJECT\manager_points\frontend :: npm run build`
  Expected: production build succeeds.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/activities/activities.service.spec.ts src/activities/activity-attendance-grants.service.spec.ts src/attendance-sessions/attendance-sessions.service.spec.ts src/attendance-sessions/attendance-realtime.service.spec.ts`
  Expected: focused activity and attendance backend tests pass.
- `D:\PROJECT\manager_points\backend :: npm run build`
  Expected: Nest build succeeds.
- `D:\PROJECT\manager_points\backend :: npm run migration:attendance-session-owner-index:dry-run -- --environment <approved-environment>`
  Expected: the sanitized report identifies installed legacy indexes and conflicts without changing any index.
- `D:\PROJECT\manager_points :: git diff --check`
  Expected: no whitespace errors.
- `D:\PROJECT\manager_points :: git status --short` and `git diff --stat`
  Expected: only approved implementation paths are changed.

## Acceptance Criteria

- Create and update forms both offer `Không chọn (mặc định tài khoản admin)` under `Giáo viên phụ trách`.
- Choosing that option assigns the authenticated admin performing the create/update operation; an explicitly selected eligible teacher takes precedence.
- Opening edit without changing the responsible selector preserves the existing responsible account.
- `Chủ nhiệm sinh viên (President)` and `Học kỳ áp dụng` controls do not appear in either mode and neither flow overwrites legacy President data.
- The active semester name is visible inline with both create and update titles, and its ID is used implicitly; submission is blocked if no active semester exists.
- Account A and administrator/account B can independently open and manage QR or GPS sessions for the same schedule after the approved index migration.
- Attendance grants are admin-only, `Theo lớp` hides the generic attendance card, and the attendance window, `Phụ trách` label, intrinsic back button, and shared control design are covered by regression tests.
- No unrelated behavior or files change.

## Gates and Exclusions

- This request is planning-only. Do not implement code, execute a migration, change persistent data, commit, push, deploy, or publish.
- Executing the attendance index migration against any database requires separate explicit migration authority, an approved environment label, and a successful dry run.
- No existing activity data migration is planned for President or semester fields.
- Do not delete the backend `president_id` schema/API field or historical President data; remove only this form's control and payload writes.
- No dependency upgrades, role-model redesign, unrelated activity UI refactor, or semester lifecycle redesign.
