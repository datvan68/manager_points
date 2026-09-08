slot_id: "taskscope-01"
generation: 2
task_id: "20260908T084510+0700-report-table-stability-and-density"
scope_file: "docs/task/taskscope-01.md"
status: completed
scope_revision: 3
created_at: "2026-09-08T08:45:10+07:00"
updated_at: "2026-09-08T09:12:00+07:00"
base_commit: "d9c1512d6317a25cc69ef6810ef9fb6c8fd5edaa"
task: "Stabilize and compact report tables"
pipeline: feature_development
profile: Full
objective: "Make Student records sort by highest record count, simplify its detail popover, eliminate data-loading flicker, cap pages at 40 rows with scrolling, and use compact table text consistently across visible report tabs."
coordination:
  depends_on: []
  warnings:
    - "The completed student-summary implementation from taskscope-02 is present in base_commit."
    - "Descending order is interpreted as record_count descending for Ghi nhận sv; ties use latest record time descending, then student id for stable pagination."
completion:
  completed_at: "2026-09-08T09:12:00+07:00"
  outcome: "completed"
  final_commit_or_state: "worktree modified; HEAD remains d9c1512d6317a25cc69ef6810ef9fb6c8fd5edaa"
  changed_paths:
    - "backend/src/academic-record/academic-record.controller.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "frontend/src/api/academic-record-api.ts"
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/app/(dashboard)/reports/page.test.tsx"
    - "frontend/src/components/reports/ReportTable.tsx"
    - "frontend/src/components/reports/ReportTable.test.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx"
    - "frontend/src/components/reports/report-types.ts"
    - "frontend/src/components/reports/report-helpers.ts"
    - "frontend/src/components/reports/report-helpers.test.ts"
    - "docs/task/taskscope-01.md"
  checks_passed:
    - "V-01: backend academic-record service suite passed, 84 passed and 2 todo"
    - "V-02: focused frontend Vitest passed, 4 files and 6 tests"
    - "V-03: reports page loading contract test passed; single active-tab effect and stale-response guard are asserted"
    - "V-04: frontend typecheck and backend build exited 0"
    - "V-05: dev UI showed 193 grouped students in count-desc order, recorder-free details, 10/20/40 options, 40-row page and compact scrolling table"
    - "V-06: git diff --check passed with no whitespace errors"
  cleanup_pending: []
evidence:
  current_behavior: "academic-record.service.ts sorts grouped students by latest time; AcademicRecordReportTab shows latest_recorded_by; reports/page.tsx has two effects that can fetch the active tab twice and replaces rows with skeletons during refresh; ReportTable delegates pagination options [5,10,20,50,100] and has no bounded vertical table viewport; compact text is applied only by the Ghi nhận sv wrapper."
  expected_behavior: "Ghi nhận sv is stably ordered by highest count, the misleading recorder line is absent, refreshes retain current rows without duplicate fetch flicker, selectable page sizes never exceed 40, long tables scroll, and all visible data tables use the same compact text scale."
  root_cause: "The grouped aggregation orders by latest dates instead of recordCount; overlapping load effects and destructive loading rendering cause flicker; ReportTable does not constrain its page-size options, viewport height, or body typography."
scope:
  inspect:
    - "frontend/src/components/ui/pagination.tsx"
    - "frontend/src/components/ui/ResponsiveDataView.tsx"
  write:
    - "backend/src/academic-record/academic-record.controller.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "frontend/src/api/academic-record-api.ts"
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/app/(dashboard)/reports/page.test.tsx (new)"
    - "frontend/src/components/reports/ReportTable.tsx"
    - "frontend/src/components/reports/ReportTable.test.tsx (new)"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx"
    - "frontend/src/components/reports/report-types.ts"
    - "frontend/src/components/reports/report-helpers.ts"
    - "frontend/src/components/reports/report-helpers.test.ts"
  preserve:
    - "Keep existing filters, RBAC, active/non-deleted counting, totals, exports, and the default grouped API ordering for callers that do not request count sorting."
    - "Keep initial-load skeletons and visible refresh feedback; only background page/filter/refresh loads retain the last successful rows."
    - "Do not change Overview charts/KPIs, tab labels, Excel columns, mobile cards, or hidden task/system navigation behavior."
  out:
    - "Schema, migration, scoring, persisted-data, dependency, or global pagination changes."
    - "Showing every recorder for a student or adding a record-history drill-down."
