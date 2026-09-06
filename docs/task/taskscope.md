slot_id: "taskscope-00"
generation: 1
task_id: "20260906-204325-student-evaluation-gate"
scope_file: "docs/task/taskscope.md"
status: in_progress
scope_revision: 1
created_at: "2026-09-06T20:43:25+07:00"
updated_at: "2026-09-06T21:15:54+07:00"
base_commit: "3fcfd7a038bfa5705bf1b8837d7d91a6921e5854"
task: "Enforce the student evaluation window across grading UI and mutation APIs"
pipeline: bug_fix
profile: Full
risk: high
environment: development
objective: "Students can change their own training scores only during an open, unexpired student evaluation phase on an active semester and an editable draft; UI and backend enforce the same decision."
coordination:
  depends_on: []
  warnings:
    - "Discovery baseline: main, clean worktree, empty docs/task directory, no active scope reservations or nested AGENTS.md found."
    - "V-04 remains blocked: the verified dev browser has only a staff/admin session; no student session is available for UI/API runtime scenarios."
    - "No production-triggering commit, push, deployment, migration, backfill, or historical repair was performed."
completion:
  completed_at: null
  outcome: "partial: implementation and automated verification complete; mandatory student runtime verification remains blocked"
  final_commit_or_state: "main @ 3fcfd7a038bfa5705bf1b8837d7d91a6921e5854; working tree contains uncommitted task changes plus unrelated auth/permissions changes preserved untouched; no commit/push/deploy"
  changed_paths:
    - "backend/src/summaries-point/summaries-point.service.ts"
    - "backend/src/summaries-point/test/summaries-point.service.spec.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "backend/src/evaluation-detail/evaluation-detail.service.ts"
    - "backend/src/evaluation-detail/test/evaluation-detail.service.spec.ts"
    - "frontend/src/app/(dashboard)/grading/score/_hooks/useGradingScoreAccess.ts"
    - "frontend/src/app/(dashboard)/grading/score/_hooks/useGradingScoreAccess.test.tsx"
    - "frontend/src/app/(dashboard)/grading/score/page.tsx"
    - "frontend/src/app/(dashboard)/grading/score/page.test.tsx"
  checks_passed:
    - "V-01: focused backend Jest suites passed — 3 suites, 178 passed, 2 todo, 180 total."
    - "V-02: focused frontend Vitest suites passed — 2 files, 16 tests."
    - "V-03: frontend typecheck and backend build exited 0."
    - "V-05: independent authorization re-review found no actionable issue in the four prior findings; staff/admin and internal sync paths remain preserved."
    - "Diff hygiene: git diff --check exited 0."
  cleanup_pending:
    - "V-04 student dev session and isolated task-scoped runtime data are still required; no score mutation or disposable data was created."
    - "Taskscope must remain in_progress until V-04 is executed and its minimal before/after evidence is recorded."
evidence:
  current_behavior: "frontend/src/app/(dashboard)/grading/score/page.tsx:canModifyScore returns isSemesterActive when activePeriod is absent, before consulting backend permission. handleCountChange/handleCountSet schedule a score intent after 350 ms, so +/- can persist without pressing Save."
  expected_behavior: "Missing/pending/closed/non-student-phase/expired evaluation windows deny student score writes; loading or failed access resolution never opens editing."
  root_cause: "Converging source evidence: AcademicRecordService.handleScoreIntent checks summary lock and student ownership but not evaluation status/deadline; SummariesPointService.getGradingAccess checks scope/lock but never evaluation periods. UI additionally bypasses its backend decision when no period exists."
  related_findings:
    - "useGradingScoreAccess grants a role fallback before backend resolution and retains old backendAccess after request failure; page ignores access.loading."
    - "EvaluationDetailService.create/update/bulkUpsert and SummariesPointService.update validate scope/lock without an evaluation-window gate, exposing alternative student write paths."
    - "page.tsx displays roleDeadline without checking it; SemesterModal promises locking according to configured deadlines."
    - "page.tsx chooses the first period matching semester; the model permits historical closed periods alongside a current period. Semester-level summaries intentionally use period_id null."
