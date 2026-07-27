## Task Identity and Pipeline

- Task: `login-remember-session-rehydration`
- Pipeline: `bug_fix`
- Profile: Full
- Rule version: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base state: branch `main`, commit `ab2e069897c7c72f557d1376e352d3416bab3dff`
- Authority: planning-only; this document does not authorize implementation, commit, push, deployment, or production mutation.

## Risk Level

- Risk: high because the behavior controls authentication persistence and refresh-token recovery.
- Environment: development investigation and local verification.
- Reversibility: source and test changes are reversible; no database or credential mutation is planned.
- Blast radius: login bootstrap, session storage, silent refresh, and browser/PWA relaunch behavior.

## Objective

When `Ghi nhớ đăng nhập` is selected and the server-side refresh session remains valid, reopening the same-origin browser application or installed PWA restores the authenticated user without requesting credentials. When it is not selected, the client creates no durable authentication state and requires login after the browser session and session cookie actually end.

## Scope Boundaries

### Approved Boundary

- Frontend login-state storage and authentication bootstrap.
- Read-only validation of the existing backend refresh-cookie contract.
- Read-only validation that the PWA service worker does not intercept authentication.

### Write Boundary

- `frontend/src/api/auth-api.ts`
- `frontend/src/providers/auth-provider.tsx`
- `frontend/src/api/auth-api.test.ts`
- `frontend/src/providers/auth-provider.test.tsx` (new)

### Read-only References

- `frontend/src/app/(auth)/login/page.tsx`
- `frontend/src/api/http-client.ts`
- `frontend/src/components/pwa/PwaInstallPrompt.tsx`
- `frontend/src/components/pwa/PwaInstallPrompt.test.tsx`
- `frontend/src/app/manifest.ts`
- `frontend/public/sw.js`
- `frontend/next.config.js`
- `backend/src/auth/controllers/auth.controller.ts`
- `backend/src/auth/services/auth.service.ts`
- `backend/src/auth/services/token.service.ts`
- `backend/src/auth/test/auth-security.spec.ts`
- `backend/test/auth.e2e-spec.ts`

## Out of Scope

- Storing passwords, refresh tokens, access JWTs, or the complete user object in `localStorage`, Cache Storage, or service-worker caches.
- Changing the PWA manifest, installation UI, service-worker caching strategy, backend token lifetime, cookie attributes, CORS, DTO validation, database schema, or session rotation policy.
- Correcting the stale admin cookie-lifetime expectation in `backend/test/auth.e2e-spec.ts`; that requires a separate backend test scope.
- Dependency upgrades, deployment, production testing, persistent-data changes, or credential handling.

## Context and Dependencies

- Login already sends `remember`; the backend creates a 30-day remembered refresh token and a persistent `HttpOnly` cookie, while a non-remembered login receives a session cookie.
- `tokenStorage` currently writes the remember flag, access token, and user only to `sessionStorage`, despite comments that imply remembered persistence.
- On a new browser/PWA context, `auth_session_id` can be restored from `localStorage` and `/auth/refresh` can succeed, but `AuthProvider.checkAuth()` then rereads a missing session user, sets the user to `null`, and redirects to `/login`.
- `/api/auth/me` already provides the authenticated server state needed to rebuild the client user and permissions after refresh.
- The installed PWA uses the same origin, but a standalone launch is a new top-level context. Its service worker bypasses non-GET, cross-origin, and `/api/*` requests, so it does not cache login or refresh responses.
- Restarting only a dev process does not inherently remove the MongoDB refresh token. Reproduction must distinguish process restart, tab reload, complete browser-session termination, and PWA relaunch.

## Steps

1. Capture a baseline for remembered and non-remembered login in a normal browser and installed PWA, recording storage state, refresh-cookie presence, `/api/auth/refresh`, `/api/auth/me`, and the final route.
2. Define one storage contract:
   - keep access tokens and user details session-scoped;
   - persist only the non-sensitive remember preference when required;
   - remove durable preference state when remember is false or logout completes;
   - tolerate unavailable storage and malformed stored data.