acceptance_criteria:
  - "AC-01: Ghi nhận sv requests count-desc sorting before server pagination; rows are ordered by record_count descending, with latest record time descending and student id as deterministic tie-breakers across pages."
  - "AC-02: The Chi tiết ghi nhận popover remains compact and shows totals, type counts, total points, latest title, and date, but never shows Người ghi; the unused mapped recorder field is removed."
  - "AC-03: Initial entry may show a skeleton, but changing tab/page/page size/filter or refreshing issues one current-tab request and retains the last successful table until the latest response replaces it; stale responses do not overwrite newer results."
  - "AC-04: Every visible report data table offers only 10, 20, and 40 rows per page, resets to page 1 when size changes, and uses a bounded vertical viewport with internal scrolling and a reachable pagination footer."
  - "AC-05: Desktop table body text in Sinh viên, Điểm rèn luyện, Ghi nhận sv, and Ghi nhận lớp uses the same compact size without truncating exported values or changing mobile content."
execution:
  - "E-01 [AC-01] academic-record controller/service/API client -> add an optional grouped sortBy=recordCount query used by reports only; place count-desc and stable tie-break sorting before $facet skip/limit while preserving the existing default order."
  - "E-02 [AC-02] report types/helper/AcademicRecordReportTab -> remove latest_recorded_by mapping and the Người ghi popover row; retain the other detail fields and compact width."
  - "E-03 [AC-03] reports/page.tsx -> consolidate active-tab loading into one dependency-aware path, separate initial loading from background refresh, keep prior rows during background loads, and retain request-sequence stale-response protection."
  - "E-04 [AC-04, AC-05] ReportTable.tsx -> pass report-only pageSizeOptions [10,20,40], normalize size changes to page 1, apply one shared compact desktop text class, and bound the table viewport so rows scroll while pagination remains usable."
  - "E-05 [AC-01, AC-03] service and reports page tests -> assert aggregation sort placement/tie-breaks/default compatibility and prove a deferred refresh produces one request, keeps old rows, and ignores stale completion."
  - "E-06 [AC-02, AC-04, AC-05] component/helper tests -> assert the recorder field is absent, page-size controls exclude 50/100, 40 is selectable, size changes reset page 1, and shared compact/scroll contracts render."
verification:
  - "V-01 [AC-01] npm --prefix backend test -- academic-record.service.spec.ts --runInBand -> grouped sorting tests and existing academic-record service tests pass with no skips."
  - "V-02 [AC-02, AC-04, AC-05] npm --prefix frontend test -- src/components/reports/report-helpers.test.ts src/components/reports/tabs/AcademicRecordReportTab.test.tsx src/components/reports/ReportTable.test.tsx -> focused tests pass with no skips."
  - "V-03 [AC-03] npm --prefix frontend test -- 'src/app/(dashboard)/reports/page.test.tsx' -> request-count, retained-data, and stale-response cases pass."
  - "V-04 [AC-01, AC-02, AC-03, AC-04, AC-05] npm --prefix frontend run typecheck && npm --prefix backend run build -> both commands exit 0."
  - "V-05 [AC-01, AC-02, AC-03, AC-04, AC-05] In the development UI, verify a multi-page Ghi nhận sv result is count-desc, the popover omits Người ghi, filter/page changes do not flash blank/skeleton content, 40 rows is the maximum, the table scrolls, and the four visible data tabs have matching body text size."
  - "V-06 [AC-01, AC-02, AC-03, AC-04, AC-05] git diff --check -- backend/src/academic-record/academic-record.controller.ts backend/src/academic-record/academic-record.service.ts backend/src/academic-record/academic-record.service.spec.ts frontend/src/api/academic-record-api.ts 'frontend/src/app/(dashboard)/reports/page.tsx' 'frontend/src/app/(dashboard)/reports/page.test.tsx' frontend/src/components/reports/ReportTable.tsx frontend/src/components/reports/ReportTable.test.tsx frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx frontend/src/components/reports/report-types.ts frontend/src/components/reports/report-helpers.ts frontend/src/components/reports/report-helpers.test.ts -> no whitespace errors."
runtime_test:
  environment: "Existing local development frontend and API; verify identities and non-production endpoints read-only before testing."
  data: "Existing active grouped academic records; no create/update/delete operations."
  scenarios: "Open Ghi nhận sv, compare first two API pages, open details, change filters and page size, then inspect Sinh viên, Điểm rèn luyện, and Ghi nhận lớp."
  pass_signal: "Stable descending ordering, no recorder label, no content flash, maximum 40 rows with internal scrolling, and consistent compact text."
  cleanup: "None; read-only verification."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "A sort added after $facet would only reorder one page and violate global ordering; the regression test must inspect stage order."
  - "Shared table styling must not alter mobile cards or the global CustomPagination defaults outside reports."
stop_conditions:
  - "Stop for clarification if descending means latest date rather than record count, or if the 40-row cap should apply outside Thống kê báo cáo."
  - "Stop if eliminating flicker requires changing a shared loader outside the scoped report page."
  - "Stop with TASKSCOPE_CONFLICT if an active task reserves a write path or an unowned change appears on one."
