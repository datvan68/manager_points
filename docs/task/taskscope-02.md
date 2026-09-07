slot_id: "taskscope-02"
generation: 3
task_id: "20260907-140840-auth-session-reliability"
scope_file: "docs/task/taskscope-02.md"
status: blocked
scope_revision: 1
created_at: "2026-09-07T14:08:40+07:00"
updated_at: "2026-09-07T14:08:40+07:00"
base_commit: "3887febd797705dea813f914bf517fb8d5c9846d"
task: "Stabilize remembered sessions, device management and administrator quick-access sessions"
pipeline: feature_development
profile: Full
risk: high
environment: development
objective: "Remembered logins survive normal refresh, browser restart and temporary connectivity loss; devices remain isolated; users can manage their own sessions; administrator quick-access sessions remain fast and are revoked with their parent login."
coordination:
  depends_on:
    - "Reservation release by docs/task/taskscope-01.md, task 20260906-210749-record-grading-permissions; verify its final auth changes before resuming."
  warnings:
    - "TASKSCOPE_CONFLICT: taskscope-01 is blocked and reserves backend/src/auth/services/auth.service.ts and backend/src/auth/test/auth.service.spec.ts, both required here. Do not execute until ownership is explicitly resolved or released."
    - "Planning-only request: this generation authorizes a reviewable plan, not application implementation, migration, deployment or changes to another scope."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "AuthModule issues 15-minute JWTs; TokenService rolls remembered refresh expiry to 30 days and preserves non-remembered one-day expiry. AuthProvider refreshes every five minutes. Browser session IDs mix sessionStorage and localStorage; duplicated ordinary tabs fork sessions. ImpersonationService uses fixed four-hour leases, five global slots and one active lease per subject."
  expected_behavior: "Normal expiry refreshes silently; transient failures do not erase usable session state; device logout stays local; security revocation invalidates access and refresh credentials; quick access binds to the initiating administrator session."
  root_cause: "TokenService marks the old token revoked before replacement persistence, so a concurrent request can observe no replacement and revoke all user tokens. JWT validation checks account status but no ordinary session revocation; session/fork can issue credentials from an otherwise revoked session's unexpired JWT. AuthProvider restore broadcast and http-client receiver use different channel names. Password reset unconditionally sets ACTIVE."
  baseline_checks:
    - "Review at base_commit: backend password.service, auth-security and auth.controller suites passed, 53 tests; frontend auth-provider, auth-api and auth-pages-ui suites passed, 22 tests. These are baseline results, not acceptance of future changes."
    - "In-memory source harness reproduced manual-lock reset becoming active and concurrent refresh revoking all user sessions before replacement persistence; no real data or source mutation."
    - "The user's individual unexpected logout has not been traced on a live environment; do not present the reproduced race as the proven cause of every reported logout."
