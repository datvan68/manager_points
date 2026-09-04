slot_id: "taskscope-00"
generation: 2
task_id: "20260904-155313-dormitory-identity-bulk-progress"
scope_file: "docs/task/taskscope.md"
status: in_progress
scope_revision: 1
created_at: "2026-09-04T15:53:13+07:00"
updated_at: "2026-09-04T16:35:00+07:00"
base_commit: "a3bf28be8fbd5d817215b68a08b21485952aac45"
task: "Unify KTX student linking and show import/bulk-delete progress"
pipeline: feature_development
profile: Full
objective: "Link unambiguous KTX roster identities consistently regardless of creation order, reconcile existing entries, and display truthful import and bulk-delete progress in KTX > List."

coordination:
  depends_on: []
  warnings: []
  reservation_check: "Clean worktree. Checked taskscope.md (completed, slot 00 generation 1), taskscope-01.md (blocked, dashboard-only writes, disjoint), taskscope-02.md (completed). Reuse lowest completed slot 00. Recheck metadata/write boundaries and Git before execution."
  execution_policy: "Planning deliverable only in this turn; implementation requires the user to pin this exact file. Full implementation requires independent review of identity, concurrency, permissions and partial mutation behavior."
  rules: "safety 3.3.0; global 3.3.6; orchestrator 3.3.7; pipeline 3.3.5; taskscope 3.3.7; implement_feature 3.0.0"

completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []

evidence:
  current_behavior:
    - "DormitoryRosterService.importRows/importStudentMatches: matches normalized name + DOB, links one Student, flags multiple matches, skips existing semester identities without repairing links. findAll only reads/populates stored student_id."
    - "DormitoryRosterIdentityService.reconcileStudent: used by StudentsService.create/update, but does not check ambiguity across all matching Students. StudentsService.createBulk/processStudentImportBatch do not reconcile KTX."
    - "DormitoryRosterImportModal.importRows: one request, busy flag, final counters only; server row numbers are request-relative while parsed rows retain original Excel rowNumber."
    - "Roster page removeSelected: one bulk request; bulkRemove accepts at most 100 unique IDs, calls RoomAssignmentService.deleteRosterEntry sequentially, but an uncaught per-item exception loses the partial response."
    - "Import limit is 5000 rows/request; optional room placement is sequential. Existing roster unique index is student_id + semester_id; no migration is needed."
    - "Baseline: 9 targeted identity/roster tests passed on 2026-09-04; not evidence that new acceptance criteria pass."
  expected_behavior: "One shared matcher; automatic post-write linking plus an explicit semester reconciliation action; import/delete progress advances only after acknowledged batch outcomes."
  root_cause: "Identity logic and triggers are split; frontend waits for whole-operation responses without incremental outcome accounting."

scope:
  inspect:
    - "backend/src/dormitory/schemas/dormitory-roster-entry.schema.ts:unique index and identity states"
    - "backend/src/dormitory/services/room-assignment.service.ts:deleteRosterEntry and assignFirstAvailableBed; preserve side effects"
    - "backend/src/dormitory/dto/update-roster-entry.dto.ts and create-roster-entry.dto.ts:student_id inheritance and identity validation"
    - "backend/src/students/students.module.ts:existing identity service provider"
    - "backend/src/dormitory/controllers/dormitory-roster-privacy.spec.ts:public response boundary"
    - "frontend/src/api/student-api.ts:getStudents and frontend/src/api/semester-api.ts:getSemesters; existing protected selectors"
    - "frontend/src/components/modals/ConfirmModal.tsx and frontend/src/api/http-client.ts:busy/close behavior and request failure semantics"
    - "frontend/package.json and backend/package.json:verification scripts"
  write:
    - "backend/src/dormitory/services/dormitory-roster-identity.service.ts"
    - "backend/src/dormitory/services/dormitory-roster-identity.service.spec.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.spec.ts"
    - "backend/src/dormitory/controllers/dormitory-roster.controller.ts"
    - "backend/src/dormitory/controllers/dormitory-permissions.spec.ts"
    - "backend/src/dormitory/dto/reconcile-roster.dto.ts"
    - "backend/src/dormitory/dto/import-roster.dto.ts"
    - "backend/src/students/students.service.ts"
    - "backend/src/students/test/students.service.spec.ts"
    - "frontend/src/api/dormitory-api.ts"
    - "frontend/src/api/dormitory-api.test.ts"
    - "frontend/src/components/dormitory/roster-batch.ts"
    - "frontend/src/components/dormitory/roster-batch.test.ts"
    - "frontend/src/components/dormitory/DormitoryRosterImportModal.tsx"
    - "frontend/src/components/dormitory/DormitoryRosterImportModal.test.tsx"
    - "frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx"
    - "frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx"
  preserve:
    - "Existing name normalization including accents and calendar-date comparison; no fuzzy matching or new student-code precedence. Stable student_id is authoritative after linking."
    - "Current RBAC, public registration privacy, Student lookup permissions, validation, semester rules, one linked entry per Student/semester, and existing linked identities."
    - "Import duplicate skipping, four required Excel columns and optional room code, input order, room/bed assignment and deletion side effects, result categories and existing API callers."
    - "Desktop/mobile list behavior, virtual scrolling, selection, single delete, PDF export, existing Student import progress/account/summary-point behavior."
  out:
    - "Production/runtime data access, backfill scripts, database/index/schema migrations, permission grants, new dependencies, queue/Redis job infrastructure."
    - "Automatic writes while reading the table; fuzzy matching; unlinking/reassigning already-linked entries; modifying Student records from KTX."
    - "Progress redesign outside KTX > List; background continuation/resume after navigation or browser reload; shared UI/http-client edits; contract/invoice identity migration."

