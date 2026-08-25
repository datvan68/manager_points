task: "Allow multiple roles per user with deduplicated permissions"
pipeline: feature_development
profile: Full
objective: "Administrators can assign multiple roles and one explicit primary role to a user; effective permissions are a stable, duplicate-free union while legacy single-role behavior remains compatible."

evidence:
  current_behavior: "backend/src/auth/schemas/user.schema.ts:User stores one role; auth.dto.ts accepts role_id; AuthService, RbacService, and JwtStrategy populate one role and expose only its permissions. UserModal, permissions/page.tsx, permissions/[id]/page.tsx, and bulk-create use a scalar role_id."
  expected_behavior: "Persist multiple roles, select a primary role, expose/edit all assignments, and resolve each effective permission code exactly once."
  root_cause: "Persistence, request DTOs, session authorization, permission preview, and user-management UI model role assignment as a scalar."

scope:
  inspect: ["backend/src/auth/{schemas/user.schema.ts,dto/auth.dto.ts,services/auth.service.ts,services/rbac.service.ts,strategies/jwt.strategy.ts}: role and permission contracts", "frontend/src/{components/modals/UserModal.tsx,app/(dashboard)/permissions/page.tsx,app/(dashboard)/permissions/[id]/page.tsx,providers/auth-provider.tsx}: role consumers"]
  write: ["backend/src/auth/schemas/user.schema.ts: additive roles field", "backend/src/auth/dto/auth.dto.ts: role_ids/primary_role_id plus legacy role_id", "backend/src/auth/services/{auth.service.ts,rbac.service.ts}: normalized assignments, permission union, token revocation, deletion guard", "backend/src/auth/strategies/jwt.strategy.ts: multi-role request context", "backend/src/auth/test/{auth.service.spec.ts,auth-security.spec.ts,rbac.service.spec.ts}: RBAC regressions", "frontend/src/api/auth-api.ts and frontend/src/providers/{auth-provider.tsx,auth-provider.test.tsx}: additive role contract/hydration", "frontend/src/components/modals/{UserModal.tsx,__tests__/UserModal.test.tsx}: multi-role UI/payloads", "frontend/src/app/(dashboard)/permissions/{page.tsx,user-list.test.tsx,preview-permissions.ts,preview-permissions.test.ts,[id]/page.tsx,[id]/page.test.tsx}: list, preview, and detail behavior"]
  preserve: ["role, roleName, and roleCode continue to represent the primary role", "Existing role_id-only clients and legacy documents with only role continue working", "Primary role controls persona, GVCN, and StrictAdmin behavior; all roles contribute permissions", "Status, password, advisor-class, impersonation, bulk-result, and responsive-list behavior"]
  out: ["Activating every roleCode-specific domain branch from secondary roles", "Removing role/role_id", "Database migration execution or deployment"]

acceptance_criteria:
  - "AC-01: User supports distinct roles[] plus primary role; a legacy document without roles reads as roles=[role] without requiring a migration."
  - "AC-02: Create, update, bulk-create, and PATCH /auth/users/:id/role accept non-empty role_ids and primary_role_id; all IDs must exist, primary must be included, duplicates are normalized, and legacy role_id creates one primary assignment."
  - "AC-03: If ADMIN is selected it must be primary; every assignment change revokes all user refresh tokens, and a role referenced by role or roles cannot be deleted."
  - "AC-04: /auth/me, /auth/users, update responses, and JwtStrategy expose populated roles/roleCodes while legacy primary-role fields remain unchanged."
  - "AC-05: Effective permissions are merged by permission.code in deterministic order—primary role first, then remaining assigned-role order—and each code appears exactly once even when two roles or one malformed role contain duplicates."
  - "AC-06: PermissionsGuard, CheckPermissionGuard, route checks, AuthProvider, and permission preview consume the deduplicated union; removing one role retains a shared permission while another assigned role still grants it."
  - "AC-07: Single and bulk UserModal flows select multiple roles and one primary role; edit hydration, validation, TEACHER-primary GVCN controls, and role_ids/primary_role_id payloads are correct."
  - "AC-08: Người dùng cards/table and filters consider every assigned role; user detail shows all role chips, marks primary, edits the full assignment, and lists every effective permission once."

execution:
  - "E-01 [AC-01..AC-06] backend auth schema/DTO/services/JwtStrategy → add compatible role normalization, stable code-keyed permission union, security validation, session revocation, and deletion protection."
  - "E-02 [AC-01..AC-06] backend auth tests → cover legacy fallback, CRUD/bulk/assignment, invalid/admin-primary cases, cross-role and intra-role duplicates, shared-permission retention, response order, guards, and revocation."
  - "E-03 [AC-04..AC-06] frontend auth-api/AuthProvider and preview helpers → retain all roles and consume the server permission union without client-side duplicate display."
  - "E-04 [AC-07] UserModal/tests → replace scalar role state in single/bulk modes with multi-select and explicit primary selection."
  - "E-05 [AC-07,AC-08] permissions page/detail/tests → submit, hydrate, display, filter, and edit full assignments while preserving current responsive behavior."

temporary_artifacts:
  create: ["docs/task/taskscope.md"]
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01..AC-06] npm --prefix backend test -- src/auth/test/auth.service.spec.ts src/auth/test/auth-security.spec.ts src/auth/test/rbac.service.spec.ts --runInBand → suites pass, including duplicate-code assertions."
  - "V-02 [AC-01..AC-06] npm --prefix backend run build → exit 0."
  - "V-03 [AC-07,AC-08] npm --prefix frontend test -- 'src/components/modals/__tests__/UserModal.test.tsx' 'src/app/(dashboard)/permissions/user-list.test.tsx' 'src/app/(dashboard)/permissions/[id]/page.test.tsx' → suites pass."
  - "V-04 [AC-04..AC-06] npm --prefix frontend test -- 'src/providers/auth-provider.test.tsx' 'src/app/(dashboard)/permissions/preview-permissions.test.ts' → suites pass with unique permission codes."
  - "V-05 [AC-07,AC-08] npm --prefix frontend run typecheck → exit 0."
  - "V-06 [AC-02..AC-08] Manual create/edit/login with two roles sharing permissions and ADMIN+another role → primary marker, unique permission summary, shared-permission retention, token invalidation, filters, and responsive UI meet criteria."

risks: ["Authorization and stored user shape change across both packages; inconsistent primary/secondary handling could overgrant role-only behavior.", "Deduplicating by ObjectId instead of permission.code would leave semantic duplicates.", "frontend/src/app/(dashboard)/permissions/page.tsx currently has uncommitted edits overlapping an implementation path."]
stop_conditions: ["Stop implementation until the owner confirms or commits the overlapping page.tsx edits.", "Stop for product direction if secondary roles must activate roleCode-only domain branches, ADMIN may be secondary, or permission ordering differs from primary-first.", "Any persistent-data migration or deployment requires a separate Human Gate."]
