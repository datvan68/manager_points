# Task Scope Review: Profile Role Runtime Error Corrections

## Review Summary

The original scope correctly identifies the backend contract mismatch:

- `GET /api/auth/me` returns `role` as a populated object.
- Directly calling `.toLowerCase()` on that object would throw.
- Role checks should use `roleCode`, `roleName`, or a normalization helper.

However, part of the previous scope is outdated when compared with the current codebase.

## Corrections To Previous Scope

### 1. `profile/page.tsx` no longer contains the reported direct call

The current `frontend/src/app/profile/page.tsx` already imports and uses:

```ts
import { isStudentRole } from "@/utils/role.util";
```

The student checks are currently:

```ts
const isStudent = isStudentRole(data);
```

and:

```tsx
{isStudentRole(profile) && (...)}
```

Therefore, this statement from the previous scope is no longer accurate for the current working tree:

```ts
data?.role?.toLowerCase() === 'student'
profile?.role?.toLowerCase() === 'student'
```

Those calls may describe the original bug, but they are not present in the current profile page anymore.

### 2. Extending `isStudentRole(...)` is not optional anymore because it is already done

The previous scope says `frontend/src/utils/role.util.ts` may need a follow-up to support populated role objects. In the current code, this utility already supports that case:

```ts
if (typeof user.role === 'string') {
  roleNames.push(user.role);
} else if (user.role && typeof user.role === 'object') {
  const roleName = user.role.name || user.role.role_code || '';
  if (roleName) roleNames.push(String(roleName));
}
```

This means the helper already avoids the `[object Object]` issue and safely normalizes populated role objects.

### 3. The recommended fix should not add a duplicate local helper

Because `isStudentRole(...)` already exists and is already used by the profile page, the current recommended scope should be:

1. Keep using `isStudentRole(data)` and `isStudentRole(profile)` in `frontend/src/app/profile/page.tsx`.
2. Do not reintroduce direct calls to `profile.role.toLowerCase()`.
3. Keep `profile.role.permissions` unchanged because the backend intentionally returns `role` as an object.
4. Verify that the runtime bundle running in the browser is rebuilt from the current source.

Adding another local `isStudentProfile(...)` helper would duplicate behavior that is already centralized in `frontend/src/utils/role.util.ts`.

## Additional Area To Check

`frontend/src/providers/auth-provider.tsx` still performs a direct string operation here:

```ts
const role = data.roleName || storedUser?.role || "User";
const isStudent = role.toLowerCase().includes("student") ||
  role.toLowerCase().includes("sinh vien") ||
  role.toLowerCase().includes("hoc sinh");
```

This is less likely to be the source of the reported profile-page error because `data.roleName` is returned by `GET /api/auth/me` as a string. Still, this logic is weaker than using the shared helper and should be considered for cleanup.

Recommended follow-up:

```ts
const isStudent = isStudentRole({
  ...storedUser,
  ...data,
});
```

This keeps all role normalization behavior in one utility and prevents future regressions if `storedUser.role` ever becomes an object.

## Updated Fix Scope

No backend response change is required.

Files that are already aligned with the intended fix:

- `frontend/src/app/profile/page.tsx`
- `frontend/src/utils/role.util.ts`
- `backend/src/auth/services/auth.service.ts`

Optional cleanup:

- `frontend/src/providers/auth-provider.tsx`
  - Replace manual `role.toLowerCase().includes(...)` checks with `isStudentRole(...)`.

## Updated Acceptance Criteria

- Opening `/profile` does not throw `profile?.role?.toLowerCase is not a function`.
- `frontend/src/app/profile/page.tsx` contains no direct `.toLowerCase()` call on `profile.role` or `data.role`.
- Student profile detection continues to use `isStudentRole(...)`.
- `isStudentRole(...)` supports:
  - `roleCode: "STUDENT"`
  - `roleName: "Student"`
  - `role: "Student"`
  - `role: { name: "Student" }`
  - `role: { role_code: "STUDENT" }`
- Student users still call `summariesPointApi.getMyLatestSummary()`.
- Non-student users do not call the latest summary endpoint.
- The permissions tab still reads from `profile.role.permissions`.

## Manual Verification Notes

1. Rebuild or restart the frontend dev server to ensure the browser is not running an old bundle.
2. Log in as a Student user.
3. Open `/profile`.
4. Confirm the page renders without the `toLowerCase` runtime error.
5. Confirm the rank badge or fallback rank message renders for Student users.
6. Open the role and permissions tab.
7. Confirm permissions still render from `profile.role.permissions`.
8. Log in as a non-student user and confirm no latest summary request is made.
