# Task Scope: Teacher Basic Permission Defaults

## Objective

Update the default RBAC seed for the `Teacher` role so Teacher accounts receive the basic permissions required to access and view student-management and grading areas.

## Target Role

- Role name: `Teacher`
- Role code: `TEACHER`

## Required Default Permissions

The Teacher role should be seeded with exactly these basic permissions:

- `STUDENT_READ`
- `GRADING_PAGE`
- `STUDENT_PAGE`

## Current Context

The current backend RBAC seed defines the Teacher role in:

- `backend/src/auth/services/auth.service.ts`

The existing Teacher seed currently includes:

- `view_users`
- `GRADING_PAGE`
- `READ_STUDENT_TASK`

This should be adjusted so Teacher no longer receives the unrelated user-list or task-read defaults as part of the basic Teacher permission set.

## Implementation Scope

### Backend

Update the `seedRbac()` Teacher role definition in `backend/src/auth/services/auth.service.ts`.

Change the Teacher permissions array to:

```ts
permissions: [
  createdPerms['STUDENT_READ'],
  createdPerms['GRADING_PAGE'],
  createdPerms['STUDENT_PAGE'],
].filter(Boolean),
```

Use `.filter(Boolean)` to avoid writing `undefined` values if a permission seed is missing unexpectedly.

### Frontend

No frontend code change is required for this scope.

The frontend already reads permissions from the authenticated user payload and uses permission helpers such as `hasPermission(...)`, `hasAnyPermission(...)`, and route permission mappings.

## Out Of Scope

- Adding new permission codes.
- Changing route permission mappings.
- Changing page-level action permissions.
- Granting Teacher create, update, delete, import, export, or task-management permissions.
- Modifying existing users manually in the database.
- Changing Admin, Supervisor, Student, or system operation role defaults.

## Acceptance Criteria

- The Teacher seed in `backend/src/auth/services/auth.service.ts` includes `STUDENT_READ`.
- The Teacher seed includes `GRADING_PAGE`.
- The Teacher seed includes `STUDENT_PAGE`.
- The Teacher seed no longer includes `view_users`.
- The Teacher seed no longer includes `READ_STUDENT_TASK`.
- On backend startup, the `TEACHER` role is upserted with the updated permission list.
- A Teacher user receives the updated permission codes through JWT validation and `/api/auth/me`.
- Teacher can access grading pages that require `GRADING_PAGE`.
- Teacher can access student-management pages that require `STUDENT_PAGE`.
- Teacher can view student data guarded by `STUDENT_READ`.

## Verification Notes

1. Restart the backend so RBAC seeding runs.
2. Log in as a Teacher user.
3. Confirm `/api/auth/me` returns:
   - `STUDENT_READ`
   - `GRADING_PAGE`
   - `STUDENT_PAGE`
4. Confirm `/api/auth/me` does not return:
   - `view_users`
   - `READ_STUDENT_TASK`
5. Confirm Teacher can open the student and grading modules.
6. Confirm Teacher does not gain create, update, delete, import, export, or task-management permissions unless assigned separately.
