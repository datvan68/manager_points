slot_id: "taskscope-00"
generation: 21
task_id: "20260903-141128-replace-activities-menu-with-dormitory"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-03T14:11:28+07:00"
updated_at: "2026-09-03T14:18:30+07:00"
base_commit: "a0dd90e4a0a36502527f3141c2a37615f493f83c"
task: "Replace the Activities sidebar entry with Dormitory"
pipeline: feature_development
profile: Quick
objective: "Show an authorized KTX navigation entry to /dormitory in place of Activities on desktop and mobile."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-03T14:18:30+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree contains the scoped implementation changes; no commit created."
  changed_paths: ["frontend/src/components/layout/Sidebar.tsx", "frontend/src/components/layout/Sidebar.test.tsx", "docs/task/taskscope.md"]
  checks_passed: ["npm --prefix frontend test -- src/components/layout/Sidebar.test.tsx (13 passed)", "npm --prefix frontend run typecheck", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/components/layout/Sidebar.tsx:allMenuItems exposes Compass/Hoạt động at /activities and bypasses mapping checks for every signed-in user; Sidebar.test.tsx asserts that bypass."
  expected_behavior: "The sidebar exposes Building2/KTX at /dormitory only for administrators or users satisfying the active non-empty dormitory route mapping, matching SubsystemPopup."
  root_cause: "The primary navigation still contains the legacy activities item rather than the dormitory module."

scope:
  inspect: ["frontend/src/components/popups/SubsystemPopup.tsx:checkModulePermission dormitory rule"]
  write: ["frontend/src/components/layout/Sidebar.tsx:allMenuItems and visibility filter", "frontend/src/components/layout/Sidebar.test.tsx:sidebar link and RBAC coverage"]
  preserve: ["Other menu routes, desktop collapse behavior, mobile search/profile behavior, dynamic mapping refresh, and server-side RBAC"]
  out: ["Subsystem popup contents", "Dormitory page/API/schema/permission mapping changes", "Activities route behavior", "Other navigation redesign"]

acceptance_criteria:
  - "AC-01: Desktop and mobile render KTX with the dormitory icon and href /dormitory; neither exposes the former Activities primary-navigation entry."
  - "AC-02: KTX is visible to administrators; for non-administrators it is visible only when /dormitory has an active mapping with one or more permissions and the user satisfies its any/all check type."
  - "AC-03: A missing, inactive, empty, or unavailable dormitory mapping does not expose KTX to a non-administrator."
  - "AC-04: Focused sidebar tests cover the replacement and its allowed/denied dynamic-mapping cases."

execution:
  - "E-01 [AC-01..AC-03] Sidebar.tsx:allMenuItems/filter → replace the Activities item with Building2/KTX at /dormitory; apply the established strict dormitory mapping rule before generic route filtering."
  - "E-02 [AC-01..AC-04] Sidebar.test.tsx → replace Activities expectations and add administrator, satisfied any/all, and unavailable-mapping KTX assertions."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..AC-04] npm --prefix frontend test -- src/components/layout/Sidebar.test.tsx → all focused tests pass."
  - "V-02 [AC-01..AC-03] npm --prefix frontend run typecheck → exits 0."
  - "V-03 [AC-01..AC-04] git diff --check → no whitespace errors."

risks: ["A relaxed KTX fallback would expose a module whose popup intentionally requires an active, non-empty mapping; keep the strict rule aligned."]
stop_conditions: ["Stop if the intended KTX visibility policy differs from SubsystemPopup, or implementation requires a route, permission, API, or schema change."]
