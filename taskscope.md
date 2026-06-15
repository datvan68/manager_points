# Task Scope: Page-Scoped Change Safety Review

## Objective

Prevent a change on one page from breaking the whole project by defining a page-scoped workflow for analysis, implementation, testing, and rollback. This review also records the current status of the `/profile` role runtime-safety work after the latest update.

## Current Review Result

The current codebase already includes the main runtime-safety fixes for the profile role issue:

- `frontend/src/app/profile/page.tsx` normalizes the raw `GET /api/auth/me` response through `normalizeProfile(rawData)`.
- `frontend/src/app/profile/page.tsx` uses `isStudentRole(...)` instead of directly calling `.toLowerCase()` on `profile.role`, `data.role`, or `rawData.role`.
- `frontend/src/app/profile/_lib/normalize-profile.ts` now supports the backend role shape that uses `_id` and `role_code`.
- `frontend/src/app/profile/_lib/normalize-profile.ts` filters permission rows that have neither `name` nor `code`.
- `frontend/src/utils/role.util.ts` supports `role.code` and `roles[].code`, in addition to `roleName`, `roleCode`, `role.name`, and `role.role_code`.
- `frontend/src/providers/auth-provider.tsx` uses the shared `isStudentRole(...)` helper instead of local role parsing.
- `frontend/src/app/profile/error.tsx` and `frontend/src/app/profile/loading.tsx` already exist for route-level loading and error isolation.
- Focused tests already exist for `normalizeProfile(...)` and role utility behavior.

The highest-risk mismatch from the previous review has been addressed. The remaining scope should not re-add duplicate helpers or change the backend contract.

## Verified Backend Contract

`GET /api/auth/me` is produced by `backend/src/auth/services/auth.service.ts` and currently returns a populated role object shaped like this:

```ts
{
  id: user._id.toString(),
  user_name: user.user_name,
  email: user.email,
  phone_number: user.phone_number || "",
  department: user.department || "",
  date_birth: user.date_birth || null,
  status: user.status,
  roleName: role?.name || "User",
  roleCode: role?.role_code || "USER",
  role: role ? {
    _id: role._id.toString(),
    name: role.name,
    role_code: role.role_code,
    permissions: role.permissions || [],
  } : null,
  permissions,
}
```

Frontend normalization must continue to support this shape. Do not rename the backend response fields only to match frontend naming.

## Remaining Gaps

### 1. `taskscope.md` was empty

This file did not contain the current reviewed scope. That documentation gap made it easy to repeat outdated tasks that are already fixed in code. This update fills the missing scope and should be treated as the source of truth for the next implementation pass.

### 2. Focused tests were verified after the latest update

The focused tests for the latest role runtime-safety update were run successfully:

```bash
cd frontend
npm test -- normalize-profile
npm test -- role.util
```

Result:

- `normalize-profile`: 6 tests passed.
- `role.util`: 40 tests passed.

Run the broader frontend verification before merge:

```bash
cd frontend
npm test
npm run build
```

### 3. Profile fetch failure UX is still light

`fetchProfile()` catches `authApi.getMe(...)` errors and shows a toast, then clears loading. This prevents a full crash, but the page can still render with `profile === null` and mostly empty content.

Recommended follow-up:

- Add local `loadError` state in `frontend/src/app/profile/page.tsx`.
- Render a small retry state inside the profile page when `GET /api/auth/me` fails.
- Keep this fallback page-local; do not move it into global providers unless multiple routes need the same behavior.

### 4. Date formatting should guard invalid backend dates

The page currently formats `data.date_birth` with `formatDateStr(new Date(data.date_birth))`. If the backend ever returns a non-empty but invalid date string, the UI can display an invalid formatted value.

Recommended follow-up:

- Reuse `parseDate(...)` before formatting `date_birth`.
- Fall back to an empty string when the parsed date is invalid.

### 5. Route-level error boundaries do not replace local async error states

`frontend/src/app/profile/error.tsx` is useful for render-time route failures. It will not automatically convert already-caught async fetch failures into a useful retry UI. Keep both:

- Route-level `error.tsx` for unexpected render errors.
- Local `loadError` state for expected API failure states.

## Page-Scoped Change Rules

Use these rules when adding or editing any specific page:

1. Identify the route folder first, for example `frontend/src/app/profile`.
2. List every imported shared module before editing the page.
3. Prefer page-local helpers under the route folder when the logic is only used by that page.
4. Promote logic to `frontend/src/utils`, `frontend/src/lib`, or providers only when two or more routes need the same behavior.
5. Never change global providers, layouts, middleware, API clients, or shared utilities without adding regression tests for all affected pages.
6. Normalize API responses at the page boundary or in a dedicated mapper before rendering.
7. Keep backend response contracts stable unless the task explicitly includes backend migration.
8. Add route-level `loading.tsx` and `error.tsx` for pages that fetch data or render complex client UI.
9. Keep optional feature fetches isolated. A secondary fetch failure should not break the whole page.
10. Run focused tests before broad tests to catch page-level regressions quickly.

## Profile Page Safety Checklist

Before changing `/profile`, confirm:

- `profile.role` is treated as an object, not a string.
- Student checks use `isStudentRole(...)`.
- `normalizeProfile(...)` remains the single profile response mapper.
- `role._id`, `role.id`, `role.role_code`, and `role.code` are all handled safely.
- Permission rendering reads from `profile.role.permissions`.
- Empty or malformed permission objects do not render blank rows.
- Student users can still load the latest locked summary.
- Non-student users do not call `summariesPointApi.getMyLatestSummary()`.
- Failed latest-summary fetches do not fail the whole profile page.
- Failed profile fetches show a clear retry or fallback state.

## Out Of Scope

Do not include these changes in the current task unless explicitly requested:

- Backend response renaming from `role_code` to `code`.
- Global auth-provider rewrites beyond role-helper usage.
- RBAC schema migrations.
- Sidebar, header, or layout redesign.
- Broad UI refactors unrelated to the profile runtime-safety issue.
- Replacing the existing test framework.

## Acceptance Criteria

- `/profile` does not throw a role-related runtime error.
- No direct `.toLowerCase()` call is made on unknown role objects in the profile page.
- `normalizeProfile(...)` supports the real backend payload from `GET /api/auth/me`.
- `isStudentRole(...)` handles string roles, populated role objects, normalized `role.code`, `roleCode`, and role arrays.
- The profile route has page-level loading and error files.
- Expected API failures are handled locally with user-visible fallback behavior.
- Focused tests for `normalize-profile` and `role.util` pass.
- `npm run build` passes for the frontend before merge.

## Recommended Next Task

Implement only the remaining UX hardening in `frontend/src/app/profile/page.tsx`:

1. Add `loadError` state.
2. Clear `loadError` before retrying `fetchProfile()`.
3. Show a retry panel when the profile fetch fails.
4. Guard invalid `date_birth` formatting.
5. Run focused and full frontend verification.
