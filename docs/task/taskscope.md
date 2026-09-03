slot_id: "taskscope-00"
generation: 19
task_id: "20260903-102113-stabilize-system-trash-operations"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-03T10:21:13+07:00"
updated_at: "2026-09-03T10:42:00+07:00"
base_commit: "31d2493d5bc1251a742a8227090848358f18d8f9"
task: "Stabilize system trash loading and destructive operations"
pipeline: feature_development
profile: Full
objective: "System trash loads each data source independently, performs report-record mutations atomically, rejects unsafe permanent deletion, and presents actionable per-item failures without unbounded request concurrency."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-03T10:42:00+07:00"
  outcome: success
  final_commit_or_state: "Working tree on main at 31d2493d5bc1251a742a8227090848358f18d8f9 with scoped changes"
  changed_paths: ["backend/src/academic-record/academic-record.controller.spec.ts", "backend/src/academic-record/academic-record.controller.ts", "backend/src/academic-record/academic-record.service.spec.ts", "backend/src/academic-record/academic-record.service.ts", "backend/src/daily-class-report/daily-class-report.service.spec.ts", "backend/src/daily-class-report/daily-class-report.service.ts", "frontend/src/app/(dashboard)/students/record/page.test.tsx", "frontend/src/app/(dashboard)/students/record/page.tsx", "docs/task/taskscope.md"]
  checks_passed: ["V-01 focused backend Jest: 3 suites, 116 passed, 2 todo", "V-02 focused frontend Vitest: 32 passed", "V-03 backend build: passed", "V-04 frontend typecheck: passed", "V-05 git diff --check: passed"]
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/record/page.tsx:fetchDeletedItems uses Promise.all so one rejected source hides both results; handleForceDeleteAllReports starts one request per report and reports counts only. backend/src/daily-class-report/daily-class-report.service.ts:{remove,restore,forceRemove} mutates linked AcademicRecord rows sequentially without a transaction, suppresses child-delete failures, and forceRemove accepts an active report. backend/src/academic-record/academic-record.controller.ts:{bulkForceRemove,forceRemove} enables bypass paths that weaken trash/link/hierarchy preconditions."
  expected_behavior: "A source failure is isolated and retryable; destructive report cascades either commit parent and children together or change nothing; public permanent-delete routes accept only trashed eligible objects; bulk outcomes identify failures and use bounded concurrency."
  root_cause: "Independent reads are coupled in one Promise.all; parent/child writes lack a MongoDB transaction; public force-delete paths reuse an internal bypass flag; frontend report purge has unbounded fan-out and discards rejection details."

scope:
  inspect: ["README.md:MongoDB replica-set runtime contract", "backend/src/semesters/semesters.service.ts:withTransaction convention", "frontend/src/api/{academic-record-api,daily-class-report-api}.ts:error propagation and existing response contracts"]
  write: ["backend/src/academic-record/academic-record.controller.ts:bulkForceRemove/forceRemove public preconditions", "backend/src/academic-record/academic-record.controller.spec.ts:force-delete routing and guard regressions", "backend/src/academic-record/academic-record.service.ts:remove/restore/forceRemove transaction-aware internal options and trash invariants", "backend/src/academic-record/academic-record.service.spec.ts:trash eligibility/session/sync regressions", "backend/src/daily-class-report/daily-class-report.service.ts:remove/restore/forceRemove atomic cascade and structured failures", "backend/src/daily-class-report/daily-class-report.service.spec.ts:atomicity/idempotent restore/error regressions", "frontend/src/app/(dashboard)/students/record/page.tsx:trash loading, retry, bounded bulk execution, operation result UI", "frontend/src/app/(dashboard)/students/record/page.test.tsx:partial-load and destructive-operation UI regressions"]
  preserve: ["Existing endpoint URLs and successful response shapes", "READ/UPDATE/DELETE/CONFIG permission requirements and owner/class visibility", "locked grading summary rule: delete remains allowed, restore remains blocked", "normal list filtering, soft-delete fields, score reconciliation, and dialogs", "legacy GET /deleted/all behavior; no schema or stored-data rewrite"]
  out: ["Database migration or production data repair", "Automatic retention/TTL or scheduled purge", "Trash search/pagination redesign without measured volume evidence", "Audit-log subsystem, new dependency, or unrelated grading refactor", "Deployment or production mutation"]

