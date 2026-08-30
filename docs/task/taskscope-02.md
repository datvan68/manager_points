slot_id: "taskscope-02"
generation: 1
task_id: "20260830-154803-redesign-system-trash-dialog"
scope_file: "docs/task/taskscope-02.md"
status: completed
scope_revision: 2
created_at: "2026-08-30T15:48:03+07:00"
updated_at: "2026-08-30T16:02:00+07:00"
base_commit: "7f39ddd8f7ef25d8f388a8ec02bcecdda895dee8"
task: "Redesign system trash dialog"
pipeline: feature_development
profile: Quick
objective: "Thùng rác hệ thống becomes a compact responsive glass dialog conforming to docs/design without changing behavior."

coordination:
  depends_on: ["20260830-000000-reconcile-grouped-total-points"]
  warnings: []

completion:
  completed_at: "2026-08-30T16:02:00+07:00"
  outcome: success
  final_commit_or_state: "Verified changes remain in the working tree; no new commit created."
  changed_paths: ["frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx", "docs/task/taskscope-02.md"]
  checks_passed: ["npm --prefix frontend test -- src/app/(dashboard)/students/record/page.test.tsx (16 tests passed)", "npm --prefix frontend run typecheck", "git diff --check"]
  cleanup_pending: []
  reuse_safe: false

evidence:
  current_behavior: "page.tsx:isTrashOpen uses p-6, shadow-2xl, fixed tables, and a tab/action row unsuitable for narrow screens; tests cover only bulk permanent-delete reconciliation."
  expected_behavior: "A scroll-contained glass dialog presents tabs, states, records, and actions clearly across screen sizes."

scope:
  inspect: ["docs/design/DESIGN.md and DESIGN.compact.md:tokens", "frontend/src/components/ui/dialog.tsx:accessibility contract"]
  write: ["frontend/src/app/(dashboard)/students/record/page.tsx:isTrashOpen dialog presentation", "frontend/src/app/(dashboard)/students/record/page.test.tsx:trash dialog UI and interaction regressions"]
  preserve: ["CONFIG_RECORD entry gate", "deleted-record/report loading and counts", "restore/force-delete/delete-all handlers and confirmations", "back/close navigation", "APIs, RBAC, schemas, dependencies, shared Dialog"]
  out: ["system configuration dialog", "confirmation-modal redesign", "other student-record UI", "backend or permission changes"]

acceptance_criteria:
  - "AC-01: Dialog, tabs, lists/tables, states, and controls use docs/design glass, rounded-xl/2xl, compact spacing, shadow-sm, and 150ms tokens; shadow-2xl and prohibited styling are absent."
  - "AC-02: Content remains scroll-contained; narrow screens have readable non-clipped records and wrapping controls, while desktop retains an efficient tabular layout."
  - "AC-03: Both tabs/counts, loading/empty states, restore, permanent delete, delete all, confirmations, back, close, RBAC, and accessible action names remain correct."

execution:
  - "E-01 [AC-01..AC-03] Responsively restructure page.tsx:isTrashOpen while preserving conditions and handlers."
  - "E-02 [AC-01..AC-03] Extend page.test.tsx for design structure, both data tabs/states, actions, navigation, and accessibility."

verification:
  - "V-01 [AC-01..AC-03] npm --prefix frontend test -- src/app/(dashboard)/students/record/page.test.tsx"
  - "V-02 [AC-01..AC-03] npm --prefix frontend run typecheck"
  - "V-03 [AC-01] git diff --check"

risks: ["The active dependency may change shared state, selectors, or the same dialog-adjacent markup."]
stop_conditions: ["Dependency or overlapping reservation remains active", "Target writes are dirty at execution time", "Implementation requires shared Dialog, permission, API, dependency, or backend changes"]

temporary_artifacts:
  create: ["docs/task/taskscope-02.md"]
  cleanup: []
  retain: ["docs/task/taskscope-02.md: user-requested taskscope deliverable"]
