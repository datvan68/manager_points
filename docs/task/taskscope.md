slot_id: "taskscope-00"
generation: 20
task_id: "20260903-105242-trash-pagination-and-selection"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-03T10:52:42+07:00"
updated_at: "2026-09-03T11:01:00+07:00"
base_commit: "bdd602cfb078884e57638a8f19a185a01e0e2d3e"
task: "Add paginated loading and selected deletion to system trash"
pipeline: feature_development
profile: Full
objective: "Each system-trash tab progressively loads bounded pages and lets authorized users explicitly select loaded rows for permanent deletion without treating unseen data as selected."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-03T11:01:00+07:00"
  outcome: success
  final_commit_or_state: "Working tree contains the scoped implementation changes; no commit created."
  changed_paths: ["backend/src/academic-record/academic-record.controller.ts", "backend/src/academic-record/academic-record.service.ts", "backend/src/daily-class-report/daily-class-report.controller.ts", "backend/src/daily-class-report/daily-class-report.service.ts", "frontend/src/api/academic-record-api.ts", "frontend/src/api/daily-class-report-api.ts", "frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx", "docs/task/taskscope.md"]
  checks_passed: ["backend focused Jest: 3 suites, 118 tests (116 passed, 2 todo)", "frontend API Vitest: 2 suites, 5 tests passed", "frontend trash/page Vitest: 32 tests passed", "npm --prefix frontend run typecheck", "npm --prefix backend run build", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/record/page.tsx:fetchDeletedItems loads both /deleted/all arrays in full; trash rows are rendered with map and expose only per-row permanent delete plus a whole-loaded-array 'Xóa tất cả' action. backend findDeleted methods do not accept page/limit, count, sort, skip, or limit."
  expected_behavior: "Both tabs load 50 newest deleted rows initially and append the next server page on demand; totals remain authoritative; checkboxes select only eligible loaded rows; permanent bulk deletion targets only explicit IDs and reports mixed outcomes."
  root_cause: "Trash endpoints expose only unbounded arrays, and the dialog has no pagination metadata or trash-specific selection state."

scope:
  inspect: ["frontend/src/components/ui/pagination.tsx:existing accessible navigation conventions", "backend/src/{academic-record,daily-class-report} service findAll pagination patterns", "completed generation 19 trash error/transaction behavior to preserve"]
  write: ["backend/src/academic-record/academic-record.controller.ts:findDeleted page/limit query forwarding", "backend/src/academic-record/academic-record.controller.spec.ts:deleted pagination contract coverage", "backend/src/academic-record/academic-record.service.ts:findDeleted optional pagination", "backend/src/academic-record/academic-record.service.spec.ts:deleted pagination/RBAC/sort coverage", "backend/src/daily-class-report/daily-class-report.controller.ts:findDeleted page/limit query forwarding", "backend/src/daily-class-report/daily-class-report.controller.spec.ts:new focused deleted pagination controller coverage", "backend/src/daily-class-report/daily-class-report.service.ts:findDeleted optional pagination", "backend/src/daily-class-report/daily-class-report.service.spec.ts:deleted pagination/ownership/sort coverage", "frontend/src/api/academic-record-api.ts:getDeletedAcademicRecords paginated contract", "frontend/src/api/academic-record-api.test.ts:deleted query/response coverage", "frontend/src/api/daily-class-report-api.ts:getDeletedDailyClassReports paginated contract", "frontend/src/api/daily-class-report-api.test.ts:deleted query/normalization coverage", "frontend/src/app/(dashboard)/students/record/page.tsx:trash paging/selection/bulk-delete UI", "frontend/src/app/(dashboard)/students/record/page.test.tsx:trash lazy-load/selection/mixed-result coverage"]
  preserve: ["Generation 19 independent per-source load/retry and safe failure summaries", "Transactional report-record delete/restore invariants and strict force-delete eligibility", "Existing endpoint paths, no-query array response, RBAC/ownership scope, and populated fields", "Single-row restore/permanent-delete and confirmation behavior", "Desktop/mobile responsive rendering and keyboard-accessible controls"]
  out: ["Delete-all-unseen server operation", "Automatic infinite-scroll observer", "Trash search/filtering, retention/TTL, or scheduled purge", "Schema/index migration, dependency, data repair, deployment, or unrelated list pagination"]

acceptance_criteria:
  - "AC-01: GET deleted/all without page/limit retains the legacy array; with page and/or limit it returns {data,meta:{total,page,limit,totalPages,has_more}}, clamps page to >=1 and limit to 1..100, preserves requester scope, and orders by updatedAt then _id descending."
  - "AC-02: Opening either tab requests page 1 with limit 50; 'Tải thêm' requests only that source's next page, appends unique IDs, disables during loading, disappears when has_more=false, and displays loaded/total counts without hiding the other tab's fulfilled state."
  - "AC-03: Desktop and mobile trash rows expose accessible checkboxes; the header control selects/deselects only currently loaded, deletion-eligible rows in the active tab and shows checked/indeterminate state accurately. Selections are isolated between tabs and removed when rows disappear."
  - "AC-04: The dialog replaces ambiguous 'Xóa tất cả' behavior with 'Xóa đã chọn (n)'; confirmation states the exact count and active data type, no request is sent for an empty selection, and only selected IDs are submitted."
  - "AC-05: AcademicRecord deletion reuses the existing 25-ID bulk endpoint; DailyClassReport deletion retains the five-request concurrency ceiling. Successful rows are removed, failed IDs remain selected when still loaded, and the existing safe per-item result summary reports succeeded and failed counts/messages."
  - "AC-06: After any delete/restore that can shift offsets, the affected tab rebases at page 1 before further loading so no row is skipped or duplicated; switching tabs does not discard the other tab's loaded data or selection."
  - "AC-07: Existing permissions, owner scope, transaction guarantees, strict force-delete checks, source-specific retry, legacy clients, and single-row actions remain unchanged; no schema, migration, dependency, or delete-all-unseen capability is introduced."

execution:
  - "E-01 [AC-01,AC-07] backend/src/academic-record/academic-record.controller.ts:findDeleted and backend/src/daily-class-report/daily-class-report.controller.ts:findDeleted → parse optional page/limit and forward a bounded query without changing guards or route paths."
  - "E-02 [AC-01,AC-07] backend/src/academic-record/academic-record.service.ts:findDeleted and backend/src/daily-class-report/daily-class-report.service.ts:findDeleted → retain array mode when pagination is absent; otherwise apply existing RBAC filter to both find/count, stable sort, skip/limit, and shared metadata shape."
  - "E-03 [AC-01,AC-07] backend controller/service specs, including new backend/src/daily-class-report/daily-class-report.controller.spec.ts → prove query forwarding, bounds, stable ordering, meta totals, legacy arrays, and unchanged student/advisor/owner/full-view scope."
  - "E-04 [AC-01,AC-02,AC-07] frontend/src/api/{academic-record-api,daily-class-report-api}.ts → add typed page/limit parameters and paginated return types while keeping no-parameter compatibility and report normalization; update both API tests for encoded queries and shapes."
  - "E-05 [AC-02,AC-06] frontend/src/app/(dashboard)/students/record/page.tsx:trash load state → track page/meta per source, implement initial/rebase versus append loading with ID deduplication, and add accessible 'Tải thêm' plus loaded/total text."
  - "E-06 [AC-03,AC-04] frontend/src/app/(dashboard)/students/record/page.tsx:trash dialog → add per-source selected-ID sets, row/mobile checkboxes, tri-state select-loaded control, permission eligibility, selected count, and type-specific confirmation copy; remove the ambiguous loaded-array delete-all entry point."
  - "E-07 [AC-05,AC-06,AC-07] frontend/src/app/(dashboard)/students/record/page.tsx:bulk handlers → submit only selected IDs through existing APIs/concurrency limits, retain eligible failed selections and summaries, prune successes, then safely rebase the affected source."
  - "E-08 [AC-02,AC-03,AC-04,AC-05,AC-06,AC-07] frontend/src/app/(dashboard)/students/record/page.test.tsx → cover independent page requests, append/dedup/end state, tab-isolated tri-state selection, permission filtering, exact selected payloads, empty guard, mixed failures, rebase, and mobile accessibility."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01,AC-07] npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts src/academic-record/academic-record.controller.spec.ts src/daily-class-report/daily-class-report.service.spec.ts src/daily-class-report/daily-class-report.controller.spec.ts --runInBand → all focused backend tests pass."
  - "V-02 [AC-01,AC-02,AC-07] npm --prefix frontend test -- src/api/academic-record-api.test.ts src/api/daily-class-report-api.test.ts → both API suites pass."
  - "V-03 [AC-02,AC-03,AC-04,AC-05,AC-06,AC-07] npm --prefix frontend test -- src/app/(dashboard)/students/record/page.test.tsx → focused trash UI suite passes."
  - "V-04 [AC-01,AC-07] npm --prefix backend run build → exits 0."
  - "V-05 [AC-01,AC-02,AC-03,AC-04,AC-05,AC-06,AC-07] npm --prefix frontend run typecheck → exits 0."
  - "V-06 [AC-01,AC-02,AC-03,AC-04,AC-05,AC-06,AC-07] git diff --check → no whitespace errors and final diff contains only declared paths plus this retained taskscope lifecycle update."

risks: ["Offset pagination can skip rows after mutation; AC-06 requires page-one rebase before any next-page request.", "Dual legacy/paginated response modes require explicit type narrowing in frontend clients.", "Selection must never imply unseen rows or bypass per-row deletion eligibility."]
stop_conditions: ["Stop if product intent requires selecting or deleting unseen/all matching rows; that needs an explicit server-side bulk contract and confirmation design.", "Stop for a schema/index migration, public legacy response removal, permission change, new dependency, production mutation, or overlap with another active taskscope/dirty path."]
