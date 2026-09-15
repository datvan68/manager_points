slot_id: "taskscope-00"
generation: 3
task_id: "20260915T101517+0700-show-timetable-sync-pair-results"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 2
created_at: "2026-09-15T10:15:17+07:00"
updated_at: "2026-09-15T10:22:30+07:00"
base_commit: "e895bcbf849b3ef17f378266ba1c7b0cfa480b98"
task: "Show class and week details for timetable synchronization results"
pipeline: bug_fix
profile: Quick
objective: "Make single-week and bulk timetable synchronization results identify the affected system class, source class, week, outcome, and actionable failure reason so administrators can immediately locate every failed or skipped pair."
coordination:
  depends_on: []
  warnings: []
completion:
  completed_at: "2026-09-15T10:22:30+07:00"
  outcome: "Implemented detailed single and bulk timetable synchronization result presentation with localized known failure guidance and partial completion semantics."
  final_commit_or_state: "Working tree changes uncommitted at base commit e895bcbf849b3ef17f378266ba1c7b0cfa480b98."
  changed_paths:
    - "frontend/src/components/timetable/TimetableSyncPanel.tsx"
    - "frontend/src/components/timetable/TimetableSyncPanel.test.tsx"
    - "docs/task/taskscope.md"
  checks_passed:
    - "V-01: TimetableSyncPanel suite 20/20 passed."
    - "V-02: timetable page and API suites 9/9 passed."
    - "V-03: npm --prefix frontend run build passed compilation, TypeScript, static generation, and optimization."
    - "V-04: git diff --check passed for the two implementation/test files."
    - "Additional: npm --prefix frontend run typecheck passed."
  cleanup_pending: []
evidence:
  current_behavior: "TimetableSyncPanel retains each bulk pair's systemClassId, sourceLabel, week, result, and failure, but the bulk dialog renders only processed/success/failed/skipped counters. The single dialog shows only the source label and raw week value. Consequently a completed run can contain failures without identifying which system class or week failed, and raw source codes such as SOURCE_INVALID_SELECTION are not actionable to administrators."
  expected_behavior: "The progress dialog clearly identifies the class-week pair for a single run and exposes a bounded, readable per-pair result list for bulk runs, prioritizing unsuccessful items and explaining known source failures in Vietnamese while retaining their diagnostic code."
  root_cause: "The frontend maps API pair results into BulkPairState but never renders that detail; it also lacks presentation helpers for system-class names, human-readable week labels, result labels, and known failure-code explanations."
scope:
  inspect:
    - "frontend/src/components/timetable/TimetableSyncPanel.tsx:BulkPairState/single progress/bulk progress rendering"
    - "frontend/src/components/timetable/TimetableSyncPanel.test.tsx:single and bulk terminal-result tests"
    - "frontend/src/api/timetable-api.ts:TimetableBulkWeekSyncRequest/TimetableBulkPairStatus/TimetableWeekSyncStatus"
  write:
    - "frontend/src/components/timetable/TimetableSyncPanel.tsx"
    - "frontend/src/components/timetable/TimetableSyncPanel.test.tsx"
  preserve:
    - "Synchronization submission, polling, cooldown, coalescing, canonical badge refresh, and callback behavior remain unchanged."
    - "Backend endpoints, request/response DTOs, status persistence, and source-adapter behavior remain unchanged because the existing API already supplies pair selection and failure data."
    - "Raw unknown failure text remains visible; known failure codes gain explanatory copy without losing the original diagnostic code."
    - "The dialog remains usable with large batches and exposes status information to assistive technology."
  out:
    - "Backend synchronization, queue, status aggregation, and error-generation changes"
    - "Changes to timetable linkage, matching, or source selection rules"
    - "Settings, schemas, persisted data, deployment, and production operations"
acceptance_criteria:
  - "AC-01: A single-week progress dialog identifies the system class, linked source class, and a human-readable week label; a failed result shows an actionable Vietnamese explanation and retains the original failure code or message."
  - "AC-02: A bulk progress dialog renders a per-pair result list containing system class, source class, week, outcome, and failure reason when applicable; failed and skipped pairs are easy to locate rather than being represented only by aggregate counters."
  - "AC-03: SOURCE_INVALID_SELECTION is presented as an explanation that the saved source selection is no longer valid and instructs the administrator to relink or verify the source class, while the code remains available for diagnosis."
  - "AC-04: A terminal batch with failures is presented as partial completion, and a batch containing only skipped pairs is not presented with an unqualified successful-completion state."
  - "AC-05: The per-pair list is scroll-bounded for at least 68 pairs, keeps processing/count feedback intact, and supplies accessible labels or semantic status text."
  - "AC-06: Existing single/bulk synchronization, stale-snapshot protection, badge reconciliation, cooldown, and duplicate-submit regression tests continue to pass."
execution:
  - "E-01 [AC-01, AC-03] frontend/src/components/timetable/TimetableSyncPanel.test.tsx -> add single-result assertions for system class, source class, readable week, and localized SOURCE_INVALID_SELECTION guidance."
  - "E-02 [AC-02, AC-04, AC-05, AC-06] frontend/src/components/timetable/TimetableSyncPanel.test.tsx -> add bulk-result regressions for mixed success/failure/skipped identities, skipped-only completion semantics, and a large bounded result list."
  - "E-03 [AC-01, AC-02, AC-03, AC-05] frontend/src/components/timetable/TimetableSyncPanel.tsx -> add presentation helpers that resolve the system class and week labels, translate known failure codes, and render single and per-pair bulk details without changing API or polling state."
  - "E-04 [AC-02, AC-04, AC-05] frontend/src/components/timetable/TimetableSyncPanel.tsx -> derive terminal dialog tone/copy from success, failed, and skipped counts; visually prioritize unsuccessful pairs and constrain the result list height with scrolling."
verification:
  - "V-01 [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06] npm --prefix frontend test -- --run src/components/timetable/TimetableSyncPanel.test.tsx -> the focused component suite passes with detailed-result assertions."
  - "V-02 [AC-06] npm --prefix frontend test -- --run 'src/app/(dashboard)/timetable/page.test.tsx' src/api/timetable-api.test.ts -> page integration and API contract suites pass."
  - "V-03 [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06] npm --prefix frontend run build -> the Next.js frontend compiles successfully."
  - "V-04 [AC-01, AC-02, AC-03, AC-04, AC-05, AC-06] git diff --check -- frontend/src/components/timetable/TimetableSyncPanel.tsx frontend/src/components/timetable/TimetableSyncPanel.test.tsx -> no whitespace errors are reported."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope.md: user-requested reusable taskscope slot"
risks:
  - "System-class names and week labels must be resolved from the panel's current class/status data with a deterministic fallback when catalog metadata is missing."
  - "Rendering every pair without a bounded container can make a large batch dialog unusable; the list must remain scrollable while summary and close controls stay reachable."
  - "Skipped outcomes represent cooldown or request coalescing rather than source failures, so their copy and terminal state must remain distinct from failed results."
stop_conditions:
  - "Stop with TASKSCOPE_CONFLICT if either write path becomes reserved by another ready or in-progress scope, or contains unrelated changes relative to the recorded baseline."
  - "Stop and amend the scope if the current API response does not retain selection/failure per pair in runtime evidence, because that would require a backend contract change outside this scope."
