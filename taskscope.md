# Task Scope Review: Notification Unauthorized Console Error

## Objective

Review the existing fix scope against the current working tree and record what is now inaccurate, already fixed, or still missing for the screenshots showing:

```text
Console Error
Unauthorized
handleResponse -> fetchNotifications
handleResponse -> Object.getNotifications -> fetchNotifications
```

## Current Code Status

The original root cause remains valid: notification endpoints are protected, and stale or expired auth state can make notification requests return `401 Unauthorized`. However, several previously listed fixes are already implemented in the working tree.

Already fixed:

- `frontend/src/api/notification-api.ts` uses shared `httpClient()` and shared `handleResponse()` for notification endpoints.
- `frontend/src/api/http-client.ts` exports `ApiError` and `isAuthError(error)`.
- `frontend/src/components/layout/Header.tsx` uses `Promise.all()` for independent unread-count and recent-notification requests.
- `Header.fetchNotifications()` suppresses expected auth errors and resets `notifications` to `[]` and `unreadCount` to `0` on `401`.
- `frontend/src/lib/notifications.ts` uses `logUnexpectedNotificationError()` and suppresses expected `401` console noise.
- `frontend/src/providers/auth-provider.tsx` now returns immediately after `401` in both `/api/auth/me` and `/students/me` validation paths, preventing stale user rehydration.
- `frontend/src/app/notifications/page.tsx` now uses `isAuthError()` around page loads, mutations, and navigation mark-read paths.

## What Was Wrong Or Outdated In The Previous Scope

### 1. Treating `notification-api.ts` as still unfixed is outdated

The previous scope said this file still needed to move from raw authenticated `fetch()` to `httpClient()`. That is no longer true.

Keep this only as an acceptance criterion:

- Do not reintroduce raw authenticated `fetch()` inside `notification-api.ts`.
- Keep all protected notification calls on `httpClient()` so refresh/retry behavior remains centralized.

### 2. Header initial loading is no longer missing state reset

The previous scope said `Header.fetchNotifications()` suppresses `401` but leaves stale count/list values. The current code now clears both values on auth error.

Remaining header issue:

- `handleMarkAllRead()` and `handleMarkRead()` still call `console.error(...)` for every error, including expected `401`.

Required correction:

- Use `isAuthError(error)` in both handlers.
- Suppress expected auth errors.
- Keep diagnostics for non-auth errors.

### 3. Background helper centralization is already done

The previous scope said `frontend/src/lib/notifications.ts` repeated inline `error?.status !== 401` checks. That is now fixed with `logUnexpectedNotificationError()`.

Keep this as a regression guard:

- New background notification helper methods must use the shared logging helper.
- Do not add direct `console.error()` calls for expected auth failures in background notification code.

### 4. `/notifications` page handling is mostly already fixed

The previous scope listed `loadCounts()`, `loadPaginated()`, `handleMarkRead()`, and `handleNavigate()` as missing expected-auth handling. The current code now checks `isAuthError()` in those paths, and also in save, mark-all-read, delete, and bulk-delete paths.

Remaining verification:

- Confirm expected `401` does not show feature-level toast messages on `/notifications`.
- Confirm non-auth failures such as `500` still show useful toast/log diagnostics.

## Missing Items Still To Add To The Fix Scope

### 1. Header mutation handlers still log expected auth errors

File:

```text
frontend/src/components/layout/Header.tsx
```

Current risky paths:

```ts
handleMarkAllRead()
handleMarkRead(id)
```

Both handlers call `console.error(...)` without `isAuthError()` filtering. If the user clicks the notification dropdown while the session is stale, this can still trigger the Next.js development console overlay.

Required correction:

- Import/use the already available `isAuthError()` checks in these handlers.
- Optionally clear header notification state on expected auth failure, matching `fetchNotifications()`.

### 2. Notification readers modal still logs expected auth errors

File:

```text
frontend/src/components/modals/NotificationReadersModal.tsx
```

Current risky path:

```ts
notificationApi.getNotificationReaders(notificationId)
```

The catch block always calls:

```ts
console.error(err);
setError(err.message || '...');
```

This can still show a development overlay if the readers modal is opened while the session is stale.

Required correction:

- Import `isAuthError()` from `frontend/src/api/http-client.ts`.
- Suppress `console.error()` for expected auth errors.
- Avoid showing a feature-level "cannot load readers" message for expected session expiration.
- Keep the visible modal error for non-auth failures.

### 3. Reports export paths can still toast expected auth failures

File:

```text
frontend/src/app/reports/page.tsx
```

Initial notification dataset loading already uses fallback catches:

```ts
notificationApi.getNotifications({ limit: 100 }).catch(() => ({ items: [], total: 0 }))
```

That reduces overlay risk. However, export paths use `fetchAllPagesForExport(notificationApi.getNotifications, ...)`; if auth expires during export, the top-level catch shows a generic export failure toast.

Required correction:

- In `fetchFullDatasetForExport()`, check `isAuthError(error)`.
- For expected auth errors, let global session handling own redirect/session expiry and avoid noisy export-level toast.
- Keep export toasts for non-auth failures such as server errors, row-limit errors, or malformed responses.

### 4. Dashboard and reports fallback catches should remain intentionally silent for auth

Files:

```text
frontend/src/app/page.tsx
frontend/src/app/reports/page.tsx
```

The dashboard notification calls already use `.catch(() => fallback)`, which avoids the screenshot overlay. This is acceptable for optional dashboard widgets, but it should be documented as intentional.

Required verification:

- Confirm optional notification widgets return fallback values on expected `401`.
- Confirm auth state still clears through `httpClient()` when refresh fails.
- Confirm non-auth failures remain observable somewhere useful during development.

### 5. Keep `AuthProvider` raw validation fetches intentional

`AuthProvider.loadUserPermissions()` still uses raw `fetch()` for:

```text
GET /api/auth/me
GET /students/me
```

The code now documents why: this is the primary session validation path and should avoid recursive silent-refresh behavior. That is acceptable if kept deliberate.

Required guardrails:

- Keep early `return` statements after `401`.
- Keep token/user/permissions clearing together.
- Do not call `setUser(updatedUser)` after clearing auth.
- If this path is later moved to `httpClient()`, re-check duplicate redirects/toasts.

## Updated Required Fix

1. Keep `notification-api.ts` on shared `httpClient()` and shared `handleResponse()`.
2. Keep `isAuthError()` as the single status-based auth-error helper.
3. Update `Header.handleMarkAllRead()` and `Header.handleMarkRead()` to suppress expected `401`.
4. Update `NotificationReadersModal` to suppress expected `401` console logging and feature-level error state.
5. Update reports export error handling to avoid noisy export toast on expected auth expiration.
6. Keep `AuthProvider` early-return behavior after auth validation `401`.
7. Verify optional dashboard/report notification widgets continue to use safe fallback behavior.

## Verification Checklist

1. Log in normally and confirm the header bell loads unread count and recent notifications.
2. Expire the access token while the refresh cookie is valid; confirm notification requests refresh and retry without a dev overlay.
3. Expire or remove the refresh cookie while keeping stale local user state; confirm auth clears and redirects without an `Unauthorized` overlay.
4. Click header notification actions after session expiry and confirm no `console.error` overlay appears for expected `401`.
5. Open `/notifications` with stale auth and confirm list, count, mark-read, mark-all-read, delete, and navigation actions suppress expected auth errors.
6. Open the notification readers modal with stale auth and confirm no expected-auth console overlay appears.
7. Run reports notification export with stale auth and confirm the session-expired path is quiet while non-auth export failures remain visible.
8. Open dashboard and reports pages with stale auth and confirm notification fallback paths do not spam the console.
9. Confirm non-auth server failures such as `500` still produce useful diagnostics.
10. Run frontend tests:

```bash
npm test
```

11. Run a production build after clearing any local `.next` file lock:

```bash
npm run build
```

## Acceptance Criteria

- Expected notification `401` failures do not trigger the Next.js development console overlay.
- Header initial load and header mutation paths handle expected auth errors consistently.
- Background notification helpers do not log expected auth errors.
- `/notifications` page and notification readers modal handle expected auth errors consistently.
- Reports export does not show feature-level failure toasts for expected session expiration.
- `AuthProvider` cannot rehydrate stale users after clearing auth.
- Non-auth errors remain debuggable.
- Tests and manual notification flows pass.
