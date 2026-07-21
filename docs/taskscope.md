# 1 Task Identity and Pipeline

- Task ID: `activities-teacher-completion-scope-20260721`
- Protocol version: `3.0`
- Pipeline version: `3.0.0`
- Selected pipeline: `feature_development`
- Repository: `D:\PROJECT\manager_points`
- Branch: `main`
- Base commit SHA: `620ca151f927b1b57e955d9afea8e0297016d3eb`
- Environment: development
- Authorization: planning only. This scope-writing turn does not authorize implementation, tests that mutate repository outputs, database changes, deployment, or any product-code modification.

# 2 Risk Level

- Risk: `medium`.
- Environment evidence: the planned work is limited to development source and test code.
- Persistent-data evidence: the completion path uses existing `AcademicRecord`, `ActivityCompletionAward`, attendance-session, and check-in collections at runtime, but this task introduces no schema migration, backfill, repair, or direct data mutation.
- Security evidence: authorization changes affect member-roster and attendance data. Incorrect ownership checks could disclose student attendance information or grant session-management capability to an unrelated teacher.
- Infrastructure and deployment evidence: no infrastructure, CI/CD, container, environment-file, or deployment change is in scope.
- Reversibility: source and test changes can be reverted. No database rollback is required because migrations and backfills are excluded.
- Blast radius: activity detail, member roster, activity schedule timeline, attendance HTTP/SSE access, and activity-completion recognition only; unrelated modules and global RBAC behavior remain unchanged.

# 3 Objective

Deliver a verified implementation plan that preserves proportional activity-completion recognition and adds ownership-scoped teacher access to activity detail: for a completion minimum of 3 approved attended sessions, counts 0–2 produce 0 recognitions, 3–5 produce 1, and 6 produce 2; a teacher is assigned only when `user.id === activity.advisor_id`, and that assigned teacher receives the student-like detail plus the `Members` and `Attendance` tabs without admin-only logo, completion-rule, or configuration controls.

# 4 Scope Boundaries

## approved_boundaries

- `backend/src/activity-attendance/**`
- `backend/src/activities/**`
- `backend/src/activity-schedules/**`
- `backend/src/attendance-sessions/**`
- `backend/test/activities.e2e-spec.ts`
- `frontend/src/app/(dashboard)/activities/[activityId]/**`
- `frontend/src/components/activities/**`
- `frontend/src/api/activity-api.ts`
- `frontend/src/utils/role.util.ts`
- `docs/taskscope.md`

## write_boundaries

