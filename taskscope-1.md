# Task Scope Review: Notification Unauthorized Console Error

## Review Objective

Review the current notification-auth fix scope and add the missing or inaccurate items needed to fully resolve the Next.js development overlay:

```text
Console Error
Unauthorized
```

The screenshots point to notification loading paths:

```text
handleResponse -> async fetchNotifications
handleResponse -> async Object.getNotifications -> async fetchNotifications
```

## Current Status In Working Tree

The initial root-cause direction is correct. Notification endpoints are protected by `JwtAuthGuard`, and the frontend must treat `401 Unauthorized` as an authenticated-session problem, not as an unexpected notification feature error.

Some corrective work is already present:

- `frontend/src/api/notification-api.ts` now imports `httpClient` and `handleResponse` from `frontend/src/api/http-client.ts`.
- `notification-api.ts` no longer builds its own `Authorization` header from `tokenStorage`.
- `Header.tsx` fetches unread count and recent notifications concurrently with `Promise.all`.
- `Header.tsx` suppresses `console.error` for errors with `status === 401`.
- `frontend/src/lib/notifications.ts` suppresses `console.error` for errors with `status === 401`.
- `AuthProvider` now clears token/user state when `/api/auth/me` returns `401`.

## What Was Inaccurate Or Already Resolved

### 1. The primary notification API refactor is no longer pending

The previous scope says `notification-api.ts` still needs to move from raw `fetch()` to `httpClient()`. That is now already implemented in the working tree.

Keep it as an acceptance criterion, but do not treat it as an unfixed item unless future diffs reintroduce raw authenticated `fetch()` in `notification-api.ts`.

### 2. Header initial notification loading is partially fixed

The `fetchNotifications()` path in `Header.tsx` now avoids logging expected `401` errors, which should address the first screenshot stack.

Remaining issue:

- On an auth failure, the header currently suppresses the error but does not explicitly reset stale `notifications` and `unreadCount` inside the catch block.
- If the user had previous notification state and the session becomes invalid, stale count/list values may remain until `user` becomes `null`.

Required correction:

- On expected `401`, set `notifications` to `[]` and `unreadCount` to `0`.
- Keep non-auth errors visible, but avoid repeated console spam from update events.

### 3. Background helper logging is partially fixed

`frontend/src/lib/notifications.ts` now suppresses console errors for `401`, so the second screenshot stack is likely covered.

Remaining issue:

- The file repeats the same `if (error?.status !== 401) console.error(...)` pattern across several methods.
- This is easy to miss in future notification helper methods.

Required correction:

- Add a small shared helper such as `isExpectedAuthError(error)` or `logUnexpectedNotificationError(message, error)`.
- Use it consistently across `getNotifications`, `addNotification`, `updateNotification`, `markRead`, `markAllRead`, and `deleteNotification`.

## Missing Items To Add To The Fix Scope

### 1. `AuthProvider` can still restore stale student user state after `/students/me` returns `401`

In `frontend/src/providers/auth-provider.tsx`, when the student-link request returns `401`, the code clears tokens and state:

```ts
tokenStorage.clearTokens();
setUser(null);
setPermissions([]);
```

However, the function can continue to the later `if (storedUser)` block and call:

```ts
tokenStorage.setUser(updatedUser);
setUser(updatedUser);
```

That can rehydrate the stale user immediately after clearing it.

Required correction:

- After handling `studentRes.status === 401`, return from `loadUserPermissions()` immediately.
- Alternatively throw a shared `ApiError`/session-expired signal and handle it in one place.

### 2. Auth validation fetches bypass the shared refresh flow

`loadUserPermissions()` uses raw `fetch()` for:

- `GET /api/auth/me`
- `GET /students/me`

This means these validation requests do not benefit from `httpClient()` refresh/retry behavior.

Required correction:

- Prefer `httpClient()` for these protected validation calls, or explicitly document that `AuthProvider` is the one place allowed to handle validation without retry.
- If using `httpClient()`, avoid duplicate redirects/toasts because `httpClient()` already clears tokens and redirects when refresh fails.

