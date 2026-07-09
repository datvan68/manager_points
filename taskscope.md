# Taskscope: Consolidate RBAC Permissions Into Business Groups

## 1. Task ID + Pipeline

Task ID: `TSK-RBAC-GROUPS-20260709`

Pipeline: `feature_development`

## 2. Risk Level

Risk Level: `high`

Reason: this task changes RBAC seed data, default role permission bundles, route permission preview behavior, and the admin permission-assignment UI. Incorrect grouping can over-grant or under-grant access.

## 3. Objective

Consolidate the current large permission matrix into clear business groups so each group contains both page-access permissions and the related task/action permissions for that page. Separate admin-only RBAC and system-operations permissions into dedicated groups so non-admin roles can be configured without scanning unrelated high-risk permissions.

## 4. Scope

Change exactly these files:

- `backend/src/auth/permissions.registry.ts`
- `backend/src/auth/services/auth.service.ts`
- `backend/src/auth/test/auth.service.spec.ts`
- `frontend/src/app/(dashboard)/permissions/page.tsx`
- `frontend/src/app/(dashboard)/permissions/preview-permissions.ts`
- `frontend/src/app/(dashboard)/permissions/preview-permissions.test.ts`

## 5. Out of Scope

- Do not change authentication login, refresh-token, password-reset, or cookie behavior in `backend/src/auth/services/auth.service.ts` outside RBAC seed and page-permission-scope sections.
- Do not change `JwtAuthGuard`, `PermissionsGuard`, `CheckPermissionGuard`, `RouteGuard`, or any guard/decorator behavior.
- Do not add database migrations or modify MongoDB schemas in `backend/src/auth/schemas/*.ts`.
- Do not change production `.env*` files, Docker files, Kubernetes files, CI/CD files, or deployment configuration.
- Do not rename existing permission codes used by guards or existing route mappings.
- Do not delete existing roles or remove custom role permissions from existing database records.
- Do not modify unrelated modules such as students, grading, dormitory, club, reports, notifications, or dashboard business logic.
- Do not introduce a new role model, policy engine, or external authorization library.

## 6. Context & Dependencies

- Existing RBAC data is seeded from `backend/src/auth/services/auth.service.ts` through `seedDeclaredPermissions()`, `seedRbac()`, `getPagePermissionScopes()`, and route mappings inside `seedRbac()`.
- Existing declared permission definitions live in `backend/src/auth/permissions.registry.ts` as `DECLARED_PERMISSION_SEEDS` and group constants such as `SYSTEM_PERMISSIONS_GROUP`, `STUDENT_MANAGER_GROUP`, `GRADING_MANAGER_GROUP`, `TASK_MANAGER_GROUP`, `SYSTEM_OPERATIONS_GROUP`, `REPORT_MANAGER_GROUP`, `CLUB_MANAGER_GROUP`, `DORMITORY_MANAGER_GROUP`, and `PROPOSED_PERMISSION_GROUP`.
- The frontend permission matrix loads permissions, groups, roles, route mappings, and page scopes in `frontend/src/app/(dashboard)/permissions/page.tsx`.
- The frontend role matrix stores checked permissions by permission code and converts codes back to permission `_id` before calling `authApi.updateRole()`.
- The route `/permissions` is protected by `<RouteGuard requiredPermission="admin" useDynamicMapping={true} failClosed={true}>`.
- Current admin-only endpoints in `backend/src/auth/controllers/auth.controller.ts` still require `ADMIN_FULL`; this task must not weaken those endpoint guards.
- Use existing package scripts only:
  - backend tests run from `backend` with `npm test`.
  - frontend tests run from `frontend` with `npm test`.
  - backend build runs from `backend` with `npm run build`.
  - frontend build runs from `frontend` with `npm run build`.

## 7. Steps

### PLAN

