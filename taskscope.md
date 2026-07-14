# 1. Task ID + Pipeline

- Task ID: `ACTIVITIES-ROLE-AWARE-ATTENDANCE-DETAILS-013`
- Pipeline: `feature_development`

# 2. Risk Level

- Risk level: `medium`
- Rationale: The task changes a read-only activity timeline response and role-specific attendance presentation. It does not change attendance records, database schemas, production configuration, deployment state, or destructive operations.

# 3. Objective

Replace the generic `Đã điểm danh` indicator with real attendance totals and an expandable member-detail view for advisor accounts, preserve a private attendance status for student accounts, and let admin accounts see the detailed roster together with each member's attendance status. This gives each authorized role the required information without exposing the complete attendance roster to student accounts.

# 4. Scope

- `backend/src/activity-schedules/activity-schedules.service.ts`
  - Keep student accounts restricted to their own `my_attendance` record.
  - Keep teacher/advisor accounts supplied with `attendance_records` for every returned schedule.
  - Keep admin accounts supplied with `attendance_records`, including each member's attendance and approval status; do not add an admin-level `my_attendance` field.
  - Preserve the existing restricted staff record projection: `_id`, `student_id._id`, `student_id.full_name`, `student_id.student_code`, `status`, `check_in_time`, `check_out_time`, `approval_status`, `recorded_at`, and `note`; do not expose email or unrelated student fields.
- `backend/src/activity-schedules/activity-schedules.service.spec.ts`
  - Add separate assertions for student, teacher/advisor, and admin timeline payloads.
  - Verify that admin items contain `attendance_records` with each member's attendance status and do not require `my_attendance`.
  - Verify that student items never contain `attendance_records` and teacher/advisor items never contain a private status for another user.
- `frontend/src/api/activity-api.ts`
  - Keep admin and teacher/advisor responses on the staff timeline item type containing `attendance_records`.
  - Keep the student response type role-specific and model nullable personal attendance exactly.
- `frontend/src/components/activities/ActivityScheduleTimeline.tsx`
  - Replace the static staff text with `Đã điểm danh: {attendance_records.length}` and a keyboard-accessible expand/collapse control scoped to each schedule card.
  - Render expanded attendance members with full name, student code, attendance status, approval status, check-in time when present, and note when present.
  - Render `Không có dữ liệu điểm danh` when the expanded list is empty.
  - Render the private `Trạng thái điểm danh` badge only for student accounts; preserve mappings for `present`, `late`, `absent`, `excused`, and the null fallback `Chưa điểm danh`.
  - Render aggregate count/details only for teacher/advisor accounts and admin accounts.
  - Preserve today-first ordering, today highlighting, past-schedule fading, registration actions, and the attendance action button.
- `frontend/src/components/activities/ActivityScheduleTimeline.test.tsx`
  - Add role-matrix tests proving advisor aggregate/detail output, student-only private output, and admin aggregate/detail output with the status of every listed member.
  - Verify expand/collapse behavior, empty attendance details, member fields, status labels, approval labels, and absence of roster data for student viewers.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
  - Pass viewer capabilities that activate aggregate/detail presentation for admin and advisor accounts and private-status presentation only for active student accounts.
  - Ensure the admin roster renders the attendance status contained in every `attendance_records` entry.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
  - Add page-level tests for the three role combinations and verify the timeline consumes the API payload without exposing advisor/admin attendance records to student accounts.
- `taskscope.md`
  - Replace the previous task definition with this exact twelve-section execution contract.

# 5. Out of Scope

- Do not create, update, approve, reject, or delete attendance records.
- Do not change `backend/src/club-attendance/`, `backend/src/attendance-sessions/`, attendance session opening/check-in behavior, QR behavior, proximity behavior, or academic-record synchronization.
- Do not change activity schedule creation, deletion, recurrence, registration, or cancellation behavior.
- Do not change database schemas, indexes, migrations, seed data, or stored user/student relationships.
- Do not expose attendance member details to student accounts.
- Do not expose email, phone number, authentication data, or fields outside the restricted projection listed in Section 4.
- Do not change the legacy club timeline under `frontend/src/app/(dashboard)/club/clubs/[clubId]/`.
- Do not change the dedicated schedule-management page at `frontend/src/app/(dashboard)/activities/schedule/page.tsx`.

