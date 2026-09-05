slot_id: "taskscope-04"
generation: 2
task_id: "20260905-093444-fix-roster-reconcile-stale-validation"
scope_file: "docs/task/taskscope-04.md"
status: completed
scope_revision: 2
created_at: "2026-09-05T09:34:44+07:00"
updated_at: "2026-09-05T09:43:30+07:00"
base_commit: "f5f649df9f525ac223d9ffeea4302592631cd03a"
task: "Remove the stale semester validation seen when confirming KTX roster reconciliation"
pipeline: bug_fix
profile: Quick
environment: development
risk_level: medium
objective: "Make confirmation of KTX roster reconciliation accept the semester-independent cursor payload and execute on the current backend build without the legacy `semester_id must be a mongodb id` validation error."

coordination:
  depends_on: []
  warnings:
    - "The running development backend must be restarted after a clean build; this briefly interrupts local API requests."
  reservation_check: "taskscope-04 generation 1 is completed, the repository is clean at the pinned base commit, and no other lifecycle scope reserves the target."

completion:
  completed_at: "2026-09-05T09:43:30+07:00"
  outcome: "completed"
  final_commit_or_state: "Working tree contains only the scoped taskscope update and DTO regression test; no commit created."
  changed_paths:
    - "backend/src/dormitory/dto/reconcile-roster.dto.spec.ts"
    - "docs/task/taskscope-04.md"
  checks_passed:
    - "V-01: backend DTO regression suite passed, 5 tests."
    - "V-02: frontend reconciliation/API and roster page regressions passed, 25 tests; existing React act warning only."
    - "V-03: backend build exited 0; development backend restarted and fresh Nest startup completed with route mapped and no TypeScript errors."
    - "V-04: authenticated KTX UI reconciliation completed 80/80 at 100%; completion toast shown and no legacy semester_id validation error."
    - "V-05: scoped git diff --check exited 0."
  cleanup_pending: []

evidence:
  current_behavior:
    - "The UI posts `{ after_id?, limit: 100 }` through frontend/src/api/dormitory-api.ts:roster.reconcile and intentionally omits `semester_id`; its API test already pins that payload."
    - "backend/src/dormitory/dto/reconcile-roster.dto.ts and backend/dist/dormitory/dto/reconcile-roster.dto.js contain only optional `after_id` and `limit`; commit c2590230 removed the formerly required `semester_id`."
    - "The active backend Node process has remained alive while Nest watch reported failed compilations for temporarily missing roster identity files, so it can retain the pre-change DTO validation metadata in memory and emit the observed legacy error."
  expected_behavior: "After a clean backend build and process restart, confirming reconciliation accepts the semester-independent request, preserves cursor validation, and starts scanning roster entries across semesters."
  root_cause: "The development backend process is serving stale in-memory DTO metadata from before c2590230 because failed watch compilations did not replace the running Node child process."

scope:
  inspect:
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx:reconcileAll"
    - "frontend/src/api/dormitory-api.ts:roster.reconcile"
    - "frontend/src/api/dormitory-api.test.ts:semester-independent reconciliation payload regression"
    - "backend/src/dormitory/dto/reconcile-roster.dto.ts:current request contract"
    - "backend/src/dormitory/controllers/dormitory-roster.controller.ts:reconcile endpoint and permission guard"
    - "backend/src/dormitory/services/dormitory-roster.service.ts:reconcile"
    - "backend/src/dormitory/services/dormitory-roster-identity.service.ts:reconcileUnlinked"
    - "backend/Dockerfile and docker-compose.yml:development build/runtime lifecycle"
  write:
    - "backend/src/dormitory/dto/reconcile-roster.dto.spec.ts (new; follow backend/src/dormitory/dto/applicant-profile.dto.spec.ts)"
  preserve:
    - "Reconciliation remains independent of semester and never restores `semester_id` to the DTO or frontend payload."
    - "DORM_REG_UPDATE authorization, stable `_id` cursor ordering, limit 1..100, invalid-cursor rejection, and current-student/current-class matching rules remain unchanged."
    - "No roster, Student, class, semester, or other persistent data is modified merely to clear the validation error."
  out:
    - "Frontend UI/design changes, matching heuristics, manual linking, import/delete workflows, production deployment, shared validation configuration, and database repair."

acceptance_criteria:
  - "AC-01: ReconcileRosterDto accepts `{}` and `{ limit: 100 }` without any `semester_id` error, accepts a valid optional `after_id`, and rejects an invalid `after_id` or a limit outside 1..100."
  - "AC-02: A clean backend build succeeds before restart; the restarted development backend reports a successful Nest startup with no TypeScript errors and no pre-restart Node child remains active."
  - "AC-03: Confirming `Đối chiếu` sends no `semester_id`, receives the reconciliation response instead of the legacy MongoId validation error, and continues cursor pages until completion."
  - "AC-04: The fix does not add semester filtering or mutate reconciliation eligibility, RBAC, pagination, counters, or roster data outside the endpoint's existing operation."

execution:
  - "E-01 [AC-01,04] backend/src/dormitory/dto/reconcile-roster.dto.spec.ts -> add class-validator regression cases for empty/limit/valid-cursor payloads and invalid cursor/limit boundaries; assert no semester field is required."
  - "E-02 [AC-02,04] Build the current backend source; stop without restarting if compilation fails, otherwise restart only the development backend service and verify the new process starts cleanly."
  - "E-03 [AC-03,04] From the existing authenticated KTX roster UI, confirm reconciliation and inspect the request/response plus terminal progress state; do not substitute an active-semester ID."

verification:
  - "V-01 [AC-01,04] npm --prefix backend test -- --runInBand dormitory/dto/reconcile-roster.dto.spec.ts -> all DTO contract cases pass."
  - "V-02 [AC-01,03,04] npm --prefix frontend test -- src/api/dormitory-api.test.ts 'src/app/(dashboard)/dormitory/roster/page.test.tsx' -> reconciliation payload and cursor workflow regressions pass."
  - "V-03 [AC-02] npm --prefix backend run build -> exits 0; then restart the development backend service and inspect its fresh logs/process list -> Nest starts successfully, zero compile errors, and the Node child start time is newer than the restart."
  - "V-04 [AC-03,04] Manual authenticated UI check: click `Đối chiếu` then `Bắt đầu đối chiếu`; POST /dormitory/roster/reconcile contains only cursor/limit fields, returns 2xx, and the progress dialog completes without `semester_id must be a mongodb id`."
  - "V-05 [AC-01..04] git diff --check -- backend/src/dormitory/dto/reconcile-roster.dto.spec.ts docs/task/taskscope-04.md -> exits 0."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-04.md: user-requested reusable taskscope slot"]

risks:
  - "Restarting the backend interrupts in-flight development requests; do it only after the build passes."
  - "A 2xx reconciliation call can write valid identity links by design; use the user's intended confirmation flow and do not run repeated exploratory calls."

stop_conditions:
  - "Backend build fails or watch mode still reports missing roster identity files: do not restart or test the mutation endpoint until compilation is clean."
  - "The request is routed to a different backend/proxy or still returns the legacy error after a verified fresh process: capture the exact URL, payload and fresh backend log, then amend the scope before changing API semantics."
  - "Any proposed fix adds `semester_id`, changes eligibility/matching, touches persistent data manually, or requires production deployment: stop for an explicit scope amendment."
