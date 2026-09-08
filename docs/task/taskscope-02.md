slot_id: "taskscope-02"
generation: 1
task_id: "20260908T081518+0700-student-record-summary-report"
scope_file: "docs/task/taskscope-02.md"
status: completed
scope_revision: 1
created_at: "2026-09-08T08:15:18+07:00"
updated_at: "2026-09-08T08:36:00+07:00"
base_commit: "8cc9098063c25485227a6cd5976848d62061ea4a"
task: "Aggregate student records in the Student records report"
pipeline: feature_development
profile: Quick
objective: "Make the Ghi nhận sv report show one row per student with the student's total record count, following the count presentation used by the Dashboard's Kỷ luật & Chú ý tab."
coordination:
  depends_on: []
  warnings:
    - "The prerequisite tab rename/removal task is already completed in taskscope-01 and included in the base commit."
    - "docs/task/taskscope.md remains an empty, unmigrated slot 00 and must not be overwritten."
completion:
  completed_at: "2026-09-08T08:36:00+07:00"
  outcome: "completed"
  final_commit_or_state: "worktree modified; HEAD remains 8cc9098063c25485227a6cd5976848d62061ea4a"
  changed_paths:
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/components/reports/report-types.ts"
    - "frontend/src/components/reports/report-helpers.ts"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx"
    - "frontend/src/components/reports/report-helpers.test.ts"
    - "docs/task/taskscope-02.md"
  checks_passed:
    - "V-01: focused Vitest files passed, 3 tests passed, no skipped tests"
    - "V-02: npm --prefix frontend run typecheck exited 0"
    - "V-03: dev UI showed grouped rows, 193-student total, and a known 3-record student once with 3 lần"
    - "V-04: dev export produced 193 workbook rows and 193 unique student codes with populated summary columns"
    - "V-05: ReportTabs regression passed, 2 tests passed"
    - "V-06: git diff --check passed with no whitespace errors"
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/app/(dashboard)/reports/page.tsx loads paginated raw academic records for the record tab, and AcademicRecordReportTab renders one row per individual record."
  expected_behavior: "Ghi nhận sv renders one aggregated row per student and shows Số lượt as a count of that student's records, with the same student-level counting concept as Dashboard > Kỷ luật & Chú ý."
  root_cause: "The report calls academicRecordApi.getAcademicRecords without groupBy=student and uses AcademicRecordReportRow, even though the existing grouped API already returns recordCount, recordTypeCounts, totalPoints, and latestRecord."
scope:
  inspect:
    - "frontend/src/components/dashboard/StudentSpotlightPanel.tsx"
    - "frontend/src/app/(dashboard)/students/record/page.tsx"
    - "frontend/src/api/academic-record-api.ts"
    - "backend/src/academic-record/academic-record.service.ts"
  write:
    - "frontend/src/app/(dashboard)/reports/page.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/components/reports/report-types.ts"
    - "frontend/src/components/reports/report-helpers.ts"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx"
    - "frontend/src/components/reports/report-helpers.test.ts"
  preserve:
    - "Keep the visible tab id as record and its label as Ghi nhận sv."
    - "Reuse academicRecordApi.getAcademicRecords with groupBy=student; preserve its existing RBAC restriction for admin, teacher/advisor, and student roles."
    - "Count only active, non-deleted records as defined by the existing backend aggregation; do not aggregate the currently loaded page on the client."
    - "Preserve server-side pagination and the supported semester, class, search, start-date, and end-date filters."
    - "Keep Dashboard > Kỷ luật & Chú ý, other report tabs, persisted data, and backend API contracts unchanged."
  out:
    - "Changing the academic-record schema, scoring rules, or record creation/deletion flows."
    - "Changing the Dashboard Kỷ luật & Chú ý component or its discipline eligibility threshold."
    - "Adding a student detail drill-down or redesigning the shared ReportTable component."
