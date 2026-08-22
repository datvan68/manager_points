# Task Identity and Pipeline

- Task: `admin-account-impersonation-review-and-hardening`
- Pipeline: `feature_development`
- Profile: Full, protocol/rules `3.2.0`
- Repository: `D:\PROJECT\manager_points`
- Base/current HEAD: `a6492af1665db21a4abebbdbcf9d1afa9a278ee7` on `main`.
- State at handoff: implementation is present as uncommitted changes under `backend/src/auth/**` and `frontend/**`; the independent security review was interrupted before a verdict.
- Environment: development. This scope is planning-only and does not independently authorize further mutation, deployment, production startup, or database/index changes.

# Risk Level

- Risk: high.
- Evidence: the change creates admin impersonation credentials, modifies JWT and refresh-token behavior, adds global concurrency enforcement, and relies on MongoDB partial-unique indexes.
- Reversibility: source changes are Git-reversible. Starting the changed backend can create indexes in MongoDB and therefore requires an explicit environment check outside disposable development.
- Blast radius: authentication, authorization, refresh/logout behavior, admin account management UI, and application startup if required indexes cannot be created.

# Objective

Complete the interrupted independent review, remediate confirmed findings, and prove that only strict `ADMIN` users can open passwordless isolated sessions for at most five distinct active non-admin accounts without weakening ordinary authentication.

# Scope Boundaries

- Approved review boundary:
  - `backend/src/auth/**`
  - `backend/test/auth*.e2e-spec.ts` or a new focused impersonation e2e test using a disposable database only
  - `frontend/src/api/auth-api.ts` and its tests
  - `frontend/src/providers/auth-provider.tsx` and its tests
  - `frontend/src/app/(dashboard)/permissions/**`
  - `frontend/src/app/(auth)/access/**`
  - `frontend/src/components/layout/Header.tsx` and a focused test if changed
  - `frontend/src/lib/impersonation-channel.ts`
- Write boundary after explicit continuation authority: only the paths above and this taskscope.
- Known implementation: strict backend admin guard; four-hour impersonation leases; five partial-unique MongoDB slots; subject-unique active lease; JWT/refresh linkage; logout release/revocation; audit events; `/auth/impersonations`; isolated `/access` bootstrap; nonce-scoped `BroadcastChannel`; session-only token storage; impersonation banner/exit action.

# Out of Scope

- Deployment, production startup, persistent database mutation, manual index creation, credential/secret changes, role or user data changes, migrations against existing data, changing the global limit from five, changing the four-hour lease policy, allowing admin targets, broad auth refactors, dependency upgrades, or unrelated lint cleanup.
- Bypassing user permissions while impersonating: authorization must continue to use the target account's current role and permissions.

# Context and Dependencies

- Backend verification already reported: focused auth tests `55 passed`; full backend suite `68 suites / 926 passed / 2 todo`; TypeScript no-emit passed; touched-feature formatting/lint checks passed.
- Frontend verification already reported: focused Vitest `6 files / 20 tests passed`; TypeScript typecheck passed; frontend diff check passed.
- No live-Mongo e2e or real-browser integration test has run.
- The cap is safe only if MongoDB successfully creates both partial-unique active indexes. `ImpersonationService.onModuleInit()` currently fails startup when index creation fails.
- Current frontend row gating calls the broad `isAdminUser()` helper, which also accepts `ADMIN_FULL`. Backend enforcement is strict, but the UI does not yet match the "only admin" requirement and needs review/remediation.
- The parent window currently maps every HTTP 409 to the five-account-limit message, including duplicate-target or inactive-target conflicts; error-code-specific UX remains to be reviewed.
- Access and refresh tokens must remain absent from URLs, `localStorage`, logs, toast messages, and cross-origin messaging. The channel nonce alone may appear in the URL fragment.

# Steps

1. **Resume independent review (read-only):** review the complete diff from the pinned base. Check strict actor/target rules, lease/index race safety, expiry reclaim, compensation, actor demotion, target status changes, JWT/refresh rotation and replay, fork prevention, logout/revocation, audit content, cookie/session scoping, channel replay/confusion, bootstrap cleanup, and ordinary-auth regressions.
2. **Reconcile strict-admin UI:** replace feature-specific use of broad `isAdminUser()` with a strict `roleCode === 'ADMIN'` predicate that tolerates the actual user response shape without accepting `ADMIN_FULL` alone. Add a regression test proving the button is hidden for a non-ADMIN user with `ADMIN_FULL`.
3. **Review conflict handling:** preserve stable backend error codes in the frontend API error type and show distinct messages for `IMPERSONATION_LIMIT_REACHED`, `IMPERSONATION_TARGET_ALREADY_ACTIVE`, inactive/admin/self targets, and expired admin auth. Do not expose internal errors.
4. **Disposable Mongo integration:** run or add a focused e2e test against an explicitly disposable MongoDB instance. Assert the named partial-unique indexes exist; ten concurrent requests for ten targets yield exactly five successes; duplicate subjects cannot consume multiple slots; release/expiry permits replacement; startup fails closed when index creation is impossible.
5. **Real-browser flow check:** in local development only, verify popup allowed/blocked states, separate session IDs/cookies, simultaneous independent target tabs, no admin-tab token overwrite, refresh after access-token expiry, banner visibility, exit release, duplicate target handling, and the sixth target rejection.
6. **Regression and final review:** run focused and affected full tests/typechecks/builds, inspect the final diff for unintended changes, and repeat independent security review after remediation. Stop on any unresolved P0/P1 or authorization/concurrency bypass.

