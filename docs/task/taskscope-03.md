slot_id: "taskscope-03"
generation: 1
task_id: "20260905-081905-adjust-roster-operation-linking"
scope_file: "docs/task/taskscope-03.md"
status: blocked
scope_revision: 1
created_at: "2026-09-05T08:19:05+07:00"
updated_at: "2026-09-05T08:19:05+07:00"
base_commit: "f6cc77609f386e56e03e7a510b3630ef753ff8a8"
task: "Move KTX operations to progress dialogs and reconcile current students"
pipeline: feature_development
profile: Full
environment: development
risk_level: high
objective: "After import or bulk-delete confirmation, replace the confirmation/input surface with a dedicated truthful progress/result dialog; reconcile KTX identities against current-class Students without a semester selector; and allow an authorized user to link an unresolved roster entry from a large searchable Student dialog."

coordination:
  depends_on:
    - "20260904-155313-dormitory-identity-bulk-progress"
    - "20260904-163806-fix-roster-progress-results-linking"
  warnings:
    - "TASKSCOPE_CONFLICT: docs/task/taskscope.md (slot 00 generation 2, in_progress) reserves all existing KTX implementation targets below."
    - "TASKSCOPE_CONFLICT: docs/task/taskscope-02.md (slot 02 generation 2, blocked) reserves the same progress, page, identity and roster targets plus the planned progress component."
  reservation_check: "Clean worktree at f6cc77609f386e56e03e7a510b3630ef753ff8a8. Slots 00/01/02 are non-terminal, so allocated next unused slot 03 and published blocked because implementation writes overlap active reservations."
  resume: "Resolve or explicitly cancel/supersede both overlapping scopes, then explicitly resume this exact file. Rebase its evidence and execution steps on the predecessor diff before changing code."

completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []

evidence:
  current_behavior:
    - "DormitoryRosterImportModal.tsx keeps the import popup open and renders progress inside it after confirmation."
    - "roster/page.tsx renders bulk-delete progress as an inline page section while ConfirmModal owns the confirmation lifecycle. The Student academic-record page has the desired separate, non-dismissible progress/result Dialog pattern, but it is not a reusable component."
    - "ReconcileRosterDto, dormitory-api.ts and roster/page.tsx require/select semester_id; reconcileSemester scans only roster rows in that semester. resolveBatch currently queries Students without status/class eligibility."
    - "Student has status and class_id; getStudents already supports search/status/pagination and class population, but no has-current-class filter. DormitoryRegistrationEditModal has no Student linking selector."
  expected_behavior: "Dedicated KTX operation dialogs; semester-independent reconciliation using currently enrolled/class-assigned Students; explicit large-dialog manual linking with conservative uniqueness and permissions."
  root_cause: "Operation state is owned by the input/page surfaces, and the reconciliation contract was designed around roster semester rather than a current-Student candidate set."

scope:
  inspect:
    - "frontend/src/app/(dashboard)/students/record/page.tsx:bulk academic-record progress/result Dialog pattern"
    - "frontend/src/components/modals/ConfirmModal.tsx:confirmation lifecycle"
    - "backend/src/students/students.service.ts:findAll current search/status/class visibility semantics"
    - "backend/src/dormitory/schemas/dormitory-roster-entry.schema.ts:Student/semester uniqueness"
    - "backend/src/dormitory/controllers/dormitory-roster-privacy.spec.ts:public data boundary"
    - "frontend/package.json and backend/package.json:verification scripts"
  write:
    - "frontend/src/components/dormitory/DormitoryRosterImportModal.tsx"
    - "frontend/src/components/dormitory/DormitoryRosterImportModal.test.tsx"
    - "frontend/src/components/dormitory/RosterOperationProgressDialog.tsx"
    - "frontend/src/components/dormitory/RosterOperationProgressDialog.test.tsx"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.tsx"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.test.tsx"
    - "frontend/src/components/dormitory/roster-batch.ts"
    - "frontend/src/components/dormitory/roster-batch.test.ts"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx"
    - "frontend/src/api/dormitory-api.ts"
    - "frontend/src/api/dormitory-api.test.ts"
    - "backend/src/dormitory/dto/reconcile-roster.dto.ts"
    - "backend/src/dormitory/dto/query-roster-link-candidates.dto.ts"
    - "backend/src/dormitory/controllers/dormitory-roster.controller.ts"
    - "backend/src/dormitory/controllers/dormitory-permissions.spec.ts"
    - "backend/src/dormitory/services/dormitory-roster-identity.service.ts"
    - "backend/src/dormitory/services/dormitory-roster-identity.service.spec.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.spec.ts"
  preserve:
    - "DORM_REG_CREATE/UPDATE/DELETE gates, public-registration privacy and minimal Student fields."
    - "Exact normalized-name plus calendar-DOB matching; no fuzzy/forced automatic match and no reassignment of LINKED entries."
    - "One linked roster entry per Student per roster semester, even though candidate discovery/reconciliation is not filtered by semester."
    - "Acknowledged batch accounting, no automatic mutation replay, import validation/row mapping, deletion side effects and partial-result retention."
    - "Existing desktop/mobile roster behavior and API compatibility outside the changed reconciliation request."
  out:
    - "Shared ConfirmModal or Student academic-record page changes, schema/index migration, new dependencies or background jobs."
    - "Production/runtime data access, live reconciliation/deletion, fuzzy matching, changing Student/class records, or linking non-current Students automatically."

