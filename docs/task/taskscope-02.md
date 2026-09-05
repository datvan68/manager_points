slot_id: "taskscope-02"
generation: 1
task_id: "20260905-210242-system-wide-permission-policy-alignment"
scope_file: "docs/task/taskscope-02.md"
status: ready
scope_revision: 1
created_at: "2026-09-05T21:02:42+07:00"
updated_at: "2026-09-05T21:02:42+07:00"
base_commit: "b05fc0e530fc2244eee0cad78cad18eeb2e52d2c"
task: "Align permission catalog, dependencies, visible features, and backend enforcement system-wide"
pipeline: bug_fix
profile: Full
objective: "Make every declared permission truthfully represent an enforced system capability, enforce parent/read prerequisites when roles are configured, and keep menus, tabs, actions, route previews, API guards, and effective role permissions consistent across Admin RBAC, HSSV, grading, activities, reports, system operations, and KTX."

coordination:
  depends_on:
    - "docs/task/taskscope-01.md generation 1: consume its completed KTX visible-permission matrix and do not reopen its room/roster implementation."
  warnings:
    - "docs/task/taskscope.md is an empty pre-existing user file, so slot 00 is reserved and untouched."
    - "taskscope-01 is in_progress and reserves KTX roster/layout permission files. This scope has no overlapping writes and must verify taskscope-01 completion before the final cross-system permission audit."
    - "Authorization behavior changes require independent review. Applying permission grants/revocations or modifying production role documents is outside this scope and requires the Human Gate."
  reservation_check: "No active scope reserves the exact write paths below; taskscope-01 owns separate dormitory files. Recheck its identity/status, active reservations, Git status, and candidate writes before execution and before each mutation batch."
  execution_policy: "Planning deliverable only in this turn. Implementation requires the user to pin this exact file. Execute serially in the current worktree; do not mutate runtime/production role or permission data."

completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []

evidence:
  current_behavior:
    - "frontend/src/app/(dashboard)/permissions/page.tsx:togglePermission/toggleGroupPermissions treats every permission as independent; checkboxes have no dependency-based disabled state."
    - "backend/src/auth/services/rbac.service.ts:createRole/updateRole persists permission IDs without validating required parent/read permissions."
    - "backend/src/auth/controllers/auth.controller.ts protects role/permission/group/route CRUD with ADMIN_FULL although granular USER_*, ROLE_*, PERMISSION_*, PERMISSION_GROUP_* and ROUTE_PERMISSION_* codes are declared and displayed."
    - "frontend/src/app/(dashboard)/students/record/page.tsx uses READ/CREATE/UPDATE/DELETE_CLASS_RECORD for visibility, while backend/src/daily-class-report/daily-class-report.controller.ts authorizes the same operations by fixed role names."
    - "frontend/src/app/(dashboard)/activities/page.tsx and related screens use Admin/Teacher/membership booleans for most visible actions even though backend Activity APIs enforce ACTIVITY_* permissions."
    - "frontend/src/components/layout/Sidebar.tsx can link users with STUDENT_READ or READ_STUDENT_TASK to /students/record, but that route requires READ_STUDENT_RECORD; student-area tabs are rendered without per-target access filtering."
    - "backend/src/auth/services/auth.service.ts attributes record actions to /grading although the active feature is /students/record, so preview/diagram scope can disagree with runtime routing."
    - "backend/src/academic-record/academic-record.controller.ts:findByDailyReportId has no authentication/permission guard and calls the service without requester scope."
    - "A static scan found declared codes with no direct frontend permission check, including most ACTIVITY_* and several backend-only KTX codes; absence from a visible tab does not prove a code is unused and requires explicit classification rather than deletion."
  expected_behavior: "One canonical permission policy classifies every declared code, defines access/read prerequisites and UI/API ownership, rejects invalid role combinations, and drives truthful navigation/action visibility and backend enforcement without weakening admin, self-service, ownership, or data-scope rules."
  root_cause: "Permission definitions, route scopes, role assignment, frontend visibility, fixed-role policies, and backend guards evolved independently; no shared dependency contract or automated catalog-to-runtime coverage check prevents drift."

