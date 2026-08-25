task: "Prevent view-only class access from enabling class mutations"
pipeline: bug_fix
profile: Full
objective: "A non-admin user whose effective permissions contain only class-view access can view classes but cannot create, import, update, or delete them from either the UI or API."

evidence:
  observed:
    - "The class screen gates add/import with CLASS_CREATE and edit/delete actions with CLASS_UPDATE/CLASS_DELETE."
    - "ClassesController already declares CLASS_CREATE, CLASS_UPDATE, and CLASS_DELETE guards on mutation endpoints."
    - "Authorization uses the union of every assigned role and an ADMIN/ADMIN_FULL bypass; testing only one displayed role can therefore misrepresent the account's effective access."
  diagnosis: "The enforcement labels are correct, so reproduce using the account's /auth/me payload and assigned roles to locate leaked, merged, admin-bypassed, or stale action permissions before changing guards."

scope:
  write:
    - "backend/src/auth/utils/role.util.ts and focused auth tests: ensure effective permissions are the deduplicated union of currently assigned roles only, with no implicit CRUD expansion from view/page permissions."
    - "backend/src/auth/services/rbac.service.ts and focused tests: make role permission replacement authoritative, including an empty action-permission selection, and invalidate affected user sessions when permissions are removed."
    - "backend/src/classes/test/classes.controller.spec.ts: add HTTP guard regressions for view-only, individual CRUD permissions, multi-role union, and Admin bypass."
    - "frontend/src/app/(dashboard)/students/page.tsx and page.test.tsx: render/open add, import, edit, and delete controls only for their exact effective permission and block handler invocation otherwise."
    - "frontend/src/providers/auth-provider.tsx and auth-provider.test.tsx: refresh/clear stale effective permissions after authorization changes or rejected mutation requests."
  preserve: ["ADMIN/ADMIN_FULL bypass", "multi-role permission union", "class read/data-scoping behavior", "existing permission codes and API payloads"]
  out: ["Changing view permission into CRUD permission", "Removing multi-role support", "Redesigning the class screen", "Changing class schema or cascade-delete rules"]

acceptance_criteria:
  - "AC-01: A non-admin account with class-view access but without CLASS_CREATE, CLASS_UPDATE, and CLASS_DELETE sees class data and no add/import/edit/delete controls."
  - "AC-02: The same account receives 403 from POST /classes, POST /classes/import/preview, POST /classes/import/confirm, PATCH /classes/:id, and DELETE /classes/:id; the service method is not called."
  - "AC-03: Granting one action permission exposes and authorizes only its matching operation; CLASS_CREATE covers create/import only."
  - "AC-04: Permissions contributed by another assigned role remain effective and deduplicated; the UI identifies this as effective multi-role access rather than treating the selected role as exclusive."
  - "AC-05: Removing action permissions takes effect after session refresh/invalidation, while Admin bypass remains unchanged."

execution:
  - "E-01 [AC-01..AC-05] Reproduce with a non-admin account; record assigned role IDs and /auth/me permissions, then distinguish union/admin/stale-state causes."
  - "E-02 [AC-04,AC-05] Correct only the confirmed effective-permission or invalidation source; do not weaken multi-role union."
  - "E-03 [AC-01,AC-03] Harden class UI action visibility and handler boundaries."
  - "E-04 [AC-02,AC-03] Add end-to-end controller guard coverage for every class mutation route."

temporary_artifacts: {create: ["docs/task/taskscope.md"], cleanup: [], retain: ["docs/task/taskscope.md"]}
verification:
  - "npm --prefix frontend test -- 'src/app/(dashboard)/students/page.test.tsx' 'src/providers/auth-provider.test.tsx'"
  - "npm --prefix frontend run typecheck"
  - "npm --prefix backend test -- src/classes/test/classes.controller.spec.ts src/auth/test/auth.service.spec.ts --runInBand"
  - "npm --prefix backend run build"
  - "Manual: single view-only role cannot mutate; adding a second role with CLASS_UPDATE enables update only; removing it revokes update after session refresh."

risks: ["RBAC is security-sensitive; an incorrect fix could revoke legitimate permissions from another role or broaden mutation access."]
stop_conditions: ["Stop for product direction if multi-role permissions are intended to use precedence/deny semantics instead of the existing union model."]