# 6. Context & Dependencies

- `GET /activity-schedules/activity/:activityId/timeline` is implemented by `findActivityTimeline` in `backend/src/activity-schedules/activity-schedules.service.ts`.
- The current service selects either `student` or `staff` mode. Student mode returns `my_attendance`; staff mode already returns `attendance_records` with a `status` field for each member. Admin and teacher/advisor accounts may remain in staff mode.
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx` currently collapses admin and teacher/advisor into `isAdminOrAdvisor`; this matches their shared aggregate/detail capability, while active students retain a separate private-status capability.
- `frontend/src/components/activities/ActivityScheduleTimeline.tsx` already displays the personal status and an attendance-record count, but it does not provide an expandable member roster.
- The existing legacy `ClubScheduleTimeline.tsx` demonstrates the intended local expand/collapse pattern and attendance status labels; implementation may mirror its presentation logic without changing that legacy file.
- Role detection must continue using existing authenticated requester helpers on the backend and `isAdminUser`, `isTeacherRole`, and `isStudentRole` on the frontend.
- Admin does not require a private `my_attendance` status. The required admin status is the `status` value of each member inside `attendance_records`.
- Preserve unrelated uncommitted work and do not revert changes outside Section 4.

# 7. Steps — PLAN → EXECUTE → VERIFY → REFINE

## PLAN

1. Inspect the timeline service query, its role helpers, API response types, activity-detail role flags, and existing timeline tests; record the exact payload shape for `STUDENT`, `TEACHER`, and `ADMIN` requesters.
2. Define explicit presentation capabilities: `canViewAttendanceRoster`, `canViewOwnAttendance`, and `canUseAttendanceAction`; map advisor and admin to the roster capability and map active students to the own-status capability.

## EXECUTE

3. In `activity-schedules.service.ts`, retain the all-record query and restricted student population for teacher/advisor/admin viewers; ensure every mapped `attendance_records` entry includes its `status` and approval metadata.
4. In `activity-schedules.service.ts`, retain the current student-filtered query for student viewers and omit `attendance_records` from every student item.
5. In `activity-schedules.service.spec.ts`, add fixtures for teacher, admin, and student; assert the exact allowed and omitted fields for each role and assert each admin roster entry's `status`.
6. In `activity-api.ts`, keep admin and teacher/advisor on the staff response branch and ensure `StaffActivityAttendanceRecord.status` remains required.
7. In the activity-detail page, calculate distinct admin, advisor, and active-member flags, then pass explicit roster and personal-status capabilities to `ActivityScheduleTimeline`.
8. In `ActivityScheduleTimeline.tsx`, store expanded schedule IDs locally, add an `aria-expanded` button beside the real record count, and render the member detail list directly beneath the selected schedule metadata.
9. In `ActivityScheduleTimeline.tsx`, reuse a single status-label configuration for private badges and roster badges; include approval status, localized check-in time, and optional note in roster rows.
10. In the two frontend test files, add the three-role matrix, assert every admin roster member's status, exercise expand/collapse, and prove that student rendering contains no other member name or student code.

## VERIFY

11. Run the focused backend and frontend test commands in Section 9 and require all assertions to pass.
12. Run backend and frontend type/build checks, then inspect the scoped diff for payload leakage, unrelated changes, and invalid role combinations.

## REFINE

13. If a role-matrix test fails, change only the corresponding scoped role mapping, payload branch, or rendering condition; rerun the failed test followed by all focused tests.
14. If type checking finds another consumer of the timeline union or changed component props, preserve backward compatibility when possible; if another file must change, stop and add its exact path to Section 4 before editing it.
15. Stop after three PLAN → EXECUTE → VERIFY iterations and request direction with the failing command, relevant output, and scoped diff if the acceptance criteria remain unmet.

# 8. Acceptance Criteria

- A teacher/advisor schedule card displays `Đã điểm danh: N`, where `N` equals `attendance_records.length`, and provides an expand/collapse control for the roster.
- Expanded teacher/advisor details display each returned member's full name, student code, attendance status, approval status, check-in time when available, and note when available.
- An active student account displays only its own attendance status for each schedule and never receives or renders `attendance_records`, another member's name, or another member's student code.
- An admin account displays `Đã điểm danh: N`, expandable member details, and the attendance status of every member returned in `attendance_records`.
- An admin account does not require or display a private status for the admin identity.
- Empty staff/admin rosters display count `0` and `Không có dữ liệu điểm danh` after expansion.
- The backend response does not expose student email or fields outside the restricted projection in Section 4.
- Existing today-first ordering, `Hôm nay` highlighting, past-schedule fading, registration behavior, and today attendance action remain unchanged.
- Focused backend tests, focused frontend tests, backend build, frontend type check, and diff checks pass.

# 9. Verification Commands

Run from `D:\PROJECT\manager_points\backend`:

```powershell
npm test -- --runInBand src/activity-schedules/activity-schedules.service.spec.ts
npm run build
```

Run from `D:\PROJECT\manager_points\frontend`:

```powershell
npm test -- --runInBand src/components/activities/ActivityScheduleTimeline.test.tsx 'src/app/(dashboard)/activities/[activityId]/page.test.tsx'
npm run typecheck
```

Run from `D:\PROJECT\manager_points`:

```powershell
rg -n "attendance_records|my_attendance|Đã điểm danh|Trạng thái điểm danh|aria-expanded" backend/src/activity-schedules/activity-schedules.service.ts frontend/src/api/activity-api.ts frontend/src/components/activities/ActivityScheduleTimeline.tsx 'frontend/src/app/(dashboard)/activities/[activityId]/page.tsx'
git diff --check -- taskscope.md backend/src/activity-schedules/activity-schedules.service.ts backend/src/activity-schedules/activity-schedules.service.spec.ts frontend/src/api/activity-api.ts frontend/src/components/activities/ActivityScheduleTimeline.tsx frontend/src/components/activities/ActivityScheduleTimeline.test.tsx 'frontend/src/app/(dashboard)/activities/[activityId]/page.tsx' 'frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx'
git diff -- taskscope.md backend/src/activity-schedules/activity-schedules.service.ts backend/src/activity-schedules/activity-schedules.service.spec.ts frontend/src/api/activity-api.ts frontend/src/components/activities/ActivityScheduleTimeline.tsx frontend/src/components/activities/ActivityScheduleTimeline.test.tsx 'frontend/src/app/(dashboard)/activities/[activityId]/page.tsx' 'frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx'
git status --short
```

# 10. Safety Gates

- No Human Gate is required for the documented local read-only response and UI changes while risk remains `medium`.
- Trigger a Human Gate before production deployment, production configuration changes, database mutations, destructive attendance operations, authorization expansion beyond admin/teacher access already enforced by the endpoint, or changes outside Section 4.
- Stop and request clarification if implementation would require resolving a private attendance status for the admin identity; this task authorizes only per-member statuses from `attendance_records`.
- Stop and request approval if satisfying the requirement requires exposing additional personal fields or changing backend guards.
- Preserve `.env*` files and never print, modify, or transmit credentials or secrets.

# 11. Artifacts to Review

- Final diff for every file listed in Section 4.
- Focused backend service test output covering student, teacher/advisor, and admin payloads.
- Focused frontend test output covering the three-role presentation matrix and expand/collapse interaction.
- Backend build output and frontend type-check output.
- `git diff --check` and `git status --short` output.
- If a Human Gate is triggered, attach the exact expanded file list, proposed payload fields, affected roles/environment, reason, and relevant failing test or API evidence.

# 12. loop_iterations Override

- No override. Use the default `loop_iterations: 3` defined by `global.md` and `safety.md`.
