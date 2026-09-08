---
slot_id: "taskscope-01"
generation: 1
task_id: "20260908-135100-supervisor-student-highlights"
scope_file: "docs/task/taskscope-01.md"
status: in_progress
scope_revision: 2
created_at: "2026-09-08T13:51:00+07:00"
updated_at: "2026-09-08T14:12:00+07:00"
base_commit: "192d1d447aac5509242095c870461b43648d3d37"
task: "Align supervisor student highlights and permission preview"
pipeline: bug_fix
profile: Full
risk: high
environment: development
objective: "Show the dashboard student highlights to authorized supervisors, control the staff panel and its data with READ_STUDENT_RECORD, and represent the same rule in permission preview."
coordination:
  depends_on: []
  warnings:
    - "Existing docs/task/taskscope.md is a zero-byte legacy file: reserve slot 00 and leave it untouched. It declares no write boundaries; no other task files or dirty paths were present at publication."
    - "Focused code checks pass. Runtime RBAC matrix is pending because no authorized localhost sessions for supervisor/admin/teacher/student/unknown were available; independent review subagents timed out and were stopped without a result."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "Dashboard page mounts StudentSpotlightPanel unconditionally. The panel selects its personal branch and skips list requests when metrics.roleScope is student. Permission preview renders a static dashboard without this panel."
  expected_behavior: "Authorized supervisors see discipline, rewards and bonus lists; staff without READ_STUDENT_RECORD cannot see or fetch these lists. Preview explains the existing permission controlling the panel."
  root_cause: "SystemService.getDashboardMetrics defaults unclassified roles, including ordinary supervisors, to student; getStudentHighlights explicitly recognizes supervisors as operators. Both controller endpoints currently use empty @Permissions(). The panel therefore chooses its branch using a scope that disagrees with the list endpoint."
scope:
  inspect:
    - "backend/src/system/"
    - "backend/src/auth/guards/permissions.guard.ts"
    - "backend/src/auth/utils/role.util.ts"
    - "backend/src/auth/services/auth.service.ts"
    - "frontend/src/components/dashboard/"
    - "frontend/src/components/guards/RouteGuard.tsx"
    - "frontend/src/utils/role.util.ts"
    - "frontend/src/providers/auth-provider.tsx"
    - "frontend/src/api/system-api.ts"
    - "frontend/src/app/(dashboard)/page.tsx"
    - "frontend/src/app/(dashboard)/permissions/"
    - "scripts/dev-host.sh"
    - "docker-compose.dev-infra.yml"
  write:
    - "backend/src/system/system.controller.ts"
    - "backend/src/system/system.service.ts"
    - "backend/src/system/system.service.spec.ts"
    - "backend/src/system/student-highlights.controller.spec.ts"
    - "frontend/src/components/dashboard/StudentSpotlightPanel.tsx"
    - "frontend/src/components/dashboard/StudentSpotlightPanel.test.tsx"
    - "frontend/src/components/dashboard/dashboard-helpers.ts"
    - "frontend/src/app/(dashboard)/page.tsx"
    - "frontend/src/app/(dashboard)/page.test.tsx"
    - "frontend/src/app/(dashboard)/permissions/page.tsx"
    - "frontend/src/app/(dashboard)/permissions/preview-permissions.ts"
    - "frontend/src/app/(dashboard)/permissions/preview-permissions.test.ts"
    - "frontend/src/app/(dashboard)/permissions/__tests__/page.test.tsx"
  preserve:
    - "Admin/ADMIN_FULL bypass; student self-service navigation and personal data; teacher assigned-class filtering; unknown-role least privilege."
    - "Existing authorized supervisor list scope, semester selection, active/non-deleted filters, category thresholds, pagination, virtualization and retry behavior."
    - "Existing dashboard payload fields and unrelated KPI/system-panel access. Permission alone must not upgrade an unknown role to a school-wide operator."
  out:
    - "New permission codes, persisted role/permission assignments, seeds, migrations and production data changes."
    - "Global auth normalization, unrelated dashboard redesign, commit/push/deployment."
acceptance_criteria:
  - "AC-01: Supervisor with READ_STUDENT_RECORD sees all three staff highlight categories on the real dashboard and can follow the existing all-records link; it is never replaced by a missing student-profile message."
  - "AC-02: Non-admin staff without READ_STUDENT_RECORD see no staff highlights and issue no list fetch; a direct student-highlights request is denied with 403. No staff list data is exposed through dashboard-metrics as an alternate path. Admin bypass remains valid."
  - "AC-03: Supervisor list scope remains the currently implemented scope; teachers only receive assigned-class records; students retain self-service behavior and cannot gain other students' records; unknown roles retain least privilege even when carrying READ_STUDENT_RECORD. No additional system data or unrelated KPIs are unlocked for supervisors."
  - "AC-04: Permission preview for roles and users includes a clearly marked simulated highlights panel linked to READ_STUDENT_RECORD (Xem ghi nhận sinh viên). Effective merged permissions and admin bypass match the real panel; missing permission is explained without loading real student data."
  - "AC-05: Semester changes, empty lists, request failure/retry and pagination remain usable; required automated checks, dev UI/API scenarios and independent authorization review pass."
