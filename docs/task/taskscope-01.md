slot_id: "taskscope-01"
generation: 1
task_id: "20260906-210749-record-grading-permissions"
scope_file: "docs/task/taskscope-01.md"
status: blocked
scope_revision: 1
created_at: "2026-09-06T21:07:49+07:00"
updated_at: "2026-09-06T21:25:00+07:00"
base_commit: "3fcfd7a038bfa5705bf1b8837d7d91a6921e5854"
task: "Separate record and grading permission groups and align dependency and display order"
pipeline: bug_fix
profile: Full
risk: high
environment: development
objective: "The permissions screen clearly separates student/class records from grading, follows actual route access requirements, and displays capabilities in business order without changing existing permission codes, role grants, or API guards."
coordination:
  depends_on: []
  warnings:
    - "Slot 00 task 20260906-204325-student-evaluation-gate is in_progress. Its grading score and backend score-service writes are disjoint from this scope. Do not edit or depend on those changing files; coordinate shared dev services before runtime tests."
    - "Planning-only: source evidence verified; database state, runtime behavior and tests have not been verified. Existing unrelated dirty files belong outside this scope."
completion:
  completed_at: null
  outcome: "blocked: mandatory verified-dev runtime evidence and independent review result are unavailable"
  final_commit_or_state: "main worktree; scoped changes uncommitted; unrelated pre-existing changes preserved"
  changed_paths:
    - "backend/src/auth/permissions.registry.ts"
    - "backend/src/auth/services/auth.service.ts"
    - "backend/src/auth/test/permission-policy.spec.ts"
    - "backend/src/auth/test/auth.service.spec.ts"
    - "frontend/src/app/(dashboard)/permissions/page.tsx"
    - "frontend/src/app/(dashboard)/permissions/permission-order.ts"
    - "frontend/src/app/(dashboard)/permissions/permission-order.test.ts"
    - "frontend/src/app/(dashboard)/permissions/record-grading-permissions.test.tsx"
  checks_passed:
    - "V-01 backend focused auth tests: 3 suites, 28 tests passed"
    - "V-02 frontend focused permission-order tests: 2 suites, 4 tests passed"
    - "V-03 frontend typecheck passed"
    - "V-03 backend build passed"
    - "git diff --check passed; only line-ending normalization warnings"
  cleanup_pending:
    - "V-04 verified-dev UI/API scenarios not run because effective dev database/Redis isolation could not be established without reading secret runtime files"
    - "V-05 independent authorization review result not returned"
evidence:
  current_behavior: "permissions.registry.ts maps GRADING_PAGE to /students/record and makes both record reads depend on it; auth.service.ts route mappings instead use GRADING_PAGE for /grading and READ_STUDENT_RECORD for /students/record. G_GRADING mixes both domains. permissions/page.tsx sorts page permissions first then alphabetically by code."
  expected_behavior: "Record permission selection does not require access to grading; groups and order reflect these distinct pages and their existing access contracts."
  root_cause: "Stale policy ownership/dependencies, mixed canonical group membership, and code-alphabetic sorting. seedRbac uses $addToSet, so changing its desired membership alone cannot remove legacy mixed entries."
scope:
  inspect:
    - "frontend/src/components/guards/RouteGuard.tsx"
    - "frontend/src/components/layout/Sidebar.tsx"
    - "frontend/src/app/(dashboard)/students/record/page.tsx"
    - "frontend/src/app/(dashboard)/grading/page.tsx"
    - "frontend/src/app/(dashboard)/grading/categories/page.tsx"
    - "frontend/src/api/auth-api.ts"
    - "backend/src/auth/services/rbac.service.ts"
    - "backend/src/auth/schemas/permission-group.schema.ts"
    - "backend/src/auth/schemas/role.schema.ts"
    - "backend/src/academic-record/academic-record.controller.ts"
  write:
    - "backend/src/auth/permissions.registry.ts"
    - "backend/src/auth/services/auth.service.ts"
    - "backend/src/auth/test/permission-policy.spec.ts"
    - "backend/src/auth/test/auth.service.spec.ts"
    - "backend/src/auth/test/rbac.service.spec.ts"
    - "frontend/src/app/(dashboard)/permissions/page.tsx"
    - "frontend/src/app/(dashboard)/permissions/permission-order.ts"
    - "frontend/src/app/(dashboard)/permissions/permission-order.test.ts"
    - "frontend/src/app/(dashboard)/permissions/record-grading-permissions.test.tsx"
  preserve:
    - "Existing permission codes and IDs, user/role grants, custom groups and unrelated groups; no automatic addition/removal of role permissions."
    - "Route guards, student self-service and teacher/admin exceptions, class/student data scope, API contracts and evaluation-window behavior."
    - "Existing prerequisite enforcement, descendant removal and group toggle logic; only correct the named dependency graph."
  out:
    - "Score editing, semester lifecycle, API authorization redesign, new permission codes, sidebar ordering or unrelated permission cleanup."
    - "Production access or mutation, commit/push/deployment, broad seed/reset execution, persistent production migration, and real user grant changes."