- `backend/src/activity-attendance/activity-completion.service.spec.ts` — optional new focused unit-test file; create only if isolated service coverage is more deterministic than extending the existing E2E fixture.
- `backend/test/activities.e2e-spec.ts`
- `backend/src/activities/activities.controller.ts`
- `backend/src/activities/activities.service.ts`
- `backend/src/activities/activities.service.spec.ts`
- `backend/src/activity-schedules/activity-schedules.service.ts`
- `backend/src/activity-schedules/activity-schedules.service.spec.ts`
- `backend/src/attendance-sessions/attendance-sessions.service.ts`
- `backend/src/attendance-sessions/attendance-realtime.service.ts`
- `backend/src/attendance-sessions/attendance-sessions.module.ts`
- `backend/src/attendance-sessions/attendance-sessions.service.spec.ts`
- `backend/src/attendance-sessions/attendance-realtime.service.spec.ts`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`
- `docs/taskscope.md`

## known_files_and_symbols

- `backend/src/activity-attendance/activity-completion.service.ts` :: `checkAndAwardCompletion`
- `backend/src/activity-attendance/schemas/activity-completion-award.schema.ts` :: `ActivityCompletionAwardSchema`
- `backend/src/activities/activities.controller.ts` :: `findOne`, `findMembers`
- `backend/src/activities/activities.service.ts` :: `findOne`, `findMembers`, `approveMember`, `isAdvisorOrPresident`
- `backend/src/activity-schedules/activity-schedules.service.ts` :: `findActivityTimeline`
- `backend/src/attendance-sessions/attendance-sessions.service.ts` :: `validateMembership`, `isManager`, `ensureManager`, `getActiveSession`, `getCheckins`
- `backend/src/attendance-sessions/attendance-realtime.service.ts` :: `resolveAccess`
- `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx` :: role/ownership flags, allowed tabs, attendance capabilities, and detail controls
- `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx` :: student/admin/teacher activity-detail scenarios

## discovery_rule

Workers may add a discovered path to the execution manifest only when it is inside an approved boundary, is required for an acceptance criterion, does not increase risk, and does not alter excluded behavior. Crossing an approved boundary, adding a dependency, changing global permissions, or introducing a migration requires a scope amendment before mutation. Generated outputs under `backend/dist/**` and `frontend/.next/**` must be regenerated by repository tools and never hand-edited.

# 5 Out of Scope

- Global role or permission redesign, including broad assignment of `ACTIVITY_*` permissions to the seeded `TEACHER` role.
- New member mutation authority. The assigned-teacher `Members` tab provides the roster; existing add, approve, update, remove, and batch-delete authorization remains unchanged unless a listed acceptance criterion cannot be met without a separately approved amendment.
- Changes to completion-rule configuration fields, criteria selection, award quantities, academic-record scoring, or unrelated completion semantics.
- Database schema changes, index changes, migrations, data repair, backfills, or production-data reconciliation.
- Infrastructure, deployment, Docker, CI/CD, IAM, secrets, `.env*`, or external-service configuration.
- Refactoring unrelated activity, attendance, student, grading, or authentication code.
- Hand-editing `backend/dist/**`, `frontend/.next/**`, `frontend/next-env.d.ts`, or other generated output.

# 6 Context and Dependencies

## Verified facts

- `ActivityCompletionService.checkAndAwardCompletion` counts approved `present`/`late` attendance and currently calculates `Math.floor(attendanceCount / rule.minimum_attendance)`.
- The first earned unit creates the base completion `AcademicRecord`; later units use sequence idempotency keys. `ActivityCompletionAward` remains a single marker per activity/student/criterion while recognitions are represented by active academic records.
- Existing E2E coverage verifies only one threshold and one-unit idempotency; it does not directly prove 3→1 and 6→2 behavior.
- The activity detail currently defines every teacher as an advisor in the UI through role alone, while attendance-session management recognizes only administrators and active presidents.
- `findActivityTimeline` currently returns staff attendance data to any teacher or supervisor without checking `activity.advisor_id`.
- Activity member-list access is guarded by global `ACTIVITY_READ` and is not ownership-scoped in the service.
- Attendance HTTP and SSE paths use separate access resolvers and must apply the same ownership decision.
- The seeded `TEACHER` role currently has `STUDENT_READ`, `GRADING_PAGE`, and `STUDENT_PAGE`, not broad activity permissions.
- Backend runtime persistence uses MongoDB configured by credential/configuration name `MONGO_URI`; no secret value is required in artifacts or logs.
- Backend is NestJS/Mongoose with Jest; frontend is Next.js with Vitest. Package locks already exist and no dependency change is needed.

## User constraints and resolved implementation decisions

- Assigned teacher means exactly that the authenticated user ID, normalized from the existing auth payload, equals the activity's `advisor_id`: `user.id === activity.advisor_id` after entity-ID normalization.
- An assigned teacher receives the student-like activity detail plus `Members` and `Attendance` tabs.
- An assigned teacher does not receive admin-only logo controls, completion-rule/configuration controls, or unrelated administrator metadata.
- An unrelated teacher remains student-like/restricted and cannot access a staff roster or manage attendance sessions for the activity.
- Ownership must be enforced consistently server-side for the member list, schedule staff timeline, attendance HTTP endpoints, and attendance SSE stream. Frontend tab hiding is not an authorization boundary.
- Ownership-based endpoint checks must not depend solely on broad global `ACTIVITY_*` permissions. No global permission redesign is in scope.
- Existing administrator, active-president, and student behavior must be preserved.

## Dependency edges

- Activity-detail ownership depends on the authenticated user ID and the populated or normalized `Activity.advisor_id`.
- Attendance session and realtime services need access to the same activity ownership fact; if the `Activity` model is injected directly, `backend/src/attendance-sessions/attendance-sessions.module.ts` must register it.
- Schedule staff-view authorization depends on resolving the activity before returning populated attendance records.
- Completion verification depends on approved attendance rows, the configured semester/rule/criteria, and idempotent academic-record creation.

## Unresolved product decisions

- None. The requested access model and ownership definition are fixed above.

# 7 Steps — PLAN, EXECUTE, VERIFY, REFINE

## PLAN

1. Boundary: approved backend/frontend paths. Targets: current Git state and all known symbols. Owner: `code-agent`. Dependency: this scope and base commit. Before: discovery evidence is read-only. After: record a manifest of exact touched paths, confirm no overlapping dirty changes, and capture focused test baselines. Artifact: `output/tasks/activities-teacher-completion-scope-20260721/plan-manifest.json`.
2. Boundary: activity-completion tests. Targets: `checkAndAwardCompletion`, existing E2E fixture, and optional new unit spec. Owner: `test-agent`. Dependency: PLAN step 1. Before: only one earned unit is asserted. After: select the smallest deterministic test location for floor and idempotency cases without changing production behavior. Artifact: `output/tasks/activities-teacher-completion-scope-20260721/completion-test-design.json`.
3. Boundary: activity ownership paths. Targets: member list, schedule timeline, attendance service, realtime service, and detail page. Owner: `code-agent`. Dependency: PLAN step 1. Before: role-wide teacher UI/staff timeline and president-only attendance management. After: define one consistent assigned-advisor decision and map it to each HTTP/SSE/UI consumer. Artifact: `output/tasks/activities-teacher-completion-scope-20260721/access-matrix.json`.

## EXECUTE

1. Boundary: activity-completion test write paths. Targets: optional `backend/src/activity-attendance/activity-completion.service.spec.ts` and/or `backend/test/activities.e2e-spec.ts`. Owner: `test-agent`. Dependency: completion test design. Before: 3→1 and 6→2 are unproven. After: deterministic tests assert 0–2→0, 3–5→1, 6→2 and repeated evaluation produces no duplicate active recognitions. Artifact: focused test diff.
2. Boundary: `backend/src/activities/**`. Targets: member-list controller/service request context and ownership checks. Owner: `code-agent`. Dependency: access matrix. Before: global permission alone can expose the roster. After: administrators and the assigned teacher can retrieve the roster for management display; unrelated teachers cannot. Preserve existing student and president behavior explicitly covered by tests. Artifact: backend activity diff.
3. Boundary: `backend/src/activity-schedules/**`. Target: `findActivityTimeline`. Owner: `code-agent`. Dependency: access matrix. Before: any teacher receives staff attendance records. After: staff roster mode is limited to existing authorized administrators/supervisors and the assigned teacher according to the preserved role rules; unrelated teachers receive only the restricted/student-like representation or a forbidden result consistent with the existing endpoint contract. Artifact: schedule diff.
4. Boundary: `backend/src/attendance-sessions/**`. Targets: HTTP manager/member resolution, SSE access resolution, and model registration if needed. Owner: `code-agent`. Dependency: activity ownership decision. Before: assigned teachers cannot manage sessions and unrelated teachers can encounter inconsistent access across HTTP/SSE. After: the assigned teacher is a manager for the owned activity, unrelated teachers are denied manager/roster data, and admin/president/student behavior is unchanged. Artifact: attendance diff.
5. Boundary: `frontend/src/app/(dashboard)/activities/[activityId]/**`. Targets: ownership normalization, tab allowlist, roster/timeline props, attendance capability, and control visibility. Owner: `code-agent`. Dependency: backend access contract. Before: all teachers are treated as advisors and assigned teachers still cannot manage attendance. After: only the assigned teacher gets student-like detail plus `Members` and `Attendance`; admin-only logo/rule/config controls remain hidden for teachers; unrelated teachers remain restricted. Artifact: frontend diff.
6. Boundary: listed backend/frontend test files. Owner: `test-agent`. Dependency: EXECUTE steps 2–5. Before: ownership cases are incomplete or encode role-wide teacher access. After: tests cover assigned teacher success, unrelated teacher denial, HTTP/SSE consistency, and unchanged admin/president/student behavior. Artifact: test diff and focused results.

## VERIFY

1. Run the focused completion test and map results to AC-001 and AC-002. Owner: `test-agent`. Artifact: `output/tasks/activities-teacher-completion-scope-20260721/verify-completion.txt`.
2. Run focused ownership, schedule, attendance HTTP/SSE, and frontend detail tests and map results to AC-003 through AC-007. Owner: `test-agent`. Artifact: `output/tasks/activities-teacher-completion-scope-20260721/verify-access.txt`.
3. Run affected backend/frontend package tests, static checks, and builds in the order listed in section 9. Owner: `test-agent`. Artifact: `output/tasks/activities-teacher-completion-scope-20260721/verify-affected.txt`.
4. Review the final diff and status for boundary compliance, generated output, encoding/line-ending-only changes, secrets, unintended permission changes, and missing tests. Owner: `review-agent`. Dependency: all verification passes. Artifact: `output/tasks/activities-teacher-completion-scope-20260721/review.json`.

## REFINE

1. On a concrete verification failure caused by the scoped change, the owning writer may apply the smallest correction inside the existing write boundary and rerun the failed check plus directly affected checks. Maximum implement ENG iterations: 3.
2. Review-requested corrections return to the relevant EXECUTE owner, remain inside approved boundaries, and rerun focused and affected verification. Maximum review remediation cycles: 2.
3. Stop instead of refining when resolution requires a global permission redesign, migration/backfill, dependency addition, deployment, external mutation, scope expansion, or conflict with unrelated user changes.

# 8 Acceptance Criteria

- `AC-001` — With `minimum_attendance = 3`, approved `present`/`late` attendance counts 0, 1, and 2 yield 0 active recognitions; counts 3, 4, and 5 yield exactly 1; count 6 yields exactly 2 for each configured criterion.
- `AC-002` — Re-evaluating the same attendance set does not duplicate active completion `AcademicRecord` rows or the `ActivityCompletionAward` marker.
- `AC-003` — A teacher with normalized authenticated `user.id` equal to normalized `activity.advisor_id` sees the student-like detail plus `Members` and `Attendance`, and does not see teacher-inappropriate admin-only logo, completion-rule, or configuration controls.
- `AC-004` — A teacher not assigned to the activity remains student-like/restricted, cannot retrieve the staff member/attendance roster, and cannot open, inspect as manager, close, or subscribe to manager-level attendance-session data.
- `AC-005` — The assigned teacher can retrieve the activity member roster and can open, observe through HTTP/SSE, and close attendance sessions for the owned activity, subject to existing schedule/session validation.
- `AC-006` — Existing administrator and active-president attendance-management capabilities continue to pass their focused tests.
- `AC-007` — Existing student behavior remains restricted to student-facing detail and the student's own attendance/check-in data; no member roster or manager-level attendance payload is exposed.
- `AC-008` — Focused tests, affected-package tests, non-mutating static checks, builds, final diff review, and repository-status review pass with no out-of-scope or hand-edited generated files.

# 9 Verification Commands

Run in this order. Long output must be saved in the planned verification artifacts with secrets redacted.

1. Working directory: `D:\PROJECT\manager_points\backend`
   Command: `npm test -- --runInBand activity-completion.service.spec.ts`
   Expected: the optional focused unit spec passes. If PLAN selects only the existing E2E fixture and the optional file is not created, record this command as not applicable and use command 3 for AC-001/AC-002.
2. Working directory: `D:\PROJECT\manager_points\backend`
   Command: `npm test -- --runInBand activities.service.spec.ts activity-schedules.service.spec.ts attendance-sessions.service.spec.ts attendance-realtime.service.spec.ts`
   Expected: assigned/unrelated teacher, admin, president, student, and HTTP/SSE authorization cases pass.
3. Working directory: `D:\PROJECT\manager_points\backend`
   Command: `npm run test:e2e -- --runInBand test/activities.e2e-spec.ts`
   Expected: activity completion and activity integration scenarios pass against the isolated test MongoDB.
4. Working directory: `D:\PROJECT\manager_points\backend`
   Command: `npm exec eslint -- "src/activity-attendance/**/*.ts" "src/activities/**/*.ts" "src/activity-schedules/**/*.ts" "src/attendance-sessions/**/*.ts" --no-fix`
   Expected: exit code 0 without modifying files.