3. Refactor authentication bootstrap so a missing session token/user first attempts cookie-based refresh, then fetches `/auth/me`, normalizes user/role/permissions, restores session-scoped state, and marks the user authenticated before redirect decisions run.
4. Preserve current student/teacher routing and student-link hydration without issuing duplicate refreshes or creating redirect races.
5. Handle failure classes explicitly:
   - `400/401/403` refresh or identity failures clear client auth state and resolve unauthenticated;
   - transient network/server failures do not fabricate an authenticated user or erase a still-usable in-memory session;
   - logout clears both session state and any remembered preference.
6. Add focused regression tests for storage semantics, refresh-plus-identity rehydration with no stored user, remembered preference recovery, non-remembered cleanup, definitive auth failure, transient failure, logout, and routing after bootstrap.
7. Run frontend checks and the unchanged backend cookie-policy test. If backend behavior contradicts the documented contract, stop and amend the scope before modifying any backend path.
8. Perform an independent authentication/security review covering XSS exposure, cookie use, refresh rotation, cross-tab behavior, duplicate requests, loading-state races, and unintended PWA/service-worker changes.

## Acceptance Criteria

- `AC-01`: With remember enabled and a valid refresh cookie, a full close/reopen of the same-origin browser application reaches the correct authenticated route without requesting credentials.
- `AC-02`: The same scenario succeeds when launching the installed PWA from its icon.
- `AC-03`: Rehydration succeeds without an existing session-stored access token or user by completing refresh, `/auth/me`, state restoration, and permission loading.
- `AC-04`: Remember false produces no persistent cookie `Max-Age` and no durable client authentication preference; once the browser session cookie is absent, reopening resolves to `/login`.
- `AC-05`: Logout and definitive refresh/identity rejection clear authentication state and cannot silently restore the prior user.
- `AC-06`: Passwords, refresh tokens, access JWTs, and complete user objects are never written to durable web or service-worker storage.
- `AC-07`: Authentication POST requests remain network-only and are not intercepted or cached by the service worker.
- `AC-08`: Existing role-based landing routes, permission loading, refresh rotation, PWA installation behavior, type checking, and production build continue to pass.

## Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- src/api/auth-api.test.ts src/providers/auth-provider.test.tsx src/components/pwa/PwaInstallPrompt.test.tsx`
  - Expected: storage, rehydration, failure, logout, routing, and PWA regression tests pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck`
  - Expected: no TypeScript errors.
- `D:\PROJECT\manager_points\frontend :: npm run build`
  - Expected: production build succeeds.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand auth/test/auth-security.spec.ts`
  - Expected: the existing 30-day remembered-cookie and environment-dependent cookie tests pass unchanged.
- Manual Chromium matrix on one exact origin:
  - remember on/off;
  - reload;
  - restart frontend process while retaining the tab;
  - close all browser/PWA windows and relaunch;
  - restart backend while retaining the database;
  - inspect cookie, `sessionStorage`, `localStorage`, refresh/identity network requests, service-worker handling, and final route.
  - Expected: `AC-01` through `AC-07` hold, and `localhost`/`127.0.0.1` are not mixed.
- `D:\PROJECT\manager_points :: git diff --check`
  - Expected: no whitespace errors.
- `D:\PROJECT\manager_points :: git status --short` and `git diff --stat`
  - Expected: only the approved implementation paths and this taskscope are changed.

## Safety Gates

- No Human Gate is required for local implementation and verification within the write boundary.
- Any backend cookie/session-policy change, production test, deployment, credential access, or persistent-data mutation requires a scope amendment and separate explicit authority.
- Authentication changes require independent review before completion.

## Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`.
- Baseline evidence: sanitized browser/PWA storage and network matrix; never record raw tokens or cookies.
- Implementation-to-review checkpoint: base/current commit IDs, scoped diff, test summaries, and hashes of any retained review artifacts.
- Final evidence: acceptance-to-verification mapping, final diff/status, and unresolved risks.

## Execution Budgets

- One writer per path; implementation and independent review are sequential.
- Maximum idempotent retries: 2.
- Maximum implementation/verification loops: 3.
- Maximum review-remediation cycles: 2.
- Default step deadline: 600 seconds; maximum step deadline: 1800 seconds.
- Stop on boundary expansion, backend-contract mismatch, sensitive-data exposure, stale state, failed required verification, or a new Human Gate.