acceptance_criteria:
  - "AC-01: G_GRADING retains GRADING_PAGE, GRADING_SEMESTER_MANAGE and CONFIG_RECORD; a new G_STUDENT_RECORD group named Ghi nhận sinh viên contains the nine existing student/class record permissions. Canonical labels/descriptions match these domains. Existing database groups converge without duplicate membership for these moved canonical entries; custom groups and role/user grants remain unchanged."
  - "AC-02: GRADING_PAGE owns /grading. READ_STUDENT_RECORD has no GRADING_PAGE prerequisite. READ_CLASS_RECORD requires READ_STUDENT_RECORD to match the existing record-page entry requirement. Individual CRUD retains its own read prerequisite; READ_ALL_CLASS_RECORD retains READ_CLASS_RECORD. No record capability depends transitively on GRADING_PAGE; the catalog remains valid and acyclic."
  - "AC-03: The record group appears after G_STUDENT and before G_GRADING. Its order is READ_STUDENT_RECORD, CREATE_STUDENT_RECORD, UPDATE_STUDENT_RECORD, DELETE_STUDENT_RECORD, READ_CLASS_RECORD, READ_ALL_CLASS_RECORD, CREATE_CLASS_RECORD, UPDATE_CLASS_RECORD, DELETE_CLASS_RECORD. Grading order is GRADING_PAGE, GRADING_SEMESTER_MANAGE, CONFIG_RECORD. Unknown codes retain deterministic fallback ordering; other groups retain their existing order."
  - "AC-04: In the rendered permission editor, record read can be selected without grading access, dependent actions remain unavailable until their read prerequisite is selected, removing a parent removes its descendants, and selecting the record group never adds GRADING_PAGE. Grading-only and record-only non-admin users retain the appropriate existing route visibility/access."
  - "AC-05: Focused tests, frontend typecheck, backend build, verified-dev UI/API scenarios and independent authorization review pass. Verify both fresh canonical data and legacy mixed group data, repeated synchronization, and unchanged effective role grants."
execution:
  - "E-01 [AC-01,AC-02] permissions.registry.ts: add the G_STUDENT_RECORD canonical group, move only the nine record seed module labels, correct GRADING_PAGE ownership and the two record-read prerequisites. Extend permission-policy.spec.ts and rbac.service.spec.ts using their existing policy validation and grant-validation conventions; assert isolated record grants and preserved action prerequisites."
  - "E-02 [AC-01,AC-05] auth.service.ts: update seedRbac group definitions and implement narrowly bounded, idempotent reconciliation that removes only the nine moved record IDs from G_GRADING and adds them to G_STUDENT_RECORD. Preserve all unrelated IDs, custom groups and role/user arrays. Extend auth.service.spec.ts seedRbac regression for fresh state, legacy state and a second run. Inspect group-to-role semantics before implementing; stop if membership changes implicitly alter effective role grants. Do not run a broad seed against an existing database."
  - "E-03 [AC-03,AC-04] Add permission-order.ts and permission-order.test.ts beside existing user-role-priority.ts/tests, using the existing Vitest convention. Export the explicit scoped ordering with deterministic fallback and call it from permissions/page.tsx. Add record-grading-permissions.test.tsx in the same existing directory using Vitest/jsdom and mocked authApi to render the real page and exercise prerequisite, descendant and group toggles; do not copy handlers into tests."
  - "E-04 [AC-05] Run V-01 to V-04, obtain independent review of the changed policy and reconciliation, resolve only scoped findings, inspect the final diff and record real runtime cleanup. If another executor owns shared dev services, serialize runtime testing."
verification:
  - 'V-01 [AC-01,AC-02] npm --prefix backend test -- --runTestsByPath src/auth/test/permission-policy.spec.ts src/auth/test/auth.service.spec.ts src/auth/test/rbac.service.spec.ts --runInBand -> catalog, grant dependencies, idempotent membership reconciliation and unchanged grants pass.'
  - 'V-02 [AC-03,AC-04] npm --prefix frontend test -- "src/app/(dashboard)/permissions/permission-order.test.ts" "src/app/(dashboard)/permissions/record-grading-permissions.test.tsx" -> exact ordering and real editor interactions pass.'
  - 'V-03 [AC-05] Run npm --prefix frontend run typecheck and npm --prefix backend run build separately -> both exit successfully; report unrelated baseline failures rather than repairing them.'
  - "V-04 [AC-01,AC-04,AC-05] Verified dev: inspect both groups in the permissions UI; use disposable record-only and grading-only non-admin test identities to verify selection/save/reload and route access. Verify missing read blocks dependent actions, group selection excludes unrelated grading grants, legacy canonical membership is corrected once, and repeated synchronization preserves IDs and role grants. Use a disposable isolated database/fixture for seed integration, not a broad seed on shared real dev data."
  - "V-05 [AC-05] Independent reviewer checks dependency correctness, no accidental privilege expansion, preservation of custom memberships/grants, idempotent reconciliation, and the unchanged guard boundary; record reviewer and result. Self-review cannot satisfy this check."
runtime_test:
  target_identity: "Not yet verified. Establish effective frontend/API, database, Redis and integration dev isolation using non-secret metadata before runtime operations."
  resources: "Task-tagged disposable permission test roles/users and an isolated group-sync fixture; coordinate service usage with slot 00."
  operations: "Normal authorized dev UI/API interactions and disposable fixture verification only; no raw database bypass of application guards or changes to existing user grants."
  scenarios: "V-04; distinguish metadata/group display changes from effective authorization."
  cleanup: "Remove only task-created disposable identities/fixtures through supported cleanup; record retained changes. Existing dev group edits require before-state, intervention check and restoration under safety.md section 6a."
temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-01.md: user-requested reusable taskscope slot"]
risks:
  - "Stored group membership can remain stale after seed-list changes; production rollout of any reconciliation is a separate release decision."
  - "Authorization metadata changes require independent review during execution; unavailable mandatory review or runtime evidence prevents completion."
stop_conditions:
  - "Apply global.md exact-file pin, freshness, reservations and dirty-path checks before execution."
  - "Amend scope before editing guards, changing permission codes, touching slot 00 write paths or expanding data reconciliation."
  - "Stop dependent runtime work if dev isolation, disposable fixture setup or shared-service ownership cannot be established."
  - "If group membership affects effective grants indirectly, stop reconciliation and resolve compatibility before mutation."
  - "No production-triggering commit/push or production data reconciliation is authorized by this planning request."
