slot_id: "taskscope-01"
generation: 5
task_id: "20260904-144138-student-spotlight-infinite-lists"
scope_file: "docs/task/taskscope-01.md"
status: blocked
scope_revision: 1
created_at: "2026-09-04T14:41:38+07:00"
updated_at: "2026-09-04T15:05:00+07:00"
base_commit: "e1050534417199f7927fb55122e6d842f06cd2ab"
task: "Paginate and virtualize student recognition lists"
pipeline: feature_development
profile: Full
environment: development
risk_level: high
objective: "All eligible students are reachable in the three recognition lists: rewards/bonus require at least one category record; discipline requires at least three. Load pages on scroll and virtualize desktop/mobile rows."

coordination:
  depends_on: []
  warnings: ["V-04 chưa chạy: workspace không có browser fixture/mock API >100 sinh viên và không có môi trường dữ liệu dashboard khả dụng; không thể xác nhận DOM/network behavior thủ công."]
  evidence: "Slot 00 (20260904-142909-dormitory-mobile-scroll-popovers) is in_progress and reserves dormitory pages/components/tests only; its inspect paths are also disjoint. Slots 01/02 are completed; reuse lowest completed slot 01. Existing dirty paths belong to slot 00 and are disjoint. Branch main."
  rules: ["safety 3.3.0", "global 3.3.6", "orchestrator 3.3.7", "pipeline 3.3.5", "taskscope 3.3.7", "implement_feature 3.0.0"]

completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: ["V-01 backend system.service.spec.ts + student-highlights.controller.spec.ts: 60 passed", "V-02 frontend focused tests: 27 passed", "V-03 frontend typecheck và backend build: passed", "V-05 git diff --check: passed"]
  cleanup_pending: ["V-04 browser synthetic/mock verification"]

evidence:
  current_behavior: "system.service.ts:getDashboardMetrics limits each category aggregation to 10 after grouping; discipline has no minimum count. StudentSpotlightPanel.tsx:renderList additionally slices to 10 and labels use array length. Desktop has three scrolling columns; mobile opens category popovers. DashboardPage loads server metrics through systemApi."
  expected_behavior: "AC-01..05"
  root_cause: "Two fixed preview caps and no paginated category data source; contentVisibility does not remove offscreen rows from the DOM."

scope:
  inspect:
    - "backend/src/system/system.service.ts:getDashboardMetrics role resolution, semester selection, getHighlightBaseStages, category aggregates"
    - "backend/src/system/system.controller.ts:getDashboardMetrics guards"
    - "backend/src/system/dto/system.dto.ts:query validation conventions"
    - "frontend/src/components/dashboard/dashboard-helpers.ts:StudentHighlightItem (type only; local aggregate helper is not the page data source)"
    - "frontend/src/components/ui/ResponsiveDataView.tsx:useVirtualizer pattern"
    - "frontend/src/app/(dashboard)/page.test.tsx:dashboard loading regression"
    - "frontend/package.json and backend/package.json:test/typecheck/build scripts; installed @tanstack/react-virtual"
  write:
    - "backend/src/system/system.service.ts"
    - "backend/src/system/system.controller.ts"
    - "backend/src/system/dto/system.dto.ts"
    - "backend/src/system/system.service.spec.ts"
    - "backend/src/system/student-highlights.controller.spec.ts"
    - "frontend/src/api/system-api.ts"
    - "frontend/src/api/system-api.test.ts"
    - "frontend/src/app/(dashboard)/page.test.tsx"
    - "frontend/src/app/(dashboard)/page.tsx"
    - "frontend/src/components/dashboard/StudentSpotlightPanel.tsx"
    - "frontend/src/components/dashboard/StudentSpotlightPanel.test.tsx"
    - "frontend/src/components/dashboard/dashboard-responsive.test.tsx"
  preserve: ["Existing role resolution and teacher assigned-class/student-self restrictions", "Active, non-deleted records in selected semester", "Category-specific ranking, card fields and student-profile navigation", "Student personal spotlight", "Other dashboard KPIs and metrics response compatibility", "Desktop columns and mobile accessible popovers"]
  out: ["Dormitory work", "Changing record creation, scores, KPI attention thresholds or category semantics", "Database/schema/index migrations", "New dependencies", "Production/runtime data access", "Local dashboard aggregate helper rewrite"]

