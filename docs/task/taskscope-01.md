slot_id: "taskscope-01"
generation: 4
task_id: "20260904-135852-dormitory-roster-mobile-ui"
scope_file: "docs/task/taskscope-01.md"
status: completed
scope_revision: 1
created_at: "2026-09-04T13:58:52+07:00"
updated_at: "2026-09-04T14:06:10+07:00"
base_commit: "2628ff029da6c0a237b2175e5c1df57418722860"
task: "Refine dormitory roster mobile presentation"
pipeline: feature_development
profile: Full
objective: "At a viewport below the `lg` breakpoint, the dormitory roster has no redundant list wrapper, preserves bulk selection without native checkboxes, and keeps the edit dialog inset from viewport edges."

coordination:
  depends_on: []
  warnings: []

completion:
  completed_at: "2026-09-04T14:06:10+07:00"
  outcome: "success"
  final_commit_or_state: "Working tree contains the scoped frontend implementation and tests; no commit was requested."
  changed_paths: ["frontend/src/app/(dashboard)/dormitory/roster/page.tsx", "frontend/src/components/ui/ResponsiveDataView.tsx", "frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx", "frontend/src/components/ui/ResponsiveDataView.test.tsx", "frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx"]
  checks_passed: ["npm --prefix frontend test -- src/components/ui/ResponsiveDataView.test.tsx src/components/dormitory/DormitoryRegistrationEditModal.test.tsx", "npm --prefix frontend test -- src/app/(dashboard)/dormitory/roster/page.test.tsx", "npm --prefix frontend run typecheck", "git diff --check", "Manual mobile screenshot/AX verification of unwrapped cards and labelled toggle; modal inset verified by render test (direct Chrome click unavailable in CDP)."]
  cleanup_pending: []

evidence:
  current_behavior: "frontend/src/app/(dashboard)/dormitory/roster/page.tsx:470 renders a bordered translucent list wrapper around mobile item cards; frontend/src/components/ui/ResponsiveDataView.tsx:128 renders a native checkbox whenever selection is supplied; frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx:154 inherits DialogContent w-full at mobile."
  expected_behavior: "Mobile roster cards sit directly in the page layout, retain an accessible non-checkbox selection control for the current bulk delete/PDF flow, and the edit dialog has a 0.5rem viewport inset with safe vertical scrolling."
  root_cause: "The roster passes generic selection to ResponsiveDataView without a mobile presentation override, while its outer desktop table container and edit dialog have no mobile-specific layout variants."

scope:
  inspect: ["frontend/src/app/(dashboard)/dormitory/roster/page.tsx:ResponsiveDataView composition and FloatingActionBar", "frontend/src/components/ui/ResponsiveDataView.tsx:renderDefaultCard selection control", "frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx:DialogContent", "frontend/src/components/ui/ResponsiveDataView.test.tsx and frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx:nearest coverage"]
  write: ["frontend/src/app/(dashboard)/dormitory/roster/page.tsx:mobile list wrapper and ResponsiveDataView selection configuration", "frontend/src/components/ui/ResponsiveDataView.tsx:optional accessible mobile selection-control variant", "frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx:mobile DialogContent sizing", "frontend/src/components/ui/ResponsiveDataView.test.tsx:mobile selection-control regression coverage", "frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx:mobile dialog sizing regression coverage"]
  preserve: ["Desktop table wrapper and header checkbox", "selected row state and bulk delete/PDF actions", "existing authorization checks and infinite scrolling", "edit-form fields, validation, and save behavior"]
  out: ["Redesigning other ResponsiveDataView consumers", "Changing deletion/PDF APIs or bulk-action semantics", "Changing create, import, QR, or confirmation dialogs"]

acceptance_criteria:
  - "AC-01: Below `lg`, the roster has no visible border/background/shadow list wrapper around its item cards; at `lg` and above, the existing table container remains styled and clipped."
  - "AC-02: Below `lg`, each roster card exposes an accessible touch target to select or deselect that row without an input[type=checkbox]; it updates the existing selected state, and selected rows retain bulk delete/PDF actions."
  - "AC-03: Other ResponsiveDataView consumers retain their current mobile checkbox presentation unless they explicitly opt into the new variant."
  - "AC-04: The edit roster dialog is at most calc(100vw - 1rem) wide, at most calc(100dvh - 1rem) high, scrolls its content, and uses the existing desktop dimensions/padding from `sm` upward."

execution:
  - "E-01 [AC-02, AC-03] frontend/src/components/ui/ResponsiveDataView.tsx → add an opt-in mobile selection-control variant with per-row accessible naming; preserve the current checkbox as the default for all callers."
  - "E-02 [AC-01, AC-02] frontend/src/app/(dashboard)/dormitory/roster/page.tsx → restrict the list wrapper visual treatment to desktop and opt the roster into the labelled mobile selection control while retaining the selected-state callbacks and FloatingActionBar."
  - "E-03 [AC-04] frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx → align mobile DialogContent width, dynamic viewport height, overflow containment, and compact padding with the roster create dialog; retain the `sm` desktop variants."
  - "E-04 [AC-02, AC-03, AC-04] frontend/src/components/ui/ResponsiveDataView.test.tsx and frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx → cover the opt-in mobile control/default checkbox and edit-dialog mobile layout classes."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-01.md: user-requested reusable taskscope slot"]

verification:
  - "V-01 [AC-02, AC-03] npm --prefix frontend test -- src/components/ui/ResponsiveDataView.test.tsx → mobile control and default checkbox tests pass."
  - "V-02 [AC-04] npm --prefix frontend test -- src/components/dormitory/DormitoryRegistrationEditModal.test.tsx → edit dialog tests pass."
  - "V-03 [AC-01, AC-02, AC-04] npm --prefix frontend test -- src/app/(dashboard)/dormitory/roster/page.test.tsx → roster behavior tests pass."
  - "V-04 [AC-01, AC-02, AC-04] manual localhost /dormitory/roster at 360px viewport → no outer list card, no native checkbox, labelled selection toggle works, and edit dialog has 8px inset."

risks: ["ResponsiveDataView is shared; the new mobile selection presentation must be opt-in so existing list workflows do not change.", "Removing native checkboxes must not make mobile bulk actions undiscoverable or inaccessible."]
stop_conditions: ["The requested mobile selection presentation requires changing bulk-action behavior or permission rules.", "A newly active taskscope or dirty change reserves any listed implementation path before execution starts."]