1. In `backend/src/auth/permissions.registry.ts`, define the target permission groups as the source of truth:
   - Keep `STUDENT_MANAGER_GROUP` for `/students` page access and all student, department, and class actions.
   - Keep `GRADING_MANAGER_GROUP` for `/grading` page access and all grading-record actions.
   - Keep `TASK_MANAGER_GROUP` for student-task actions.
   - Keep `SYSTEM_OPERATIONS_GROUP` for `/system` page access, login logs, system requests, performance read, and database backup actions.
   - Keep `REPORT_MANAGER_GROUP` for `/reports` page access and report-read actions.
   - Keep `CLUB_MANAGER_GROUP` for `/clubs` or club-domain page/action permissions.
   - Keep `DORMITORY_MANAGER_GROUP` for `/dormitory` or dormitory-domain page/action permissions.
   - Replace the current mixed admin/proposed bucket with an explicit admin-only group named `ADMIN_RBAC_GROUP` with code `G_ADMIN_RBAC`.
2. In `backend/src/auth/permissions.registry.ts`, map every admin console permission to `ADMIN_RBAC_GROUP.name`:
   - `admin`
   - `view_users`
   - `reset_pwd`
   - `ADMIN_FULL`
   - `USER_CREATE`
   - `USER_UPDATE`
   - `USER_DELETE`
   - `ROLE_CREATE`
   - `ROLE_UPDATE`
   - `ROLE_DELETE`
   - `PERMISSION_CREATE`
   - `PERMISSION_UPDATE`
   - `PERMISSION_DELETE`
   - `PERMISSION_GROUP_CREATE`
   - `PERMISSION_GROUP_UPDATE`
   - `PERMISSION_GROUP_DELETE`
   - `ROUTE_PERMISSION_CREATE`
   - `ROUTE_PERMISSION_UPDATE`
   - `ROUTE_PERMISSION_DELETE`
3. In `backend/src/auth/permissions.registry.ts`, ensure each non-admin group contains the page-access code plus related action codes:
   - `STUDENT_MANAGER_GROUP`: `STUDENT_PAGE`, `STUDENT_READ`, `STUDENT_CREATE`, `STUDENT_UPDATE`, `STUDENT_DELETE`, `STUDENT_IMPORT`, `STUDENT_EXPORT`, `STUDENT_ACCOUNT_ACTIVATE`, `STUDENT_ACCOUNT_RESET_PASSWORD`, `STUDENT_TRANSFER`, `DEPT_CREATE`, `DEPT_UPDATE`, `DEPT_DELETE`, `CLASS_CREATE`, `CLASS_UPDATE`, `CLASS_DELETE`.
   - `GRADING_MANAGER_GROUP`: `GRADING_PAGE`, `GRADING_SEMESTER_MANAGE`, `READ_STUDENT_RECORD`, `CREATE_STUDENT_RECORD`, `UPDATE_STUDENT_RECORD`, `DELETE_STUDENT_RECORD`, `READ_CLASS_RECORD`, `CREATE_CLASS_RECORD`, `UPDATE_CLASS_RECORD`, `DELETE_CLASS_RECORD`, `CONFIG_RECORD`.
   - `TASK_MANAGER_GROUP`: `READ_STUDENT_TASK`, `CREATE_STUDENT_TASK`, `UPDATE_STUDENT_TASK`, `DELETE_STUDENT_TASK`.
   - `SYSTEM_OPERATIONS_GROUP`: `SYSTEM_ADMIN`, `SYSTEM_PERFORMANCE_READ`, `LOGIN_LOG_READ`, `SYSTEM_REQUEST_READ`, `SYSTEM_REQUEST_MANAGE`, `DATABASE_BACKUP_READ`, `DATABASE_BACKUP_CREATE`, `DATABASE_BACKUP_DOWNLOAD`, `DATABASE_BACKUP_DELETE`, `DATABASE_BACKUP_RESTORE`.
   - `REPORT_MANAGER_GROUP`: `REPORTS_PAGE`, `REPORTS_READ`.
4. In `backend/src/auth/services/auth.service.ts`, identify only these RBAC sections for modification:
   - `getPagePermissionScopes()`
   - `seedRbac()` permission seed list
   - `seedRbac()` default role definitions
   - `seedRbac()` permission group seed list
   - `seedRbac()` route mappings
   - `seedDeclaredPermissions()` only if it must import and use the new group constants.