scope:
  inspect:
    - "backend/src/auth/guards/jwt-auth.guard.ts"
    - "backend/src/auth/guards/strict-admin.guard.ts"
    - "backend/src/auth/schemas/login-log.schema.ts"
    - "backend/src/auth/utils/role.util.ts"
    - "backend/src/core/rate-limit/rate-limit.module.ts"
    - "backend/src/system/system-event-emitter.ts"
    - "frontend/src/api/config.ts"
    - "frontend/src/lib/impersonation-channel.ts"
    - "frontend/src/app/(dashboard)/permissions/page.tsx"
    - "frontend/src/app/(dashboard)/permissions/impersonation-flow.test.tsx"
    - "frontend/src/app/(dashboard)/system/page.tsx"
    - "frontend/src/components/ui/TabNavigation.tsx"
    - "docs/design/DESIGN.compact.md"
    - "scripts/dev-host.sh"
    - "docker-compose.dev-infra.yml"
    - "frontend/package.json"
    - "backend/package.json"
  write:
    - "backend/src/auth/auth.module.ts"
    - "backend/src/auth/dto/auth.dto.ts"
    - "backend/src/auth/schemas/user.schema.ts"
    - "backend/src/auth/schemas/refresh-token.schema.ts"
    - "backend/src/auth/schemas/impersonation-session.schema.ts"
    - "backend/src/auth/schemas/auth-session.schema.ts"
    - "backend/src/auth/services/session.service.ts"
    - "backend/src/auth/services/token.service.ts"
    - "backend/src/auth/services/auth.service.ts"
    - "backend/src/auth/services/password.service.ts"
    - "backend/src/auth/services/impersonation.service.ts"
    - "backend/src/auth/strategies/jwt.strategy.ts"
    - "backend/src/auth/controllers/auth.controller.ts"
    - "backend/src/auth/test/session.service.spec.ts"
    - "backend/src/auth/test/auth.service.spec.ts"
    - "backend/src/auth/test/auth-security.spec.ts"
    - "backend/src/auth/test/auth.controller.spec.ts"
    - "backend/src/auth/test/password.service.spec.ts"
    - "backend/src/auth/test/impersonation.service.spec.ts"
    - "frontend/src/api/auth-api.ts"
    - "frontend/src/api/auth-api.test.ts"
    - "frontend/src/api/http-client.ts"
    - "frontend/src/api/http-client.test.ts"
    - "frontend/src/providers/auth-provider.tsx"
    - "frontend/src/providers/auth-provider.test.tsx"
    - "frontend/src/app/(auth)/login/page.tsx"
    - "frontend/src/app/(auth)/access/page.tsx"
    - "frontend/src/app/(auth)/access/page.test.tsx"
    - "frontend/src/app/auth-pages-ui.test.tsx"
    - "frontend/src/app/(dashboard)/profile/page.tsx"
    - "frontend/src/app/(dashboard)/profile/page.test.tsx"
    - "frontend/src/components/profile/ActiveSessionsSection.tsx"
    - "frontend/src/components/profile/ActiveSessionsSection.test.tsx"
    - "frontend/src/components/layout/Header.tsx"
    - "frontend/src/components/layout/Header.test.tsx"
  preserve:
    - "Existing roles, effective permissions, student/teacher routing, account validation, HttpOnly refresh cookies, API error handling and domain data ownership. No JWT or refresh credential in URLs, localStorage, logs, device-list responses or persisted test artifacts."
    - "15-minute access expiry, rolling 30-day remembered login, fixed one-day non-remembered refresh expiry, fixed four-hour impersonation expiry, five global quick-access slots and one active quick-access lease per subject."
    - "Normal sessions on separate browsers/devices remain independent. Ordinary tabs using the same login share a session; explicit account switching ends that browser login's old context. Admin child tabs remain isolated by child session ID and never overwrite ordinary shared session state."
    - "Existing success response fields remain compatible; new session-management endpoints and claims are additive. No changes to grading/permission policy or unrelated profile features."
  out:
    - "Production access or mutation, commit/push/deployment, database migrations/backfills/index application, dependency installation and infrastructure changes."
    - "MFA, passwordless login, hardware fingerprinting, geolocation tracking, arbitrary changes to session durations or impersonation limits."
    - "Repository-wide audit instrumentation or changes to business-domain mutation handlers; preserve current actor/subject context and auth audit events."
acceptance_criteria:
  - "AC-01: Parallel refreshes for the same ordinary or child session return a consistent replacement without falsely revoking unrelated sessions. Cover a delayed replacement write, failed write, delayed duplicate response and replay after the permitted retry window. Confirmed replay affects only its session family; explicit account security events may revoke all families. Retry allowance must be bounded and not revive a revoked family."
  - "AC-02: Remember=true restores authentication after access expiry, tab reopen, browser restart and device sleep while the refresh credential is valid. Network timeout, offline, 429 and 5xx retain recoverable state with a retry/reconnect UI and bounded requests; 401 for a definitively invalid session clears it. A late refresh or /me response cannot restore a logged-out user, switch accounts or overwrite a newer session. Remember=false does not acquire a persistent ordinary cookie."
  - "AC-03: Two independent browser/device logins remain valid when either refreshes or logs out. Ordinary same-login tabs coordinate refresh and logout using the current session identity, including first login before an ID exists. Restore invalidation reaches applicable tabs without sharing credentials across ordinary/child identities."
  - "AC-04: Every newly issued access/refresh credential belongs to a server-validated session family. After logout or session revocation, its old access token is rejected by protected endpoints and session/fork. Password changes/resets and admin password resets invalidate all affected user's sessions; account lock/inactivation rejects access and refresh. Password reset preserves INACTIVE and manual LOCKED states; only a temporary failed-login lock may be cleared."
  - "AC-05: Authenticated ordinary users can list only their own ordinary sessions and revoke one or all other sessions through the profile UI. Show current-session marker, browser/device label, created time and last activity without tokens, raw IP or precise location. Foreign IDs are rejected without mutation; impersonated sessions cannot inspect or revoke the subject's real sessions. Current-session revocation logs out the current context; unrelated device families remain valid."
  - "AC-06: Quick access requires a valid ordinary admin parent session, not merely an active admin account. Record its parent session ID; parent logout/revocation invalidates its child leases and credentials, while another admin-device family and the subject's real login remain valid. Account-wide admin security events invalidate all its children. Child logout/expiry affects only that child."
  - "AC-07: Quick access opens through the existing nonce handoff without password re-entry or token-bearing URLs. /me rehydration retains authoritative impersonation identity and expiry. Header displays the subject, remaining lease time and a clear end-access action. Ordinary refresh never extends a child past four hours; duplicate child tabs cannot create independent child sessions or trigger false replay revocation. Existing strict-admin and subject-role checks remain effective."
  - "AC-08: Session lookup uses indexed identity; no full-family scan on every protected request, no writes on every render and no tight refresh polling. Server revocation takes effect on the next protected request; idle tabs update by their next auth check or focus validation. Auth audit events distinguish actor, subject, session and revocation reason without logging credentials."
  - "AC-09: Additive schema and old-record handling are explicit and tested. A valid legacy refresh credential can be upgraded safely to a server session; a legacy access token lacking session identity must refresh before protected access and must never mint a new family by itself. Legacy child leases without a provable parent fail closed and can be reopened by the admin. No automatic database migration or destructive cleanup."
  - "AC-10: Focused regressions, frontend typecheck, backend build, verified-dev multi-context UI/API scenarios and independent authentication/authorization review pass. Record measured warm quick-access and refresh behavior and actual cleanup; do not claim production or real-device verification from mocks."
