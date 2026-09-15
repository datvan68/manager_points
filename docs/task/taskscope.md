slot_id: "taskscope-00"
generation: 2
task_id: "20260915T100315+0700-fix-timetable-stale-sync-badge"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 3
created_at: "2026-09-15T10:03:15+07:00"
updated_at: "2026-09-15T10:13:30+07:00"
base_commit: "550ead8d6ecdbc0d045a359606c201d30838909a"
task: "Refresh timetable week badges after synchronization completes"
pipeline: bug_fix
profile: Quick
objective: "After a timetable synchronization reaches a terminal result, the administration table displays the same current week status as the progress dialog without requiring a reload or tab change."
coordination:
  depends_on: []
  warnings: []
completion:
  completed_at: "2026-09-15T10:13:30+07:00"
  outcome: "Implemented terminal status reconciliation for single-week and bulk timetable synchronization, with success and failure badge regressions."
  final_commit_or_state: "Working tree changes uncommitted at base commit 550ead8d6ecdbc0d045a359606c201d30838909a."
  changed_paths:
    - "frontend/src/components/timetable/TimetableSyncPanel.tsx"
    - "frontend/src/components/timetable/TimetableSyncPanel.test.tsx"
    - "docs/task/taskscope.md"
  checks_passed:
    - "V-01: TimetableSyncPanel suite 20/20 passed."
    - "V-02: page callback and timetable API suites 9/9 passed."
    - "V-03: npm --prefix frontend run build passed compilation, TypeScript, static generation, and optimization."
    - "V-04: git diff --check passed for the two implementation/test files."
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/components/timetable/TimetableSyncPanel.tsx:pollWeek marks the dialog completed from getSavedClassWeekStatus and invokes onSynced, but does not refresh the panel's statuses state. The row badge continues to render the previously loaded weekStatus, and the page-level onSynced callback only refreshes TimetableLookup. Bulk polling likewise does not refresh panel statuses when all pairs become terminal."
  expected_behavior: "A successful terminal poll updates the selected week badge to Đã đồng bộ in the same panel, while failed terminal results remain Lỗi with their failure details; bulk completion also reconciles the affected row badges."
  root_cause: "The progress dialog and table badges use different state sources: targeted polling receives the new terminal result, while the table retains the classStatuses snapshot loaded before synchronization because no canonical status refresh occurs when polling finishes."
scope:
  inspect:
    - "frontend/src/components/timetable/TimetableSyncPanel.tsx:applyStatus/refreshStatuses/pollWeek/pollBulkStatus"
    - "frontend/src/components/timetable/TimetableSyncPanel.test.tsx"
    - "frontend/src/app/(dashboard)/timetable/page.tsx:onSynced"
    - "frontend/src/api/timetable-api.ts"
  write:
    - "frontend/src/components/timetable/TimetableSyncPanel.tsx"
    - "frontend/src/components/timetable/TimetableSyncPanel.test.tsx"
  preserve:
    - "The progress dialog reaches completed only after a new valid snapshot is observed, preserving the existing lastSuccessfulUpdate baseline guard."
    - "Request coalescing, cooldown handling, polling intervals, duplicate-submit prevention, and API contracts remain unchanged."
    - "A status-refresh failure does not reclassify a successful synchronization as a source failure and remains visible as a refresh warning."
  out:
    - "Backend synchronization, queue, snapshot, and status aggregation behavior"
    - "Timetable lookup rendering outside the administration synchronization panel"
    - "Settings, schemas, persisted data, deployment, and production operations"
acceptance_criteria:
  - "AC-01: Given a row whose selected week currently shows Lỗi or Chưa đồng bộ, when single-week polling observes a new valid snapshot, the dialog shows Đồng bộ hoàn tất and the same row badge changes to Đã đồng bộ without a page reload or tab change."
  - "AC-02: Given single-week polling returns a terminal failure, the dialog and selected-week badge remain consistent with Lỗi and the failure is not reported as a successful refresh."
  - "AC-03: When every accepted bulk pair becomes terminal, the panel refreshes canonical class statuses so successful and failed row badges reflect the completed bulk result."
  - "AC-04: Existing baseline timestamp checks, callback behavior, request coalescing, skipped outcomes, and duplicate-submit protection continue to pass."
execution:
  - "E-01 [AC-01, AC-02, AC-04] frontend/src/components/timetable/TimetableSyncPanel.test.tsx -> extend the single-week terminal tests to assert canonical status refresh and the visible row badge for both success and failure."
  - "E-02 [AC-03, AC-04] frontend/src/components/timetable/TimetableSyncPanel.test.tsx -> add a bulk terminal regression proving badges are reconciled after all accepted pairs finish."
  - "E-03 [AC-01, AC-02, AC-03, AC-04] frontend/src/components/timetable/TimetableSyncPanel.tsx:pollWeek/pollBulkStatus -> reconcile the panel through the existing refreshStatuses path at terminal completion while preserving dialog outcome and callback semantics."
verification:
  - "V-01 [AC-01, AC-02, AC-03, AC-04] npm --prefix frontend test -- --run src/components/timetable/TimetableSyncPanel.test.tsx -> the focused component suite passes with the new badge-reconciliation assertions."
  - "V-02 [AC-04] npm --prefix frontend test -- --run 'src/app/(dashboard)/timetable/page.test.tsx' src/api/timetable-api.test.ts -> page callback and API contract suites pass."
  - "V-03 [AC-01, AC-02, AC-03, AC-04] npm --prefix frontend run build -> the Next.js frontend compiles successfully."
  - "V-04 [AC-01, AC-02, AC-03, AC-04] git diff --check -- frontend/src/components/timetable/TimetableSyncPanel.tsx frontend/src/components/timetable/TimetableSyncPanel.test.tsx -> no whitespace errors are reported."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope.md: user-requested reusable taskscope slot"
risks:
  - "Refreshing too early can reload pending state instead of the terminal snapshot; reconciliation must occur only after terminal polling has been observed."
  - "Awaiting a secondary refresh must not leave submission locks or polling flags active if that refresh fails."
stop_conditions:
  - "Stop with TASKSCOPE_CONFLICT if either write path becomes reserved or has unrelated changes relative to the recorded baseline."
  - "Stop and amend the scope if runtime evidence shows getSyncStatus remains failed after getSavedClassWeekStatus reports valid, because that indicates a backend status-aggregation defect rather than stale frontend state."
