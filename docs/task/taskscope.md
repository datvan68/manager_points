slot_id: "taskscope-00"
generation: 26
task_id: "20260904-100510-bulk-delete-dormitory-roster"
scope_file: "docs/task/taskscope.md"
status: blocked
scope_revision: 1
created_at: "2026-09-04T10:05:10+07:00"
updated_at: "2026-09-04T10:12:24+07:00"
base_commit: "18a48e6745ec57c38068819753809b0cd7334aed"
task: "Add server-side bulk deletion for the dormitory roster"
pipeline: feature_development
profile: Full
objective: "Authorized KTX managers can delete up to 100 selected roster entries through one request, with an explicit partial-success result and protection for entries referenced by contracts."

coordination:
  depends_on: []
  warnings: ["TASKSCOPE_CONFLICT: dirty candidate write path backend/src/dormitory/services/dormitory-roster.service.ts overlaps existing work that includes importRows/validateImportCapacity changes; preserve and reconcile before resume."]

completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/dormitory/roster/page.tsx:removeSelected issues one DELETE /dormitory/roster/:id per selected row with Promise.allSettled; backend/src/dormitory/services/dormitory-roster.service.ts:remove blocks only a single entry when a contract references it."
  expected_behavior: "One guarded bulk endpoint returns deleted, blocked, not_found, and invalid IDs; the roster table reflects partial success and retains only blocked IDs selected."
  root_cause: "No roster bulk-delete controller, DTO, service method, or frontend API method exists; the table fans out individual delete requests."

scope:
  inspect: ["backend/src/dormitory/services/invoices.service.ts:bulkDelete response convention", "backend/src/dormitory/controllers/dormitory-roster.controller.ts:route guards", "frontend/src/api/dormitory-api.test.ts:HTTP API test convention", "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx:roster selection coverage"]
  write: ["backend/src/dormitory/dto/bulk-delete-roster.dto.ts:BulkDeleteRosterDto", "backend/src/dormitory/controllers/dormitory-roster.controller.ts:bulkDelete route", "backend/src/dormitory/services/dormitory-roster.service.ts:bulkRemove", "backend/src/dormitory/services/dormitory-roster.service.spec.ts:bulk remove tests", "frontend/src/api/dormitory-api.ts:roster.bulkDelete contract", "frontend/src/api/dormitory-api.test.ts:bulk-delete request test", "frontend/src/app/(dashboard)/dormitory/roster/page.tsx:removeSelected", "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx:bulk-delete UI tests"]
  preserve: ["Single DELETE /dormitory/roster/:id and its DORM_REG_DELETE guard", "Contract-reference deletion protection", "Partial-success semantics, toasts, reload, PDF selection, and existing pagination/search reset behavior", "No schema, migration, or dependency change"]
  out: ["Atomic all-or-nothing deletion", "Cross-page/select-all-results behavior", "Contract lifecycle changes", "Production deployment or deletion of live data"]

acceptance_criteria:
  - "AC-01: POST /dormitory/roster/bulk-delete requires DORM_REG_DELETE, accepts 1–100 string IDs, and returns a structured result without invoking per-item HTTP requests."
  - "AC-02: The service deletes only existing unreferenced entries, reports invalid/missing/contract-blocked IDs, and emits one roster invalidation when at least one entry is deleted."
  - "AC-03: The roster table sends one bulk request, prevents duplicate confirmation while pending, refreshes after deletion, and retains only contract-blocked IDs selected with an accurate outcome message."
  - "AC-04: Focused backend and frontend tests cover full success, partial success, contract blocking, request shape, and UI selection/result handling."

execution:
  - "E-01 [AC-01] backend/src/dormitory/dto/bulk-delete-roster.dto.ts + controllers/dormitory-roster.controller.ts → add bounded ID input and guarded POST bulk-delete route."
  - "E-02 [AC-02] backend/src/dormitory/services/dormitory-roster.service.ts:bulkRemove → normalize IDs, resolve roster/contract references in batches, delete eligible rows, and return categorized IDs with one invalidation."
  - "E-03 [AC-01, AC-04] backend/src/dormitory/services/dormitory-roster.service.spec.ts → cover categorized outcomes, contract protection, and invalidation."
  - "E-04 [AC-01, AC-04] frontend/src/api/dormitory-api.ts + dormitory-api.test.ts → expose and verify typed POST bulk-delete request/response."
  - "E-05 [AC-03, AC-04] frontend/src/app/(dashboard)/dormitory/roster/page.tsx + page.test.tsx → consume result, update selection/modal/loading/toasts, and test full/partial UI outcomes."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01, AC-02] npm --prefix backend test -- dormitory/services/dormitory-roster.service.spec.ts --runInBand → targeted Jest suite passes."
  - "V-02 [AC-01, AC-03, AC-04] npm --prefix frontend test -- src/api/dormitory-api.test.ts src/app/(dashboard)/dormitory/roster/page.test.tsx → targeted Vitest files pass."
  - "V-03 [AC-01, AC-02] npm --prefix backend run build → Nest TypeScript build succeeds."
  - "V-04 [AC-03] npm --prefix frontend run typecheck → frontend TypeScript check succeeds."

risks: ["Bulk deletion is a persistent-data operation: deployment or execution against non-development data requires a Human Gate.", "The partial-success response is an additive public API contract and must remain stable once introduced."]
stop_conditions: ["A requirement for atomic all-or-nothing deletion, audit retention, or deleting contract-referenced entries requires a scope amendment.", "An active taskscope or dirty worktree overlaps any listed write path.", "A non-development deployment or live-data deletion requires Human Gate approval."]
