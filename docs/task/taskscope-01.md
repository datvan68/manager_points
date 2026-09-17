slot_id: "taskscope-01"
generation: 1
task_id: "20260917-080209-fix-class-selection-overflow"
scope_file: "docs/task/taskscope-01.md"
status: ready
scope_revision: 1
created_at: "2026-09-17T08:02:09+07:00"
updated_at: "2026-09-17T08:02:09+07:00"
base_commit: "14c53f25b0ca18d5079ce6aedd108f1b533c400f"
task: "Constrain the class-selection popover to the visible viewport"
pipeline: bug_fix
profile: Quick
objective: "Keep the desktop class-selection popover, its scrollable class list, and its Cancel/Confirm actions fully usable within the visible viewport at supported compact desktop heights."
coordination:
  depends_on: []
  warnings:
    - "frontend/src/components/grading/RecordSelectionUi.tsx and its test currently contain uncommitted student-search and draft-selection fixes; execution must preserve those changes and review only the task-specific diff."
completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []
evidence:
  current_behavior: "frontend/src/components/grading/RecordSelectionUi.tsx:RecordSelectionDialog gives the desktop PopoverContent an explicit viewport-based height/max-height, which suppresses the shared PopoverContent fallback to --radix-popover-content-available-height; in the supplied compact-height screenshot the list remains visible while the action footer extends below the visible window."
  expected_behavior: "The desktop popover height is capped by Radix's actual available-height value, only the class list scrolls, and the action footer remains visible without changing selection semantics or the mobile dialog."
  root_cause: "The desktop RecordSelectionDialog overrides the shared collision-aware available-height cap with h-[min(26rem,calc(100vh-3rem))] and max-h-[calc(100vh-3rem)], so the anchored popup can be taller than the space Radix reports around its trigger."
scope:
  inspect:
    - "frontend/src/components/ui/popover.tsx"
    - "frontend/src/components/grading/AddRecordView.tsx"
    - "frontend/src/components/grading/AddClassReportView.tsx"
  write:
    - "frontend/src/components/grading/RecordSelectionUi.tsx"
    - "frontend/src/components/grading/RecordSelectionUi.test.tsx"
  preserve:
    - "Class search, single/multiple draft selection, Cancel, Confirm, loading and load-more behavior remain unchanged."
    - "The mobile Dialog dimensions and behavior remain unchanged."
    - "Existing uncommitted mobile student search, stale-response protection and draft-selection fixes remain intact."
  out:
    - "No API, backend, class catalog, RBAC, persistence or shared Popover primitive changes."
    - "No redesign of the surrounding class-report or individual-record forms."
acceptance_criteria:
  - "AC-01: On desktop at a compact supported viewport height, the class-selection popover stays inside Radix's reported available height and the Cancel/Confirm footer is visible while the class list scrolls independently."
  - "AC-02: At normal desktop sizes, class search and single/multiple selection still support Cancel without committing and Confirm with the existing value contract."
  - "AC-03: The mobile class-selection Dialog retains its current sizing and interaction behavior."
execution:
  - "E-01 [AC-01,AC-02,AC-03] frontend/src/components/grading/RecordSelectionUi.tsx:RecordSelectionDialog -> cap the desktop PopoverContent with --radix-popover-content-available-height, keep the content column min-height constrained, and make the action footer non-shrinking so only the option list owns vertical scrolling; do not modify the mobile Dialog branch."
  - "E-02 [AC-01,AC-02,AC-03] frontend/src/components/grading/RecordSelectionUi.test.tsx -> add focused assertions for the collision-aware desktop height contract and persistent footer, while retaining the existing selection and mobile scenarios."
verification:
  - "V-01 [AC-01,AC-02,AC-03] npm --prefix frontend test -- \"src/components/grading/RecordSelectionUi.test.tsx\" \"src/components/grading/AddClassReportView.test.tsx\" -> both focused suites pass."
  - "V-02 [AC-01,AC-02,AC-03] npm --prefix frontend run typecheck -> exits 0."
  - "V-03 [AC-01,AC-02] authenticated dev UI at /students/record, compact desktop viewport: open Hệ thống ghi nhận lớp, open the class selector, scroll the list, then Cancel and reopen/Confirm without saving the form -> popup remains within the visible content area, footer stays visible, list scrolls, Cancel does not commit and Confirm does."
  - "V-04 [AC-03] authenticated dev UI at a <=767px viewport: open and close the class selector -> the centered mobile Dialog remains contained and usable with no regression to search or selection."
runtime_test:
  environment:
    frontend: "http://localhost:3000 (verify the repository-owned dev process before testing)"
    api: "http://localhost:8001 (verify identity and availability before any dependent scenario)"
    data_services: "Existing local dev MongoDB and Redis only; no direct data mutation is required."
  scope: "Use an existing authorized dev session and an existing class catalog; interact only with the unsaved record/report form."
  scenarios:
    - "Compact desktop: class selector remains bounded, list scrolls, footer stays visible, Cancel and Confirm behave correctly."
    - "Mobile width: the centered Dialog remains bounded and selection remains usable."
  pass_signal: "All selector controls remain inside the visible viewport and the existing selection contract is preserved at both breakpoints."
  cleanup: "Cancel or leave the unsaved form; do not submit a grading record or class report."
temporary_artifacts:
  create: []
  cleanup: []
  retain:
    - "docs/task/taskscope-01.md: user-requested reusable taskscope slot"
risks:
  - "A Tailwind arbitrary value that references the Radix CSS variable may be emitted incorrectly or fail when the variable is absent; inspect the rendered class and verify in the dev UI."
  - "Constraining the outer popover without preserving min-h-0/shrink behavior could clip the footer instead of transferring overflow to the option list."
stop_conditions:
  - "Stop if the target files acquire unrelated new edits after pinning and the task-specific patch cannot be isolated safely."
  - "Stop runtime verification if the local dev identity cannot be established, authentication is unavailable, or the page has no class catalog; report the unmet UI evidence instead of claiming AC-01 or AC-03 passed."
