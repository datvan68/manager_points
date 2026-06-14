# Task Scope: Profile Role toLowerCase Runtime Error

## User Report

Opening the personal profile page fails with:

```text
profile?.role?.toLowerCase is not a function
```

The affected screen is the profile page that loads the current user through `GET /api/auth/me`.

## Primary Finding

The profile page treats `role` as both a string and an object.

In `frontend/src/app/profile/page.tsx`, student detection calls:

```ts
data?.role?.toLowerCase() === 'student'
profile?.role?.toLowerCase() === 'student'
```

However, the backend `AuthService.getMe(...)` returns `role` as a populated object:

```ts
role: role ? {
  _id: role._id.toString(),
  name: role.name,
  role_code: role.role_code,
  permissions: role.permissions || [],
} : null
```

Because `role` is an object, not a string, optional chaining only protects against `null` or `undefined`. It does not protect against calling `toLowerCase()` on a non-string value. When the profile page evaluates this expression, the browser throws the reported runtime error.

## Contract Mismatch

The current `GET /api/auth/me` response already exposes normalized role fields for role checks:

- `roleName`: display/name value such as `Student`
- `roleCode`: stable code such as `STUDENT`
- `permissions`: flattened permission codes
- `role`: populated role object for role metadata and permission details

Therefore, profile role checks should use `roleCode`, `roleName`, or a small role-normalization helper. They should not call string methods directly on `profile.role`.

## Affected Code

- `frontend/src/app/profile/page.tsx`
  - The `fetchProfile` student check uses `data?.role?.toLowerCase()`.
  - The header rank badge condition uses `profile?.role?.toLowerCase()`.
  - The permissions tab correctly assumes `profile.role` is an object when reading `profile?.role?.permissions`.

- `backend/src/auth/services/auth.service.ts`
  - `getMe(...)` intentionally returns `role` as an object and should not need to change for this bug.

## Recommended Fix Scope

1. Add a local helper or reuse the existing role utility to detect student users safely.

   Recommended local helper shape:

   ```ts
   const isStudentProfile = (user: any): boolean => {
     if (!user) return false;
     if (user.roleCode === 'STUDENT') return true;
     const roleName = String(user.roleName || user.role?.name || '').toLowerCase();
     return roleName === 'student';
   };
   ```

2. Replace both profile-page student checks with the helper.

   The two call sites should become:

   ```ts
   const isStudent = isStudentProfile(data);
   ```

   and:

   ```tsx
   {isStudentProfile(profile) && (...)}
   ```

3. Keep `profile.role.permissions` usage unchanged.

   That part matches the backend response contract because `role` is a populated object.

4. Avoid changing the backend response shape unless there is a broader API contract decision.

   Changing `role` back to a string would likely break the permissions tab and any code that expects populated role details.

## Files To Touch If Fixing

- `frontend/src/app/profile/page.tsx`

Optional follow-up:

- `frontend/src/utils/role.util.ts`
  - Consider extending `isStudentRole(...)` to handle `user.role?.name`, because the current helper safely stringifies `user.role` but would produce `[object Object]` for populated role objects.

## Acceptance Criteria

- Opening `/profile` no longer throws `profile?.role?.toLowerCase is not a function`.
- Student users still trigger `summariesPointApi.getMyLatestSummary()`.
- The rank badge still appears for Student profiles.
- Non-student profiles do not call the latest summary endpoint.
- The permissions tab still renders `profile.role.permissions`.
- No backend API contract change is required.

## Manual Verification

1. Log in as a Student user.
2. Open the personal profile page.
3. Confirm the page renders without a runtime error.
4. Confirm the rank badge area appears and the latest summary request is made.
5. Switch to the role and permissions tab.
6. Confirm the permissions list still renders from `profile.role.permissions`.
7. Log in as a non-student user.
8. Open the profile page and confirm no latest summary request is made.