acceptance_criteria:
  - "AC-01: Ghi nhận sv displays exactly one row per student returned by the grouped academic-record API, rather than one row per individual record."
  - "AC-02: Each row displays the student's code, full name, class, Số lượt as '<recordCount> lần', counts for Khen thưởng/Cộng điểm/Kỷ luật, total point impact, and latest-record information/date."
  - "AC-03: The displayed total and pagination use the grouped response meta.total, so the total represents students and changing page or page size never duplicates a student."
  - "AC-04: Semester, class, text search, start date, and end date are sent to the grouped API; results remain limited by the requester's existing RBAC scope."
  - "AC-05: Exporting Ghi nhận sv fetches all grouped pages within the existing export cap and creates one Excel row per student using the same columns and active filters as the screen."
  - "AC-06: Loading, empty, API-error, and export-limit behavior remain consistent with the other report tabs, while Dashboard > Kỷ luật & Chú ý and all other report tabs are unchanged."
execution:
  - "E-01 [AC-01, AC-02] frontend/src/components/reports/report-types.ts and report-helpers.ts -> add a student-record summary row type and a pure mapper from AcademicRecordStudentGroup to display/export rows; derive identity and class from latestRecord.student_id, and keep recordCount as the authoritative total."
  - "E-02 [AC-01, AC-03, AC-04] frontend/src/app/(dashboard)/reports/page.tsx:record loading -> request academic records with groupBy=student plus the supported report filters, store grouped rows separately from raw overview data, and bind grouped meta.total/page/limit to the tab."
  - "E-03 [AC-02, AC-03, AC-06] frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx -> replace raw-record columns with the student summary columns and label the table/pagination in student terms; keep the shared responsive table, loading, empty state, and export trigger."
  - "E-04 [AC-05] frontend/src/app/(dashboard)/reports/page.tsx:record export -> page through groupBy=student results with the current export limit, map the complete grouped result, and export the same one-row-per-student representation shown on screen."
  - "E-05 [AC-01, AC-02, AC-03] frontend/src/components/reports/report-helpers.test.ts -> prove multiple records belonging to one grouped student produce one row and preserve recordCount, per-type counts, totalPoints, and latest-record fields."
  - "E-06 [AC-02, AC-06] frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx -> verify the summary title/labels, student-count pagination wording, rendered count values, and empty/loading behavior."
verification:
  - "V-01 [AC-01, AC-02, AC-03, AC-06] npm --prefix frontend test -- src/components/reports/report-helpers.test.ts src/components/reports/tabs/AcademicRecordReportTab.test.tsx -> all focused Vitest tests pass with no skipped tests."
  - "V-02 [AC-01, AC-03, AC-04, AC-05] npm --prefix frontend run typecheck -> TypeScript completes with exit code 0."
  - "V-03 [AC-01, AC-02, AC-03, AC-04] In the development UI, open Thống kê báo cáo > Ghi nhận sv, verify one known student with multiple records appears once, and compare Số lượt/type counts against the grouped academic-record response before and after applying semester/class/search/date filters."
  - "V-04 [AC-05] Export Ghi nhận sv in the development UI and verify the workbook contains one row per filtered student and matches the displayed summary columns/counts."
  - "V-05 [AC-06] npm --prefix frontend test -- src/components/reports/ReportTabs.test.tsx -> the five-tab navigation regression test remains green."
  - "V-06 [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06] git diff --check -- 'frontend/src/app/(dashboard)/reports/page.tsx' frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx frontend/src/components/reports/report-types.ts frontend/src/components/reports/report-helpers.ts frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx frontend/src/components/reports/report-helpers.test.ts -> no whitespace errors."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-02.md: user-requested reusable taskscope slot"
risks:
  - "AcademicRecordStudentGroup carries student/class display data through latestRecord; the mapper must tolerate missing populated references without breaking the table."
  - "The grouped response counts students, while the old report counted individual records; table totals, labels, KPI consumers, and export metadata must not accidentally mix these units."
  - "Reusing raw academicRecords for the overview charts would change unrelated KPIs; grouped report state must remain separate."
stop_conditions:
  - "Stop and request clarification if Ghi nhận sv is intended to include only discipline records or only students with at least three discipline records, because the current wording and tab name indicate all record types per student."
  - "Stop with TASKSCOPE_CONFLICT if another active task reserves any write path or an unowned change appears on a scoped path."