### EXECUTE

1. In `backend/src/auth/permissions.registry.ts`, add `ADMIN_RBAC_GROUP` near the existing group constants with:
   - `code: 'G_ADMIN_RBAC'`
   - `name: 'Admin RBAC Console'`
   - `description: 'Admin-only permissions for user, role, permission, permission-group, and route-permission management.'`
   - `status: 'Active'`
2. In `backend/src/auth/permissions.registry.ts`, move admin console permissions from `PROPOSED_PERMISSION_GROUP.name` or other modules to `ADMIN_RBAC_GROUP.name`; keep their existing `code` values unchanged.
3. In `backend/src/auth/permissions.registry.ts`, add missing declared seed entries for `view_users`, `reset_pwd`, `ADMIN_FULL`, and `GRADING_SEMESTER_MANAGE` if they are still defined only inside `seedRbac()`; each added entry must use the same code, name, and description currently seeded in `backend/src/auth/services/auth.service.ts`.
4. In `backend/src/auth/services/auth.service.ts`, remove duplicate inline permission definitions from `seedRbac()` for any permission now declared in `DECLARED_PERMISSION_SEEDS`; keep the existing upsert behavior and `createdPerms` map population.
5. In `backend/src/auth/services/auth.service.ts`, replace the `groups` array inside `seedRbac()` with explicit group records matching the group constants from `backend/src/auth/permissions.registry.ts`; each group must use `$set` for `code`, `name`, and `description`, and `$addToSet: { permissions: { $each: validPerms } }` for permission membership so existing groups receive newly grouped permissions without wiping custom additions.
6. In `backend/src/auth/services/auth.service.ts`, update the default Admin role so it continues to receive `Object.values(createdPerms)` only through `$setOnInsert.permissions`; do not overwrite permissions for an existing Admin role.
7. In `backend/src/auth/services/auth.service.ts`, update the `Security Admin` default role to include only `admin`, `view_users`, `reset_pwd`, and the RBAC CRUD permissions listed in step PLAN.2; do not include `ADMIN_FULL` in `Security Admin`.
8. In `backend/src/auth/services/auth.service.ts`, update `System Operator`, `Audit Viewer`, and `Backup Operator` default roles to use only `SYSTEM_OPERATIONS_GROUP` permissions listed in PLAN.3.
9. In `backend/src/auth/services/auth.service.ts`, update `getPagePermissionScopes()`:
   - `/permissions.access_permissions` remains `['admin']`.
   - `/permissions.action_permissions` contains the full admin console permission list from PLAN.2 except `admin`.
   - `/system.access_permissions` remains system page access and operations read/manage permissions.
   - `/system.action_permissions` contains system operations actions only; it must not contain RBAC admin console CRUD permissions.
   - `/students`, `/grading`, and `/reports` must match the group lists in PLAN.3.
10. In `backend/src/auth/services/auth.service.ts`, update route mappings in `seedRbac()` so each route uses only the page-access permission for that route:
    - `/permissions` uses `admin`.
    - `/system` uses `SYSTEM_ADMIN`.
    - `/students` uses `STUDENT_PAGE`.
    - `/grading` uses `GRADING_PAGE`.
    - `/reports` uses `REPORTS_PAGE`.
11. In `backend/src/auth/test/auth.service.spec.ts`, add regression coverage for `seedRbac()` verifying:
    - `roleModel.findOneAndUpdate()` never writes `permissions` through `$set`.
    - the `G_ADMIN_RBAC` group is upserted.
    - the `G_ADMIN_RBAC` group receives `admin`, `view_users`, `reset_pwd`, user CRUD, role CRUD, permission CRUD, permission-group CRUD, and route-permission CRUD permission IDs.
    - the `G_SYSTEM_OPERATIONS` group does not receive `ROLE_CREATE`, `PERMISSION_CREATE`, `USER_CREATE`, or `ADMIN_FULL`.
