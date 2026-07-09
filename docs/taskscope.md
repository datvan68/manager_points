# 1. Task ID + Pipeline

- Task ID: `CLUB-REJECTION-UX-AND-REJOIN-GUARD-007`
- Pipeline: `feature_development`

# 2. Risk Level

- Risk level: `medium`
- Rationale: the task changes student membership authorization in `joinClub` and `switchClub`, plus student-facing registration states. An incorrect guard could allow a rejected student to rejoin or could block a valid administrator-directed transfer.

# 3. Objective

Make rejected club applications explicit to students when they open the rejected club, prevent student self-registration or self-service transfer back into that club during the same semester, and reduce club-card registration states to the three requested labels. Preserve the existing three-change self-service transfer limit and the administrator override.

# 4. Scope

Only the following files may be changed:

- `backend/src/clubs/clubs.service.ts`
  - Reject student `joinClub` requests when the existing membership for the target club and semester has status `rejected`.
  - Reject student `switchClub` requests when the target membership for the target club and semester has status `rejected`.
  - Preserve `adminTransferClub` as the direct administrator override that may reactivate a rejected target membership.
  - Preserve the existing per-student, per-semester count of completed `self_service` transfers and the maximum of three.
- `backend/src/clubs/clubs.service.spec.ts`
  - Add regression tests for rejected same-semester join and switch attempts.
  - Add an administrator-direct-transfer regression test for a rejected target membership.
  - Retain coverage proving that the fourth self-service transfer is rejected.
- `frontend/src/app/(dashboard)/club/clubs/membership-policy.ts`
  - Add an explicit rejected policy result with label `Bị từ chối` and `disabled: true`.
  - Preserve internal `JOIN`, `SWITCH`, `ADMIN_REQUIRED`, and `TEACHER_APPROVAL_REQUIRED` decisions while allowing the card layer to use the requested simplified labels.
- `frontend/src/app/(dashboard)/club/clubs/membership-policy.test.ts`
  - Add coverage for the rejected policy and verify that it cannot initiate registration or transfer.
  - Retain coverage for the three-change transfer limit.
- `frontend/src/app/(dashboard)/club/clubs/page.tsx`
  - Render only `Đăng ký tham gia`, `Đang chờ duyệt`, or `Bị từ chối` as student registration-state labels on club cards.
  - Render no registration-state button for the student's active club; the card remains navigable to its detail route.
  - Keep `Đăng ký tham gia` as the visible label for an eligible target club even when the click will execute the existing switch workflow.
  - Disable the `Bị từ chối` state so it cannot open either join or switch confirmation.
- `frontend/src/app/(dashboard)/club/clubs/page.test.tsx`
  - Test the three allowed card labels, the absence of a registration-state button for an active membership, and the disabled rejected state.
- `frontend/src/app/(dashboard)/club/clubs/[clubId]/page.tsx`
  - Detect the current student's `rejected` membership returned by `clubApi.getMyClubs()` when the club detail data loads.
  - Open a dismissible notification modal with the exact message `Bạn bị từ chối gia nhập CLB này.` when a student opens that rejected club.
  - Do not render the `Đăng ký` action for a rejected membership.
- `frontend/src/app/(dashboard)/club/clubs/[clubId]/page.test.tsx`
  - Test that opening a rejected club as a student displays the rejection modal and no `Đăng ký` action.
  - Test that dismissing the modal does not call `clubApi.joinClub`.

# 5. Out of Scope

- Do not add, remove, or migrate MongoDB collections, fields, or indexes.
- Do not persist or display a rejection reason; the modal uses only the required generic message.
- Do not change approval permissions for the assigned teacher or administrator.
- Do not change `adminTransferClub` authorization or its `admin_direct` audit mode.
- Do not change the definition of a consumed transfer: only completed `self_service` transfer records count toward the maximum of three.
- Do not count initial club registration, leaving a club, rejected transfers, teacher-approved transfers, or administrator-directed transfers toward the three-change limit.
- Do not block a new application in a later semester because a membership was rejected in an earlier semester.
- Do not change club schedules, attendance, notifications, favorites, card layout, detail tabs, or cover/statistics visibility.
- Do not modify API routes, DTOs, schemas, migrations, seed data, `.env*`, CI/CD configuration, or production infrastructure.
- Do not apply the rejected-membership restriction to administrator direct add/transfer operations.

# 6. Context & Dependencies