execution:
  - "E-01 [AC-04,AC-08,AC-09] Add auth-session.schema.ts and session.service.ts using existing auth schema/InjectModel conventions; register in auth.module.ts. Use a durable opaque family identity, user ownership, revoked/expiry state and minimal activity metadata. Add optional session links to refresh-token.schema.ts and parent link to impersonation-session.schema.ts; use user.schema.ts only for an account-wide revocation generation if required. Define safe legacy upgrade and revocation boundaries before issuing session-bound JWTs. Cover service behavior in new session.service.spec.ts. New file parents already exist."
  - "E-02 [AC-01,AC-04,AC-09] Update token.service.ts and auth.service.ts to issue and rotate session-bound credentials, keep retry results consistent during delayed persistence and isolate replay to one family. Update jwt.strategy.ts to enforce family validity and block fork after revocation. Extend auth-security.spec.ts and auth.service.spec.ts with deferred-operation tests and old-credential rejection."
  - "E-03 [AC-04,AC-05,AC-06,AC-08] Update auth.controller.ts, auth.dto.ts, auth.service.ts and password.service.ts for ownership-checked session listing/revocation, logout and security-event revocation. Define GET /auth/sessions, DELETE /auth/sessions/:id and POST /auth/sessions/revoke-others; reject impersonated callers. Preserve account status during both password-reset flows. Use validated opaque identifiers and redact device metadata. Extend auth.controller.spec.ts, password.service.spec.ts and session.service.spec.ts."
  - "E-04 [AC-01,AC-06,AC-07,AC-09] Update impersonation.service.ts and its schema/session integration so acquisition stores the initiating parent and validation enforces its revocation. Keep existing limits, strict-admin checks and auth audit context. Return verified child identity/expiry from auth.service.ts:getMe; cover parent logout, independent admin device, child expiry, legacy child and concurrent refresh in impersonation.service.spec.ts and auth-security.spec.ts."
  - "E-05 [AC-02,AC-03,AC-07] Update auth-api.ts, http-client.ts, auth-provider.tsx, login/page.tsx and access/page.tsx: stable ordinary browser session sharing, dynamic channel lifecycle, child-only storage, request deduplication and cancellation/generation guards. Stop ordinary-tab auto-forking; bind recovery and logout to the captured session. Preserve recoverable state on transient errors and refresh on focus/reconnect. Add focused regressions in their existing tests and auth-pages-ui.test.tsx."
  - "E-06 [AC-05,AC-07,AC-08] Add ActiveSessionsSection.tsx and its test under the existing profile component directory using profile/StudentDormitorySection and existing UI conventions. Integrate in profile/page.tsx with auth-api session methods and explicit revoke actions, keeping student/non-student branches accessible. Update Header.tsx for child identity/countdown/end action. Extend profile/page.test.tsx, Header.test.tsx and auth-api.test.ts."
  - "E-07 [AC-01..AC-10] Run verification below after reservations and dev targets are verified. Obtain independent review of session ownership, concurrent refresh, legacy compatibility and admin parent/child isolation; fix only scoped findings, rerun affected checks, retain the taskscope and report the final diff without commit/push."
