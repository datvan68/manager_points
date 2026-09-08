---
slot_id: "taskscope-03"
generation: 1
task_id: "20260908-161612-track-student-record-follow-up"
scope_file: "docs/task/taskscope-03.md"
status: ready
scope_revision: 1
created_at: "2026-09-08T16:16:12+07:00"
updated_at: "2026-09-08T16:16:12+07:00"
base_commit: "0196739d26562f88b284197ea904f0988b74e444"
task: "Track follow-up status for students with academic records"
pipeline: feature_development
profile: Full
risk: high
environment: development
objective: "In Reports > Ghi nhận SV, let authorized staff mark a student's current-semester records as handled and reliably distinguish students with no later records from students with records created after that handling point."
coordination:
  depends_on: []
  warnings:
    - "docs/task/taskscope.md is an unmigrated zero-byte legacy file; slot 00 remains reserved and untouched."
    - "This adds persistent follow-up state and an additive API contract; independent persistence/API compatibility review is required before completion."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx renders only student identity, counts and points. backend/src/academic-record/academic-record.service.ts:findAll groups active records by student and returns latestRecord/recordCount, but neither layer stores or compares a staff handling checkpoint; latest_record_at is mapped but not displayed as workflow state."
  expected_behavior: "Each student-semester row has an explicit unhandled, handled-without-new-records, or handled-with-new-records state, backed by an auditable server-created checkpoint and filterable from the report."
  root_cause: null
scope:
  inspect:
    - "backend/src/academic-record/schemas/academic-record.schema.ts"
    - "backend/src/auth/permissions.registry.ts"
    - "backend/src/users/schemas/user.schema.ts"
    - "backend/src/semesters/schemas/semester.schema.ts"
    - "frontend/src/components/reports/ReportTable.tsx"
  write:
    - "backend/src/academic-record/schemas/academic-record-follow-up.schema.ts (new)"
    - "backend/src/academic-record/dto/mark-academic-record-follow-up.dto.ts (new)"
    - "backend/src/academic-record/academic-record-follow-up.service.ts (new)"
    - "backend/src/academic-record/academic-record-follow-up.service.spec.ts (new)"
    - "backend/src/academic-record/academic-record.module.ts"
    - "backend/src/academic-record/academic-record.controller.ts"
    - "backend/src/academic-record/academic-record.controller.spec.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "frontend/src/api/academic-record-api.ts"
    - "frontend/src/components/reports/report-types.ts"
    - "frontend/src/components/reports/report-helpers.ts"
    - "frontend/src/components/reports/report-helpers.test.ts"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.tsx"
    - "frontend/src/components/reports/tabs/AcademicRecordReportTab.test.tsx"
    - "frontend/src/app/(dashboard)/reports/page.tsx"
  preserve:
    - "Existing academic-record creation, scoring, deletion, grouping, role-based student/class visibility and report filters remain unchanged."
    - "A handling checkpoint is scoped to exactly one student and one semester; it never edits, deletes or changes the status/score of an academic record."
    - "The server derives the checkpoint from the latest active non-deleted record at request time; clients cannot submit their own cursor, count, handler identity or handled timestamp."
    - "Record creation order uses createdAt plus _id as the deterministic cursor, so a newly entered backdated record is still classified as new; recorded_at remains the event date only."
    - "Only users already authorized to read the scoped records may see follow-up metadata, and marking handled requires UPDATE_STUDENT_RECORD without weakening existing guards."
    - "Existing GET /academic-records consumers remain compatible because follow-up fields and query filtering are additive and apply to grouped-by-student responses only."
  out:
    - "Sending notifications, creating student tasks, changing disciplinary thresholds, acknowledging individual categories, cross-semester/global acknowledgement, historical backfill, database migration scripts, production data/deployment, commit or push."
acceptance_criteria:
  - "AC-01: For a student-semester with no checkpoint, the grouped report returns followUpStatus=unhandled; marking handled stores handler/time plus the server-selected latest createdAt/_id cursor and then returns settled while no later active record exists; an authorized reset removes only that exact student-semester checkpoint and returns it to unhandled."
  - "AC-02: Creating an active record after the checkpoint, including one whose recorded_at is backdated, changes that student to new with an exact positive newRecordCount; marking handled again advances the checkpoint and returns settled."
  - "AC-03: GET /academic-records?groupBy=student accepts followUpStatus=unhandled|settled|new, filters before pagination/counting, preserves recordCount sorting and RBAC scope, and rejects unsupported values without changing ungrouped responses."
  - "AC-04: Reports > Ghi nhận SV visibly and accessibly shows all three Vietnamese statuses, latest handling time/handler where available, and the new-record count; staff can filter each status and confirm 'Đã xử lý' with a disabled/loading/error-safe action."
  - "AC-05: After a successful mark, the current page refreshes from the server and shows settled; a failed or stale request does not optimistically claim success or overwrite newer filter/page results."
  - "AC-06: Existing category-detail dialogs, report filters, pagination, export, counts, empty/loading states and academic-record mutations retain their current behavior."