scope:
  inspect:
    - "backend/src/auth/guards/check-permission.guard.ts and permissions.guard.ts: all/any semantics and ADMIN bypass"
    - "backend/src/auth/utils/role.util.ts and frontend/src/providers/auth-provider.tsx: effective permission semantics"
    - "backend/src/activities/, backend/src/activity-schedules/, backend/src/activity-attendance/, backend/src/activity-attendance-config/, backend/src/attendance-sessions/: existing permission, ownership, membership and self-service boundaries"
    - "backend/src/dormitory/controllers/: classify backend-only KTX codes after taskscope-01 without editing its reserved files"
    - "frontend/src/api/activity-api.ts, academic-record-api.ts and daily-class-report-api.ts: endpoint callers used by visible actions"
    - "frontend/src/app/(dashboard)/reports/, system/, dormitory/: final catalog/visibility audit only; amend scope instead of writing an unlisted file"
    - "frontend/package.json and backend/package.json: verification entrypoints"
  write:
    - "backend/src/auth/permissions.registry.ts"
    - "backend/src/auth/controllers/auth.controller.ts"
    - "backend/src/auth/services/auth.service.ts"
    - "backend/src/auth/services/rbac.service.ts"
    - "backend/src/auth/test/auth.controller.spec.ts"
    - "backend/src/auth/test/rbac.service.spec.ts"
    - "backend/src/auth/test/permission-policy.spec.ts (new; parent backend/src/auth/test exists)"
    - "backend/src/academic-record/academic-record.controller.ts"
    - "backend/src/academic-record/academic-record.controller.spec.ts"
    - "backend/src/daily-class-report/daily-class-report.controller.ts"
    - "backend/src/daily-class-report/daily-class-report.controller.spec.ts (new; parent backend/src/daily-class-report exists)"
    - "frontend/src/api/auth-api.ts"
    - "frontend/src/app/(dashboard)/permissions/page.tsx"
    - "frontend/src/app/(dashboard)/permissions/__tests__/page.test.tsx"
    - "frontend/src/app/(dashboard)/permissions/preview-permissions.ts"
    - "frontend/src/app/(dashboard)/permissions/preview-permissions.test.ts"
    - "frontend/src/components/modals/RoleModal.tsx"
    - "frontend/src/components/modals/__tests__/RoleModal.test.tsx"
    - "frontend/src/components/permissions/PermissionFlowDiagram.tsx"
    - "frontend/src/components/layout/Sidebar.tsx"
    - "frontend/src/components/layout/Sidebar.test.tsx"
    - "frontend/src/components/popups/SubsystemPopup.tsx"
    - "frontend/src/components/popups/SubsystemPopup.test.tsx"
    - "frontend/src/app/(dashboard)/students/page.tsx"
    - "frontend/src/app/(dashboard)/students/navigation-order.test.ts"
    - "frontend/src/app/(dashboard)/students/record/page.tsx"
    - "frontend/src/app/(dashboard)/students/record/page.test.tsx"
    - "frontend/src/app/(dashboard)/students/tasks/page.tsx"
    - "frontend/src/components/activities/activity-view-policy.ts"
    - "frontend/src/components/activities/activity-view-policy.test.ts"
    - "frontend/src/app/(dashboard)/activities/page.tsx"
    - "frontend/src/app/(dashboard)/activities/page.test.tsx"
    - "frontend/src/app/(dashboard)/activities/[activityId]/page.tsx"
    - "frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx"
    - "frontend/src/app/(dashboard)/activities/schedule/page.tsx"
    - "frontend/src/app/(dashboard)/activities/schedule/page.test.tsx"
  preserve:
    - "ADMIN/ADMIN_FULL bypass, JWT authentication, multi-role effective permissions, token revocation on permission removal, and least-privilege behavior."
    - "Student self-service, teacher/advisor class scoping, activity membership/president/delegated-attendance policies, creator ownership and service-level data filtering."
    - "All currently enforced API permissions, public compatibility, route response shapes, and taskscope-01 KTX behavior; a backend-only or self-service permission is classified, not removed solely because no frontend literal references it."
    - "No automatic grants, revocations, role-document rewrites, production data reads, migrations, or startup backfills."
  out:
    - "Designing new business features for permissions that have no current UI, redesigning the permissions console, or changing business ownership/scope rules."
    - "Runtime/production permission assignment, persistent role migration, deployment, database mutation, or edits to taskscope-01 reserved dormitory files."
    - "Unrelated authentication, impersonation, account lifecycle, KTX roster/leader, grading calculation, or activity attendance algorithm changes."