12. In `frontend/src/app/(dashboard)/permissions/page.tsx`, update the API group normalization section around the existing `apiGroups = g.map(...)` block:
    - preserve `group.code` as `tag` when `group.code` exists.
    - sort groups in this order before `setGroups(apiGroups)`: `G_ADMIN_RBAC`, `G_SYSTEM_OPERATIONS`, `G_STUDENT`, `G_GRADING`, `G_TASK`, `G_REPORT`, `G_CLUB`, `G_DORMITORY`, `G_UNGROUPED`, then all remaining groups by `name`.
    - within each group, sort permissions so page-access permission codes ending in `_PAGE` or exactly `admin` appear before action permissions, then sort remaining permissions by `code`.
13. In `frontend/src/app/(dashboard)/permissions/page.tsx`, update the role assignment matrix rendering so `G_ADMIN_RBAC` and `G_SYSTEM_OPERATIONS` display a visible high-risk label in the group header; do not disable checkboxes.
14. In `frontend/src/app/(dashboard)/permissions/preview-permissions.ts`, replace the hard-coded `PROPOSED_PERMISSIONS` concept with an `ADMIN_RBAC_PERMISSIONS` list containing the exact admin console permission list from PLAN.2.
15. In `frontend/src/app/(dashboard)/permissions/preview-permissions.ts`, update `buildSystemPreviewAccess()` so admin console visibility is controlled by `admin` or `ADMIN_FULL`, and system operations visibility is controlled only by system operation permissions.
16. In `frontend/src/app/(dashboard)/permissions/preview-permissions.ts`, update the `/permissions` fallback scope so it lists `admin`, `view_users`, `reset_pwd`, `ADMIN_FULL`, and admin console CRUD permissions with status `scope_defined` instead of `proposed`.
17. In `frontend/src/app/(dashboard)/permissions/preview-permissions.test.ts`, update existing tests and add assertions for:
    - `ROLE_CREATE` under `/permissions` is `scope_defined`, not `proposed`.
    - `G_SYSTEM_OPERATIONS`-style permissions do not unlock `/permissions`.
    - `admin` unlocks `/permissions` preview without requiring `ADMIN_FULL`.
    - `ADMIN_FULL` still produces `admin_override` statuses.

### VERIFY

1. From `D:\PROJECT\manager_points\backend`, run `npm test -- auth.service.spec.ts`.
2. From `D:\PROJECT\manager_points\frontend`, run `npm test -- 'src/app/(dashboard)/permissions/preview-permissions.test.ts'`.
3. From `D:\PROJECT\manager_points\backend`, run `npm run build`.
4. From `D:\PROJECT\manager_points\frontend`, run `npm run build`.
5. Inspect changed files with `git diff -- backend/src/auth/permissions.registry.ts backend/src/auth/services/auth.service.ts backend/src/auth/test/auth.service.spec.ts 'frontend/src/app/(dashboard)/permissions/page.tsx' 'frontend/src/app/(dashboard)/permissions/preview-permissions.ts' 'frontend/src/app/(dashboard)/permissions/preview-permissions.test.ts'`.

### REFINE

1. If backend unit tests fail because mocked Mongoose methods lack `updateOne`, `findOneAndUpdate`, `deleteOne`, or `find`, add the missing jest mock method only inside `backend/src/auth/test/auth.service.spec.ts`.
2. If frontend tests fail because expected statuses changed from `proposed` to `scope_defined`, update only `frontend/src/app/(dashboard)/permissions/preview-permissions.test.ts` expected values that reference admin console CRUD permissions.
3. If build fails because the new group constant is not imported, update only the import list at the top of `backend/src/auth/services/auth.service.ts`.
4. If TypeScript fails on group sorting types in `frontend/src/app/(dashboard)/permissions/page.tsx`, add a local `const groupOrder: Record<string, number>` and compare `group.tag || group.code || group.name`; do not introduce a new shared type file.

## 8. Acceptance Criteria