acceptance_criteria:
  - "AC-01: Confirming import closes the confirmation and import-input modal, then opens a dedicated progress Dialog before the first batch request. It shows phase, acknowledged processed/total, integer percentage and outcome counters; it cannot close while a request is pending. Completion/interruption remains visible as a result state until the user closes it."
  - "AC-02: Confirming bulk delete closes its confirmation and opens the same KTX progress-dialog pattern. Progress advances only for acknowledged batches and separately reports deleted/blocked/not_found/invalid plus unconfirmed/unsent IDs. Failed or blocked IDs remain selected; no timer, silent truncation, automatic retry or false rollback/100% claim."
  - "AC-03: POST /dormitory/roster/reconcile no longer accepts or requires semester_id. With DORM_REG_UPDATE it scans every UNLINKED/CONFLICT roster entry in stable _id cursor pages and matches only Students whose status is Studying, class_id is non-null and referenced Class still exists. Student candidate matching is independent of any academic semester; roster Student/semester uniqueness is still enforced per entry."
  - "AC-04: KTX List reconciliation has no semester selector, prevents duplicate launch, displays cumulative linked/unlinked/conflict/failed outcomes, and performs no write on list load/search/page change. A denied request mutates nothing."
  - "AC-05: Each UNLINKED/CONFLICT row exposes a DORM_REG_UPDATE-only manual-link action opening a large responsive Dialog. The dialog searches/paginates current-class Students by name, code or class, shows code/name/class/status, requires an explicit selection and confirmation, and links through the existing guarded roster update without editing Student data."
  - "AC-06: Manual linking rejects missing/non-current Students and a Student already linked in the roster entry's semester; concurrent/stale changes do not overwrite a newer link. Success refreshes the row and closes with focus restoration; failure keeps the dialog, selection and actionable sanitized error. LINKED rows expose no relink action."
  - "AC-07: Synthetic tests cover slow multi-batch import/delete transitions, partial/unconfirmed results, all-semester roster scanning, Studying/current-class eligibility, missing/deleted Class references, ambiguity, cursor continuation, permissions and manual-link uniqueness. No real personal data is used."

execution:
  - "E-01 [AC-01,02] Add RosterOperationProgressDialog.tsx and tests, modeled on the academic-record delete Dialog; wire import and roster page so confirmation/input surfaces close before the operation dialog opens and terminal results persist."
  - "E-02 [AC-01,02,07] Update roster-batch.ts/tests and both callers to retain immutable acknowledged/unconfirmed/unsent snapshots, reset between runs, reject over-limit delete input and release busy state on every exit."
  - "E-03 [AC-03,04,07] Remove semester_id from reconcile DTO/client/UI; change identity/service reconciliation to stable cursor pages across unresolved roster entries and a bounded Student query constrained to Studying plus existing class_id/Class. Preserve per-entry semester collision checks."
  - "E-04 [AC-05,06,07] Add the DORM_REG_UPDATE-protected paginated roster link-candidate query DTO/controller/service/client and permission tests, returning only minimal Student/class display fields and excluding non-current candidates."
  - "E-05 [AC-05,06,07] Add RosterStudentLinkModal.tsx/tests and row action wiring; search with debounce/abort, paginate, confirm the chosen identity, PATCH student_id through existing update semantics, handle stale/duplicate errors and restore focus."
  - "E-06 [AC-01..07] Run focused verification, independently review identity/RBAC/concurrency behavior, inspect scoped diff and record completion evidence."

verification:
  - "V-01 [AC-01,02,04..07] npm --prefix frontend test -- src/api/dormitory-api.test.ts src/components/dormitory/roster-batch.test.ts src/components/dormitory/RosterOperationProgressDialog.test.tsx src/components/dormitory/RosterStudentLinkModal.test.tsx src/components/dormitory/DormitoryRosterImportModal.test.tsx 'src/app/(dashboard)/dormitory/roster/page.test.tsx' -> all pass with deferred batch responses and real confirm-to-dialog interactions."
  - "V-02 [AC-03..07] npm --prefix backend test -- dormitory-roster-identity.service.spec.ts dormitory-roster.service.spec.ts dormitory-permissions.spec.ts dormitory-roster-privacy.spec.ts --runInBand -> all pass for eligibility, cursor, ambiguity, uniqueness, stale write and denial cases."
  - "V-03 [AC-01..07] npm --prefix frontend run typecheck; npm --prefix backend run build -> both exit 0."
  - "V-04 [AC-01,02,04,05] Local synthetic browser verification at 375/768/1280px -> input/confirm closes before progress opens, pending dialog cannot dismiss, terminal states remain readable, reconciliation has no semester control, and the Student picker is usable without horizontal overflow."
  - "V-05 [AC-01..07] git diff --check and final changed-path review -> no whitespace errors or out-of-scope writes; independent review findings resolved."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-03.md: user-requested reusable taskscope slot"]

risks:
  - "High: identity linking changes access to Student-associated KTX data; eligibility, RBAC, uniqueness and conditional writes require independent review."
  - "A lost batch response can follow committed writes; the UI must retain an unconfirmed state rather than retrying."
  - "The repository has no explicit Class active flag; this scope defines 'lớp hiện tại' as a referenced existing Class plus Student.status=Studying. Stop if product intent uses a different class-lifecycle rule."

stop_conditions:
  - "Remain blocked while either overlapping active scope reserves a target; resume only after explicit user pin and fresh identity/status/baseline validation."
  - "If 'lớp hiện tại' requires an unimplemented academic-year/active-Class rule, obtain that business rule before mutation."
  - "New schema/index work, permission expansion, shared-component changes or additional paths require a scope amendment."
  - "Production data access, live reconciliation or destructive deletion requires the repository Human Gate; code and synthetic verification only are authorized."
