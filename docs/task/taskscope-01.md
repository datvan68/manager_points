slot_id: "taskscope-01"
generation: 1
task_id: "20260908T104820+0700-verify-report-attention-kpi"
scope_file: "docs/task/taskscope-01.md"
status: in_progress
scope_revision: 4
created_at: "2026-09-08T10:48:20+07:00"
updated_at: "2026-09-08T11:10:00+07:00"
base_commit: "94851c77f24a25fbbdbe864343355e130d1e82ee"
task: "Verify report quick statistics and the attention-student count"
pipeline: test_only
profile: Full
objective: "Ensure report quick statistics use complete filter- and RBAC-scoped data, especially that Cần xử lý counts distinct students with more than two active discipline occurrences and includes students with exactly three."
coordination:
  depends_on: []
  warnings:
    - "The calculation was added in commit e6b51cd8, but focused regression coverage and dev UI/API reconciliation were not completed before its scope file was removed."
    - "This verification scope does not authorize speculative production-code changes; a confirmed mismatch requires a scoped bug-fix amendment."
    - "AC-04 blocker: unfiltered dev report cards show 360 discipline occurrences and 19 attention students, while the selected class CĐ24A-CNKTCK has 17 students and independently grouped active current-semester records produce 0 and 0; the UI still displays 360 and 19 after the class filter."
completion:
  completed_at: null
  outcome: "partial; AC-01 through AC-03 passed, AC-04 blocked by confirmed dev filter mismatch"
  final_commit_or_state: "Uncommitted worktree on main at 94851c77f24a25fbbdbe864343355e130d1e82ee"
  changed_paths:
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "frontend/src/app/(dashboard)/reports/page.test.tsx"
    - "frontend/src/components/reports/report-helpers.ts"
    - "frontend/src/components/reports/report-helpers.test.ts"
    - "docs/task/taskscope-01.md"
  checks_passed:
    - "Focused backend Jest: 85 passed, 2 todo"
    - "Focused frontend Vitest: 4 passed"
    - "Frontend typecheck: exit 0"
    - "Backend build: exit 0"
    - "git diff --check: no whitespace errors"
  cleanup_pending:
    - "AC-04 requires a scoped bug-fix amendment to trace why the academic-record aggregate remains unfiltered before this verification can complete."
evidence:
  current_behavior: "backend/src/academic-record/academic-record.service.ts:findAll(groupBy=student) sums normalized ky_luat quantity before pagination and exposes attentionStudentCount using a strict > 3 threshold; frontend report helpers display this aggregate, but existing focused tests do not assert the threshold, pre-pagination aggregate, or KPI metadata wiring."
  expected_behavior: "All four quick statistics reflect the full current filters and requester scope; Cần xử lý is the number of distinct students whose active, non-deleted ky_luat occurrence quantity totals at least three."
  root_cause: null
scope:
  inspect:
    - "backend/src/academic-record/academic-record.service.ts:findAll"
    - "frontend/src/app/(dashboard)/reports/page.tsx:loadTabSpecificData"
    - "frontend/src/components/reports/report-helpers.ts:processReportsData"
    - "backend/src/system/system.service.ts:getDashboardMetrics"
  write:
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "frontend/src/components/reports/report-helpers.ts"
    - "frontend/src/app/(dashboard)/reports/page.test.tsx"
    - "frontend/src/components/reports/report-helpers.test.ts"
  preserve:
    - "Apply the requested strict threshold: exactly two discipline occurrences is not Cần xử lý; three or more is."
    - "Preserve active/non-deleted record filtering, requester RBAC, semester/department/class/status/search/date filters, pagination, and additive API compatibility."
    - "Do not expose student identity or raw personal data in committed fixtures, logs, screenshots, or the taskscope."
  out:
    - "Production-code, schema, migration, index, scoring, permission, dashboard, export, or persistent-data changes."