execution:
  - "E-01 [AC-01,AC-02,AC-03] Load .agents/Skills/debug_issue.md at execution; pin this file and revalidate Git/reservations. In system.service.ts separate staff-highlight access/mode from the generic dashboard roleScope using an additive capability/mode field, typed in dashboard-helpers.ts. Do not classify supervisors as admin/system globally. Reuse role helpers and effective permissions; preserve student personal behavior and existing list scope. Enforce READ_STUDENT_RECORD for staff list retrieval server-side, including alternate highlight arrays in dashboard-metrics; keep dashboard itself available. Use system.controller.ts/PermissionsGuard conventions where compatible with preserved self-service."
  - "E-02 [AC-01,AC-02,AC-03,AC-05] Update dashboard page and StudentSpotlightPanel to consume explicit highlight mode/access instead of inferring student identity from generic metrics.roleScope. Gate rendering and requests before scheduling category loads; clear stale staff data when access changes. Keep category UI, navigation, semester refresh, pagination and retry behavior."
  - "E-03 [AC-04] Extend preview-permissions.ts and permissions/page.tsx using existing effective-permission and admin rules. Add synthetic three-category preview and a readable permission association; do not fetch live highlights for the preview subject."
  - "E-04 [AC-01,AC-02,AC-03,AC-04,AC-05] Extend system.service.spec.ts and student-highlights.controller.spec.ts with executable authorization/scope assertions, including guard metadata/enforcement rather than only direct controller delegation. Extend StudentSpotlightPanel.test.tsx and dashboard page.test.tsx with rendering/request assertions; extend preview-permissions.test.ts and permissions/__tests__/page.test.tsx for role/user permission states. Follow existing Jest mocks and Vitest/React setup; source-string assertions alone do not establish authorization."
  - "E-05 [AC-01,AC-02,AC-03,AC-04,AC-05] Run focused checks and verified-dev scenarios, then obtain an independent authorization review of the scoped diff. Independent review is required by pipeline.md; use an authorized reviewer or a bounded review subagent under that explicit requirement. Resolve findings within this scope and record actual evidence before completion."
verification:
  - 'V-01 [AC-01,AC-02,AC-03] npm --prefix backend test -- --runTestsByPath src/system/system.service.spec.ts src/system/student-highlights.controller.spec.ts --runInBand -> relevant service scope and HTTP permission checks pass.'
  - 'V-02 [AC-01,AC-02,AC-04,AC-05] npm --prefix frontend test -- "src/components/dashboard/StudentSpotlightPanel.test.tsx" "src/app/(dashboard)/page.test.tsx" "src/app/(dashboard)/permissions/preview-permissions.test.ts" "src/app/(dashboard)/permissions/__tests__/page.test.tsx" -> visibility, no unauthorized requests, preview and existing interaction checks pass.'
  - 'V-03 [AC-05] npm --prefix frontend run typecheck; npm --prefix backend run build -> both exit successfully; run these as separate commands.'
  - 'V-04 [AC-01,AC-02,AC-03,AC-04,AC-05] Perform runtime_test scenarios and independent diff review -> actual UI/API evidence satisfies the access matrix, no scope expansion, no unresolved authorization findings.'
  - 'V-05 [AC-05] git diff --check and scoped diff/status inspection -> no whitespace errors or unrelated changes; complete this retained scope only after all required checks.'
runtime_test:
  targets: "Resolve effective frontend/API/database and relevant storage/integration identities read-only at execution start; isolation from production is not yet verified. Follow safety.md section 6a."
  resources: "Reserve the dev services and existing authorized test sessions for supervisor with/without READ_STUDENT_RECORD, admin, teacher, student and unknown role. Use existing semester/class records with minimal redacted evidence."
  operations: "Read-only UI navigation and API GET requests through normal authentication; no persisted role/permission mutations. Use existing sessions or authorized preview/impersonation flows. If required identities are unavailable, record the missing runtime case instead of bypassing RBAC."
  scenarios:
    - "Supervisor with permission: actual three-category panel and paginated API succeed; compare scope to existing list behavior."
    - "Supervisor without permission: panel absent, no category request, direct API returns 403 and dashboard has no staff highlight-list leak."
    - "Admin, teacher, student and unknown role: verify AC-03 boundaries through API and corresponding UI; supervisor gains no unrelated system information."
    - "Permission preview role/user switch reflects merged permissions, labels READ_STUDENT_RECORD and uses synthetic data only."
    - "Change semester, observe an empty category, exercise pagination and simulate a failed request/retry without persistent-data mutation."
  cleanup: "No persistent data changes expected; restore any transient preview/session selection and report actual residual state."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "Reusing admin/system roleScope for supervisor would broaden unrelated dashboard data; explicit panel access must remain separate."
  - "A frontend-only gate leaves direct API or legacy dashboard arrays exposed."
  - "New denial behavior is intentional for staff lacking READ_STUDENT_RECORD; no automatic permission grant is authorized."
stop_conditions:
  - "Apply exact-file pin, ownership/conflict and release boundaries from global.md and safety.md."
  - "Stop dependent runtime checks if dev isolation or required authorized sessions cannot be established; do not report mocks as runtime success."
  - "If required behavior needs writes outside this boundary, persisted IAM changes or broader data access, record the concrete amendment needed before those actions."
  - "Do not complete without required independent review and successful mandatory runtime checks."
---
