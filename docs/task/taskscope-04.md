slot_id: "taskscope-04"
generation: 1
task_id: "20260905-091059-align-roster-ui-design-system"
scope_file: "docs/task/taskscope-04.md"
status: completed
scope_revision: 3
created_at: "2026-09-05T09:10:59+07:00"
updated_at: "2026-09-05T09:27:00+07:00"
base_commit: "33cc462b4456ed41267fac118d3505604dd74d7f"
task: "Align newly created KTX roster UI with the repository design system"
pipeline: feature_development
profile: Full
environment: development
risk_level: medium
objective: "Make the new KTX progress/result, reconciliation and manual Student-linking interfaces visually and behaviorally consistent with docs/design/DESIGN.md across desktop and mobile, while preserving the implemented operation and identity contracts."

coordination:
  depends_on: ["20260905-081905-adjust-roster-operation-linking"]
  warnings:
  reservation_check: "Resume verified on branch main at 5cb12a3b3f41f8cf519f6bf99d98315fe1297ae5. No taskscope-03.md exists and the working tree is clean; no competing reservation or unresolved deletion remains."
  resume: "Resumed explicitly by the user; revalidated source/test baselines against the current HEAD before mutation."

completion:
  completed_at: "2026-09-05T09:27:00+07:00"
  outcome: "completed"
  final_commit_or_state: "Working tree contains only the scoped UI, test, and taskscope changes; no commit created."
  changed_paths:
    - "docs/task/taskscope-04.md"
    - "frontend/src/components/dormitory/RosterOperationProgressDialog.tsx"
    - "frontend/src/components/dormitory/RosterOperationProgressDialog.test.tsx"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.tsx"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.test.tsx"
    - "frontend/src/components/dormitory/DormitoryRosterImportModal.tsx"
    - "frontend/src/components/dormitory/DormitoryRosterImportModal.test.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx"
  checks_passed:
    - "V-01/V-02: focused roster/import/link/API tests passed, 29 tests total."
    - "V-03: scoped token inspection completed; remaining prohibited tokens are pre-existing legacy page/primitive usages outside the changed interaction surfaces."
    - "V-04: frontend typecheck and scoped git diff --check passed."
    - "V-05: browser checks measured scrollWidth == clientWidth at 375, 768, and 1280px; 375px manual-link modal opened with no overflow and accessible empty state."
  cleanup_pending: []

evidence:
  current_behavior:
    - "docs/design/DESIGN.md is the UI source of truth: compact glass surfaces, white reflective borders, #1E293B/#64748B text, semantic translucent states, rounded-xl controls, rounded-2xl large containers, soft shadows, and rounded-full only for avatars."
    - "RosterOperationProgressDialog and RosterStudentLinkModal use plain opaque/default dialog surfaces and slate borders instead of the required glass material; the progress bar and Student marker use forbidden rounded-full."
    - "The manual-link list keeps a four-column table at mobile widths and truncates Student name/class without a full-value fallback; row selection exposes no radio/aria-pressed state."
    - "Import stores detailed row outcomes in the closed import popup while the visible terminal operation dialog shows counters only; its toast directs users to inaccessible detail."
    - "Reconciliation feeds processed+1 as an invented total while more cursor pages exist, so a determinate percentage is visually misleading. Browser verification at 375/768/1280 remains unrun."
  expected_behavior: "Every new surface follows the documented material, radius, color, density, responsive and interaction rules; operation results remain actionable and progress semantics remain truthful."
  root_cause: "The implementation reused Dialog behavior but did not apply the repository design tokens or define separate responsive/result states for the new workflows."

scope:
  inspect:
    - "docs/design/DESIGN.md: canonical design rules"
    - "docs/design/DESIGN.compact.md: compact token reference"
    - "frontend/src/app/(dashboard)/students/record/page.tsx:progress/result dialog interaction reference"
    - "frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx:large KTX modal layout reference"
    - "frontend/src/components/ui/button.tsx and dialog.tsx:shared primitives"
    - "frontend/package.json: test and typecheck scripts"
  write:
    - "frontend/src/components/dormitory/RosterOperationProgressDialog.tsx"
    - "frontend/src/components/dormitory/RosterOperationProgressDialog.test.tsx"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.tsx"
    - "frontend/src/components/dormitory/RosterStudentLinkModal.test.tsx"
    - "frontend/src/components/dormitory/DormitoryRosterImportModal.tsx"
    - "frontend/src/components/dormitory/DormitoryRosterImportModal.test.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx"
  preserve:
    - "Existing DORM_REG permissions, API payloads, Student eligibility, matching/uniqueness rules and backend behavior."
    - "Import/delete batching, acknowledged/unconfirmed/unsent accounting, no automatic retry, and pending-dialog dismissal prevention."
    - "Search debounce/abort, pagination, explicit manual confirmation, sanitized errors, focus restoration and list refresh."
    - "Existing unrelated KTX create/edit/room/PDF/table behavior and shared primitive contracts."
  out:
    - "Backend/API/business-rule changes, shared design documentation or primitive redesign, other pages/modals, new dependencies, and production/runtime data access."