execution:
  - "E-01 [AC-01,AC-02] Add AcademicRecordFollowUp schema with required student_id, semester_id, handled_through_record_id, handled_through_created_at, handled_record_count, handled_at and handled_by fields, optional note, timestamps, and a unique student_id+semester_id index; register it with AcademicRecordModule."
  - "E-02 [AC-01,AC-02] Add validated MarkAcademicRecordFollowUpDto and AcademicRecordFollowUpService.markHandled -> verify student/semester scope through existing academic-record access rules, select the latest active non-deleted record ordered by createdAt/_id, and atomically upsert the server-owned checkpoint; return a clear not-found/domain error when no eligible record exists."
  - "E-03 [AC-01,AC-02,AC-03] Extend AcademicRecordController with guarded PUT and DELETE /academic-records/follow-up/:studentId endpoints (semesterId required), where DELETE removes only the exact checkpoint, and extend findAll grouped aggregation with follow-up lookup, deterministic status/newRecordCount calculation and pre-facet followUpStatus filtering."
  - "E-04 [AC-01,AC-02,AC-03] Add backend service/controller tests for first mark, repeat mark, concurrent/new backdated record, invalid/no-record input, unique upsert behavior, all filter states, pagination totals, sorting and teacher/student access boundaries."
  - "E-05 [AC-03,AC-04,AC-05] Extend frontend API/group/report row types and mapper with follow-up status, new count, handler/time and the markHandled call; thread followUpStatus from reports/page.tsx into the server query and reset page on status changes."
  - "E-06 [AC-04,AC-05,AC-06] Update AcademicRecordReportTab with compact status chips/filter, handling metadata and a confirmed mark action available only when semesterId exists; use request identity/loading/error handling and trigger a parent server refresh only after success."
  - "E-07 [AC-04,AC-05,AC-06] Extend report helper and tab tests for the three states, filtering callbacks/page reset, disabled no-semester action, confirm/success refresh, failure retention, stale response protection and unchanged category-detail/empty/loading behavior."
  - "E-08 [AC-01,AC-02,AC-03] Obtain independent review of the new persistent schema/index, cursor ordering, authorization and additive grouped API contract; resolve required findings within this scope before completion."
verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix backend test -- --runTestsByPath \"src/academic-record/academic-record-follow-up.service.spec.ts\" \"src/academic-record/academic-record.controller.spec.ts\" \"src/academic-record/academic-record.service.spec.ts\" --runInBand -> focused backend cases pass, including backdated-new detection and filtering before pagination."
  - "V-02 [AC-04,AC-05,AC-06] npm --prefix frontend test -- \"src/components/reports/report-helpers.test.ts\" \"src/components/reports/tabs/AcademicRecordReportTab.test.tsx\" -> all status/action/detail regression cases pass."
  - "V-03 [AC-01,AC-02,AC-03,AC-04,AC-05,AC-06] npm --prefix backend run build; npm --prefix frontend run typecheck -> both affected packages compile successfully."
  - "V-04 [AC-01,AC-02,AC-04,AC-05] Verified dev UI/API after proving non-production isolation: on one authorized disposable dev student-semester, observe unhandled, mark handled and observe settled, create one tagged backdated academic record and observe new with count 1, mark again and observe settled; verify all three report filters and action failure feedback."
  - "V-05 [AC-01,AC-02,AC-03,AC-04,AC-05,AC-06] Independent review passes; git diff --check on every scoped write path plus scoped diff/status inspection shows no migration, permission regression, secret, test data or unrelated write."
runtime_test:
  targets: "Before runtime mutation, establish from non-secret metadata that the effective frontend, API, MongoDB, Redis/queue and outbound integrations are development resources isolated from production."
  resources: "One authorized disposable/tagged dev student-semester, its task-created follow-up checkpoint and one task-created tagged academic record; reserve their IDs in runtime."
  operations: "Use existing UI/API validation and RBAC to read grouped rows, mark handled, create one backdated test record, filter states and mark again; no raw database writes, bulk operations or external messages."
  scenarios:
    - "No checkpoint -> unhandled; mark -> settled with current operator/time."
    - "Create a record after the checkpoint with an older recorded_at -> new with newRecordCount=1; mark again -> settled."
    - "Exercise unhandled, settled and new filters plus one safely induced/rejected request to confirm error feedback."
  cleanup: "Delete only the positively identified task-created academic record through the application API, then remove the task-created checkpoint through the guarded follow-up DELETE endpoint or restore the captured pre-state after checking for intervening changes; report exact cleanup outcome."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-03.md: user-requested reusable taskscope slot"
risks:
  - "An incorrect or client-controlled cursor can suppress genuinely new records or repeatedly flag old ones."
  - "The unique checkpoint and upsert must prevent duplicate state under concurrent staff actions without losing the latest valid cursor."
  - "Follow-up metadata identifies staff activity and must remain inside existing academic-record visibility boundaries."
  - "Filtering after pagination would produce incorrect totals/pages and omit actionable students."
stop_conditions:
  - "Execution requires this exact taskscope file to be pinned and must pass identity, reservation, Git freshness and production-release checks."
  - "Stop on any overlapping active reservation or unknown change in a scoped write path; do not overwrite unrelated work."
  - "Stop if the current authorization utilities cannot prove student/class scope for the mark endpoint without permission-policy changes outside this scope."
  - "Stop runtime mutations until every effective destination is verified as isolated development and outbound delivery is disabled/captured."
  - "Do not complete without the required independent persistence/API compatibility review and successful cleanup/restoration of dev test state."
---
