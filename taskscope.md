# Task Scope: Resilient Route-Permission Loading During Backend Startup

## 1. Task ID + Pipeline

- **Task ID:** `FE-ROUTE-PERMISSION-STARTUP-RETRY-001`
- **Pipeline:** `feature_development`

## 2. Risk Level

- **Risk Level:** `LOW`
- **Rationale:** The task changes only frontend handling of an idempotent `GET` request. It does not modify authentication tokens, authorization rules, database data, backend endpoints, infrastructure, or production deployment configuration.

## 3. Objective

Prevent repeated `TypeError: Failed to fetch` errors when the frontend becomes available before the backend is ready. Route-permission loading must retry transient network failures for a bounded period, remain fail-closed while permission data is unavailable, and stop pending work when the component unmounts.

## 4. Scope

Only the following files may be created or changed:

- `frontend/src/api/http-client.ts`
  - Add a reusable helper for bounded retries of idempotent requests that fail before receiving an HTTP response.
- `frontend/src/api/auth-api.ts`
  - Route `getRoutePermissionsPublic` through the retry-capable request helper and accept an optional abort signal.
- `frontend/src/components/popups/SubsystemPopup.tsx`
  - Create and clean up an `AbortController`, preserve the fail-closed empty mapping state during startup failure, and avoid logging cancellation as an error.
- `frontend/src/api/http-client.test.ts`
  - Add unit tests for retry count, backoff behavior, HTTP-response handling, successful recovery, and abort handling.
- `frontend/src/components/popups/SubsystemPopup.test.tsx`
  - Add focused tests for permission-loading recovery and unmount cancellation if the existing test environment supports this component without unrelated production changes.

## 5. Out of Scope

- Do not change backend source code, backend health endpoints, database schemas, migrations, seeds, or authorization policies.
- Do not change Docker Compose, Kubernetes, reverse-proxy, CI/CD, environment-variable, or deployment files.
- Do not retry mutation requests (`POST`, `PUT`, `PATCH`, or `DELETE`).
- Do not retry HTTP responses such as `400`, `401`, `403`, `404`, `429`, or `5xx`; this task covers only network-level failures where `fetch` throws before returning a `Response`.
- Do not change token refresh, logout, redirect, or cross-tab authentication synchronization behavior.
- Do not expose modules or routes when route-permission mappings are unavailable.
- Do not add a third-party retry dependency.
- Do not refactor unrelated API methods or popup UI.

## 6. Context & Dependencies

- `SubsystemPopup.tsx` currently invokes `authApi.getRoutePermissionsPublic(token)` from the effect beginning near line 174 and logs every thrown error near line 182.
- `authApi.getRoutePermissionsPublic` currently calls `fetch` directly near line 389, so it does not use shared request behavior from `frontend/src/api/http-client.ts`.
- A browser `TypeError: Failed to fetch` indicates that no HTTP response was available. Expected causes include backend startup delay, connection refusal, CORS rejection, mixed content, DNS failure, or an incorrect API origin. Retry mitigates transient startup delay but must not conceal persistent configuration errors.
- React development Strict Mode may execute effects more than once. Cleanup must abort the superseded request/retry loop so duplicated effects do not produce concurrent retry sequences.
- Use the existing Vitest setup and scripts declared in `frontend/package.json`. Do not install dependencies.
- The repository does not currently expose `global.md`, `safety.md`, `orchestrator.md`, or `pipeline.md`; follow the task-scope and safety requirements supplied in the active `AGENTS.md` instructions.

## 7. Steps — PLAN → EXECUTE → VERIFY → REFINE

### PLAN

1. Inspect `frontend/src/api/http-client.ts`, `frontend/src/api/auth-api.ts`, and the route-mapping effect in `frontend/src/components/popups/SubsystemPopup.tsx` to confirm call boundaries and existing exports.
2. Inspect the existing Vitest configuration and neighboring frontend tests before creating either test file; reuse the repository's current mocking and DOM setup conventions.
3. Define a retry contract limited to thrown network errors for idempotent requests: a maximum of four total attempts with delays of `500`, `1000`, and `2000` milliseconds between attempts.

### EXECUTE

1. In `frontend/src/api/http-client.ts`, add and export a typed retry helper that:
   - accepts the same URL and `RequestInit` inputs used by `fetch`;
   - permits retries only when the effective method is `GET` or `HEAD`;
   - performs no more than four total attempts;
   - waits `500 ms`, `1000 ms`, and `2000 ms` before attempts two, three, and four;
   - immediately returns every received `Response`, including non-2xx responses;
   - retries only when `fetch` throws a non-abort error;
   - immediately rethrows an `AbortError`;
   - uses the supplied `AbortSignal` for both `fetch` and delay cancellation;
   - rethrows the final network error after the fourth failed attempt.