# Acceptance Criteria

- **AC-01:** Backend accepts impersonation creation only when the actor's current persisted `role_code` is exactly `ADMIN`; `ADMIN_FULL` without that role is denied, and the frontend does not show the action.
- **AC-02:** Self, inactive/nonexistent, and `ADMIN` targets are denied without creating credentials or consuming a slot; no target password, OTP, or confirmation is requested.
- **AC-03:** At most five distinct active subject accounts exist globally under concurrent multi-process requests, proven by live partial-unique indexes and a disposable-database concurrency test.
- **AC-04:** Active access and refresh requests revalidate the lease and current actor. Actor demotion/deactivation, lease release/expiry, or target deactivation invalidates the impersonated session.
- **AC-05:** Refresh rotation preserves actor/lease linkage; replay, fork, logout, startup failure, and audit failure cannot create an ordinary or untracked target session.
- **AC-06:** Impersonated requests receive only the target's current role and permissions. The actor's admin permissions are never merged into the subject session.
- **AC-07:** Each child window has a distinct session-only ID and token state. No access/refresh token appears in URL fragments, `localStorage`, logs, or wildcard/cross-origin messages, and the original admin tab remains authenticated as the admin.
- **AC-08:** The `/access` bootstrap is fail-closed for invalid/expired handoffs and does not run normal auth hydration before isolation. Popup, timeout, malformed payload, API error, ACK, and cleanup paths are controlled.
- **AC-09:** A visible impersonation banner identifies the target; ending access releases the lease and revokes its refresh-token family without logging out or overwriting the admin's original session.
- **AC-10:** Stable conflict codes produce accurate Vietnamese messages, including a limit message only for `IMPERSONATION_LIMIT_REACHED`.
- **AC-11:** Existing ordinary login, refresh, session fork, logout, RBAC, permissions page behavior, backend full tests, frontend affected tests, and builds remain passing.
- **AC-12:** Independent review reports no unresolved P0/P1 and the final diff contains only intentional files inside the approved boundary.

# Verification

- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand auth/test/impersonation.service.spec.ts auth/test/auth.service.spec.ts auth/test/auth-security.spec.ts auth/test/auth.controller.spec.ts` => focused auth/impersonation tests pass.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand` => all backend suites pass, excluding only documented pre-existing todos.
- `D:\PROJECT\manager_points\backend :: npx tsc -p tsconfig.build.json --noEmit` => backend types pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => Nest production compilation passes without starting the app or connecting to a persistent database.
- `D:\PROJECT\manager_points\backend :: <repository-native disposable-Mongo e2e command established during continuation>` => named indexes and live concurrency/lifecycle criteria pass. Do not invent or run this command until the test database URI is proven disposable.
- `D:\PROJECT\manager_points\frontend :: npm test -- --run src/api/auth-api.test.ts src/providers/auth-provider.test.tsx "src/app/(dashboard)/permissions/__tests__/page.test.tsx" "src/app/(dashboard)/permissions/impersonation-flow.test.tsx" "src/app/(auth)/access/page.test.tsx"` => API/storage/bootstrap/admin gating/handoff tests pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => frontend types pass.
- `D:\PROJECT\manager_points\frontend :: npm run build` => Next production compilation passes without deployment.
- `D:\PROJECT\manager_points :: git diff --check; git status --short` => no whitespace errors and every changed file is intentional.
- Manual local browser evidence must record six-target behavior, isolated tokens/session IDs, refresh, banner, exit/release, popup denial, and absence of tokens in URL/localStorage.

# Safety Gates

- **G-01 — Disposable database proof:** before any e2e command that connects to MongoDB, verify the exact URI/database is disposable and contains no user or production data. Resume: one bounded test run.
- **G-02 — Index/database mutation:** before starting this backend against staging/production or any persistent shared database, approve the target environment, exact index definitions, duplicate-data preflight, backup/rollback, startup failure behavior, and operator. Resume: controlled startup/index creation only.
- **G-03 — Deployment:** require affected test/build evidence, disposable-Mongo concurrency results, real-browser evidence, independent security approval, monitoring/audit review, and rollback version before staging or production deployment.

# Artifacts and Checkpoints

- Preserve the current uncommitted implementation and base commit in Git; do not create or switch branches/worktrees unless explicitly requested.
- Required continuation artifacts: independent review findings, remediation diff, focused/full test outputs, disposable-Mongo index/concurrency evidence, local browser checklist, and final status/diff.
- Material checkpoints: after review findings; after strict-admin/error remediation; after disposable-Mongo tests; after browser verification; after final independent review.

# Execution Budgets

- Step deadline: 600 seconds; maximum 1800 seconds for disposable integration/build verification.
- One writer per path. Serialize frontend API/error-contract edits with UI/test edits; do not edit the same path concurrently.
- Retry limits: at most 2 idempotent command retries; engineering loop `0..3`; independent-review remediation `0..2`.
- Stop on dirty-path overlap from a new source, unproven database disposability, index mismatch, sixth active lease, strict-admin bypass, token leakage, ordinary-auth regression, new dependency/migration requirement, production effect, or scope expansion.