acceptance_criteria:
  - "AC-01: If either deleted-record or deleted-report request fails, the fulfilled tab still renders; the failed tab shows its own non-sensitive error and retry action, and retry requests only that source."
  - "AC-02: DailyClassReport soft-delete, restore, and permanent-delete commit the report plus all linked AcademicRecord mutations in one MongoDB transaction; an injected child/parent failure aborts the transaction and returns a stable reasonCode, operation phase, and failed object ID without personal data."
  - "AC-03: Restoring a deleted report treats already-active linked records as an idempotent no-op, restores only deleted children, still rejects locked-summary children, and reconciles affected scores exactly once after a successful transaction."
  - "AC-04: Public AcademicRecord permanent-delete rejects active records and direct deletion of report-owned records; public DailyClassReport permanent-delete rejects active reports. Internal report cascade may bypass ownership/link checks only after the report-level authorization and trash-state checks pass."
  - "AC-05: AcademicRecord bulk force-delete retains succeeded/failed semantics; report 'delete all' runs at most five requests concurrently, retains failed rows, and displays succeeded count plus each failed row's safe label/ID and backend message."
  - "AC-06: Existing successful response shapes, RBAC/ownership visibility, confirmation dialogs, locked-summary behavior, and ordinary soft-delete/restore flows remain compatible; no schema, migration, dependency, or endpoint replacement is introduced."

execution:
  - "E-01 [AC-02,AC-03,AC-04,AC-06] backend/src/academic-record/academic-record.service.ts:{remove,restore,forceRemove} → add an internal transaction context that passes ClientSession through record mutation and defers/deduplicates score reconciliation until commit; keep public defaults strict and backward-compatible."
  - "E-02 [AC-04,AC-06] backend/src/academic-record/academic-record.controller.ts:{bulkForceRemove,forceRemove} → stop converting query input or bulk routes into an unrestricted bypass; reserve bypass for authenticated report-service calls."
  - "E-03 [AC-02,AC-03,AC-04] backend/src/daily-class-report/daily-class-report.service.ts:{remove,restore,forceRemove} → follow the repository withTransaction pattern, validate permission/state before mutation, mutate linked records in the same session, abort on every child failure, make active children idempotent during restore, and emit structured safe exceptions."
  - "E-04 [AC-02,AC-03,AC-04,AC-06] backend/src/academic-record/{academic-record.controller.spec.ts,academic-record.service.spec.ts} and backend/src/daily-class-report/daily-class-report.service.spec.ts → cover strict public force-delete, internal cascade allowance, rollback, locked restore, active-child restore, parent eligibility, and one-time reconciliation."
  - "E-05 [AC-01] frontend/src/app/(dashboard)/students/record/page.tsx:fetchDeletedItems → replace coupled loading with per-source settled state, safe tab-specific errors, and targeted retries while retaining successful data."
  - "E-06 [AC-05,AC-06] frontend/src/app/(dashboard)/students/record/page.tsx:{runBulkRecordDelete,handleForceDeleteAllReports,trash dialog} → cap report deletion concurrency at five, keep failed rows after reconciliation, and render an accessible operation summary with per-item messages."
  - "E-07 [AC-01,AC-05,AC-06] frontend/src/app/(dashboard)/students/record/page.test.tsx → verify partial loading/retry, concurrency ceiling, mixed outcomes, retained failures, error accessibility, and unchanged confirmations."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-02,AC-03,AC-04,AC-06] npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts src/academic-record/academic-record.controller.spec.ts src/daily-class-report/daily-class-report.service.spec.ts --runInBand → all focused backend tests pass."
  - "V-02 [AC-01,AC-05,AC-06] npm --prefix frontend test -- src/app/(dashboard)/students/record/page.test.tsx → all focused trash UI tests pass."
  - "V-03 [AC-02,AC-03,AC-04,AC-06] npm --prefix backend run build → Nest/TypeScript build exits 0."
  - "V-04 [AC-01,AC-05,AC-06] npm --prefix frontend run typecheck → TypeScript exits 0."
  - "V-05 [AC-01,AC-02,AC-03,AC-04,AC-05,AC-06] git diff --check → no whitespace errors; final diff contains only declared write paths plus this retained taskscope lifecycle update."

risks: ["MongoDB transaction availability is required; repository README documents replica-set rs0 as a runtime prerequisite.", "Score reconciliation occurs across multiple linked records and must be deduplicated by student/semester/criterion after commit.", "Structured errors must not expose populated student/user personal data."]
stop_conditions: ["Stop if the target runtime cannot provide the documented MongoDB replica set; do not add a non-atomic fallback.", "Stop for a required schema/index migration, public response replacement, permission change, new dependency, production data repair, or deployment approval.", "Stop on a new active taskscope or dirty-worktree overlap with any declared write path."]
