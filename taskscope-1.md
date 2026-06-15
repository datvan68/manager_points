# Task Scope Review: Next.js Client Chunk Cache Fix

## Objective

Review the previous analysis and correction for the runtime error where Next.js could not instantiate the `lucide-react` `Loader2` client module required by `SemesterModal.tsx`.

Observed error:

```text
Module [project]/node_modules/lucide-react/dist/esm/icons/loader-circle.js [app-client] (ecmascript) <export default as Loader2> was instantiated because it was required from module [project]/src/components/grading/SemesterModal.tsx [app-client] (ecmascript), but the module factory is not available.
```

## Review Result

The root-cause direction is correct: this is most likely a stale Next.js client chunk/runtime mismatch, not an invalid `Loader2` import. The `lucide-react` dependency is installed and `Loader2` is imported through the normal package entrypoint.

No app-level service worker, `next-pwa`, or Workbox configuration was found in the repository. That means the stale response is more likely coming from one of these layers:

- Browser cache.
- CDN or reverse proxy cache.
- Stale HTML/RSC response after deployment.
- Incomplete cache invalidation between Next.js builds.

## What Was Wrong Or Incomplete

### 1. The previous document was accidentally emptied

`taskscope-1.md` currently has no content in the working tree. That loses the root-cause notes, the intended fix, and the verification checklist.

Required correction:

- Restore this file with the reviewed scope.
- Keep the scope focused on the `Loader2`/Next.js client chunk cache issue.
- Record what was wrong, what was corrected, and what still needs verification.

### 2. `middleware.ts` is deprecated in this project context

The first implementation used `frontend/src/middleware.ts`. The project is on Next.js `^16.1.6`, where the middleware file convention has been renamed to `proxy`; `middleware` is deprecated.

Required correction:

- Remove `frontend/src/middleware.ts`.
- Add `frontend/src/proxy.ts`.
- Export a function named `proxy`.

Current status:

- `frontend/src/middleware.ts` is no longer present.
- `frontend/src/proxy.ts` exists and exports `proxy`.

### 3. The previous middleware shape had an unused request parameter

The earlier middleware imported `NextRequest` and accepted a `request` argument that was not used. This is not a runtime bug, but it is unnecessary and may become a lint/type hygiene issue if stricter rules are enabled.

Required correction:

- Do not import `NextRequest`.
- Do not accept an unused `request` argument.

Current status:

- `frontend/src/proxy.ts` imports only `NextResponse`.
- `proxy()` has no unused parameter.

### 4. `/_next/static` must not be overridden

An earlier attempted fix changed cache headers for `/_next/static`. That is not correct for this issue. Next.js static chunks are content-hashed and should keep the framework default caching behavior.

Required correction:

- Do not add custom `Cache-Control` headers for `/_next/static`.
- Apply no-cache behavior only to app shell and route responses that may reference stale chunks.
- Exclude `/_next/static`, `/_next/image`, `favicon.ico`, and file-like asset paths from the matcher.

Current status:

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

### 5. The fix reduces recurrence but does not repair already-stale clients by itself

Adding app-shell no-cache headers prevents future stale HTML/RSC responses from lingering, but users who already have a stale browser/CDN response may still need cache invalidation.

Required correction:

- Purge CDN/reverse proxy cache for HTML and app responses during deployment.
- Ask affected users to hard refresh once if they already loaded the stale runtime.
- Confirm no external service worker or platform-level cache rule is serving old responses.

### 6. Build verification is still blocked

`npm run build` was attempted but failed before proving the application build:

```text
EPERM: operation not permitted, open 'D:\PROJECT\manager point\frontend\.next\trace'
```

This points to a local Windows permission or file-lock issue around `.next\trace`. It does not prove the code change is invalid, but it means build verification is incomplete.

Required correction:

- Stop any running Next.js process that may hold `.next\trace`.
- Clean the local `.next` directory only after confirming it is safe.
- Re-run `npm run build`.

## Implemented Correction

The deprecated middleware approach was replaced with a Next.js 16-compatible proxy file.

Implemented file:

```txt
frontend/src/proxy.ts
```

Current implementation:

```ts
import { NextResponse } from 'next/server';

const APP_SHELL_CACHE_CONTROL = 'private, no-cache, no-store, max-age=0, must-revalidate';

export function proxy() {
  const response = NextResponse.next();

  response.headers.set('Cache-Control', APP_SHELL_CACHE_CONTROL);

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

## Files To Keep Or Review

- `frontend/src/proxy.ts`: keep this as the active cache-control fix.
- `frontend/src/middleware.ts`: should remain removed.
- `frontend/next.config.js`: should not contain custom `/_next/static` cache headers.
- `taskscope-1.md`: keep this reviewed scope as the action record for the `Loader2` issue.

## Verification Completed

- `npm test` for the frontend passed previously with 95 tests.
- The known `CopyScoreModal` stderr during tests is expected from the test case that simulates an API connection error.

## Verification Still Required

1. Resolve the local `.next\trace` file lock or permission issue.
2. Re-run `npm run build`.
3. Run the production server with `npm run start`.
4. Open the grading semester modal that uses `SemesterModal.tsx`.
5. Confirm the `Loader2` module factory error no longer appears.
6. Confirm app shell responses include:

```text
Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
```

7. Confirm `/_next/static/*` chunk responses are still handled by Next.js defaults.
8. Confirm deployment/CDN/proxy rules do not override the intended headers.
9. Purge stale HTML/app response cache during the next deployment.

## Acceptance Criteria

- `frontend/src/proxy.ts` is used instead of deprecated `middleware.ts`.
- No unused proxy request parameter remains.
- App shell responses force revalidation.
- `/_next/static` chunk cache behavior is left to Next.js defaults.
- CDN/proxy cache rules do not serve stale HTML/RSC responses after deployment.
- `npm test` passes for the frontend.
- `npm run build` passes after the `.next\trace` lock is cleared.
- `SemesterModal.tsx` no longer triggers the missing `Loader2` module factory error after deployment and cache purge.