2. In `frontend/src/api/auth-api.ts`, replace the direct `fetch` inside `getRoutePermissionsPublic` with the new retry helper. Change its signature to `getRoutePermissionsPublic(accessToken?: string, signal?: AbortSignal): Promise<any[]>`, pass `signal` in `RequestInit`, retain the optional `Authorization` header, and continue parsing the final response through `handleResponse<any[]>`.
3. In the route-mapping `useEffect` in `frontend/src/components/popups/SubsystemPopup.tsx`:
   - instantiate one `AbortController` per effect execution;
   - pass `controller.signal` to `getRoutePermissionsPublic`;
   - keep `routeMappings` as an empty array until a successful response is received;
   - do not call `setRouteMappings` after cancellation;
   - suppress logging when `controller.signal.aborted` is true or the caught error has name `AbortError`;
   - log one `console.error` only after the retry helper exhausts all attempts;
   - return a cleanup function that calls `controller.abort()`.
4. In `frontend/src/api/http-client.test.ts`, use fake timers and a mocked global `fetch` to verify the exact four-attempt ceiling, delay schedule, recovery after transient failures, no retry after any returned HTTP response, no retry for non-idempotent methods, and immediate abort termination.
5. In `frontend/src/components/popups/SubsystemPopup.test.tsx`, add only the minimum mocks required to verify that a successful mapping response updates component behavior and that unmount aborts the request without emitting `console.error`. If the component cannot be isolated with the existing test setup, document the constraint in the verification output and rely on helper unit tests plus type checking; do not modify unrelated providers solely to enable this test.

### VERIFY

1. Run the focused retry-helper test file.
2. Run the popup test file if it was created and is supported by the existing test harness.
3. Run the complete frontend test suite to detect regressions.
4. Run TypeScript type checking.
5. Run the production frontend build.
6. Manually start the frontend while the backend is stopped, open the subsystem popup, then start the backend within 3.5 seconds. Confirm that permission mappings load without refreshing the page and that no more than one terminal error is logged if all attempts fail.

### REFINE

1. If a test reveals duplicated retries under React Strict Mode, correct effect cleanup and signal propagation without increasing the retry limit.
2. If TypeScript rejects DOM abort types or timer types, adjust local type annotations only; do not weaken compiler settings or introduce `@ts-ignore`.
3. If the production build identifies server-rendering access to browser-only APIs, keep `AbortController` construction inside `useEffect`.
4. Repeat all verification commands after every correction until all automated checks pass or a Human Gate condition is reached.

## 8. Acceptance Criteria

- `getRoutePermissionsPublic` succeeds without a page refresh when the backend becomes reachable during the bounded retry window.
- The request makes at most four total attempts with delays of exactly `500 ms`, `1000 ms`, and `2000 ms` between attempts.
- Only thrown network errors are retried; every received HTTP response is passed immediately to `handleResponse` without transport retry.
- `POST`, `PUT`, `PATCH`, and `DELETE` requests cannot use the helper's retry behavior.
- Unmounting or rerunning the popup effect aborts the active fetch and pending delay and produces no cancellation error log.
- A persistent network failure produces no more than one terminal `console.error` per active effect execution.
- Route-permission mappings remain fail-closed while unavailable; the change does not grant access based on missing data.
- Existing token refresh and authentication behavior remains unchanged.
- Focused tests, the complete frontend test suite, TypeScript type checking, and the frontend production build pass.

## 9. Verification Commands

Run from `D:\PROJECT\manager_points`:

```powershell
npm --prefix frontend test -- src/api/http-client.test.ts
npm --prefix frontend test -- src/components/popups/SubsystemPopup.test.tsx
npm --prefix frontend test
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

If `frontend/src/components/popups/SubsystemPopup.test.tsx` is not created for the documented test-harness reason, omit only the second command and attach that reason to the verification report.

## 10. Safety Gates

Trigger a Human Gate and stop execution before making changes if any of the following becomes necessary:

- Any backend, database, migration, authorization-policy, production, deployment, environment-variable, Docker, Kubernetes, reverse-proxy, or CI/CD file must be changed.
- The implementation would retry mutation requests or retry authentication failures such as `401` or `403`.
- The implementation would default to granting module or route access while permission data is unavailable.
- A new runtime or development dependency must be installed.
- Existing authentication refresh, logout, redirect, or token-storage behavior must be altered.
- Verification requires access to production credentials, production services, or destructive operations.
- Automated tests, type checking, or build remain failing after three PLAN → EXECUTE → VERIFY → REFINE iterations.

## 11. Artifacts to Review

Attach the following artifacts when triggering a Human Gate or requesting final review:

- Git diff for all in-scope files.
- Full output of each command listed in **Verification Commands**, including exit codes.
- Vitest failure output and snapshots, if any.
- TypeScript diagnostics, if any.
- Next.js production build output, if any.
- Browser console output and Network-panel evidence from the manual backend-startup test.
- A concise statement confirming the observed number of fetch attempts and delay sequence.
- A list of any pre-existing failures distinguished from failures introduced by this task.

## 12. loop_iterations Override

- **Override:** None.
- Use the default `3` iterations. Three cycles are sufficient for this isolated frontend resilience change; reaching the third unsuccessful cycle triggers the Human Gate defined above.