5. Working directory: `D:\PROJECT\manager_points\backend`
   Command: `npm run build`
   Expected: NestJS build succeeds; generated `dist/**` is excluded from the reviewed source diff.
6. Working directory: `D:\PROJECT\manager_points\frontend`
   Command: `npm test -- "src/app/(dashboard)/activities/[activityId]/page.test.tsx"`
   Expected: assigned teacher, unrelated teacher, admin, president, and student detail behavior passes.
7. Working directory: `D:\PROJECT\manager_points\frontend`
   Command: `npm test`
   Expected: all frontend Vitest tests pass.
8. Working directory: `D:\PROJECT\manager_points\frontend`
   Command: `npm run typecheck`
   Expected: TypeScript exits successfully without emitted source artifacts.
9. Working directory: `D:\PROJECT\manager_points\frontend`
   Command: `npm run build`
   Expected: Next.js production build succeeds; generated `.next/**` and `next-env.d.ts` changes are excluded from the reviewed source diff unless the generator requires a tracked update.
10. Working directory: `D:\PROJECT\manager_points`
    Command: `git diff --check`
    Expected: no whitespace errors.
11. Working directory: `D:\PROJECT\manager_points`
    Command: `git status --short`
    Expected: only approved source/test/documentation paths are changed; unrelated pre-existing changes are preserved and reported.

