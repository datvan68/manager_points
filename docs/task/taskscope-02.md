---
slot_id: "taskscope-02"
generation: 1
task_id: "20260911-102305-academic-record-criterion-matrix"
scope_file: "docs/task/taskscope-02.md"
status: blocked
scope_revision: 3
created_at: "2026-09-11T10:23:05+07:00"
updated_at: "2026-09-11T11:12:00+07:00"
base_commit: "2119f64d1f831456a8423c6775bb3a71e933c6b0"
task: "Add academic-record statistics by criterion and student"
pipeline: feature_development
profile: Full
objective: "Add a criterion-level matrix to the academic-record report so each filtered student row shows the number of active records for every criterion that occurs anywhere in the full filtered result set."
coordination:
  depends_on: []
  warnings:
    - "Slot 00 is an empty legacy file and remains untouched; slot 01 generation 2 is blocked and reserves only timetable-related paths. This new slot and all planned report/academic-record writes are disjoint from the active reservation and current unrelated timetable changes."
    - "Execution started from the exact user-pinned ready scope; the scoped report paths are disjoint from active timetable reservations and current unrelated changes."
    - "Code implementation and focused verification passed, but V-04 authenticated browser interaction is blocked because Chrome reports another extension UI open on the local reports tab; no password or data mutation was performed."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx renders one student-grouped table with only aggregate Khen thuong, Cong diem and Ky luat counts. backend/src/academic-record/academic-record.service.ts groupBy=student joins criteria but returns only recordTypeCounts; criterion-level counts and a full-filter active-criterion catalog are absent."
  expected_behavior: "The report offers an additional criterion view whose dynamic columns are stable across pagination, include only criteria with at least one matching active record, and count records per student and criterion under the existing filters and requester scope."
  root_cause: null
scope:
  inspect:
    - "frontend/src/components/reports/ReportTable.tsx"
    - "frontend/src/components/reports/report-export.ts"
    - "frontend/src/api/criteria-api.ts"
    - "backend/src/academic-record/schemas/academic-record.schema.ts"
    - "backend/src/criteria/schemas/criterion.schema.ts"
  write:
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "frontend/src/api/academic-record-api.ts"
    - "frontend/src/components/reports/report-types.ts"
    - "frontend/src/components/reports/report-helpers.ts"
    - "frontend/src/components/reports/report-helpers.test.ts"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx"
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/app/(dashboard)/reports/page.test.tsx"
  preserve:
    - "Existing GET /academic-records query parameters, requester/RBAC scoping, active and non-deleted record filters, student pagination order, follow-up behavior and current summary table remain backward compatible."
    - "A count means one active academic-record document, matching the current Số lượt semantics; quantity and score effects must not multiply the criterion count."
    - "Criterion identity uses criterion_id; criterion_name is presentation text and must not be used as an aggregation key."
    - "Existing report filters and full-dataset Excel row limits remain enforced."
  out:
    - "Database/schema migrations, persistent-data changes, new permissions, follow-up workflow changes and production deployment."
    - "Changing KPI disciplineOccurrences or score calculation semantics."
    - "Grouping by record_title or merging different criterion IDs that happen to share a display name."
acceptance_criteria:
  - "AC-01: Each grouped student result includes criterionCounts keyed by criterion ID; every matching active, non-deleted record contributes exactly one, while quantity greater than one still contributes one record occurrence."
  - "AC-02: Grouped response metadata includes activeCriteria with ID, code, name and type for exactly the criteria occurring in the complete filtered/requester-scoped result, not merely the current page; criteria with zero occurrences are omitted and the ordered list remains stable across page changes."
  - "AC-03: The Ghi nhận report provides clear Tong hop and Theo tieu chi views. The criterion view keeps Mã HSSV, Họ tên, Lớp and Số lượt, adds one horizontally scrollable column per active criterion, displays the per-student count or a dash for zero, and retains existing loading, empty and server pagination behavior."
  - "AC-04: Semester, department, class, student status, search, date and follow-up-status filters constrain both rows and active criterion columns consistently; changing filters/page cannot leave stale columns or counts from an older response."
  - "AC-05: Exporting the Ghi nhận report includes a separate criterion-statistics sheet with the same full filtered student set and dynamic criterion columns, using criterion IDs internally and visible names as headers; duplicate display names remain distinct and export row safeguards still apply."
  - "AC-06: Existing summary counts, detail dialogs, follow-up actions, selection behavior and grouped API consumers continue to work without response-shape regressions."