acceptance_criteria:
  - "AC-01: A shared batch matcher returns LINKED only for one exact normalized-name/DOB Student with no competing roster in that semester. Zero matches stays UNLINKED; multiple Students or competing roster entries become CONFLICT. Explicit authorized student_id selection resolves an unlinked/conflicted entry subject to uniqueness. Existing LINKED entries are never automatically reassigned. Repeated/concurrent attempts cannot create two linked entries for one Student/semester or overwrite a newer manual choice."
  - "AC-02: Authenticated roster create/update/import and Student create/update/createBulk/processStudentImportBatch use the shared matcher. Student batch matching runs after all successful inserts for that operation are visible, so same-name/DOB Students in later batches are included. Post-Student-write reconciliation errors do not relabel persisted Students as failed imports; report a sanitized reconciliation warning without losing existing import progress. Public registration behavior remains unchanged."
  - "AC-03: KTX List offers 'Đối chiếu liên kết' only with DORM_REG_UPDATE. A semester selector defaults to the sole active semester and requires an explicit valid selection otherwise. POST /dormitory/roster/reconcile validates semester_id, optional after_id and limit (1..100); processes UNLINKED/CONFLICT entries in stable _id cursor order and returns scanned/linked/unlinked/conflicts/failed, per-entry outcome/reason, next_cursor and has_more. No offset skipping as states change. Missing permission returns 403 before mutation. Page refresh alone performs zero reconciliation writes."
  - "AC-04: Unlinked/conflicted entries expose an explicit Student selector in the existing edit modal using existing protected lookup, with confirmation and current Student identity shown before save. Duplicate-semester conflicts remain visible; linked fields stay locked. Import outcomes add optional per-row identity_state and additive linked/unlinked/conflicts counters for newly created entries; existing created/duplicated/failed fields remain compatible. Duplicate imports still skip existing entries; the reconciliation action repairs old links."
  - "AC-05: Import processes sequential batches of at most 50 valid rows with a frozen input snapshot and original Excel row mapping. Whole-file validation still enforces the existing total limit and skipped-invalid counts. UI shows preparation, processing, completed/partial/interrupted states, acknowledged processed/total and percentage plus created/duplicated/failed and identity counts. No timer-based progress. 100% means every submitted row has a confirmed outcome, not every row succeeded. Deduplication survives batch boundaries. Pin the active semester before the first batch through an optional semester_id request field; backend rejects batches if that semester is no longer the sole active semester. Legacy callers without the field retain existing behavior."
  - "AC-06: Bulk delete freezes/deduplicates the confirmed selection (preserve maximum 100 per user operation), sends sequential batches of at most 10 IDs, and shows acknowledged processed/total, percentage and deleted/blocked/not_found/invalid counts. Backend captures per-item failures in blocked with sanitized reasons, continues other IDs, and still delegates each actual deletion to deleteRosterEntry. Successfully deleted IDs leave selection; blocked, unsent and unconfirmed IDs remain available for review."
  - "AC-07: During import/delete/reconciliation, prevent duplicate launches and incompatible roster actions; block modal dismissal while a batch is pending and give an in-flight navigation warning. Request failure stops later batches, preserves acknowledged results and identifies the current batch as unconfirmed; do not automatically replay mutations or claim rollback. Unsent work is distinct from server-declared failures. Refresh roster after acknowledged mutations and after an uncertain response; refresh failure must not erase mutation results or restart work. Release busy state on every completion/error path. Use accessible progressbar/live status on desktop/mobile."
  - "AC-08: Match candidates in bounded batched Student queries and prefetch roster collision data rather than a Student lookup per row. Keep room assignment/deletion ordered. Synthetic multi-batch tests assert batch bounds, bounded query growth, exact row/ID accounting, monotonic acknowledged progress, partial failure and no duplicate writes. No new worker/job service."