# 10 Safety Gates

- No Human Gate is currently triggered because this is planning-only development work with no implementation, migration, persistent-data mutation, deployment, secret operation, IAM change, destructive action, shared-history change, or merge.
- Stop and request a scope amendment before crossing an approved boundary, changing global role permissions, adding a dependency, introducing a schema/index change, or changing excluded behavior.
- A Human Gate is required before any future staging/production deployment, database/schema mutation, migration/backfill, secret or IAM operation, material destructive action, production-affecting CI/CD change, merge into a protected branch, shared-history rewrite, or remote-branch deletion.
- For any future gate, the executor must provide the exact action, environment, impact, risk, reviewed artifacts with SHA-256, rollback evidence, and resume point. Gates remain outside ENG and review-remediation loops.

# 11 Artifacts and Checkpoints

All execution artifacts below are planned and have not been produced by this planning-only turn. Their SHA-256 is therefore not applicable until execution; the producing step must calculate and record it after writing each artifact.

- `docs/taskscope.md` :: producer `synthesize_scope` :: authoritative approved plan :: SHA-256 calculated after this document is finalized :: required for execution resume.
- `output/tasks/activities-teacher-completion-scope-20260721/plan-manifest.json` :: producer `PLAN.1` :: base state, touched-path manifest, and dirty-state evidence :: not yet produced; SHA-256 not applicable until execution :: required for resume.
- `output/tasks/activities-teacher-completion-scope-20260721/completion-test-design.json` :: producer `PLAN.2` :: selected completion-test location and matrix :: not yet produced; SHA-256 not applicable until execution :: required for test-step resume.
- `output/tasks/activities-teacher-completion-scope-20260721/access-matrix.json` :: producer `PLAN.3` :: role/ownership/API/UI access matrix :: not yet produced; SHA-256 not applicable until execution :: required for implementation resume.
- `output/tasks/activities-teacher-completion-scope-20260721/verify-completion.txt` :: producer `VERIFY.1` :: completion command, exit status, and results :: not yet produced; SHA-256 not applicable until execution :: required for final verification.
- `output/tasks/activities-teacher-completion-scope-20260721/verify-access.txt` :: producer `VERIFY.2` :: access command, exit status, and results :: not yet produced; SHA-256 not applicable until execution :: required for final verification.
- `output/tasks/activities-teacher-completion-scope-20260721/verify-affected.txt` :: producer `VERIFY.3` :: package/static/build evidence :: not yet produced; SHA-256 not applicable until execution :: required for final verification.
- `output/tasks/activities-teacher-completion-scope-20260721/review.json` :: producer `VERIFY.4` :: reviewer verdict and scope/security checks :: not yet produced; SHA-256 not applicable until execution :: required for completion.

Every execution checkpoint must record the base and current commit SHA, task ID, input/taskscope SHA-256, scope version, pipeline version, step ID and status, branch/worktree identity, artifact URIs and hashes, acceptance-criterion status, retry/ENG/remediation counters, and approval references when applicable. A commit, scope, pipeline, or artifact hash mismatch is stale state and must stop mutation pending rediscovery.

# 12 Execution Budgets

- Per-step deadline: 600 seconds.
- Pipeline deadline: 3600 seconds.
- Concurrency: at most 2 read-only workers; at most 1 writer per path; overlapping writes are serialized.
- Idempotent tool/API retries: 2 total per operation.
- Implement ENG loop iterations: maximum 3 per mutating step.
- Documentation scope loop iterations: maximum 2.
- Review remediation cycles: maximum 2.
- Safety violations, Human Gates, stale checkpoints, conflicts, and scope expansions are not retryable and do not enter ENG or remediation loops.