acceptance_criteria:
  - "AC-01: For a fixed semester and authorized scope, every distinct student with rewards count >=1, bonus count >=1 (including zero net points), or discipline count >=3 is reachable; counts 0/1/2 are excluded from discipline. Headers show full eligible totals, not loaded lengths."
  - "AC-02: GET /system/student-highlights accepts category=discipline|rewards|bonus, optional semesterId, page>=1 and limit=20 by default (1..100); returns {items,total,page,limit,hasMore,semesterId}. Invalid supplied inputs return 400. Empty/no-semester results have zero total and hasMore=false. Apply eligibility before pagination/counting; keep one row per existing student. Stable category ranking ends with student ID as tie-breaker."
  - "AC-03: Each category fetches bounded pages independently near its scroll end, reaches beyond 10 and beyond one page, deduplicates by studentId, prevents concurrent duplicate loads and stops at hasMore=false. Loading, empty, recoverable error/retry and terminal states are distinct; retries retain loaded rows."
  - "AC-04: Desktop lists and opened mobile popovers use @tanstack/react-virtual with the actual bounded scroll root, measured variable-height rows, stable keys and overscan. Mounted student rows remain bounded by visible range plus overscan as loaded data grows; hidden layouts do not trigger extra page loads. Keyboard/touch scrolling and profile buttons remain usable."
  - "AC-05: Semester changes, dashboard refresh and role/user changes reset category data, pagination and scroll; obsolete responses cannot append into new scope. Server guards and filtering prevent cross-class/student leakage, including users with no assigned classes. Personal student spotlight and existing metrics consumers retain behavior."

execution:
  - "E-01 [AC-01,02,05] system.service.ts: add getStudentHighlights using the existing role/semester resolution and highlight filters through narrowly shared helpers; do not call the entire metrics computation per page. Group by student/category, apply minimum count, preserve projections and ranking, add ID tie-breaker, and return bounded items plus matching total. Existing metrics preview arrays may remain capped for compatibility; new lists must not consume them as complete data."
  - "E-02 [AC-02,05] system.dto.ts and system.controller.ts: add validated GetStudentHighlightsQueryDto and guarded endpoint matching dashboard authentication/permissions; pass authenticated requester, never accept client-supplied ownership scope."
  - "E-03 [AC-02,03,05] system-api.ts: add typed request/response using existing httpClient/handleResponse and StudentHighlightItem. page.tsx: supply semester and refresh identity tied to the displayed successful metrics load, so refresh also invalidates categories."
  - "E-04 [AC-01,03,04,05] StudentSpotlightPanel.tsx: isolate operator hooks from the early student return; replace slice/map list flow with per-category paged state and a reusable internal virtualized list component. Share category data between layouts, use server totals and reset/invalidate stale requests; retain existing cards and popover interactions."
  - "E-05 [AC-01,02,05] system.service.spec.ts and new student-highlights.controller.spec.ts: cover thresholds, >20 students, ties, totals, last/empty pages, zero-point bonus, semester/status/deletion filters, teacher/student isolation and DTO/guard wiring with mocks; no runtime database."
  - "E-06 [AC-01..05] system-api.test.ts and new StudentSpotlightPanel.test.tsx: cover URL/response, sequential load/dedup/end/retry, totals, stale response rejection, refresh/semester reset and virtual range behavior. Update only affected assertions in dashboard-responsive.test.tsx while preserving accessibility requirements."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-01.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01,02,05] npm --prefix backend test -- system.service.spec.ts student-highlights.controller.spec.ts --runInBand -> pass."
  - "V-02 [AC-01..05] npm --prefix frontend test -- src/api/system-api.test.ts src/components/dashboard/StudentSpotlightPanel.test.tsx src/components/dashboard/dashboard-responsive.test.tsx 'src/app/(dashboard)/page.test.tsx' -> pass."
  - "V-03 [AC-02..05] npm --prefix frontend run typecheck; npm --prefix backend run build -> both pass."
  - "V-04 [AC-03,04,05] Browser with synthetic/mocked >100-student category pages at 1280px and 390px: scroll each category to last student, confirm bounded network pages and DOM row count, no duplicates/hidden-layout fetches, mobile popover scroll and keyboard profile navigation; switch semester while request pending and verify no stale rows."
  - "V-05 [AC-01..05] Independent focused review of endpoint isolation, backward compatibility and request-race handling; git diff --check -> pass. Record actual checks and final paths before marking completed."

risks: ["Cross-package paginated API must preserve existing personal-data visibility; requires Full review.", "Offset pages are deterministic for unchanged data; concurrent record changes can move ranks. Deduplicate appended IDs and refresh from page one; snapshot consistency is outside scope.", "Desktop/mobile roots coexist in markup; hidden roots and portal measurements can accidentally trigger extra loads."]
stop_conditions: ["Active reservations or dirty changes overlap listed writes at execution start", "Additional write paths, authorization changes, dependency or persistence changes are required", "Required mocked browser verification cannot run: record blocker rather than claim completion"]
