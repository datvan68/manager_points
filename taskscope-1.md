# Task Scope Review: Profile Page Runtime Safety After Latest Update

## Review Summary

The latest working tree already fixes most of the original `/profile` role runtime issue. The task scope should now be updated so it does not ask for duplicate helpers or repeat work that has already been completed.

Current status:

- `frontend/src/app/profile/page.tsx` calls `normalizeProfile(rawData)` before storing profile data.
- `frontend/src/app/profile/page.tsx` uses `isStudentRole(...)` for student checks.
- `frontend/src/app/profile/page.tsx` now has a local `loadError` state and a retry UI for failed `authApi.getMe(...)` calls.
- `frontend/src/app/profile/page.tsx` guards `date_birth` parsing when the profile is first loaded.
- `frontend/src/app/profile/_lib/normalize-profile.ts` supports `role._id`, `role.id`, `role.role_code`, and `role.code`.
- `frontend/src/app/profile/_lib/normalize-profile.ts` filters malformed permission objects that have neither `name` nor `code`.
- `frontend/src/utils/role.util.ts` supports role strings, `roleName`, `roleCode`, populated role objects, `role.code`, and role arrays.
- `frontend/src/providers/auth-provider.tsx` uses the shared `isStudentRole(...)` helper.
- `frontend/src/app/profile/error.tsx` and `frontend/src/app/profile/loading.tsx` exist.
- Focused tests for profile normalization and role utilities pass.

## Current Backend Contract

`GET /api/auth/me` is produced by `backend/src/auth/services/auth.service.ts`.

The response shape currently includes:

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

The frontend should continue adapting to this contract. Do not rename backend fields from `role_code` to `code` only to match the frontend model.

## What Is Already Correct

### 1. The original role crash path is covered

The profile page no longer performs direct calls like:

```ts
profile.role.toLowerCase()
data.role.toLowerCase()
rawData.role.toLowerCase()
```

The only `.toLowerCase()` calls in this flow are inside `frontend/src/utils/role.util.ts`, after `getRoleString(...)` has converted supported role shapes into a string.

### 2. Profile response normalization is page-scoped

`normalizeProfile(...)` lives under:

```text
frontend/src/app/profile/_lib/normalize-profile.ts
```

This is the right boundary because the shape is currently specific to the profile page. It avoids pushing page-specific data-mapping details into global providers.

### 3. Backend role shape is now covered by tests

`frontend/src/app/profile/_lib/normalize-profile.test.ts` includes a real backend-style payload with:

- `role._id`
- `role.role_code`
- `role.permissions`
- top-level `roleName`
- top-level `roleCode`

This closes the previous mismatch where tests only covered `role.id` and `role.code`.

### 4. Permission rendering is safer

Malformed permission entries are filtered out when they have neither `name` nor `code`. This prevents blank permission rows in the role and permissions tab.

### 5. Async profile fetch failure is now handled locally

The profile page now has:

- `loadError`
- retry button
- a page-local failed-load view

This is the right layer for expected `GET /api/auth/me` failures. `error.tsx` should remain reserved for unexpected route/render errors.

## Remaining Gaps

### 1. Cancel-edit date formatting still bypasses the safe date parser

The initial profile load now safely formats `date_birth`, but the cancel-edit branch still uses direct formatting:

```ts
dob: profile?.date_birth ? formatDateStr(new Date(profile.date_birth)) : "",
```

Risk:

- If `profile.date_birth` contains a non-empty invalid date string, this branch can produce an invalid displayed value when the user cancels editing.

Recommended fix:

```ts
const formatProfileDate = (dateStr: string): string => {
  const parsed = parseDate(dateStr);
  return parsed ? formatDateStr(parsed) : "";
};
```

Then use it in both places:

```ts
dob: data.date_birth ? formatProfileDate(data.date_birth) : "",
dob: profile?.date_birth ? formatProfileDate(profile.date_birth) : "",
```

### 2. No component-level regression test covers the retry UI

The helper tests are good, but they do not prove the profile page renders the failed-load state and retries `fetchProfile()`.

Recommended test follow-up:

- Mock `authApi.getMe(...)` failure.
- Assert that the retry view is shown.
- Click retry.
- Assert that `authApi.getMe(...)` is called again.

This can be deferred if the project does not currently have page-level React Testing Library patterns.

### 3. No automated test confirms student summary fetch isolation

Manual behavior appears correct:

- `summariesPointApi.getMyLatestSummary()` is only called when `isStudentRole(data)` is true.
- Its failure is caught and ignored so the main profile page still renders.

Recommended test follow-up:

- Student profile should call `summariesPointApi.getMyLatestSummary()`.
- Non-student profile should not call it.
- Summary fetch failure should not trigger `loadError`.

### 4. Full frontend verification has not been completed in this review

Focused tests passed, but the full frontend suite and production build still need to be run before merge:

```bash
cd frontend
npm test
npm run build
```

## Verification Completed

Focused frontend tests were run successfully:

```bash
cd frontend
npm test -- normalize-profile
npm test -- role.util
```

Result:

- `normalize-profile`: 6 tests passed.
- `role.util`: 40 tests passed.

## Updated Fix Scope

Required follow-up:

- `frontend/src/app/profile/page.tsx`
  - Reuse one safe date-format helper for both initial profile load and cancel-edit reset.

Recommended follow-up:

- Add a component-level test for profile failed-load retry behavior.
- Add a component-level test for student-only latest summary fetching.

Do not include:

- Backend response renaming.
- New duplicate role helpers.
- Global provider rewrites.
- RBAC schema changes.
- Broad profile UI redesign.

## Updated Acceptance Criteria

- Opening `/profile` does not throw a role-related runtime error.
- `frontend/src/app/profile/page.tsx` contains no direct `.toLowerCase()` call on unknown role objects.
- `normalizeProfile(...)` supports the real `GET /api/auth/me` backend payload.
- `isStudentRole(...)` supports `roleCode`, `roleName`, string roles, populated role objects, `role.code`, and role arrays.
- `profile.role.permissions` renders without blank rows from malformed permission entries.
- Failed profile fetches show a local retry UI.
- Failed latest-summary fetches do not fail the whole profile page.
- Invalid `date_birth` values do not produce invalid displayed dates in either initial load or cancel-edit reset.
- `npm test -- normalize-profile` passes.
- `npm test -- role.util` passes.
- Full `npm test` and `npm run build` pass before merge.

## Manual Verification Notes

1. Restart or rebuild the frontend so the browser is not using an old bundle.
2. Log in as a Student user.
3. Open `/profile`.
4. Confirm the page renders without a role-related runtime error.
5. Confirm the latest locked summary badge or fallback message renders.
6. Open the role and permissions tab.
7. Confirm permissions render from `profile.role.permissions`.
8. Log in as a non-student user.
9. Confirm no latest-summary request is made.
10. Simulate a failed `GET /api/auth/me` response.
11. Confirm the retry UI appears and retry attempts to load the profile again.
12. Simulate an invalid non-empty `date_birth`, enter edit mode, then cancel edit.
13. Confirm the displayed date falls back safely instead of showing an invalid date.

## Final Recommendation

The role runtime-safety implementation is mostly complete. The only required code follow-up identified in this review is to reuse the safe date formatting path in the cancel-edit reset branch. After that, run the full frontend test suite and production build before merging.