acceptance_criteria:
  - "AC-01: Every code in DECLARED_PERMISSION_SEEDS is uniquely classified by a canonical policy as page/module access, read, action, scope modifier, self-service, or backend-only; each non-proposed code names at least one real route/UI/API owner, and a contract test fails on duplicate, unknown, ownerless or falsely mapped codes."
  - "AC-02: Role create/update rejects any action or scope-modifier permission whose declared parent/read prerequisites are missing, rejects unknown IDs, and accepts valid sets and ADMIN_FULL according to the existing bypass contract; validation occurs server-side before save."
  - "AC-03: Both role-assignment surfaces render parent/read permissions before descendants, disable descendants until all prerequisites are selected, explain the missing prerequisite, select prerequisites before group-select, and atomically clear descendants when a prerequisite is removed; search/filtering cannot bypass these rules."
  - "AC-04: HSSV navigation and sub-tabs are shown only when their destination is accessible. READ_STUDENT_RECORD gates Tình hình HSSV and its CREATE/UPDATE/DELETE children; READ_CLASS_RECORD gates Tình hình lớp học and its CREATE/UPDATE/DELETE plus READ_ALL_CLASS_RECORD modifier; users do not receive a visible link that immediately redirects for lack of destination permission."
  - "AC-05: Daily-class-report endpoints enforce the matching READ/CREATE/UPDATE/DELETE_CLASS_RECORD permissions in addition to existing ownership/data-scope rules, and academic-record daily-report reads require authentication plus the same read/self-service constraints as equivalent academic-record reads."
  - "AC-06: Granular Admin RBAC codes shown in the catalog protect their matching create/update/delete endpoints and visible buttons while the admin page-access prerequisite and ADMIN_FULL bypass remain valid; granting a displayed granular code has observable effect and lacking it returns 403 before service mutation."
  - "AC-07: Activity list, detail, schedule, membership, attendance, configuration, report and export controls use the ACTIVITY_* or ATTENDANCE_SESSION_* permission enforced by their called endpoint, combined with existing ownership/membership capabilities where applicable; a role name alone does not expose a staff action that its API will deny."
  - "AC-08: Page scopes, route mappings, preview and flow diagram use real current routes including /students/record, /students/tasks and /activities descendants, distinguish UI-backed, self-service and backend-only permissions, and do not label an action route-enforced unless the runtime guard enforces it."
  - "AC-09: After taskscope-01 completes, the cross-system audit covers Admin RBAC, HSSV/student records, class records, grading, tasks, activities, attendance, reports, system operations, PDF templates and KTX; no visible action/API mismatch remains in the declared matrix and no taskscope-01 path is overwritten."

execution:
  - "E-01 [AC-01,02,08,09] permissions.registry.ts + auth.service.ts + permission-policy.spec.ts -> add canonical code classification, dependency and real owner metadata for every declared permission; correct page scopes to actual routes and fail tests on drift without persisting new runtime data."
  - "E-02 [AC-02] rbac.service.ts + spec -> resolve submitted permission IDs to codes, reject missing/unknown prerequisites before create/update save, preserve valid multi-role and ADMIN_FULL behavior, and revoke tokens under the existing removal contract only after successful save."
  - "E-03 [AC-03,08] auth.controller.ts + auth-api.ts + permission console/RoleModal/preview/diagram and tests -> expose the canonical policy read-only and make both assignment surfaces dependency-aware, accessible, search-safe and truthful about owner/status."
  - "E-04 [AC-04] Sidebar.tsx + SubsystemPopup.tsx + students page/record/tasks pages and focused tests -> derive each menu/tab destination from its actual access permission, keep student self-service routes, and prevent inaccessible sibling tabs from rendering."
  - "E-05 [AC-05] daily-class-report.controller.ts + new controller spec and academic-record.controller.ts + spec -> replace fixed-role-only endpoint admission with matching permission-aware guards while retaining service ownership scope; protect daily-report record reads and pass requester context."
  - "E-06 [AC-06] auth.controller.ts + permission page and controller/page tests -> wire displayed Admin RBAC CRUD codes to their exact endpoints/buttons with the page prerequisite and ADMIN_FULL bypass, including 403-before-service negative cases."
  - "E-07 [AC-07] activity-view-policy.ts + activity list/detail/schedule pages and tests -> centralize visible Activity capabilities from effective permissions plus existing membership/ownership signals and align every invoked endpoint; retain the independently permission-guarded attendance page."
  - "E-08 [AC-01..09] wait for and verify taskscope-01 completion, run the canonical coverage matrix across all declared permission families, inspect actual controller guards/callers for any failing code, and stop for a scope amendment rather than editing an unlisted path."
  - "E-09 [AC-01..09] run focused and package verification, obtain independent authorization review, inspect the final diff/active reservations, and record completion evidence without changing runtime permission data."