acceptance_criteria:
  - "AC-01: A focused backend regression proves discipline occurrences are summed from normalized quantity before pagination, only ky_luat records contribute, exactly two is excluded, and three or more counts one distinct student."
  - "AC-02: Backend regression proves active/non-deleted filtering plus requester and report filters are applied before grouping, so unrelated or inaccessible records cannot affect quick statistics."
  - "AC-03: Frontend regressions prove the four quick-stat labels/order and values use aggregate metadata even when preview rows are incomplete or misleading; Cần xử lý is not recomputed from the current page."
  - "AC-04: Read-only dev UI/API reconciliation confirms the displayed Cần xử lý value equals an independently checked count for at least one unfiltered scope and one narrower filter scope, including the three-versus-four boundary when matching dev records exist."
execution:
  - "E-01 [AC-01, AC-02] backend/src/academic-record/academic-record.service.ts:findAll and backend/src/academic-record/academic-record.service.spec.ts:findAll grouped-by-student tests -> change the attention threshold to > 2 and assert the quantity-normalizing expression, pre-pagination aggregate facet, returned metadata, base active/non-deleted match, report filters, requester restriction, and the exact-two/three boundary."
  - "E-02 [AC-03] frontend/src/components/reports/report-helpers.ts and frontend/src/components/reports/report-helpers.test.ts:processReportsData tests -> update the KPI description to more than two discipline occurrences and assert authoritative aggregate metadata alongside a deliberately partial preview."
  - "E-03 [AC-03] frontend/src/app/(dashboard)/reports/page.test.tsx:reports loading contract -> assert grouped requests carry applicable filters and aggregate metadata is stored for overview/record loads without page-derived fallback or stale-response overwrite."
verification:
  - "V-01 [AC-01, AC-02] npm --prefix backend test -- --runTestsByPath src/academic-record/academic-record.service.spec.ts --runInBand -> focused Jest suite passes with the new aggregate boundary assertions and no new skips."
  - "V-02 [AC-03] npm --prefix frontend test -- 'src/app/(dashboard)/reports/page.test.tsx' src/components/reports/report-helpers.test.ts -> focused Vitest suites pass with no skipped tests."
  - "V-03 [AC-01, AC-02, AC-03] npm --prefix frontend run typecheck; npm --prefix backend run build -> both commands exit 0."
  - "V-04 [AC-04] In verified development only, compare Thống kê báo cáo quick cards with GET /api/academic-records?groupBy=student&sortBy=recordCount and the scoped active discipline records for the same requester and filters -> four KPI values agree, and Cần xử lý counts distinct students above two occurrences."
  - "V-05 [AC-01, AC-02, AC-03] git diff --check -- backend/src/academic-record/academic-record.service.spec.ts 'frontend/src/app/(dashboard)/reports/page.test.tsx' frontend/src/components/reports/report-helpers.test.ts docs/task/taskscope-01.md -> no whitespace errors."
runtime_test:
  environment: "Existing local development frontend/API/database; establish non-production identities from non-secret runtime metadata before any request."
  data: "Read-only existing dev report data; retain only redacted aggregate counts and anonymous boundary evidence."
  scenarios: "Open Thống kê báo cáo, record all four cards, compare API aggregates with independently grouped active ky_luat quantities, then repeat with one available semester and class or department filter."
  pass_signal: "Displayed and independently calculated values agree for both scopes; a student totaling three contributes zero and a student totaling four or more contributes one when such records are available."
  cleanup: "Reset UI filters; no persistent data is created or changed."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "A mocked pipeline assertion alone cannot prove real MongoDB aggregation, so AC-04 requires read-only dev reconciliation."
  - "Occurrence quantity and record-document count are different units; this scope follows the existing Dashboard rule and normalized quantity contract."
stop_conditions:
  - "Stop and record the exact mismatch if dev data disagrees with the API or UI; do not edit production code until the earliest incorrect state and fix boundary are confirmed and the scope is amended."
  - "Stop dependent runtime checks if frontend, API, or database identity cannot be proven separate from production."
  - "Stop with TASKSCOPE_CONFLICT if an active task reserves a write path or an unowned change appears on one."
