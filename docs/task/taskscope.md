slot_id: "taskscope-00"
generation: 1
task_id: "20260915T094940+0700-fix-timetable-source-invalid-selection"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-15T09:49:40+07:00"
updated_at: "2026-09-15T09:52:39+07:00"
base_commit: "28206c66a6247a0f891cd730a2793695522c111d"
task: "Recover timetable synchronization from a stale source selection page"
pipeline: bug_fix
profile: Quick
objective: "Timetable synchronization transparently reloads the source workflow once when a reused page cannot resolve a valid saved selection, while genuinely invalid selections still fail closed."
coordination:
  depends_on: []
  warnings: []
completion:
  completed_at: "2026-09-15T09:52:39+07:00"
  outcome: "Implemented bounded stale-page recovery for SOURCE_INVALID_SELECTION and added regressions for successful fresh replay and persistent invalid selection."
  final_commit_or_state: "Working tree changes uncommitted at base commit 28206c66a6247a0f891cd730a2793695522c111d."
  changed_paths:
    - "backend/src/timetable/school-timetable.adapter.ts"
    - "backend/src/timetable/school-timetable.adapter.spec.ts"
    - "docs/task/taskscope.md"
  checks_passed:
    - "V-01: adapter suite 11/11 passed."
    - "V-02: bulk performance suite 3/3 passed with request-count baselines."
    - "V-03: npm --prefix backend run build passed."
    - "V-04: git diff --check passed for both implementation files."
  cleanup_pending: []
evidence:
  current_behavior: "User-reported synchronization returns SOURCE_INVALID_SELECTION; backend/src/timetable/school-timetable.adapter.ts:lookup/loadFreshPage reuses SessionContext.page, but only retries SOURCE_MARKUP_CHANGED, while postback/submitSearch emit SOURCE_INVALID_SELECTION when the requested option is absent from that reused dependent-dropdown page. Commit 28206c66 introduced the reusable page state and this asymmetric recovery path."
  expected_behavior: "Treat an invalid selection from an already reused page as stale page state, discard that page/filter state, and replay one fresh lookup; retain SOURCE_INVALID_SELECTION when the fresh source page also lacks the requested value."
  root_cause: "The page-cache optimization retains an ASP.NET dependent-dropdown page between synchronization items, but lookup does not invalidate and replay that cached page for SOURCE_INVALID_SELECTION, so a selection valid in a fresh context fails against stale option markup."
scope:
  inspect:
    - "backend/src/timetable/school-timetable.adapter.ts"
    - "backend/src/timetable/school-timetable.adapter.spec.ts"
    - "backend/src/timetable/timetable-sync.service.ts:fetchWithRetry"
    - "backend/src/timetable/timetable.config.ts"
  write:
    - "backend/src/timetable/school-timetable.adapter.ts"
    - "backend/src/timetable/school-timetable.adapter.spec.ts"
  preserve:
    - "Source credentials remain internal and source-origin, timeout, cookie isolation, serialization, coalescing, and cache contracts remain unchanged."
    - "Recovery is bounded to the existing two-attempt lookup and only applies when the failed attempt used SessionContext.page."
    - "A selection absent from a fresh source workflow still returns SOURCE_INVALID_SELECTION; errors are not swallowed or reclassified."
  out:
    - "Frontend behavior and API response contracts"
    - "Timetable sync queue, snapshots, settings, schemas, and persisted data"
    - "Source credentials, deployment, and production runtime operations"
acceptance_criteria:
  - "AC-01: Given a reused source page whose dependent dropdown does not contain the next valid selection, the adapter clears the stale page/filter state, replays one fresh lookup, and returns the timetable result without SOURCE_INVALID_SELECTION."
  - "AC-02: Given a selection absent after the fresh replay, the adapter stops after the bounded retry and returns SOURCE_INVALID_SELECTION."
  - "AC-03: Existing session isolation, request coalescing/cache behavior, session-expiry recovery, and bulk request-count expectations continue to pass."
execution:
  - "E-01 [AC-01, AC-02] backend/src/timetable/school-timetable.adapter.spec.ts -> add focused fetch-sequence regressions for a stale reused page that succeeds after a fresh reload and a persistently absent option that still fails after one replay."
  - "E-02 [AC-01, AC-02] backend/src/timetable/school-timetable.adapter.ts:lookup -> extend cached-page recovery to SOURCE_INVALID_SELECTION, clearing only SessionContext.page and filters before the existing second attempt."
verification:
  - "V-01 [AC-01, AC-02, AC-03] npm --prefix backend test -- --runTestsByPath src/timetable/school-timetable.adapter.spec.ts --runInBand -> the adapter suite passes with the new recovery and bounded-failure assertions."
  - "V-02 [AC-03] npm --prefix backend test -- --runTestsByPath src/timetable/timetable-bulk-performance.spec.ts --runInBand -> all bulk request-count baselines pass."
  - "V-03 [AC-01, AC-02, AC-03] npm --prefix backend run build -> Nest backend compiles successfully."
  - "V-04 [AC-01, AC-02, AC-03] git diff --check -- backend/src/timetable/school-timetable.adapter.ts backend/src/timetable/school-timetable.adapter.spec.ts -> no whitespace errors are reported."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope.md: user-requested reusable taskscope slot"
risks:
  - "A broad retry could hide a genuinely invalid saved selection; constrain recovery to an attempt that started from a cached SessionContext.page and preserve the second failure."
stop_conditions:
  - "Stop with TASKSCOPE_CONFLICT if either write path becomes reserved or has unrelated changes relative to the recorded baseline."
  - "Stop and amend the scope if the regression shows SOURCE_INVALID_SELECTION originates from a fresh page rather than reused page state, because the confirmed fix boundary has changed."
