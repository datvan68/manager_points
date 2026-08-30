slot_id: "taskscope-01"
generation: 1
task_id: "20260830-210355-simplify-category-criteria-management"
scope_file: "docs/task/taskscope-01.md"
status: completed
scope_revision: 1
created_at: "2026-08-30T21:03:55+07:00"
updated_at: "2026-08-30T21:24:00+07:00"
base_commit: "6beb666693e71cb26153b6f2cf63b556d847656f"
task: "Simplify category and criteria management"
pipeline: feature_development
profile: Quick
objective: "Deliver one minimal, responsive workspace for administrators to manage categories and criteria without switching views."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-08-30T21:24:00+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree retains unrelated pre-existing changes; scoped implementation is complete."
  changed_paths: ["frontend/src/app/(dashboard)/grading/categories/page.tsx", "frontend/src/app/(dashboard)/grading/categories/page.test.tsx"]
  checks_passed: ["npm --prefix frontend test -- src/app/(dashboard)/grading/categories/page.test.tsx", "npm --prefix frontend run typecheck", "rg forbidden radius classes: no matches", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/grading/categories/page.tsx:CategoriesPage duplicates management across Kanban and master-detail; no focused test exists."
  expected_behavior: "One compact master-detail workspace follows docs/design/ and keeps category/criterion actions discoverable on desktop and mobile."
  root_cause: null

scope:
  inspect: ["docs/design/DESIGN.md:UI rules", "frontend/src/components/grading/{CategoryModal,CriteriaModal}.tsx:form contracts", "frontend/src/api/{category-api,criteria-api}.ts:CRUD contracts"]
  write: ["frontend/src/app/(dashboard)/grading/categories/page.tsx:CategoriesPage", "frontend/src/app/(dashboard)/grading/categories/page.test.tsx: focused UI/interaction coverage"]
  preserve: ["Access/redirects, API payloads, modal validation, CRUD, bulk deletion, lock/type/score semantics, toasts"]
  out: ["Backend/API/schema changes", "CategoryModal or CriteriaModal redesign", "New dependency", "Other grading pages"]

acceptance_criteria:
  - "AC-01: The page uses one searchable master-detail flow: category list, selected-category summary, and criterion list; Kanban/view toggle and local category-column storage are absent."
  - "AC-02: Create/edit/delete category, create/edit/delete criterion, and select-all/bulk-delete criterion entry points remain visible and invoke existing handlers/contracts."
  - "AC-03: Loading, empty, selected, locked, over-limit, and mobile drill-down states are readable, keyboard-operable, and follow docs/design/."

execution:
  - "E-01 [AC-01,AC-03] page.tsx:CategoriesPage -> replace duplicated layouts with one responsive list/detail workspace."
  - "E-02 [AC-02] page.tsx handlers -> remove presentation-only Kanban/column state while retaining server mutations, confirmations, selection, and feedback."
  - "E-03 [AC-01..AC-03] page.test.tsx -> cover data, search/selection, mobile back, CRUD, bulk delete, empty/loading, and redirect."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-01.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-03] npm --prefix frontend test -- 'src/app/(dashboard)/grading/categories/page.test.tsx' -> focused tests pass."
  - "V-02 [AC-01..AC-03] npm --prefix frontend run typecheck -> page and tests compile."
  - "V-03 [AC-03] rg -n 'rounded-(full|sm|md|none|lg)' 'frontend/src/app/(dashboard)/grading/categories/page.tsx' -> no forbidden radius class."
  - "V-04 [AC-01..AC-03] git diff --check -> no whitespace errors."

risks: ["Removing Kanban removes its local-only two-column arrangement; server data and CRUD remain unchanged."]
stop_conditions: ["Stop if the redesign requires API/schema/RBAC changes, modal contract changes, or a third implementation file."]