- `ClubMemberSchema` uniquely identifies a membership by `club_id`, `student_id`, and `semester_id`; therefore the rejected check must include all three identifiers.
- `clubApi.getMyClubs()` already supplies `membership.status`, and the list page already maps that value to `membership_status`; no API response contract change is required.
- `joinClub` currently reactivates both `left` and `rejected` records. Change this behavior so only `left` may be reused by student self-service; `rejected` must raise `ForbiddenException` before any membership or transfer save.
- `switchClub` currently reactivates any existing target membership. It must preflight the target membership and raise `ForbiddenException` before releasing the source membership when the target status is `rejected`.
- `adminTransferClub` intentionally reactivates an existing target membership and is the approved exception requested by the user.
- The transfer counter is already implemented by `countCompletedSelfServiceTransfers(studentId, semesterId)` with `{ mode: 'self_service', status: 'completed' }`. `switchClub` already blocks when the result is greater than or equal to `3`, and the service test suite already covers this condition.
- `ConfirmModal` is already imported by the club detail page and must be reused for the rejection notice; no new modal component is required.
- Existing uncommitted changes in the scoped club service and detail-page files must be preserved. Implementation must modify only the statements required by this scope.

# 7. Steps

## PLAN

1. In `backend/src/clubs/clubs.service.ts`, locate the existing target membership queries inside `joinClub` and `switchClub`; document the exact point at which each rejected-status guard will run before any `save()`, transaction start, or source-membership mutation.
2. In `frontend/src/app/(dashboard)/club/clubs/page.tsx`, identify every card renderer that calls `renderJoinButtonContent` and `isJoinButtonDisabled`, including grid and table variants, so all variants use the same three-label rule.
3. In `frontend/src/app/(dashboard)/club/clubs/[clubId]/page.tsx`, use the membership resolved by `findClubMembership(myMemberships, clubId)` as the single source for opening the rejection modal.

## EXECUTE

1. In `backend/src/clubs/clubs.service.ts`, change the `joinClub` existing-membership branch:
   - If `member.status === 'rejected'`, throw `ForbiddenException` with `Bạn đã bị từ chối gia nhập CLB này trong học kỳ hiện tại.`.
   - Continue to reject occupied or duplicate memberships with the existing duplicate error.
   - Permit only a `left` record to be reactivated through student self-service.
2. In `backend/src/clubs/clubs.service.ts`, add a `switchClub` preflight query for `{ club_id: targetClubId, student_id: studentId, semester_id: dto.semester_id }` after target-club validation and before `startSession()`. If its status is `rejected`, throw the same `ForbiddenException`; do not change the source membership or create a transfer record.
3. In `backend/src/clubs/clubs.service.ts`, leave `adminTransferClub` reactivation logic unchanged so an authenticated administrator can directly place the student into the previously rejected club.
4. In `frontend/src/app/(dashboard)/club/clubs/membership-policy.ts`, evaluate `targetMembershipStatus === 'rejected'` before the no-occupied-membership branch and return a disabled rejected result labelled `Bị từ chối`.
5. In `frontend/src/app/(dashboard)/club/clubs/page.tsx`, centralize the card-facing label mapping:
   - `pending` maps to `Đang chờ duyệt`.
   - `rejected` maps to `Bị từ chối`.
   - Eligible `none`, `left`, and `inactive` targets map to `Đăng ký tham gia`, including targets that internally use the switch workflow.
   - `active` renders no registration-state action.
   Apply the mapping to every grid and table card renderer and add rejected-state danger styling without enabling click handling.
6. In `frontend/src/app/(dashboard)/club/clubs/[clubId]/page.tsx`, add rejection-modal state. During `loadData`, set it to open only when the authenticated role is `student` and the resolved membership status is `rejected`.
7. In `frontend/src/app/(dashboard)/club/clubs/[clubId]/page.tsx`, render the existing `ConfirmModal` with title `Đăng ký bị từ chối`, message `Bạn bị từ chối gia nhập CLB này.`, a single dismissal action, and no callback to `clubApi.joinClub`.
8. In `frontend/src/app/(dashboard)/club/clubs/[clubId]/page.tsx`, remove `rejected` from the statuses that render the `Đăng ký` action.
9. Add the scoped backend and frontend regression tests described in Section 4.

## VERIFY

1. Run the targeted frontend policy, list-page, and detail-page test files.
2. Run the targeted backend club service test file.
3. Run frontend and backend production builds.
4. Run `git diff --check` and inspect the scoped diff to confirm no unrelated dirty-worktree changes were overwritten.

## REFINE