execution:
  - "E-01 [AC-01,02,08] dormitory-roster-identity.service.ts + its spec: centralize pure identity normalization, batched candidate resolution and guarded link writes; prefetch competing identities, handle unique-index collisions, exclude LINKED entries at write time."
  - "E-02 [AC-01,02,04,05,06,08] dormitory-roster.service.ts + its spec and import-roster.dto.ts: inject existing identity provider, route authenticated buildEntry/update/importRows through shared resolution; retain public path; add semester pin validation and additive import identity results; capture per-ID bulkRemove failures and retain prior successes."
  - "E-03 [AC-02,08] students.service.ts + students.service.spec.ts: replace single-write reconciliation calls with shared behavior; reconcile successful createBulk/import operation IDs after insertion completes, including partial-insert error paths; preserve Student operation counters and expose sanitized best-effort reconciliation warnings."
  - "E-04 [AC-03] new reconcile-roster.dto.ts, dormitory-roster.controller.ts, dormitory-roster.service.ts and service/permission specs: add bounded cursor reconciliation endpoint under DORM_REG_UPDATE before parameterized routes; test scope, validation, state changes and denial."
  - "E-05 [AC-03,04,05] dormitory-api.ts + its spec: typed reconciliation request/response, optional import semester pin, additive identity fields; preserve existing method call forms."
  - "E-06 [AC-05,06,07,08] new local roster-batch.ts + spec: sequential bounded runner with frozen input, acknowledged progress callback and partial/unconfirmed/unsent outcome tracking, no automatic retry."
  - "E-07 [AC-04,05,07,08] DormitoryRosterImportModal.tsx + spec: use runner with 50-row batches, obtain/pin sole active semester with existing semester API, map response row offsets back to original Excel rows, aggregate counts and render progress/partial outcomes; add rendered interaction tests beyond existing parser tests."
  - "E-08 [AC-01,04] DormitoryRegistrationEditModal.tsx + spec: protected explicit Student selection/confirmation only when unlinked/conflicted; submit student_id via existing PATCH and preserve current form identity-lock behavior."
  - "E-09 [AC-03,06,07,08] roster/page.tsx + page.test.tsx: semester reconciliation dialog/cursor loop, 10-ID delete runner and accessible progress, mutation interlocks, partial selection retention and consolidated final reload. Update old one-request test only where multi-batch behavior changes."
  - "E-10 [AC-01..08] Run focused checks below and independent review of guarded matching, role boundaries, partial writes and batch error semantics; review final diff and record evidence before completing this slot."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..06,08] npm --prefix backend test -- dormitory-roster.service.spec.ts dormitory-roster-identity.service.spec.ts dormitory-permissions.spec.ts dormitory-roster-privacy.spec.ts --runInBand -> all pass; cover ambiguous Students, competing rosters, repeated/conditional writes, read-only list, semester change, cursor continuation, additive results and partial deletion."
  - "V-02 [AC-02,08] npm --prefix backend test -- students/test/students.service.spec.ts --runInBand -> all pass; cover individual/bulk/import hooks, cross-batch ambiguous Students, partial inserts and reconciliation failure without corrupting import counters."
  - "V-03 [AC-03..08] npm --prefix frontend test -- src/api/dormitory-api.test.ts src/components/dormitory/roster-batch.test.ts src/components/dormitory/DormitoryRosterImportModal.test.tsx src/components/dormitory/DormitoryRegistrationEditModal.test.tsx 'src/app/(dashboard)/dormitory/roster/page.test.tsx' -> all pass; deferred promises prove no early progress/100%, exact Excel rows across skipped/batch rows, partial results, no retry, selection and busy cleanup."
  - "V-04 [AC-01..08] npm --prefix frontend run typecheck; npm --prefix backend run build -> both exit 0."
  - "V-05 [AC-03..07] Local mocked/synthetic UI verification at desktop/mobile widths: import 120 valid rows plus invalid/duplicate rows, delete 25 IDs, interrupt middle batch and fail final reload; observe progress and totals, readable error summary, preserved state and controls. Do not use real student data."
  - "V-06 [AC-01..08] git diff --check and final changed-path review -> no whitespace errors, writes only within scope, independent review resolved, completion/cleanup recorded."

risks:
  - "High: linking affects access to Student-associated KTX data. Existing name/DOB collisions and concurrent manual choices require conditional writes and independent review."
  - "Batch requests can commit before a response is lost; unconfirmed status must remain explicit. UI batching is not a durable background job and cannot guarantee rollback or continuation after closing the tab."
  - "Roster records may already have rooms/contracts. Preserve existing assignment/deletion behavior; pause if correct linking requires modifying contract/invoice identity fields outside this scope."
stop_conditions:
  - "TASKSCOPE_PIN_* / TASKSCOPE_CONFLICT, overlapping dirty paths or named-target baseline drift: stop before mutation and follow global.md."
  - "Need for schema/index migration, new dependency/job infrastructure, permission expansion, shared-component changes or other write paths: amend scope before proceeding."
  - "Production/database mutation, real-data reconciliation or destructive live deletion requires the repository Human Gate; this task authorizes code and synthetic verification only."
  - "If existing uniqueness enforcement is unavailable, do not repair live indexes under this task; report the prerequisite."
