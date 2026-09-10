slot_id: "taskscope-01"
generation: 1
task_id: "20260910-discipline-new-label-valid-checkpoint"
scope_file: "docs/task/taskscope-01.md"
status: ready
scope_revision: 1
created_at: "2026-09-10T15:45:17.5720247+07:00"
updated_at: "2026-09-10T15:45:17.5720247+07:00"
base_commit: "75496f32faa2db6f9884973fd9c5e41c78ff95e4"
task: "Show the new-discipline label only after a valid handled checkpoint"
pipeline: bug_fix
profile: Quick
objective: "Ensure the Kỷ luật cần xử lý UI shows Ghi nhận mới only for a student whose discipline records were previously handled through a valid checkpoint and who then received additional discipline occurrences."
coordination:
  depends_on:
    - "docs/task/taskscope-02.md generation 2 must release backend/src/system/system.service.ts and backend/src/system/system.service.spec.ts by reaching completed or cancelled status."
  warnings:
    - "The reported UI screenshot demonstrates the incorrect label, but the exact affected development records have not been inspected; runtime verification must distinguish invalid/stale checkpoints from stale deployed code or cached API responses."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/components/dashboard/StudentSpotlightPanel.tsx renders Ghi nhận mới whenever GET /api/system/student-highlights returns followUpStatus=new. The dashboard aggregation accepts a follow-up document directly, while backend/src/academic-record/academic-record.service.ts validates the referenced handled record and its ky_luat criterion before treating the same student as handled. This can make the report show Chưa xử lý while the dashboard shows Ghi nhận mới."
  expected_behavior: "Unhandled students never receive the Ghi nhận mới label. The label appears only when a valid discipline follow-up checkpoint exists and at least one active, non-deleted discipline occurrence in the same active semester was created after that checkpoint."
  root_cause: "The dashboard and grouped academic-record report use different validity checks for follow-up checkpoints, allowing the dashboard to classify a stale, broken, or non-discipline checkpoint as handled and then mark later records as new."
scope:
  inspect:
    - "backend/src/academic-record/schemas/academic-record-follow-up.schema.ts"
    - "backend/src/academic-record/academic-record-follow-up.service.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "frontend/src/api/system-api.ts"
    - "frontend/src/components/dashboard/dashboard-helpers.ts"
  write:
    - "backend/src/system/system.service.ts"
    - "backend/src/system/system.service.spec.ts"
    - "frontend/src/components/dashboard/StudentSpotlightPanel.test.tsx"
  preserve:
    - "GET /api/system/student-highlights keeps its existing query and paginated response shape."
    - "The follow-up schema, mark/reset APIs, authorization, teacher class scope, and active-semester restriction remain unchanged."
    - "A new discipline occurrence is determined by the existing createdAt/ObjectId checkpoint ordering."
    - "Eligible valid followUpStatus=new students remain ahead of eligible unhandled students."
  out:
    - "Changes to UI layout, label copy, colors, navigation, pagination, or non-discipline highlight categories"
    - "Schema, index, migration, backfill, or automatic deletion of stale follow-up documents"
    - "Changes to the grouped academic-record report unless evidence shows its established checkpoint semantics are incorrect"
    - "Production data changes, commit, push, or deployment"
acceptance_criteria:
  - "AC-01: A student with no valid discipline follow-up checkpoint is returned as followUpStatus=unhandled with newRecordCount=0 and never displays the Ghi nhận mới label, even when three or more eligible discipline occurrences exist."
  - "AC-02: A follow-up document whose handled record is missing or is not a ky_luat record for the same student and semester is not a valid handled checkpoint and cannot produce followUpStatus=new."
  - "AC-03: A student with a valid discipline checkpoint and one or more later active, non-deleted discipline occurrences in the same active semester is returned as followUpStatus=new with a positive newRecordCount and displays Ghi nhận mới."
  - "AC-04: A student with a valid checkpoint but no later eligible discipline occurrence is settled and remains absent from Kỷ luật cần xử lý."
  - "AC-05: Dashboard and grouped academic-record reporting classify the same valid, invalid, and absent checkpoints consistently, while endpoint compatibility, authorization, active-semester filtering, >=3 eligibility, and new-first ordering are preserved."
execution:
  - "E-01 [AC-01,AC-02,AC-05] backend/src/system/system.service.ts:getStudentHighlights -> validate the joined follow-up by resolving its handled_through_record_id and confirming that record belongs to the grouped student and active semester and resolves to a ky_luat criterion before exposing checkpoint fields."
  - "E-02 [AC-01,AC-03,AC-04] backend/src/system/system.service.ts:getStudentHighlights -> derive unhandled/new/settled only from the validated checkpoint; force newRecordCount/newImpactScore to zero when no valid checkpoint exists and retain the existing post-checkpoint ordering for valid checkpoints."
  - "E-03 [AC-01,AC-02,AC-03,AC-04,AC-05] backend/src/system/system.service.spec.ts -> add executable aggregation tests for no checkpoint, missing handled record, non-discipline handled record, valid checkpoint without later records, and valid checkpoint with later discipline records."
  - "E-04 [AC-01,AC-03] frontend/src/components/dashboard/StudentSpotlightPanel.test.tsx -> replace source-string-only coverage with rendered cases proving unhandled omits Ghi nhận mới and new with a positive delta displays it."
verification:
  - "V-01 [AC-01,AC-02,AC-03,AC-04,AC-05] npm --prefix backend test -- --runTestsByPath src/system/system.service.spec.ts --runInBand -> focused service tests pass with the checkpoint-validity matrix exercised."
  - "V-02 [AC-01,AC-03] npm --prefix frontend test -- \"src/components/dashboard/StudentSpotlightPanel.test.tsx\" -> rendered label conditions pass."
  - "V-03 [AC-01,AC-03,AC-04,AC-05] On isolated development data, compare the grouped academic-record response and GET /api/system/student-highlights?category=discipline for the same students -> unhandled has no label, valid handled-plus-later has the label, settled is absent, and both endpoints agree."
  - "V-04 [AC-05] npm --prefix frontend run typecheck and npm --prefix backend run build -> frontend typing and Nest compilation succeed."
runtime_test:
  identity: "Verify the effective frontend/API and MongoDB targets are development and isolated from production using non-secret runtime metadata before any data-changing verification."
  resources: "Prefer task-tagged disposable students, discipline records, and follow-up checkpoints in the existing active development semester; inspect reported records read-only if they can be identified safely."
  operations: "Create only the minimum fixtures needed for absent, invalid, settled, and new checkpoint states through application services or APIs; do not fabricate production-like follow-up documents outside isolated development data."
  scenarios: "Compare dashboard and grouped-report classifications for no checkpoint, invalid checkpoint, valid checkpoint without later records, and valid checkpoint followed by a later discipline occurrence."
  cleanup: "Remove only positively identified task-created academic records and follow-up state, then confirm the task tags no longer exist."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "Existing stale follow-up documents may remain stored; this task ignores them for classification rather than migrating or deleting data."
  - "If the screenshot is produced by stale deployed code or cached responses instead of checkpoint inconsistency, runtime comparison must establish that before changing aggregation semantics."
stop_conditions:
  - "Do not execute until docs/task/taskscope-02.md generation 2 is completed or cancelled and releases the overlapping backend write paths."
  - "TASKSCOPE_CONFLICT if another active scope or unknown changes reserve or modify a write path at execution time."
  - "Stop for a scope amendment if product owners intend any existing follow-up document to count as handled even when its referenced discipline record is missing or invalid."
  - "Stop dependent runtime verification if development isolation cannot be proven or safe disposable fixtures cannot be established."
