slot_id: "taskscope-00"
generation: 1
task_id: "20260904-142909-dormitory-mobile-scroll-popovers"
scope_file: "docs/task/taskscope.md"
status: completed
scope_revision: 1
created_at: "2026-09-04T14:29:09+07:00"
updated_at: "2026-09-04T14:41:00+07:00"
base_commit: "e1050534417199f7927fb55122e6d842f06cd2ab"
task: "Hide mobile scrollbars and use immediate-choice popovers"
pipeline: bug_fix
profile: Quick
objective: "Below lg, both dormitory tabs and registration/room forms scroll invisibly; select choices commit immediately inside popovers."

coordination:
  depends_on: []
  warnings: []
  evidence: "Slots 01/02 completed; worktree clean. User explicitly requests this empty legacy path; initialize lifecycle in place."

completion:
  completed_at: "2026-09-04T14:41:00+07:00"
  outcome: "Implemented mobile-scoped scrollbar suppression and immediate-choice dormitory popovers while preserving desktop Select behavior and form callbacks."
  final_commit_or_state: "Working tree changes retained; no commit requested."
  changed_paths: ["frontend/src/app/(dashboard)/dormitory/roster/page.tsx", "frontend/src/app/(dashboard)/dormitory/buildings/page.tsx", "frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx", "frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx", "frontend/src/components/dormitory/DormitoryChoicePopover.tsx"]
  checks_passed: ["npm --prefix frontend test -- 'src/app/(dashboard)/dormitory/roster/page.test.tsx' 'src/app/(dashboard)/dormitory/buildings/page.test.tsx' src/components/dormitory/DormitoryRegistrationEditModal.test.tsx (20 passed)", "npm --prefix frontend run typecheck", "git diff --check"]
  cleanup_pending: []

evidence:
  current_behavior: "Both pages use custom-scrollbar and mobileClassName without hiding; form dialogs overflow-y-auto. SelectTrigger focuses a search input; SelectItem already commits/closes. Code inspection only."
  expected_behavior: "AC-01..03"
  root_cause: "Missing scoped scrollbar suppression; searchable Select instead of button-triggered Popover."

scope:
  inspect: ["frontend/src/components/ui/ResponsiveDataView.tsx", "frontend/src/components/ui/select.tsx", "frontend/src/components/ui/popover.tsx", "frontend/src/globals.css", "frontend/package.json"]
  write:
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx"
    - "frontend/src/app/(dashboard)/dormitory/buildings/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/buildings/page.test.tsx"
    - "frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx"
    - "frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx"
    - "frontend/src/components/dormitory/DormitoryChoicePopover.tsx"
  preserve: ["RBAC, locked Student fields, gender/room restrictions, validation, payloads, explicit form saving, virtualization/load-more, desktop behavior"]
  out: ["Shared UI/CSS changes, calendar/student search redesign, public registration, area/bed dialogs, backend"]

acceptance_criteria:
  - "AC-01: Below 1024px, both list roots and add/edit registration/room dialogs hide scrollbar tracks/thumbs while touch/wheel/keyboard scrolling and load-more work."
  - "AC-02: Mobile gender/room-type choices in registration forms and area/room-type/status choices in room forms open button-triggered popovers; one choice updates the field and closes only the popover, without confirmation or form submission. Disabled fields cannot open."
  - "AC-03: Choices show current value, support keyboard activation/Escape and return focus; scrollable options hide scrollbars; popovers and save/close controls remain reachable within viewport."

execution:
  - "E-01 [AC-01] Both pages and edit modal: apply mobile-scoped scrollbar CSS utilities to actual scrolling roots, retaining overflow and refs."
  - "E-02 [AC-02,03] Add DormitoryChoicePopover using existing Popover; integrate only mobile form selects in those three consumers, preserving callbacks and disabled rules."
  - "E-03 [AC-01..03] Extend the three corresponding test files with scroll classes, immediate selection/close, disabled, focus and unchanged save-payload regressions."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-01..03] npm --prefix frontend test -- 'src/app/(dashboard)/dormitory/roster/page.test.tsx' 'src/app/(dashboard)/dormitory/buildings/page.test.tsx' src/components/dormitory/DormitoryRegistrationEditModal.test.tsx → all pass."
  - "V-02 [AC-01..03] npm --prefix frontend run typecheck → pass."
  - "V-03 [AC-01..03] Browser fixtures at 375/768/1023px and desktop 1280px: verify hidden scrollbars while scrolling, load-more, all four forms, immediate choice, focus, viewport fit and desktop preservation."

risks: ["Popover portal must remain interactive inside Dialog focus handling."]
stop_conditions: ["Dirty write targets or active reservations; required writes outside scope."]