### 3. Notification page call sites still log or toast expected auth failures

`frontend/src/app/notifications/page.tsx` still has direct notification calls that can log expected auth failures:

- `loadCounts()`
- `loadPaginated()`
- `handleMarkRead()`
- `handleNavigate()`

These paths are not shown in the screenshots, but they use the same `notificationApi` and can still surface noisy console errors when auth state is stale.

Required correction:

- Apply the same expected-401 handling used in `Header.tsx`.
- For page-level loads, avoid showing "cannot load notifications" toast when the real issue is session expiration.
- For user-triggered mutations, let the global auth/session handling own the redirect and only show a toast for non-auth failures.

### 4. Dashboard and reports notification calls need verification

Other call sites also use `notificationApi`:

- `frontend/src/app/page.tsx`
- `frontend/src/app/reports/page.tsx`

They mostly use `.catch(() => fallback)`, which reduces overlay risk. Still, these paths should be included in verification because they run on protected pages with `Header` mounted and can race with stale auth.

Required correction:

- Confirm expected auth failures return fallback data without `console.error`.
- Confirm non-auth failures still have enough diagnostics during development.

### 5. Centralize expected auth error detection

Current code checks `error?.status !== 401` inline. That works for `ApiError`, but it is fragile if another client throws a differently shaped auth error.

Required correction:

- Export or define a small helper:

```ts
export function isAuthError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as any).status === 401;
}
```

- Use it in notification UI/background code.
- Keep the helper status-based and avoid matching only the message text `"Unauthorized"`.

### 6. Avoid duplicate notification requests where possible

`Header` fetches notifications, and pages like dashboard or notifications center can also fetch notifications on mount. This is acceptable, but it can produce repeated requests during session expiry.

Recommended follow-up:

- Keep the current `Promise.all` pattern for independent count/list calls.
- Consider a shared client-side notification query layer later, such as SWR, to dedupe requests and revalidate after `notifications-updated`.
- This is a follow-up improvement, not required to fix the screenshots.

## Updated Required Fix

1. Keep `notification-api.ts` on the shared `httpClient()` and shared `handleResponse()`.
2. Add consistent expected-auth-error handling for every notification call site that can run in the background.
3. Reset header notification state on expected `401`.
4. Fix `AuthProvider.loadUserPermissions()` so `studentRes.status === 401` cannot clear auth and then re-set a stale user.
5. Decide whether `AuthProvider` protected validation calls should use `httpClient()` or remain intentionally raw with explicit session handling.
6. Review `/notifications` page logging/toast behavior so session-expired cases do not show noisy feature-level errors.

## Verification Checklist

1. Log in normally and confirm the header bell loads unread count and recent notifications.
2. Expire the access token while the refresh cookie is valid; confirm notification requests refresh and retry without an overlay.
3. Expire or remove the refresh cookie while keeping stale local user state; confirm the app clears auth and redirects without an `Unauthorized` overlay.
4. Confirm the header resets unread count and notification list after expected auth failure.
5. Open `/notifications` with a stale session and confirm no `console.error` overlay is produced for expected `401`.
6. Open dashboard and reports pages with a stale session and confirm notification fallback paths do not spam the console.
7. For non-auth server failures such as `500`, confirm useful diagnostics still appear.
8. Run frontend tests:

```bash
npm test
```

9. Run a production build after clearing any local `.next` file lock:

```bash
npm run build
```

## Acceptance Criteria

- `notification-api.ts` uses `httpClient()` for all protected notification endpoints.
- Expected notification `401` failures do not trigger the Next.js development console overlay.
- Header notification state is cleared on expected auth failure.
- `AuthProvider` does not re-set stale users after clearing auth on `401`.
- `/notifications`, dashboard, reports, and helper notification paths handle expected auth failures consistently.
- Non-auth errors remain debuggable.
- Tests and manual notification flows pass.