scope:
  inspect:
    - "frontend/src/api/evaluation-period-api.ts"
    - "frontend/src/api/evaluation-detail-api.ts"
    - "frontend/src/api/summaries-point-api.ts"
    - "frontend/src/components/grading/SemesterModal.tsx"
    - "frontend/src/app/(dashboard)/grading/page.tsx"
    - "backend/src/academic-record/academic-record.controller.ts"
    - "backend/src/academic-record/dto/intent-score.dto.ts"
    - "backend/src/evaluation-detail/evaluation-detail.controller.ts"
    - "backend/src/summaries-point/summaries-point.controller.ts"
    - "backend/src/summaries-point/summaries-point.module.ts"
    - "backend/src/evaluation-periods/evaluation-periods.service.ts"
    - "backend/src/evaluation-periods/dto/evaluation-period.dto.ts"
    - "backend/src/evaluation-periods/schemas/evaluation-period.schema.ts"
    - "backend/src/auth/utils/grading-access.util.ts"
  write:
    - "backend/src/summaries-point/summaries-point.service.ts"
    - "backend/src/summaries-point/test/summaries-point.service.spec.ts"
    - "backend/src/academic-record/academic-record.service.ts"
    - "backend/src/academic-record/academic-record.service.spec.ts"
    - "backend/src/evaluation-detail/evaluation-detail.service.ts"
    - "backend/src/evaluation-detail/test/evaluation-detail.service.spec.ts"
    - "frontend/src/app/(dashboard)/grading/score/_hooks/useGradingScoreAccess.ts"
    - "frontend/src/app/(dashboard)/grading/score/_hooks/useGradingScoreAccess.test.tsx"
    - "frontend/src/app/(dashboard)/grading/score/page.tsx"
    - "frontend/src/app/(dashboard)/grading/score/page.test.tsx"
  preserve:
    - "Existing role normalization, student self scope, teacher class scope, staff permissions, locked-summary protection, and criterion restrictions."
    - "Academic records as score source of truth; score computation, count conflict handling, daily-report protection, audit attribution and realtime events."
    - "Existing API shapes and semester-level summary identity; no migration or reassignment of existing period_id values."
    - "Do not apply student self-assessment restrictions to internal attendance/record synchronization or redefine staff phase permissions."
  out:
    - "Production access/mutation, commit/push/deployment, migrations, backfills, or correction of historical scores."
    - "Redesign of teacher/admin approval, reopening/closing periods, snapshot archival, or bulk record management."
    - "New deadline date-picker semantics, automatic phase transitions, schema/index changes, or broad RBAC cleanup."
acceptance_criteria:
  - "AC-01: Student access returns canModifyScore false with a specific reason for absent/pending/gv_phase/admin_phase/closed period, expired or invalid sv_deadline, inactive semester, non-draft summary, or wrong student. Valid own draft in sv_phase before the stored deadline remains editable. Read access is not removed merely because editing is unavailable."
  - "AC-02: Student intent variants (increase/decrease/set_target_count/select_option/set_manual_score/clear_score), alternative detail/summary writes and permitted record mutation routes reject the same closed-window cases before any data/log/sync/event mutation. Caller-supplied role or target IDs cannot bypass the check. Existing unrelated permissions remain unchanged."
  - "AC-03: Student +/- controls, numeric input, option selector, manual save and autosave obey the current backend decision. No permission fallback during initial load, failed access/period fetch, user/semester/summary change, or stale response. Queued intents recheck current access and cannot persist a closed-window change; rejection restores/refetches displayed values."
  - "AC-04: A valid active period takes precedence over historical closed periods for the selected semester; an explicitly period-bound summary is evaluated against that same period and semester. Ambiguous or mismatched context denies student mutation. No period_id migration is needed."
  - "AC-05: Focused regression suites, frontend typecheck, backend build, independent authorization review and verified-dev UI/API scenarios pass; record actual evidence and cleanup before completion."
execution:
  - "E-01 [AC-01,AC-04] SummariesPointService: add a reusable student-window decision/assertion using existing injected semester/period/summary models and grading role helpers; apply it in getGradingAccess. Resolve authoritative context from the summary, validate supplied coordinates/ownership, preserve semester-level identity, choose the unique non-closed period when unbound, deny ambiguous context. Compare server time with stored sv_deadline; deny at/after that instant. Add table-driven cases in the existing service spec."
  - "E-02 [AC-02] AcademicRecordService.handleScoreIntent and student-reachable create/update/remove/bulkRemove paths, EvaluationDetailService.create/update/bulkUpsert, SummariesPointService.create/update: reuse E-01 before any write or repair/sync side effect. Validate original and proposed targets on update. Inspect existing guards before wiring shared/internal methods; constrain this new policy to authenticated student writes. Extend the three existing service specs to assert zero mutation on denial and normal valid-window behavior."
  - "E-03 [AC-03,AC-04] useGradingScoreAccess: key results to current user/context, clear stale results and deny editing until a successful matching response; retain readable-page state on edit denial. Add new useGradingScoreAccess.test.tsx in the existing _hooks parent using Vitest/renderHook conventions from the adjacent page suite. page.tsx: remove student no-period bypass, include access loading/error, guard handlers and timer flush/save paths, refresh access after period changes and expired deadline, and show the reason without hiding readable scores. Extend page.test.tsx for all entry controls, failed/stale responses and pending debounce rejection."
  - "E-04 [AC-05] Run V-01 through V-04, then obtain independent review of changed authorization/context checks as required by pipeline.md. Resolve in-scope findings, inspect final diff, and record runtime cleanup; do not claim the entire evaluation lifecycle verified by these student-window checks."