acceptance_criteria:
  - "AC-01: Progress/result, reconciliation-confirmation and manual-link DialogContent use the documented compact glass surface, white reflective border, rounded-2xl container, soft shadow, backdrop blur, #1E293B main text and #64748B secondary text. Nested cards/inputs/actions use rounded-xl, compact gaps/padding and translucent semantic colors; touched UI contains no rounded-full except avatars, forbidden smaller radii, dark borders or heavy shadow."
  - "AC-02: Import, delete and reconciliation share one coherent progress/result hierarchy: title, concise state, progress/scanned count, semantic counter cards, actionable warning/error area and footer action. Import terminal state exposes grouped row numbers/reasons inside the visible result dialog; no copy refers to hidden content."
  - "AC-03: Determinate bars show acknowledged processed/known total and reach 100% only when all submitted items have confirmed outcomes. Reconciliation, whose total is unknown during cursor scanning, renders an accessible indeterminate state plus the exact scanned count until the final response; it never fabricates total=processed+1."
  - "AC-04: At widths 375, 768 and 1280px, the Student-linking modal has no horizontal overflow and preserves complete decision-critical code/name/class information. Desktop may use a compact table; mobile uses stacked cards or an equivalent full-detail layout. Selection uses radio/radiogroup or aria-pressed semantics, announces the selected Student, and keeps pagination/loading/empty/error states readable."
  - "AC-05: All touched actions retain visible hover/focus-visible/disabled states, minimum practical touch targets, labelled icon controls, inline actionable errors and logical focus restoration. Decorative icons are hidden from assistive technology; progress changes use aria-live; width/spinner motion has a prefers-reduced-motion fallback."
  - "AC-06: Confirming import/delete still closes the input/confirmation surface before opening progress; pending operations cannot dismiss; terminal and partial results remain until explicit close. Styling changes do not alter request counts, payloads, selection retention, reconciliation writes or manual-link behavior."
  - "AC-07: Focused interaction tests and synthetic visual checks cover every state at 375/768/1280px, including long Vietnamese names/classes/reasons, zero and large counters, interrupted operations, keyboard-only selection and reduced motion. No overflow, inaccessible truncation or design-token violation remains in the touched UI."

execution:
  - "E-01 [AC-01,03,05,06] RosterOperationProgressDialog.tsx + test: apply canonical glass/radius/typography/state tokens; support determinate and indeterminate presentation, tabular counters, reduced motion and accessible pending/terminal states without changing lifecycle callbacks."
  - "E-02 [AC-01,02,06] DormitoryRosterImportModal.tsx + test: pass grouped acknowledged row outcomes into the visible operation result dialog, remove hidden-detail copy, and retain file/reset/close behavior."
  - "E-03 [AC-01,03,06] roster/page.tsx + test: style the reconciliation confirmation consistently and replace fabricated reconciliation percentage with scanned-count/indeterminate progress; preserve cursor calls and operation locks."
  - "E-04 [AC-01,04,05,06] RosterStudentLinkModal.tsx + test: apply glass design tokens, add responsive desktop/mobile candidate layouts, expose complete identity details and semantic selection, and retain search/pagination/link/error/focus behavior."
  - "E-05 [AC-01..07] Run focused tests/typecheck, inspect prohibited-token searches and scoped diff, then perform synthetic visual/keyboard verification before completion."

verification:
  - "V-01 [AC-01..06] npm --prefix frontend test -- src/components/dormitory/RosterOperationProgressDialog.test.tsx src/components/dormitory/RosterStudentLinkModal.test.tsx src/components/dormitory/DormitoryRosterImportModal.test.tsx 'src/app/(dashboard)/dormitory/roster/page.test.tsx' -> all tests pass, including import detail visibility, indeterminate reconciliation and semantic selection."
  - "V-02 [AC-06] npm --prefix frontend test -- src/components/dormitory/roster-batch.test.ts src/api/dormitory-api.test.ts -> existing operation/API regressions pass without request-contract changes."
  - "V-03 [AC-01,04,05,07] Inspect added/changed JSX lines for rounded-full, rounded-lg/md/sm/none, dark borders and heavy shadows against docs/design/DESIGN.md -> zero prohibited uses except an explicitly documented avatar exception; unchanged legacy UI is reported separately, not silently expanded into scope."
  - "V-04 [AC-01..07] npm --prefix frontend run typecheck; git diff --check -- frontend/src/components/dormitory/RosterOperationProgressDialog.tsx frontend/src/components/dormitory/RosterOperationProgressDialog.test.tsx frontend/src/components/dormitory/RosterStudentLinkModal.tsx frontend/src/components/dormitory/RosterStudentLinkModal.test.tsx frontend/src/components/dormitory/DormitoryRosterImportModal.tsx frontend/src/components/dormitory/DormitoryRosterImportModal.test.tsx 'frontend/src/app/(dashboard)/dormitory/roster/page.tsx' 'frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx' -> both exit 0."
  - "V-05 [AC-01..07] Synthetic browser verification at 375/768/1280px with long Student identity and import reasons, slow/partial import-delete and multi-page reconciliation -> screenshots/states match DESIGN.md, scrollWidth <= clientWidth, keyboard selection/focus is visible, screen-reader attributes are correct and reduced-motion mode removes nonessential motion."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-04.md: user-requested reusable taskscope slot"]

risks:
  - "Responsive visual correctness cannot be proven by class assertions alone; V-05 is mandatory."
  - "Moving detailed import outcomes into the operation dialog changes UI state ownership; preserve acknowledged results until explicit dismissal and do not replay requests."

stop_conditions:
  - "TASKSCOPE_CONFLICT or unresolved deletions on any write target: stop before mutation; do not restore or overwrite unknown work."
  - "A required change to shared primitives, docs/design, API/backend behavior or paths outside scope requires a scope amendment."
  - "If the predecessor changes the new UI contracts before resume, refresh this scope from its final diff rather than applying stale class-only edits."
