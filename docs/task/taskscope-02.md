slot_id: "taskscope-02"
generation: 1
task_id: "20260904-140405-dormitory-rooms-mobile-ui"
scope_file: "docs/task/taskscope-02.md"
status: blocked
scope_revision: 1
created_at: "2026-09-04T14:04:05+07:00"
updated_at: "2026-09-04T14:04:05+07:00"
base_commit: "2628ff029da6c0a237b2175e5c1df57418722860"
task: "Fix Rooms mobile presentation"
pipeline: bug_fix
profile: Quick
objective: "Below lg, show single-row full-width search, inset room dialogs, checkbox-free selection, and unwrapped room cards."

coordination:
  depends_on: ["20260904-135852-dormitory-roster-mobile-ui"]
  warnings:
    - "TASKSCOPE_WARNING: dependency owns dirty frontend/src/components/ui/ResponsiveDataView.tsx; await terminal status and verified toggle API."
    - "TASKSCOPE_CONFLICT: docs/task/taskscope.md is empty legacy reserved input; ownership/boundaries require explicit classification before execution. Numbered slot 01 is in_progress; retained untouched."

completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []

evidence:
  current_behavior: "BuildingsPage renders mobile search above an unconditional toolbar; room DialogContent inherits w-full; list has unconditional decorative wrapper and default checkbox selection. Code inspection only."
  expected_behavior: "AC-01 through AC-04."
  root_cause: "Page composition lacks mobile variants for toolbar visibility, dialog width, list decoration, and selection control."

scope:
  inspect: ["frontend/src/components/ui/ResponsiveDataView.tsx:selection.mobileControl/getMobileSelectionLabel", "frontend/src/components/ui/dialog.tsx:DialogContent", "frontend/package.json:scripts"]
  write: ["frontend/src/app/(dashboard)/dormitory/buildings/page.tsx", "frontend/src/app/(dashboard)/dormitory/buildings/page.test.tsx"]
  preserve: ["Desktop presentation; RBAC; CRUD payloads, validation and errors; bulk selection/deletion; virtualization, infinite-scroll root/sentinel, search and pagination"]
  out: ["Shared-component writes; other tabs; area/bed dialogs; backend"]

acceptance_criteria:
  - "AC-01: Open mobile search occupies toolbar width with close control; other toolbar actions disappear without a second row; closing restores actions and retains query."
  - "AC-02: Add/edit room dialogs have at least 8px viewport inset, internal vertical scrolling, and reachable close/save controls."
  - "AC-03: Mobile cards use labeled aria-pressed selection buttons, no visible checkboxes; select/deselect and authorized bulk actions still work."
  - "AC-04: Mobile list has no outer background/border/shadow/rounding; individual room cards and scrolling remain."

execution:
  - "E-01 [AC-01,AC-02,AC-04] buildings/page.tsx: make toolbar mutually exclusive on mobile, constrain room dialog width/height, restrict wrapper decoration to lg."
  - "E-02 [AC-03] buildings/page.tsx: opt into verified mobileControl=toggle with room-specific labels."
  - "E-03 [AC-01..04] buildings/page.test.tsx: extend compact-search coverage and add dialog, selection, wrapper regressions."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-02.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..04] npm --prefix frontend test -- 'src/app/(dashboard)/dormitory/buildings/page.test.tsx' → pass."
  - "V-02 [AC-01..04] npm --prefix frontend run typecheck → pass."
  - "V-03 [AC-01..04] Browser at 375/390/768px and desktop 1280px: verify criteria, no horizontal overflow, search focus/close, add/edit scrolling, selection and load-more using fixtures; no real-data deletion."

risks: ["Shared toggle API is currently unverified work in progress."]
stop_conditions: ["Unresolved coordination blockers; dirty write targets; shared-component changes required."]