verification:
  - "V-01 [AC-01,02,06,08,09] npm --prefix backend test -- --runTestsByPath src/auth/test/permission-policy.spec.ts src/auth/test/rbac.service.spec.ts src/auth/test/auth.controller.spec.ts --runInBand -> all policy coverage, prerequisite validation, granular CRUD and 403-before-service cases pass."
  - "V-02 [AC-05] npm --prefix backend test -- --runTestsByPath src/academic-record/academic-record.controller.spec.ts src/daily-class-report/daily-class-report.controller.spec.ts src/daily-class-report/daily-class-report.service.spec.ts --runInBand -> class CRUD and daily-report reads enforce permissions while ownership/self-service cases remain valid."
  - "V-03 [AC-03,04,06,08] npm --prefix frontend test -- 'src/app/(dashboard)/permissions/__tests__/page.test.tsx' src/components/modals/__tests__/RoleModal.test.tsx src/app/(dashboard)/permissions/preview-permissions.test.ts src/components/layout/Sidebar.test.tsx src/components/popups/SubsystemPopup.test.tsx 'src/app/(dashboard)/students/navigation-order.test.ts' 'src/app/(dashboard)/students/record/page.test.tsx' -> parent-child, destination visibility and Admin CRUD cases pass."
  - "V-04 [AC-07] npm --prefix frontend test -- src/components/activities/activity-view-policy.test.ts 'src/app/(dashboard)/activities/page.test.tsx' 'src/app/(dashboard)/activities/[activityId]/page.test.tsx' 'src/app/(dashboard)/activities/schedule/page.test.tsx' 'src/app/(dashboard)/activities/attendance/page.test.tsx' -> Activity controls match permissions and membership/ownership exceptions."
  - "V-05 [AC-01..09] npm --prefix frontend run typecheck; npm --prefix backend run build -> both exit 0."
  - "V-06 [AC-03,04,06,07,08] Synthetic manual check with non-production roles at desktop/mobile widths: missing parent disables children; removing parent clears descendants; each visible HSSV, Activity and Admin action succeeds or is hidden consistently; no personal records are loaded."
  - "V-07 [AC-01..09] git diff --check -- backend/src/auth backend/src/academic-record backend/src/daily-class-report frontend/src/api/auth-api.ts 'frontend/src/app/(dashboard)/permissions' 'frontend/src/app/(dashboard)/students' 'frontend/src/app/(dashboard)/activities' frontend/src/components/modals/RoleModal.tsx frontend/src/components/permissions/PermissionFlowDiagram.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/components/popups/SubsystemPopup.tsx docs/task/taskscope-02.md; final changed-path/AC review -> no whitespace errors, reservation overlap, unintended writes or unresolved independent-review findings."

temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-02.md: user-requested reusable taskscope slot"

risks:
  - "Critical authorization change: an incorrect dependency or guard can over-grant access or strand valid users; independent review of registry coverage, negative guards and bypass/self-service paths is mandatory."
  - "Existing roles may contain child permissions without parents. Code must fail safely for new updates and report legacy incompatibilities; automatically rewriting stored roles is prohibited in this scope."
  - "Replacing fixed-role guards must preserve finer ownership and class/activity membership scoping enforced in services; permission possession alone must not broaden data scope."
  - "Dynamic route mappings use exact paths while several features have descendants; route normalization must be explicit and tested, not inferred by unsafe prefix matching."

stop_conditions:
  - "TASKSCOPE_PIN_* / TASKSCOPE_CONFLICT, changed scope identity, overlap with taskscope-01 or another active reservation, or unknown dirty change on a write path: stop before mutation."
  - "taskscope-01 is not completed with its permission acceptance criteria, or its final behavior contradicts this canonical policy: stop E-08 and request dependency resolution/amendment."
  - "A declared permission requires a new business feature, a new ownership rule, or writes outside the exact scope to become truthful: record the code/owner gap and request a scope amendment; do not invent behavior or delete the permission."
  - "Any request to grant/revoke permissions, rewrite existing role documents, run a migration/backfill, access production data, deploy, or apply runtime configuration requires the Human Gate and is not performed by this task."
  - "Do not complete without independent review of authorization, ADMIN bypass, self-service/ownership preservation, parent-child validation and unguarded endpoint remediation."