1. If a targeted test fails, change only the scoped implementation or its directly corresponding test fixture, rerun that targeted test, and then rerun all Verification Commands.
2. If either build fails because of a pre-existing error outside the scoped files, capture the exact command and error output in the handoff; do not change out-of-scope files.
3. Stop after three PLAN → EXECUTE → VERIFY → REFINE iterations and report the remaining failure without expanding scope.

# 8. Acceptance Criteria

1. When a student opens a club detail page whose membership status is `rejected` for that club and semester, a modal displays `Bạn bị từ chối gia nhập CLB này.`.
2. Dismissing the rejection modal performs no registration, transfer, approval, or navigation action.
3. The rejected club detail page does not render the `Đăng ký` action for the student.
4. Student-facing club cards display no registration-state text other than `Đăng ký tham gia`, `Đang chờ duyệt`, and `Bị từ chối`.
5. A card with `pending` membership is disabled and displays `Đang chờ duyệt`.
6. A card with `rejected` membership is disabled, displays `Bị từ chối`, and cannot open join or switch confirmation.
7. A card with `active` membership renders no registration-state button and still opens the club detail page through the card navigation.
8. Eligible target clubs display `Đăng ký tham gia` even when the existing policy selects the switch workflow.
9. `joinClub` returns HTTP 403 through `ForbiddenException` when the same student has a rejected membership for the same club and semester, with no membership or transfer mutation.
10. `switchClub` returns HTTP 403 through `ForbiddenException` when the target membership is rejected in the same semester, before the source membership is released and without creating a transfer.
11. A rejection from a different semester does not block registration in the current semester.
12. `adminTransferClub` can reactivate a rejected target membership and records the transfer as `admin_direct`.
13. Each completed pre-start self-service switch increments the per-student, per-semester counter by one; a student with three completed self-service switches cannot perform a fourth.
14. Initial registration, leaving, rejected or teacher-approval transfers, and administrator direct transfers do not increment the self-service counter.
15. All Verification Commands pass, except a demonstrably pre-existing out-of-scope build failure documented with its exact output.

# 9. Verification Commands

Run from `D:\PROJECT\manager_points`:

```powershell
npm test -- --run 'src/app/(dashboard)/club/clubs/membership-policy.test.ts' 'src/app/(dashboard)/club/clubs/page.test.tsx' 'src/app/(dashboard)/club/clubs/[clubId]/page.test.tsx'
npm test -- --runInBand clubs/clubs.service.spec.ts
npm run build
npm run build
git diff --check
git status --short
git diff -- backend/src/clubs/clubs.service.ts backend/src/clubs/clubs.service.spec.ts 'frontend/src/app/(dashboard)/club/clubs/membership-policy.ts' 'frontend/src/app/(dashboard)/club/clubs/membership-policy.test.ts' 'frontend/src/app/(dashboard)/club/clubs/page.tsx' 'frontend/src/app/(dashboard)/club/clubs/page.test.tsx' 'frontend/src/app/(dashboard)/club/clubs/[clubId]/page.tsx' 'frontend/src/app/(dashboard)/club/clubs/[clubId]/page.test.tsx'
```

Command working directories, in order:

- First command: `D:\PROJECT\manager_points\frontend`
- Second command: `D:\PROJECT\manager_points\backend`
- Third command: `D:\PROJECT\manager_points\frontend`
- Fourth command: `D:\PROJECT\manager_points\backend`
- Remaining commands: `D:\PROJECT\manager_points`

# 10. Safety Gates

- No Human Gate is required for local source and test changes under this medium-risk task.
- Stop and request approval using the Human Gate Request Schema from `.agents/Rules/safety.md` before any production deployment, production database migration, production infrastructure change, IAM or permission change, secret operation, merge into `main`, `master`, or `release/*`, remote branch deletion, or shared-history reset/rebase.
- Stop and request clarification before changing membership behavior across semesters, removing the administrator override, changing which transfer modes consume the three-attempt quota, or modifying a database schema.
- Do not run a migration, modify production data, or invoke deployment commands as part of this task.

# 11. Artifacts to Review

Attach the following if a Human Gate is triggered:

- `docs/taskscope.md`
- The scoped output of the final `git diff` command from Section 9
- Targeted frontend Vitest output
- Targeted backend Jest output
- Frontend and backend build output
- `git diff --check` output
- The proposed migration, deployment manifest, infrastructure diff, permission diff, or production command that triggered the gate

# 12. loop_iterations override (if any)

- No override. Use the default maximum of `3` iterations defined by `.agents/Rules/safety.md`.
