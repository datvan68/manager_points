Task: isolate-auth-session-per-tab | bug_fix | Risk: MEDIUM
Objective: Allow a duplicated browser tab to log out and sign in with another account without revoking, replacing, clearing, or showing an expired-session notification in the original tab.
Scope:
- backend/src/auth/controllers/auth.controller.ts :: login, refresh, logout, and session-cookie helpers :: address the HttpOnly refresh cookie by a validated opaque browser-session ID, add an authenticated session-fork endpoint for duplicated tabs, and clear/revoke only the caller's session cookie.
- backend/src/auth/services/auth.service.ts :: session creation and fork orchestration :: create an independent refresh session for a duplicated tab while preserving the source session and record logout against only the selected session.
- backend/src/auth/services/token.service.ts :: refresh-token issuance and revocation :: support cloning a valid session into a separately rotatable/revocable refresh-token chain without weakening expiry, account-status, rotation-grace, reuse-detection, or revoke-all security flows.
- backend/src/auth/test/auth.controller.spec.ts :: cookie/session routing tests :: cover validated session IDs, per-session cookie selection, fork, refresh, and logout without affecting a sibling session.
- backend/src/auth/test/auth.service.spec.ts :: session fork/logout tests :: verify a fork creates a distinct token chain for the same account and revokes only the requested chain.
- backend/src/auth/test/auth-security.spec.ts :: token security regression tests :: verify independent rotation/revocation plus unchanged reuse detection and security-wide revoke-all behavior.
- backend/test/auth.e2e-spec.ts :: multi-tab authentication scenario :: prove a forked tab can log out and log in as another user while the original Admin session still refreshes successfully.
- frontend/src/api/auth-api.ts :: tab identity and auth storage :: keep active user, access token, remember state, and opaque session ID in a tab-scoped namespace; preserve only non-session preferences globally; send the session ID on login, fork, refresh, and logout requests without exposing refresh-token values to JavaScript.
- frontend/src/api/http-client.ts :: refresh coordination and auth events :: namespace locks, promises, and BroadcastChannel messages by session ID; ignore clear/refresh events from sibling sessions; classify an explicit logout separately from an unexpected expired session so another tab cannot trigger the line-219 `ApiError` or toast.
- frontend/src/providers/auth-provider.tsx :: duplicated-tab bootstrap and logout :: detect a copied tab session, fork it before auth mutations, bind periodic refresh/logout to that tab's session, and update only the current tab's React auth state.
- frontend/src/api/auth-api.test.ts :: tab-scoped client tests :: cover session-ID headers, storage isolation, duplicated-tab fork, and logout requests.
- frontend/src/api/http-client.test.ts :: cross-tab coordination tests :: cover same-session synchronization and prove sibling-session `TOKEN_CLEARED`, refresh failure, and logout events do not clear or redirect the current tab.
- docs/taskscope.md :: implementation contract :: capture the diagnosed cause, selected isolation model, verification, and acceptance criteria.
Out: Simultaneous accounts within one tab, sharing credentials between different origins/browser profiles, JavaScript-readable refresh tokens, changes to access-token lifetime or remembered-session expiry, password/RBAC flows, database migrations, and unrelated files or behavior.
Context: Tabs on the same origin currently share `refresh_token`, `user`, `remember_login`, and remembered `access_token` through cookies/localStorage. Logout in tab 2 revokes and clears the shared refresh token; tab 1 then receives 401, throws `ApiError('Phiên đăng nhập đã hết hạn')` in `http-client.ts`, broadcasts `TOKEN_CLEARED`, and redirects. Browser cookies cannot be isolated by tab, so the fix uses a non-secret per-tab session ID to select distinct HttpOnly refresh cookies/token chains. A duplicated tab initially copies `sessionStorage`; it must receive a new ID and fork the authenticated session before it can log out or switch accounts. Security operations that intentionally revoke every session (password reset/change, account lock/deactivation, role security changes, and confirmed token reuse) remain global.
Steps:
1. Add validated session-addressed refresh cookies and a fork operation that creates a distinct refresh-token chain without revoking the source chain.
2. Make active auth storage, refresh coordination, broadcasts, logout, redirects, and notifications session-scoped in the frontend.
3. Add unit and end-to-end regressions for duplicate-tab fork, logout, second-account login, source-session refresh, and global security revocation.
4. Run targeted tests, type-check/build both applications, manually exercise the two-tab scenario, and review the final diff/status.
Verify:
- backend :: npm test -- auth/test/auth.controller.spec.ts auth/test/auth.service.spec.ts auth/test/auth-security.spec.ts --runInBand => all session-isolation and existing auth-security unit tests pass.
- backend :: npm run test:e2e -- auth.e2e-spec.ts --runInBand => duplicated-tab logout/account-switch scenario passes and the original session can still refresh.
- backend :: npm run build => NestJS production build succeeds.
- frontend :: npm test -- src/api/auth-api.test.ts src/api/http-client.test.ts => tab storage, request routing, and cross-session event regressions pass.
- frontend :: npm run typecheck => TypeScript reports no errors.
- repository root :: manual browser check: log in as Admin in tab 1, duplicate it, log out tab 2, sign in there as another account, wait for/force refresh in both tabs => tab 1 remains Admin without expired-session toast/redirect; tab 2 remains the second account; each tab can refresh and log out independently.
- repository root :: manual security check: perform a global revocation condition => all related tab sessions become unauthenticated as before.
- repository root :: git diff --check && git status --short => no whitespace errors or unintended files.
Done:
- Logging out or switching accounts in a duplicated tab does not revoke, overwrite, clear, redirect, or notify the original tab, and both tabs retain independent server-refreshable sessions.
- Explicit global security revocation still terminates every session for the affected account.
- Refresh tokens remain HttpOnly and are never stored or returned to frontend JavaScript.
Gate/Stop: Stop if product policy requires logout to terminate every browser session, because that conflicts with independent accounts per tab and needs an explicit product/security decision.
Rollback: Revert the scoped frontend/backend changes together; mixed deployment is unsupported because legacy shared-cookie clients and session-addressed cookie endpoints must change atomically.
Dependencies: Frontend and backend must deploy in the same release. Browser support must include `BroadcastChannel`, `sessionStorage`, `crypto.randomUUID` (or an existing project-compatible opaque-ID fallback), and multiple same-origin HttpOnly cookies.
Artifacts: Final scoped diff, targeted test/build output, and manual two-tab verification notes.