verification:
  - "V-01 [AC-01,AC-04,AC-05,AC-06,AC-08,AC-09] npm --prefix backend test -- --runTestsByPath src/auth/test/session.service.spec.ts src/auth/test/auth.service.spec.ts src/auth/test/auth-security.spec.ts src/auth/test/auth.controller.spec.ts src/auth/test/password.service.spec.ts src/auth/test/impersonation.service.spec.ts --runInBand -> meaningful success, rejection, deferred-write race and compatibility assertions all pass."
  - "V-02 [AC-02,AC-03,AC-05,AC-07] npm --prefix frontend test -- src/api/auth-api.test.ts src/api/http-client.test.ts src/providers/auth-provider.test.tsx src/app/auth-pages-ui.test.tsx \"src/app/(auth)/access/page.test.tsx\" \"src/app/(dashboard)/profile/page.test.tsx\" src/components/profile/ActiveSessionsSection.test.tsx src/components/layout/Header.test.tsx \"src/app/(dashboard)/permissions/impersonation-flow.test.tsx\" -> recovery, stale-response, cross-tab and child handoff assertions pass."
  - "V-03 [AC-10] npm --prefix frontend run typecheck; npm --prefix backend run build; git diff --check -> run as separate commands, all pass with no unowned edits."
  - "V-04 [AC-01..AC-09] Verified-dev UI/API: two independent cookie jars plus ordinary sibling tabs and an admin child tab; test remember/reopen, expired access, delayed concurrent refresh, offline/reconnect, logout during pending refresh, list/revoke ownership, password reset on locked/inactive fixtures, parent/child cascade and the subject's separate real login. Assert old access and refresh both fail after targeted revocation and unrelated families still work. Verify session metadata responses contain no credentials."
  - "V-05 [AC-07,AC-08,AC-10] Measure warm admin child opening and refresh under the same dev conditions before/after implementation, inspect request counts and indexed lookups; no avoidable serial duplicate refresh or tight polling. Independent reviewer checks full auth diff and runtime evidence; unresolved must-fix findings or missing runtime evidence prevent completion."
runtime_test:
  target_identity: "Unknown until execution: verify effective frontend/API, database identity and integration targets are isolated dev using non-secret metadata before the first interaction."
  resources: "Reserve task-tagged disposable accounts for ordinary active, inactive, manual-locked and admin identities; use independent cookie jars and task-owned parent/child sessions. Do not mutate another task's users."
  operations: "Normal UI/API login, refresh, logout, list/revoke sessions, child open/end and password reset on disposable accounts only. Mail must be captured by a verified dev sink before OTP/link requests. No production calls, raw DB writes, schema/index application or real external delivery."
  scenarios: "V-04 and V-05, recording actual pass signals separately from unit tests; exercise existing device/browser tooling and state clearly when physical-device coverage is unavailable."
  cleanup: "Revoke task sessions and remove only positively identified task-created disposable resources through authorized application paths. Restore any explicitly reserved reversible changes after checking intervening edits; record retained data if cleanup cannot be completed."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-02.md: user-requested reusable taskscope slot"
risks:
  - "Persistence changes need explicit review of additive schema definitions and legacy records. Applying database schema/index changes is a separate safety gate, including dev; stop dependent runtime verification if the required storage cannot be prepared within existing authority."
  - "Strict legacy JWT handling may require one silent refresh; legacy admin child sessions may require reopening. Do not extend legacy JWT trust to bypass session revocation."
  - "Browser/PWA cookie retention differs by context; confirm effective cookie delivery rather than infer it from remember=true or localhost."
  - "This scope changes authentication and concurrency: independent review is mandatory. Arrange an independent reviewer only when authorized/available; otherwise record the unmet requirement and keep execution incomplete."
stop_conditions:
  - "Taskscope-01 still reserves either intersecting auth path; scope identity changed; or another task modifies a target during execution. Do not edit or cancel that other task."
  - "Exact-file resume authorization is absent, dev isolation cannot be established, or mail/integration effects cannot be contained. Stop only dependent actions."
  - "Implementation needs a new dependency, migration/index application, unlisted write path, production action or changed role/duration/limit policy; amend scope or obtain the exact required authority before that action."
  - "Required checks, runtime evidence or independent review are missing or failing; do not declare completion."
