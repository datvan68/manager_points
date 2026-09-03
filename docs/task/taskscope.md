slot_id: "taskscope-00"
generation: 18
task_id: "20260903-094722-search-student-records-by-class"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-03T09:47:22+07:00"
updated_at: "2026-09-03T10:03:00+07:00"
base_commit: "70563b59fe93ec01000475d029a324ac48f521d4"
task: "Search student records by class without client-side lag"
pipeline: feature_development
profile: Full
objective: "The Tình hình HSSV search matches class names while retaining debounced, server-paginated loading and responsive table interaction."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-03T10:03:00+07:00"
  outcome: "success"
  final_commit_or_state: "working tree (uncommitted)"
  changed_paths: ["backend/src/academic-record/academic-record.service.ts", "backend/src/academic-record/academic-record.service.spec.ts", "frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx"]
  checks_passed: ["npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts --runInBand (79 passed)", "npm --prefix frontend test -- src/app/(dashboard)/students/record/page.test.tsx (28 passed)", "npm --prefix backend run build", "npm --prefix frontend run typecheck", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/record/page.tsx:fetchRecords sends debounced search and classId separately; backend/src/academic-record/academic-record.service.ts:findAll matches search against student name/code, record title/description, and criterion name, but not class_name."
  expected_behavior: "Typing a full or partial class name returns matching HSSV groups through the existing paginated endpoint; the class dropdown, debounce, pagination, RBAC, and other search fields remain unchanged."
  root_cause: "backend/src/academic-record/academic-record.service.ts:findAll never resolves search text against Class.class_name or includes students from matching classes."

scope:
  inspect: ["backend/src/academic-record/academic-record.service.ts:findAll access filters/grouped pagination", "frontend/src/app/(dashboard)/students/record/page.tsx:fetchRecords/search controls"]
  write: ["backend/src/academic-record/academic-record.service.ts:findAll search resolution", "backend/src/academic-record/academic-record.service.spec.ts:class-search/performance regression coverage", "frontend/src/app/(dashboard)/students/record/page.tsx:Tình hình HSSV search hint", "frontend/src/app/(dashboard)/students/record/page.test.tsx:search request/UI coverage"]
  preserve: ["GET /academic-records query contract and response shape", "debounce, server pagination/load-more, class/date/creator filters", "RBAC visibility and student self-scope", "existing name/code/title/description/criterion search semantics"]
  out: ["Client-side filtering of all records", "Schema/index migration", "Tình hình lớp học search", "New dependency or UI redesign"]

acceptance_criteria:
  - "AC-01: A case-insensitive full or partial class_name search returns only accessible HSSV groups belonging to matching classes and composes correctly with an explicit classId filter."
  - "AC-02: Existing search fields, RBAC, filters, grouped response shape, debounce, page size, and load-more behavior remain unchanged."
  - "AC-03: Class search is resolved by bounded backend queries before the existing paginated record query; the browser neither fetches all records/classes per keystroke nor performs client-side full-table filtering."
  - "AC-04: Desktop and mobile search affordances indicate that class names are searchable and continue sending the debounced search parameter."

execution:
  - "E-01 [AC-01..AC-03] backend service → resolve matching class IDs and combine class membership with current student name/code matches, preferably parallel with criterion lookup, then reuse the existing record filter and pagination."
  - "E-02 [AC-01..AC-03] backend spec → cover partial/case-insensitive class lookup, no-match behavior, classId intersection, preserved search branches, and bounded query composition."
  - "E-03 [AC-02,AC-04] frontend page → clarify the shared desktop/mobile placeholder without adding fetches or local filtering."
  - "E-04 [AC-02..AC-04] frontend spec → verify debounce/request parameters and the class-search hint."
  - "E-05 [AC-01..AC-04] independent review → check RBAC intersections, query fan-out, pagination stability, and absence of client-side full-data work."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-03] npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts --runInBand → focused service tests pass."
  - "V-02 [AC-02,AC-04] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → focused page tests pass."
  - "V-03 [AC-01..AC-04] npm --prefix backend run build && npm --prefix frontend run typecheck → both affected packages compile/typecheck successfully."

risks: ["Regex class lookup must escape user input and remain constrained by existing RBAC/class filters; unbounded client-side data loading would regress responsiveness."]
stop_conditions: ["Stop if satisfying class search requires an API response change, schema/index migration, authorization change, or writes outside the four declared paths."]