execution:
  - "E-01 [AC-01,AC-02,AC-04,AC-06] backend/src/academic-record/academic-record.service.ts: extend the existing groupBy=student aggregation to collect per-student criterion IDs/counts and compute activeCriteria before page slicing from the same filtered pipeline. Return additive fields only, sort criteria deterministically by criterion_code then criterion_name then ID, and preserve current facets, totals, follow-up filtering and requester constraints."
  - "E-02 [AC-01,AC-02,AC-04,AC-06] backend/src/academic-record/academic-record.service.spec.ts: extend grouped-response tests for multiple students/criteria, zero omission, full-filter metadata across pagination, quantity semantics, filtering and unchanged legacy fields."
  - "E-03 [AC-01,AC-02,AC-03,AC-04,AC-06] frontend API/report type and helper files: add typed activeCriteria and criterionCounts transport/mapping, preserve criterion IDs, and carry metadata independently of page rows without deriving columns from only the visible page. Add focused mapping tests including duplicate criterion names."
  - "E-04 [AC-03,AC-04,AC-06] AcademicRecordReportTab.tsx and its test: add the two-view selector and dynamic criterion table using the existing ReportTable conventions, horizontal overflow and shared server pagination. Keep status filters and current summary/follow-up interactions intact; criterion zero cells render a dash and no zero-only criterion column appears."
  - "E-05 [AC-04,AC-05,AC-06] reports/page.tsx and its test: store/reset activeCriteria with each current request, pass it to the tab, fetch all grouped pages with the same complete filter set including department/status/follow-up status, and create the separate dynamic Excel sheet without weakening size/error handling."
verification:
  - "V-01 [AC-01,AC-02,AC-04,AC-06] npm --prefix backend test -- --runTestsByPath src/academic-record/academic-record.service.spec.ts --runInBand -> grouped-by-student criterion/count/filter/backward-compatibility cases pass."
  - "V-02 [AC-03,AC-04,AC-06] npm --prefix frontend test -- src/components/reports/report-helpers.test.ts src/components/reports/tabs/AcademicRecordReportTab.test.tsx src/app/(dashboard)/reports/page.test.tsx -> dynamic columns, view switching, stale-response handling, pagination and preserved summary/follow-up tests pass."
  - "V-03 [AC-01,AC-02,AC-03,AC-05,AC-06] npm --prefix backend run build and npm --prefix frontend run typecheck -> both exit 0; git diff --check -- backend/src/academic-record frontend/src/api/academic-record-api.ts frontend/src/components/reports frontend/src/app/(dashboard)/reports -> no whitespace errors."
  - "V-04 [AC-02,AC-03,AC-04,AC-05,AC-06] On verified dev targets, use a filtered dataset containing at least two criteria and two students: compare UI counts with record detail, change page and each relevant filter, confirm zero-only columns disappear, inspect horizontal layout at desktop and 390px, and export/open the workbook to verify both sheets and dynamic headers."
runtime_test:
  targets: "Before interaction, verify the effective frontend/API, database and export destination are development and isolated from production using non-secret metadata."
  resources: "Read existing dev academic records and create no persistent records unless a missing scenario requires a tagged disposable record through the application API."
  scenarios: "Multiple students/criteria, quantity greater than one, zero omission, duplicate names, page/filter changes, desktop/mobile table and Excel export."
  pass_signal: "UI and exported counts match the filtered active record details, dynamic columns are stable and no legacy summary/follow-up behavior regresses."
  cleanup: "Remove only positively identified task-created disposable records/files; otherwise no data cleanup is needed."
review:
  required: false
  trigger: null
  availability: null
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-02.md: user-requested reusable taskscope slot"
risks:
  - "Dynamic columns can become wide when many criteria occur; horizontal scrolling and deterministic ordering are required, and the existing export row limits remain the bounded-data safeguard."
  - "Computing active criteria from only paginated rows would make columns unstable; backend metadata must be derived before skip/limit from the same filtered scope."
stop_conditions:
  - "Implementation starts only when the user pins this exact ready taskscope for execution; this request authorizes taskscope creation only."
  - "Stop and amend the scope if the requested Số lần must sum quantity instead of counting record documents, or if the criterion view must group by mutable record_title rather than configured criterion_id."
  - "Stop runtime-dependent checks if dev isolation cannot be established; do not substitute mock-only evidence for V-04."
---
