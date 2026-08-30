slot_id: "taskscope-01"
generation: 1
task_id: "20260830-153656-redesign-system-utilities-dialog"
scope_file: "docs/task/taskscope-01.md"
status: blocked
scope_revision: 1
created_at: "2026-08-30T15:36:56+07:00"
updated_at: "2026-08-30T15:36:56+07:00"
base_commit: "cd78e93f5ceb76b36aa86ec5daf3eab75f4b702f"
task: "Redesign system configuration and utilities dialog"
pipeline: feature_development
profile: Quick
objective: "Cấu hình & Tiện ích hệ thống becomes a compact responsive glass dialog conforming to docs/design without changing actions, permissions, or filters."

coordination:
  depends_on: ["20260830-113000-complete-grouped-student-record-summaries"]
  warnings: ["TASKSCOPE_CONFLICT: dependency reserves frontend/src/app/(dashboard)/students/record/page.tsx and page.test.tsx; wait for terminal status and revalidate."]

completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
  reuse_safe: false

evidence:
  current_behavior: "page.tsx:isGlobalConfigModalOpen uses p-6/gap-6, prohibited shadow-2xl, ungrouped controls, and an empty Tiêu chí tính vắng section; tests cover only opening, purge absence, and trash navigation."
  expected_behavior: "Responsive scroll-contained glass cards group utilities and display controls; no empty section; all handlers and permission conditions remain intact."
  root_cause: null

scope:
  inspect: ["docs/design/DESIGN.md and DESIGN.compact.md:tokens", "frontend/src/components/ui/dialog.tsx:accessibility contract"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:isGlobalConfigModalOpen dialog markup/styles", "frontend/src/app/(dashboard)/students/record/page.test.tsx:dialog design and interaction regressions"]
  preserve: ["CONFIG_RECORD open gate", "createStudentRecord/createClassRecord visibility", "trash fetch/navigation", "ghinhan_view_layout and creatorFilter effects", "API/schema/dependencies/shared Dialog"]
  out: ["trash dialog redesign", "other student-record UI", "backend or permission changes"]

acceptance_criteria:
  - "AC-01: Modal and controls use documented glass, rounded-xl/2xl, compact spacing, shadow-sm, and 150ms tokens with no prohibited styling."
  - "AC-02: Narrow view is scroll-contained/one-column; md is two-column; the empty criteria heading is absent."
  - "AC-03: Trash, permitted import, layout selection, creator filter, close, title, and RBAC behavior/accessibility remain intact."

execution:
  - "E-01 [AC-01,AC-02,AC-03] page.tsx:isGlobalConfigModalOpen → replace presentation with responsive glass sections; preserve handlers/conditions."
  - "E-02 [AC-01,AC-02,AC-03] page.test.tsx → cover styling structure, responsive containment, RBAC utilities, state effects, navigation, and close."

temporary_artifacts:
  create: ["docs/task/taskscope-01.md"]
  cleanup: []
  retain: ["docs/task/taskscope-01.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix frontend test -- src/app/(dashboard)/students/record/page.test.tsx → focused Vitest file passes."
  - "V-02 [AC-01,AC-02,AC-03] npm --prefix frontend run typecheck → TypeScript exits 0."

risks: ["Dependency may change the same files and invalidate selectors."]
stop_conditions: ["Dependency remains active or target writes are dirty at execution time", "Implementation requires shared Dialog, permission, API, dependency, or backend changes"]
