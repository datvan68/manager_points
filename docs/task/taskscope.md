task: "Bulk academic-record deletion with progress and semester score cards"
pipeline: feature_development
profile: Full
objective: "Authorized users can delete many academic records without HTTP 429 failures, see accurate deletion progress, and view archived training scores by semester on the student-information page."

evidence:
  current_behavior: "frontend/src/app/(dashboard)/students/record/page.tsx:handleDelete/history/handleForceDeleteAllRecords issue one DELETE request per record (including Promise.all); backend/src/core/rate-limit/rate-limit.constants.ts caps burst traffic at 30 requests/10 seconds. backend/src/evaluation-periods/evaluation-periods.service.ts:archiveLockedSnapshots already stores locked scores in student.training_point_history, but frontend/src/app/(dashboard)/students/[classId]/[id]/page.tsx shows only one resolved score."
  expected_behavior: "Bulk deletion uses bounded batch requests with a blocking percentage modal; archived scores render as semester-labelled cards independent of source-record deletion."
  root_cause: "Per-record HTTP deletion exhausts the global throttler; archived snapshot data has no history-card rendering."

scope:
  inspect: ["backend/src/academic-record/academic-record.service.ts:remove/forceRemove", "backend/src/evaluation-periods/evaluation-periods.service.ts:archiveLockedSnapshots", "backend/src/students/schemas/student.schema.ts:TrainingPointSnapshot"]
  write: ["backend/src/academic-record/dto/bulk-delete-academic-record.dto.ts", "backend/src/academic-record/academic-record.controller.ts:bulkRemove/bulkForceRemove", "backend/src/academic-record/academic-record.service.ts:bulkRemove/bulkForceRemove", "backend/src/academic-record/academic-record.controller.spec.ts", "backend/src/academic-record/academic-record.service.spec.ts", "frontend/src/api/academic-record-api.ts", "frontend/src/api/academic-record-api.test.ts", "frontend/src/app/(dashboard)/students/record/page.tsx", "frontend/src/app/(dashboard)/students/record/page.test.tsx", "frontend/src/app/(dashboard)/students/[classId]/[id]/page.tsx", "frontend/src/app/(dashboard)/students/[classId]/[id]/page.test.tsx"]
  preserve: ["DELETE_STUDENT_RECORD RBAC and student self-service rules", "daily-report protection/bypass contract", "soft-delete versus eligible permanent-delete semantics", "locked SummaryPoint and training_point_history values", "single-record endpoints"]
  out: ["changing global rate limits", "schema/migration changes", "deleting locked summaries or archived snapshots", "redesigning unrelated profile sections"]

acceptance_criteria:
  - "AC-01: A validated bulk endpoint accepts a bounded, deduplicated ID list and returns requested/succeeded/failed item results while applying existing deletion authorization and record guards."
  - "AC-02: Every multi-delete action in Tình hình HSSV uses sequential bounded bulk batches, not per-record concurrent requests; 500 selected records do not exceed the 30-request burst limit."
  - "AC-03: A non-dismissible progress modal displays processed/total and 0-100% during soft or permanent bulk deletion, prevents duplicate submission, then reports partial failures and refreshes affected lists."
  - "AC-04: The student-information page renders one archived training-score card per training_point_history item with semester name, score, rank/classification, and locked date; empty history has a clear empty state."
  - "AC-05: Deleting source records does not modify locked SummaryPoint or archived semester snapshots."

execution:
  - "E-01 [AC-01,AC-05] academic-record DTO/controller/service -> add permission-protected soft/permanent bulk operations that reuse remove/forceRemove invariants and return per-ID outcomes."
  - "E-02 [AC-01] backend academic-record specs -> cover DTO bounds, guards, deduplication, partial failure, and unchanged locked-score behavior."
  - "E-03 [AC-02,AC-03] academic-record-api.ts and students/record/page.tsx -> submit fixed-size bulk batches sequentially and drive a blocking progress/result modal for selection, history, and trash bulk-delete flows."
  - "E-04 [AC-02,AC-03] frontend API/page specs -> prove request count is bounded, percentage advances, duplicate submission is blocked, and partial failures remain selected/reported."
  - "E-05 [AC-04,AC-05] students/[classId]/[id]/page.tsx/page.test.tsx -> map snapshot semester IDs through the existing semester response; render and test responsive archived-score cards without recalculating scores from academic records."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested rolling taskscope"]

verification:
  - "V-01 [AC-01,AC-05] npm --prefix backend test -- academic-record/academic-record.service.spec.ts academic-record/academic-record.controller.spec.ts --runInBand -> focused suites pass."
  - "V-02 [AC-02,AC-03,AC-04] npm --prefix frontend test -- src/api/academic-record-api.test.ts 'src/app/(dashboard)/students/record/page.test.tsx' 'src/app/(dashboard)/students/[classId]/[id]/page.test.tsx' -> focused suites pass."
  - "V-03 [AC-01,AC-05] npm --prefix backend run build -> Nest build exits 0."
  - "V-04 [AC-02,AC-03,AC-04] npm --prefix frontend run typecheck -> TypeScript exits 0."

risks: ["Bulk deletion mutates persistent data and crosses API/UI boundaries; implementation requires independent review of RBAC, partial-failure behavior, and locked-score immutability."]
stop_conditions: ["Stop if the bulk contract requires weakening RBAC/daily-report guards, changing snapshot schemas, or introducing background infrastructure/WebSocket dependencies."]