verification:
  - 'V-01 [AC-01,AC-02,AC-04] npm --prefix backend test -- --runTestsByPath src/summaries-point/test/summaries-point.service.spec.ts src/academic-record/academic-record.service.spec.ts src/evaluation-detail/test/evaluation-detail.service.spec.ts --runInBand -> allowed/denied matrix passes, denied calls produce no writes or events, existing regressions pass.'
  - 'V-02 [AC-03,AC-04] npm --prefix frontend test -- "src/app/(dashboard)/grading/score/page.test.tsx" "src/app/(dashboard)/grading/score/_hooks/useGradingScoreAccess.test.tsx" -> controls and handlers remain closed during absent/failed/stale permission resolution; valid open phase permits changes.'
  - 'V-03 [AC-05] npm --prefix frontend run typecheck; npm --prefix backend run build -> both exit successfully. Run separately; do not use lint --fix.'
  - "V-04 [AC-01,AC-02,AC-03,AC-04,AC-05] On verified dev, sign in as student, open /grading/score and test no period, pending, valid sv_phase, expiry, phase change while tab stays open, locked summary and direct intent/detail/summary requests. Denials leave records, totals and audit history unchanged after reload; valid +/- persists once. Confirm teacher/admin smoke cases retain prior authorized behavior."
  - "V-05 [AC-05] Independent review checks consistent backend enforcement, ownership/context matching, bypass routes and no unintended staff/internal-sync restrictions. Record reviewer and actionable result; self-review is not independent review."
runtime_test:
  target_identity: "Frontend/API, MongoDB, Redis and integration destinations remain unverified; establish non-secret dev isolation evidence before runtime actions under safety.md section 6a."
  resources: "Reserve one task-tagged dev student/semester/summary and evaluation period, with normal student and authorized staff sessions; avoid shared live academic records where possible."
  operations: "Task-scoped UI/API evaluation configuration and reversible score interactions; no raw database writes or external delivery."
  scenarios: "V-04; also reload after rejection and inspect only minimal redacted record/count evidence."
  cleanup: "Capture minimal before-state for existing records; check intervening changes before restore. Remove only positively identified task-created disposable data and record any retained changes."
review_backlog:
  - "EvaluationPeriodsService.update does not repeat create's non-closed-period uniqueness check; concurrent create is also not protected by a unique index. Resolve duplicate data as a separate scoped persistence decision if encountered."
  - "SemesterModal serializes a selected date with new Date(date).toISOString(); intended end-of-day/timezone behavior is not established. This scope respects stored timestamps; changing calendar semantics requires a separate business decision."
  - "Closing archives only summaries with period_id equal to the period, while grading initializes/loads semester-level summaries with period_id null. Audit full submit/review/lock/archive lifecycle separately before claiming it works end to end."
  - "Supervisor phase behavior differs between base backend role capabilities and frontend phase branching; preserve current staff behavior here and resolve policy explicitly before expanding the fix."
temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]
risks:
  - "Authorization and shared mutation entrypoints require independent review during execution."
  - "No runtime evidence identifies the user's actual semester/period state; source evidence establishes a reproducible missing-gate mechanism, not a production data diagnosis."
stop_conditions:
  - "Apply global.md pin, ownership, dirty-path and reservation checks before execution and mutation."
  - "Stop dependent runtime tests if dev data isolation cannot be verified."
  - "Amend scope before adding write paths, changing staff phase policy, calendar semantics, or persistent-data identity."
  - "Existing ambiguous periods or historical-data repair require separate authorization/scope; deny student writes safely rather than silently selecting or repairing data."
  - "Missing mandatory verification or independent review prevents completion; no production-triggering commit/push is authorized."
