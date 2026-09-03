slot_id: "taskscope-00"
generation: 17
task_id: "20260903-083015-bulk-delete-preview-filtered-drawer"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 2
created_at: "2026-09-03T08:30:15+07:00"
updated_at: "2026-09-03T08:51:37+07:00"
base_commit: "c4f96fd838587c2c59bab54a1050a9f8be8809e1"
task: "Batch student delete preview and align filtered drawer"
pipeline: bug_fix
profile: Full
objective: "The student drawer matches active table filters and bulk-delete preview remains reliable for hundreds of selected students with a compact confirmation modal."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-03T08:51:37+07:00"
  outcome: "Implemented filtered drawer parity, single batch delete preview, compact zero-safe confirmation, and preserved partial-delete behavior. Self-review found no RBAC, filter, API, or data-safety blockers."
  final_commit_or_state: "working tree (uncommitted)"
  changed_paths:
    - "backend/src/academic-record/dto/delete-preview-academic-record.dto.ts"
    - "backend/src/academic-record/academic-record.controller.ts"
    - "backend/src/academic-record/academic-record.controller.spec.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "frontend/src/api/academic-record-api.ts"
    - "frontend/src/components/modals/ConfirmModal.tsx"
    - "frontend/src/app/(dashboard)/students/record/page.tsx"
    - "frontend/src/app/(dashboard)/students/record/page.test.tsx"
  checks_passed:
    - "V-01 controller spec: PASS (27 tests)"
    - "V-02 service spec: PASS (80 tests, 2 todo)"
    - "V-03 frontend page spec: PASS (27 tests)"
    - "V-04 backend build: PASS"
    - "V-05 frontend typecheck: PASS"
    - "V-06 git diff --check: PASS"
  cleanup_pending: []

evidence:
  current_behavior: "page.tsx:handleOpenDrawerChange sends only studentId; prepareDeletePreview launches one getAcademicRecords request per selected group via Promise.all. Selecting 288 students can exceed the global 30-request/10-second limit and produce a 0-record preview with group-load warnings."
  expected_behavior: "Drawer history uses the table's class/date/creator scope; one guarded batch-preview request resolves all selected students and returns deletable IDs, preserved daily-report counts, and per-student failures."
  root_cause: "Unfiltered drawer parameters diverge from the grouped table, while the N-request preview fan-out competes with the global IP rate limiter."

scope:
  inspect: ["backend/src/core/rate-limit/rate-limit.constants.ts:global limits", "backend/src/academic-record/academic-record.service.ts:findAll/remove access and filter rules"]
  write: ["backend/src/academic-record/dto/delete-preview-academic-record.dto.ts:new validated request", "backend/src/academic-record/academic-record.controller.ts:POST delete-preview", "backend/src/academic-record/academic-record.controller.spec.ts:route/guard/forwarding", "backend/src/academic-record/academic-record.service.ts:single-query preview", "backend/src/academic-record/academic-record.service.spec.ts:filter/RBAC/grouping coverage", "frontend/src/api/academic-record-api.ts:preview contract", "frontend/src/components/modals/ConfirmModal.tsx:optional disabled prop", "frontend/src/app/(dashboard)/students/record/page.tsx:filtered drawer, one-request preview, compact modal", "frontend/src/app/(dashboard)/students/record/page.test.tsx:drawer/288-selection/modal regressions"]
  preserve: ["DELETE_STUDENT_RECORD and hierarchy enforcement", "active class/date/creator filters; search only locates students", "daily_report_id records are never deletion candidates", "25-ID delete batching, partial-failure selection, trash/restore/force-delete"]
  out: ["Changing global rate limits", "Deleting daily-report records", "Class-report flows", "Schema/migration/general UI redesign"]

acceptance_criteria:
  - "AC-01: If a filtered table row reports 4 records, opening its drawer requests the same class/date/creator scope and renders those 4 records; without filters it renders all active history."
  - "AC-02: Preparing deletion for up to 500 selected students makes exactly one preview HTTP request and does not emit per-student requests."
  - "AC-03: Preview validates IDs/filters, enforces requester visibility and deletion hierarchy, excludes daily_report_id records, and returns stable group results without mutating data."
  - "AC-04: The modal uses a short title and at most three conditional summary lines: selected students/deletable records, preserved daily records, and failed students. Remove implementation-detail and empty-group prose."
  - "AC-05: Confirm is disabled when no deletable IDs exist; failures remain selected, valid IDs retain existing sequential deletion behavior, and zero candidates never call delete."

execution:
  - "E-01 [AC-02,AC-03] DTO/controller/service → add POST /academic-records/delete-preview with DELETE_STUDENT_RECORD guard, max 500 Mongo IDs, optional class/start/end/creator filters, one bounded query, hierarchy classification, and grouped response."
  - "E-02 [AC-02,AC-03] backend specs → verify validation, guard, filter propagation, no mutation, daily-report exclusion, hierarchy failures, and grouped counts."
  - "E-03 [AC-01,AC-02,AC-05] academic-record-api.ts/page.tsx → use filtered parameters for drawer and replace Promise.all fan-out with the batch-preview API."
  - "E-04 [AC-04,AC-05] ConfirmModal/page.tsx → add optional disabled support, reduce confirmation copy, expose concise counts, disable zero-candidate confirmation, and retain actionable failure state."
  - "E-05 [AC-01..AC-05] page.test.tsx → assert filtered/unfiltered drawer, one preview call for 288 selections, compact copy, zero-ID blocking, and partial success."
  - "E-06 [AC-01..AC-05] independent review → verify RBAC, personal-data exposure, API compatibility, filter parity, and zero/partial states."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-02,AC-03] npm --prefix backend test -- src/academic-record/academic-record.controller.spec.ts --runInBand → passes."
  - "V-02 [AC-02,AC-03] npm --prefix backend test -- src/academic-record/academic-record.service.spec.ts --runInBand → passes."
  - "V-03 [AC-01,AC-02,AC-04,AC-05] npm --prefix frontend test -- 'src/app/(dashboard)/students/record/page.test.tsx' → passes."
  - "V-04 [AC-02,AC-03] npm --prefix backend run build → exits 0."
  - "V-05 [AC-01,AC-02,AC-04,AC-05] npm --prefix frontend run typecheck → exits 0."
  - "V-06 [AC-01..AC-05] git diff --check → exits 0."

risks: ["The new endpoint exposes candidate IDs and therefore must preserve existing requester visibility and hierarchy checks.", "Date boundaries must retain the existing UTC query semantics."]
stop_conditions: ["Stop for any change to permission semantics, public delete behavior, date interpretation, schema, or global throttling."]