- `backend/src/auth/permissions.registry.ts` contains `ADMIN_RBAC_GROUP` with code `G_ADMIN_RBAC`.
- All admin console permissions listed in PLAN.2 belong to `ADMIN_RBAC_GROUP.name`.
- `G_SYSTEM_OPERATIONS` contains only system-operations permissions and does not contain user, role, permission, permission-group, route-permission CRUD permissions, or `ADMIN_FULL`.
- Each business group contains both its page-access permission and its related action permissions.
- `seedRbac()` adds grouped permissions to existing groups without overwriting custom group memberships.
- Existing roles are not overwritten with new permission arrays because role permissions remain under `$setOnInsert`.
- `/permissions` route mapping continues to require `admin`.
- `/system` route mapping does not require RBAC admin console permissions.
- The frontend permission matrix displays `G_ADMIN_RBAC` separately from system operations.
- The frontend matrix uses backend group codes for display tags instead of generated `G_${idx}` tags when a code exists.
- The frontend preview treats admin console CRUD permissions as real admin RBAC permissions, not proposed permissions.
- All verification commands listed in section 9 pass.

## 9. Verification Commands

Run these exact commands:

```powershell
Set-Location D:\PROJECT\manager_points\backend
npm test -- auth.service.spec.ts
```

```powershell
Set-Location D:\PROJECT\manager_points\frontend
npm test -- 'src/app/(dashboard)/permissions/preview-permissions.test.ts'
```

```powershell
Set-Location D:\PROJECT\manager_points\backend
npm run build
```

```powershell
Set-Location D:\PROJECT\manager_points\frontend
npm run build
```

```powershell
Set-Location D:\PROJECT\manager_points
git diff -- backend/src/auth/permissions.registry.ts backend/src/auth/services/auth.service.ts backend/src/auth/test/auth.service.spec.ts 'frontend/src/app/(dashboard)/permissions/page.tsx' 'frontend/src/app/(dashboard)/permissions/preview-permissions.ts' 'frontend/src/app/(dashboard)/permissions/preview-permissions.test.ts'
```

## 10. Safety Gates

Trigger a Human Gate before continuing if any of these conditions occur:

- The implementation requires deployment to production.
- The implementation requires running a database migration or directly modifying production MongoDB data.
- The implementation requires changing `backend/src/auth/guards/*.ts`, `backend/src/auth/decorators/*.ts`, or `frontend/src/components/RouteGuard.tsx`.
- The implementation changes any production `.env*` file.
- The implementation changes Docker, Kubernetes, Terraform, or CI/CD files.
- Any role other than `Admin` is about to receive `ADMIN_FULL`.
- Existing role permissions would be overwritten through `$set.permissions` instead of `$setOnInsert.permissions`.
- Any verification command fails after 3 loop iterations.

Human Gate Request Schema values:

- `type`: `approval_required`
- `task_id`: `TSK-RBAC-GROUPS-20260709`
- `pipeline_id`: `feature_development`
- `environment`: `development` unless the requester explicitly targets staging or production
- `risk_level`: `high`
- `triggered_by`: one of the Safety Gates above

## 11. Artifacts to Review

Attach these artifacts when triggering a Human Gate:

- `backend/src/auth/permissions.registry.ts`
- `backend/src/auth/services/auth.service.ts`
- `backend/src/auth/test/auth.service.spec.ts`
- `frontend/src/app/(dashboard)/permissions/page.tsx`
- `frontend/src/app/(dashboard)/permissions/preview-permissions.ts`
- `frontend/src/app/(dashboard)/permissions/preview-permissions.test.ts`
- Output log from `npm test -- auth.service.spec.ts`
- Output log from `npm test -- 'src/app/(dashboard)/permissions/preview-permissions.test.ts'`
- Output log from `npm run build` in `backend`
- Output log from `npm run build` in `frontend`
- `git diff -- backend/src/auth/permissions.registry.ts backend/src/auth/services/auth.service.ts backend/src/auth/test/auth.service.spec.ts 'frontend/src/app/(dashboard)/permissions/page.tsx' 'frontend/src/app/(dashboard)/permissions/preview-permissions.ts' 'frontend/src/app/(dashboard)/permissions/preview-permissions.test.ts'`

## 12. loop_iterations override

No override. Use the default `max_loop_iterations: 3` from `safety.md`.
