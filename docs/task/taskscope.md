slot_id: "taskscope-00"
generation: 14
task_id: "20260902-124414-refine-grading-category-criteria-ui"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-02T12:44:14+07:00"
updated_at: "2026-09-02T12:58:00+07:00"
base_commit: "3507d5b85e7967a6e27491ab5332441c26c76517"
task: "Refine grading category cards and criterion modal"
pipeline: feature_development
profile: Full
objective: "At /grading/categories, soften borders, widen the criterion form to reduce vertical scrolling, and store/display a separate description so criterion names can stay concise."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-02T12:58:00+07:00"
  outcome: success
  final_commit_or_state: "Working tree changes retained; no commit requested."
  changed_paths: ["backend/src/criteria/dto/create-criterion.dto.ts", "backend/src/criteria/schemas/criterion.schema.ts", "backend/src/criteria/test/create-criterion.dto.spec.ts", "frontend/src/api/criteria-api.ts", "frontend/src/app/(dashboard)/grading/categories/page.tsx", "frontend/src/app/(dashboard)/grading/categories/page.test.tsx", "frontend/src/components/grading/CriteriaModal.tsx", "frontend/src/components/grading/CriteriaModal.test.tsx"]
  checks_passed: ["backend focused DTO Jest: 8/8", "frontend focused Vitest: 2 files, 6/6 tests", "backend build", "frontend typecheck", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "page.tsx uses prominent white borders on cards; CriteriaModal uses two columns only for single_option and an overflow-y-auto body; the Criterion schema, DTO, API types, and form have no description field."
  expected_behavior: "Cards have subtler borders; the desktop modal distributes fields horizontally and collapses to one column responsively; an optional description is created, updated, and displayed separately from the name."
  root_cause: null

scope:
  inspect: ["frontend/src/app/(dashboard)/grading/categories/page.tsx:CategoriesPage", "frontend/src/components/grading/CriteriaModal.tsx:CriteriaModal", "frontend/src/api/criteria-api.ts:Criterion DTOs", "backend/src/criteria:Criterion contract/persistence"]
  write: ["frontend/src/app/(dashboard)/grading/categories/page.tsx:map, payload, card presentation", "frontend/src/app/(dashboard)/grading/categories/page.test.tsx:description payload/render coverage", "frontend/src/components/grading/CriteriaModal.tsx:responsive horizontal layout and description field", "frontend/src/components/grading/CriteriaModal.test.tsx:form/layout behavior", "frontend/src/api/criteria-api.ts:optional description contract", "backend/src/criteria/schemas/criterion.schema.ts:optional description", "backend/src/criteria/dto/create-criterion.dto.ts:optional description validation", "backend/src/criteria/test/create-criterion.dto.spec.ts:description compatibility/validation"]
  preserve: ["RBAC/controller/service behavior", "existing criterion_name required", "old documents and clients without description remain valid", "scoring modes, score validation, code suggestion, lock/delete behavior"]
  out: ["Backfill/migration of existing criteria", "renaming existing criterion data", "other grading screens", "dependency or endpoint changes"]

acceptance_criteria:
  - "AC-01: Card/category/criterion borders are visibly thinner or lower-contrast while focus, selected, locked and error states remain distinguishable."
  - "AC-02: On desktop the add/update criterion modal uses a wider multi-column layout for both scoring modes and avoids page-level vertical scrolling for the normal form; narrow screens collapse safely to one column with internal overflow when needed."
  - "AC-03: An optional trimmed description can be created and updated; omission remains valid and existing documents require no migration."
  - "AC-04: Criterion cards show the short name as the heading and non-empty description as secondary detail without breaking long-text layout."

execution:
  - "E-01 [AC-03] backend criterion schema/DTO/tests → add optional string description with trim-compatible validation and backward compatibility."
  - "E-02 [AC-03] criteria-api.ts and page.tsx → map description through read/create/update payloads."
  - "E-03 [AC-01,AC-02,AC-04] CriteriaModal.tsx and page.tsx → add description textarea, responsive desktop columns, bounded overflow, and lighter default borders while preserving semantic states."
  - "E-04 [AC-01..AC-04] focused frontend tests → assert payload, conditional description display, form hydration/save, and responsive layout classes/semantics."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-03] npm --prefix backend test -- src/criteria/test/create-criterion.dto.spec.ts --runInBand → focused Jest passes."
  - "V-02 [AC-01..AC-04] npm --prefix frontend test -- 'src/app/(dashboard)/grading/categories/page.test.tsx' 'src/components/grading/CriteriaModal.test.tsx' → focused Vitest passes."
  - "V-03 [AC-03] npm --prefix backend run build → exits 0."
  - "V-04 [AC-01..AC-04] npm --prefix frontend run typecheck → exits 0."
  - "V-05 [AC-01,AC-02,AC-04] Manual responsive check at /grading/categories (desktop and narrow viewport) → borders, two/one-column modal, overflow and description hierarchy match ACs."

risks: ["Optional schema/API field is a public contract extension; keep it backward-compatible and do not backfill persisted data.", "A wider modal must retain usable overflow and focus access on short/narrow viewports."]
stop_conditions: ["Stop if description must be required, needs migration/backfill, or must propagate to other screens/exports.", "Stop if satisfying the layout requires changing shared modal/input primitives outside declared writes."]
