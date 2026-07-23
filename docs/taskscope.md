# Task Identity and Pipeline

Task: `activity-visibility-attendance-permission-selector`

Profile: Full

Pipeline: `feature_development`

Rule manifest: `3.2.0` (`safety.md` SHA-256 `6A3F283B...A772`, `global.md` `67806F70...A43F`, operating contract `51F3677C...1790`, orchestrator `B782109E...716`, pipeline `0419C072...41F3`).

Repository: `D:\PROJECT\manager_points`

Base state: branch `main`, commit `d85526acd0d6c221fff6f46888b8328e139f79c5`. At preflight, the only worktree change was the requested `docs/taskscope.md`, whose previous tracked scope had been removed and whose working-tree file was empty.

Authority: planning only. This scope does not authorize implementation, migration, deployment, or production mutation.

# Risk Level

Risk: high.

The change crosses frontend and backend activity modules, changes an authenticated read boundary, and changes server-authoritative attendance permissions persisted per activity and teacher. Incorrect implementation could expose inactive activities or member rosters, grant a non-teacher attendance access, or let UI state diverge from backend enforcement. Development code is Git-reversible. No data backfill is intended.

# Objective

Make every authenticated account able to see and open an activity card when `settings.require_registration_for_attendance` is `false`, subject to the existing public lifecycle rules. In the Attendance tab, replace the per-teacher card/checkbox grant layout with one teacher selector and three independently confirmed buttons for QR, GPS, and manual-class attendance. An active TEACHER account with no explicit per-activity override receives `manual_class` by default from the backend.

# Scope Boundaries

Approved backend boundaries:

- `backend/src/activities/**`
- `backend/src/attendance-sessions/**` for permission-regression tests or a required server-authoritative integration adjustment only
- `backend/test/activities.e2e-spec.ts`
- Read-only dependencies: `backend/src/auth/schemas/user.schema.ts`, `backend/src/auth/schemas/role.schema.ts`, `backend/src/auth/strategies/jwt.strategy.ts`, and `backend/src/classes/schemas/class.schema.ts`

Known backend write targets:

- `backend/src/activities/activities.controller.ts`
- `backend/src/activities/activities.service.ts`
- `backend/src/activities/activity-attendance-grants.service.ts`
- `backend/src/activities/dto/activity-attendance-grant.dto.ts`
- `backend/src/activities/schemas/activity-attendance-grant.schema.ts` only if the explicit empty override cannot be represented without an additive schema change
- `backend/src/activities/activities.controller.spec.ts`
- `backend/src/activities/activities.service.spec.ts`
- `backend/src/activities/activity-attendance-grants.service.spec.ts` (new)
- `backend/src/attendance-sessions/attendance-sessions.service.spec.ts`

Approved frontend boundaries:

- `frontend/src/api/activity-api.ts`
- `frontend/src/api/activity-api.test.ts`
- `frontend/src/app/(dashboard)/activities/page.tsx`
- `frontend/src/app/(dashboard)/activities/page.test.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- `frontend/src/components/activities/ActivityListWorkspace.tsx`
- `frontend/src/components/activities/ActivityListWorkspace.test.tsx`
- `frontend/src/components/activities/ActivityCard.tsx`
- `frontend/src/components/activities/ActivityCard.test.tsx`
- `frontend/src/components/attendance/AttendanceGrantManager.tsx`
- `frontend/src/components/attendance/AttendanceGrantManager.test.tsx` (new)
- `frontend/src/hooks/useAttendanceSession.ts`
- `frontend/src/hooks/useAttendanceSession.test.ts` (new if page coverage cannot prove capability-driven manager behavior)

Excluded boundaries: production data, deployment configuration, global role/permission definitions, unrelated activity forms, schedule creation, training-point rules, and non-activity attendance contexts.

# Out of Scope

- Anonymous/public access; “all accounts” means authenticated application accounts.
- Showing inactive, soft-deleted, cancelled, or draft activities to ordinary accounts when existing lifecycle policy hides them.
- Relaxing member-roster, member-management, schedule-management, activity-edit, or activity-delete authorization.
- Changing the single `activity.advisor_id` rule.
- Giving a teacher access to another teacher’s homeroom class.
- Redesigning QR/GPS check-in, the manual student grid, attendance concurrency, SSE transport, or training-point synchronization.
- Creating one default grant document for every teacher/activity pair.
- Adding a package, external queue, database backfill, or production index operation.

# Context and Dependencies

- `GET /activities` currently uses `checkPermission('ACTIVITY_READ')`; an authenticated account without that permission cannot reach `ActivitiesService.findAll`.
- `ActivitiesService.findAll` currently restricts TEACHER accounts to their own `advisor_id` and has no `require_registration_for_attendance=false` visibility branch.
- `findOne` calls `ensureActivityReadAccess`, and that helper is also used by `findMembers`. Open-activity detail access must be separated from roster authorization so the visibility exception does not expose members.
- The frontend activities page additionally hides other clubs after a student has one active club. This client filter currently hides no-registration clubs and must retain them.
- `ActivityCard` already hides its registration button for a no-registration activity. Table/list behavior and visibility tests must remain consistent with that setting.
- The existing grant model is unique by `(activity_id, teacher_id)`, stores `allowed_methods`, status, and audit actors/timestamps. Existing explicit records remain authoritative.
- The current candidate endpoint returns class rows, so one teacher can appear more than once and a non-TEACHER class advisor can pass the present eligibility check. The revised contract must derive candidates from active User records whose populated role code is exactly `TEACHER`, returning one option per account; class names may be supplemental display data.
- Default permission semantics are: no explicit record => `['manual_class']` for an active TEACHER; active explicit record => exactly its stored method set, including an explicit empty set; revoked record => no delegated methods. Admin and the assigned activity advisor retain inherent QR, GPS, and manual-class access.
- A default is overridable. This preserves the three-button control: Admin/advisor may turn manual-class off for a selected teacher, and that explicit choice must not be replaced by the implicit default.
- A teacher may show `manual_class` as confirmed by default without owning a class, but opening or writing a manual-class session still requires `assertOwnClass`; the capability response returns no selectable classes in that case.
- Server capabilities and method assertions are authoritative. The frontend must not infer a default from a local role string.
- Existing QR/GPS/manual session paths already delegate to `assertMethod`; affected tests must prove direct API calls cannot bypass the selected method state.
- No new dependency is required.

# Steps

1. Define a visibility predicate for a lifecycle-visible activity with `require_registration_for_attendance=false`. Apply it to the authenticated list query and activity-detail read path while preserving the stricter roster/member helper.
2. Replace the list route’s unconditional `ACTIVITY_READ` gate with authenticated access plus service-level role/permission filtering. Preserve all existing list access for Admin, assigned advisors, and authorized roles; add only the no-registration exception for other authenticated accounts.
3. Update the frontend student/other-role list filter so no-registration activities are never removed by the single-active-club presentation rule. Keep search/type grouping and lifecycle behavior unchanged.
4. Replace class-row grant candidates with unique active TEACHER accounts, validate the target’s database role again on every grant mutation, and optionally return class summary labels without using class ownership as proof of teacher role.
5. Implement the implicit `manual_class` default and explicit-override semantics consistently in candidate state, grant listing, capabilities, `assertMethod`, upsert, and revoke behavior. Support an explicit empty method set without materializing defaults or requiring a backfill.
6. Keep Admin/assigned-advisor grant administration and inherent methods unchanged. Reject grant mutation by delegated teachers, presidents, students, and other roles.
7. Change the grant UI to one searchable, scrollable teacher select. After selection, render exactly three buttons: `QR`, `GPS`, and `Lớp thủ công`.
8. Make each method button an accessible toggle with `aria-pressed`, clear confirmed/unconfirmed styling, and immediate persistence of the complete canonical method set. Serialize mutations per selected teacher, reconcile from the server response, prevent stale double-click overwrites, and restore the last confirmed state with an inline error on failure.
9. Use capability `effective_methods` as the source for the teacher’s Attendance-tab methods and manager data path. Remove local method defaults while preserving the separately defined president behavior.
10. Add authorization, visibility, default/override, role-validation, selector, toggle, pending/error, and API contract tests. Repair only scoped stale test setup required to execute those tests.
11. Perform independent authorization/privacy review, then run focused tests, affected builds/static checks, and final diff/status validation.

# Acceptance Criteria

- `VIS-1`: Every authenticated role receives each lifecycle-visible activity whose `require_registration_for_attendance` value is `false`, even when the requester is not its advisor/member and lacks `ACTIVITY_READ`.
- `VIS-2`: A student with an active club still sees every lifecycle-visible no-registration activity card, including another club.
- `VIS-3`: The same requester can open the no-registration activity detail, but cannot read its member roster or use staff management endpoints without the pre-existing authorization.
- `VIS-4`: The exception does not expose inactive, soft-deleted, cancelled, or draft activities beyond existing policy and does not broaden registration-required activity visibility.
- `GRANT-1`: The grant selector contains each active TEACHER account once and excludes student, admin-only, inactive/locked, and non-TEACHER class-advisor accounts.
- `GRANT-2`: Only Admin or the activity’s assigned advisor can view administrative grant state and mutate the three attendance permissions.
- `GRANT-3`: With no explicit grant record, a TEACHER capability response and server method assertion allow `manual_class` and deny QR/GPS.
- `GRANT-4`: An active explicit override, including an empty set, is authoritative; a revoked override grants no delegated method. Existing explicit grants are not silently rewritten.
- `GRANT-5`: Manual-class session opening and marking remain limited to a class currently advised by the requesting teacher.
- `UI-1`: “Phân quyền điểm danh” shows one teacher select and exactly three method buttons, not per-teacher cards or checkboxes.
- `UI-2`: Selecting a teacher displays the backend-effective state; manual-class is confirmed for a teacher with no explicit override.
- `UI-3`: Pressing one method button persists the full next method set once, shows pending state, reconciles the response, and cannot lose an adjacent rapid update.
- `UI-4`: A failed mutation retains the prior confirmed state and exposes an accessible error without clearing the teacher selection.
- `AUTH-1`: A direct API call cannot grant a method to a non-TEACHER or use a method absent from the backend-effective set.
- `REG-1`: Existing advisor/Admin inherent access, explicit grants, president policy, registration-required cards, QR/GPS operation, manual own-class checks, and activity realtime refresh remain compatible.

# Verification

Backend focused tests:

```text
D:\PROJECT\manager_points\backend :: npm test -- --runInBand activities/activities.service.spec.ts activities/activities.controller.spec.ts activities/activity-attendance-grants.service.spec.ts attendance-sessions/attendance-sessions.service.spec.ts attendance-sessions/attendance-sessions.controller.spec.ts
```

Expected: visibility and privacy matrix, active-TEACHER validation, implicit manual default, explicit empty/revoked overrides, direct method enforcement, and existing session behavior pass. The preflight baseline had five existing failures in `activities.controller.spec.ts` because its test module omitted `ActivitiesRealtimeService`; the scoped verification must update that stale mock setup before results can be considered green.

Backend integration and build:

```text
D:\PROJECT\manager_points\backend :: npm run test:e2e -- --runInBand activities.e2e-spec.ts
D:\PROJECT\manager_points\backend :: npm run build
```

Expected: authenticated no-permission role can list/open only eligible no-registration activities, protected member access remains denied, and Nest/TypeScript build succeeds. If the configured test database is unavailable, record the environmental failure and retain the unit authorization matrix; do not point the test at production data.

Frontend focused tests:

```text
D:\PROJECT\manager_points\frontend :: npm test -- "src/components/attendance/AttendanceGrantManager.test.tsx" "src/api/activity-api.test.ts" "src/app/(dashboard)/activities/page.test.tsx" "src/app/(dashboard)/activities/[activityId]/page.test.tsx"
```

Expected: role/card visibility, teacher selection, the three buttons, default manual state, serialized mutation, server reconciliation, capability-driven method display, and error handling pass.

Frontend affected checks:

```text
D:\PROJECT\manager_points\frontend :: npm run typecheck -- --incremental false
D:\PROJECT\manager_points\frontend :: npm run build
```

Expected: no scoped TypeScript or Next.js build failure. Preflight typecheck already had unrelated failures in grading, permissions, students, system, and `MaintenanceGuard`; distinguish those exact pre-existing failures from introduced failures rather than editing them outside scope.

Final repository checks:

```text
D:\PROJECT\manager_points :: git diff --check
D:\PROJECT\manager_points :: git status --short
```

Expected: clean diff formatting, only approved paths changed, and unrelated user work preserved.

# Safety Gates

- No Human Gate is required for development implementation and test-only data in the repository’s isolated test environment.
- Human approval is required before production deployment, persistent-data migration/backfill, production index application, or mutation of production data.
- The planned implicit default and explicit empty override require no backfill. If implementation proves that a schema migration, bulk grant creation, role/permission mutation, or new infrastructure is necessary, stop with a reviewed design and request a scope amendment plus the applicable approval.
- Rollback before deployment: revert the scoped code. Existing grant documents remain readable because their method arrays and statuses stay authoritative.

# Artifacts and Checkpoints

- `CP-0`: base commit `d85526acd0d6c221fff6f46888b8328e139f79c5`, rule manifest `3.2.0`, and this approved planning artifact.
- `CP-1`: reviewed backend visibility predicate, normalized grant contract, authorization matrix, focused test result, and backend diff hash.
- `CP-2`: frontend selector/toggle integration, focused test/static-check results, independent review findings, and final diff hash.
- Store long test/build output outside `taskscope.md`; execution reporting references only commands actually run, concise failures, and artifact hashes.

# Execution Budgets

- One writer per path; serialize backend API/type ownership before frontend integration.
- Backend visibility and grant contracts precede UI mutation. Read-only review may run independently after the implementation checkpoint.
- Maximum three implementation/verification loops, two review-remediation cycles, and two retries for idempotent commands.
- Default step deadline: 600 seconds; maximum bounded step deadline: 1,800 seconds.
- Stop for broader lifecycle changes, member-data exposure, role/permission mutation, new dependency/infrastructure, migration/backfill, production action, authorization ambiguity, or unrelated dirty-path overlap.
