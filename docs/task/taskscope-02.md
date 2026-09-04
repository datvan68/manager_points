slot_id: "taskscope-02"
generation: 2
task_id: "20260904-163806-fix-roster-progress-results-linking"
scope_file: "docs/task/taskscope-02.md"
status: blocked
scope_revision: 1
created_at: "2026-09-04T16:38:06+07:00"
updated_at: "2026-09-04T16:38:06+07:00"
base_commit: "fd81b9732e0d75618b98499c1412e94466773e42"
task: "Fix visible KTX progress, import result layout and incomplete identity reconciliation"
pipeline: bug_fix
profile: Full
objective: "Show visible import/bulk-delete percentages throughout processing, render readable import outcomes without horizontal overflow, and link every uniquely matching eligible roster entry with explicit reasons for unresolved identities."

coordination:
  depends_on: ["20260904-155313-dormitory-identity-bulk-progress"]
  warnings:
    - "TASKSCOPE_CONFLICT: docs/task/taskscope.md, slot 00 generation 2, status in_progress, owns every implementation write path below except the new RosterOperationProgress component/test. This successor must remain blocked until the predecessor releases those reservations; do not edit or complete the predecessor from this task."
  reservation_check: "Clean worktree; inspected lifecycle/scope.write of taskscope.md (in_progress), taskscope-01.md (blocked, disjoint dashboard work), taskscope-02.md (completed generation 1). Reused lowest completed slot 02."
  resume: "User must explicitly resume this exact file after dependency resolution. Revalidate overlapping targets against base_commit; reconcile predecessor changes into a revised scope before implementation. Do not execute stale steps or duplicate completed fixes."

completion:
  completed_at: null
  outcome: null
  final_commit_or_state: null
  changed_paths: []
  checks_passed: []
  cleanup_pending: []

evidence:
  current_behavior:
    - "User screenshot: long row ranges occupy the left column and squeeze 'Da tao / 162 dong' against the right edge; horizontal scrollbar visible."
    - "DormitoryRosterImportModal: progress renders inside the underlying Popup only while busy. ConfirmModal awaits onConfirm before closing and overlays content at z-index 200/201, masking the processing surface."
    - "Import results use grid-cols-[auto_1fr] and whitespace-nowrap for the entire row-range string; this reproduces the screenshot's overflow mechanism."
    - "roster/page.tsx:removeSelected invokes runRosterBatches without onProgress, has no percentage UI, and silently truncates selected IDs with slice(0,100). Both import/delete return early on interruption before consolidating acknowledged outcomes."
    - "Identity resolveBatch queries exact date_bir timestamps, while importStudentMatches queries a calendar-day range. Its regex is unescaped/unanchored; reconcileSemester spreads Mongoose documents and resolves one row at a time, and unresolved outcomes are returned without saving updated states."
    - "reconcileStudent still has separate matching logic without ambiguity checking across all Students. Import also uses separate matching logic. Roster UI has no reconciliation action although API endpoint/client exist."
  root_cause: "Progress visibility/callback wiring and result layout causes are evidenced by code plus screenshot. Identity paths are inconsistent and old rows lack a UI reconciliation path; the exact reason for the user's individual unlinked records is unverified without authorized sample data."
  expected_behavior: "Use an unobscured operation surface, acknowledged batch progress, readable grouped outcomes, and one safe matcher for both automatic and explicit reconciliation. Do not interpret incomplete linking as permission to force ambiguous matches."

scope:
  inspect:
    - "frontend/src/components/modals/ConfirmModal.tsx:onConfirm lifecycle; leave shared modal unchanged"
    - "frontend/src/api/dormitory-api.ts:existing reconcile/importRows optional semester_id contracts"
    - "frontend/src/api/semester-api.ts:getSemesters"
    - "backend/src/dormitory/controllers/dormitory-roster.controller.ts:reconcile permission guard"
    - "backend/src/dormitory/dto/reconcile-roster.dto.ts and import-roster.dto.ts:validation"
    - "backend/src/dormitory/schemas/dormitory-roster-entry.schema.ts:identity/unique indexes"
    - "backend/src/dormitory/services/room-assignment.service.ts:deleteRosterEntry/assignFirstAvailableBed"
    - "backend/src/students/students.service.ts:existing create/update/bulk/import reconciliation callers"
    - "frontend/package.json and backend/package.json:focused test/typecheck/build scripts"
  write:
    - "frontend/src/components/dormitory/DormitoryRosterImportModal.tsx"
    - "frontend/src/components/dormitory/DormitoryRosterImportModal.test.tsx"
    - "frontend/src/components/dormitory/roster-batch.ts"
    - "frontend/src/components/dormitory/roster-batch.test.ts"
    - "frontend/src/components/dormitory/RosterOperationProgress.tsx"
    - "frontend/src/components/dormitory/RosterOperationProgress.test.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.tsx"
    - "frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx"
    - "backend/src/dormitory/services/dormitory-roster-identity.service.ts"
    - "backend/src/dormitory/services/dormitory-roster-identity.service.spec.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.ts"
    - "backend/src/dormitory/services/dormitory-roster.service.spec.ts"
  preserve: ["Existing RBAC and public registration privacy", "Student identity authority, normalized name including accents plus calendar DOB, unique Student/semester link", "No automatic reassignment of linked entries", "Import validation/duplicate skipping/room order; deletion side effects", "50-row import and 10-ID delete batches; existing request/response compatibility", "Mobile/desktop list selection, scrolling and PDF behavior"]
  out: ["Shared modal/CSS changes", "New dependencies, job infrastructure or schema/index changes", "Force linking by name alone, fuzzy matching or new student-code precedence", "Production/runtime data access or live backfill/delete", "Other KTX tabs and Student import UI redesign", "Completion or modification of another taskscope"]

acceptance_criteria:
  - "AC-01: Confirming import closes the confirmation overlay and exposes a persistent progress surface before the first request. Show phase, a filled bar, integer percentage and acknowledged processed/total. During a slow batch the last confirmed percentage remains visible. Retain terminal 100% for completed processing until dismissal; interrupted operations retain their actual percentage. No artificial timers or progress hidden behind another modal."
  - "AC-02: Bulk delete shows the same visible progress behavior after confirmation with onProgress wired. Disable duplicate launch/close during pending work. Freeze unique selection; if more than 100 IDs are selected, reject before sending with an explicit limit message instead of silently truncating. Track deleted/blocked/not_found/invalid separately; 100% denotes processed, not all deleted."
  - "AC-03: Results show readable summary counts for created/duplicate/failed and linked/unlinked/conflict. Each group places status + count first, reason second, row ranges in a separate wrapping area with expandable detail. At 375px, 768px and 1280px widths, a 162-row group with discontinuous ranges and a long reason causes no horizontal container overflow, squeezed status or inaccessible row numbers. Preserve original Excel row numbers and distinguish import success from identity status."
  - "AC-04: Partial/interrupted runs consolidate all acknowledged results, show unconfirmed current-batch and unsent counts, retain unresolved selection/input and refresh after acknowledged or uncertain writes. Do not replay mutations automatically, discard known successes, label unconfirmed rows failed, or claim rollback. Refresh errors cannot replace operation results. Reset progress for a new operation and release busy state on every exit."
  - "AC-05: Shared matching links one exact normalized-name/calendar-DOB Student only when roster uniqueness permits; zero matches remains UNLINKED, ambiguous Students/competing entries become CONFLICT with actionable reasons. Use escaped anchored name queries and calendar-day ranges; pass explicit plain document fields including _id. Resolve a reconciliation page as one batch; query only relevant identities/semester/collision candidates rather than all semester entries per row. Persist unresolved state changes conditionally. Concurrent identity changes/manual links must not be overwritten."
  - "AC-06: Authenticated create/update/import and reconcileStudent/reconcileSemester use equivalent shared matching; keep the public registration path unchanged. Existing import duplicates remain skipped. Provide 'Doi chieu lien ket' in KTX List under existing DORM_REG_UPDATE with an explicit semester selection (default sole active semester), iterate the existing cursor API and show linked/unlinked/conflict/failed results. Import passes a frozen active semester_id through the existing optional field. Loading/searching/paging the table performs no linking writes. Existing records are repaired by explicit reconciliation, not reimport."
  - "AC-07: Synthetic tests cover same day/different time, normalized spacing/case, regex metacharacters, ambiguous Students, an already-linked Student in the semester, hydrated Mongoose input, stale/manual updates and more than one cursor page. All uniquely matching eligible fixtures link; unresolved fixtures stay unlinked/conflicted with reasons. No claim that real user records are repaired without authorized runtime verification."

execution:
  - "E-01 [AC-01..04] Add local RosterOperationProgress.tsx + test; wire import modal and roster page + tests to show progress in the active operation surface, close only confirmation overlays at launch and retain terminal outcomes. Reuse existing modal composition; do not modify ConfirmModal globally."
  - "E-02 [AC-02,04] roster-batch.ts + new roster-batch.test.ts: preserve acknowledged/unconfirmed/unsent accounting; freeze per-callback snapshots, validate positive batch size, no replay. Update import/delete callers to aggregate before testing terminal status; validate selection limit and preserve partial results on reload failure."
  - "E-03 [AC-03] DormitoryRosterImportModal.tsx + test: replace auto-width row-range layout with responsive summary/group cards, separate wrapping expandable ranges, identity counts and reasons. Use screenshot-equivalent synthetic 162-row fixture."
  - "E-04 [AC-05,07] dormitory-roster-identity.service.ts + spec: unify normalized matching and bounded collision queries, plain document mapping, conditional state/link updates and duplicate-index outcome handling; route reconcileStudent and reconcileSemester through the same resolver."
  - "E-05 [AC-05..07] dormitory-roster.service.ts + spec: replace separate import matching with shared resolver, align authenticated update/create, preserve public behavior and duplicate semantics; prove identity results and stored states agree."
  - "E-06 [AC-06] roster/page.tsx + tests and DormitoryRosterImportModal.tsx + tests: wire existing protected reconcile API with semester selection/cursor outcomes; pin import semester with existing API argument. Keep permission denials visible and no write-on-read."
  - "E-07 [AC-01..07] Focused tests and independent identity/concurrency review; visually verify actual confirmation-to-processing transition and terminal layout. Record successful checks, changed paths and cleanup before completing this slot."

verification:
  - "V-01 [AC-01..04,06] npm --prefix frontend test -- src/components/dormitory/DormitoryRosterImportModal.test.tsx src/components/dormitory/roster-batch.test.ts src/components/dormitory/RosterOperationProgress.test.tsx 'src/app/(dashboard)/dormitory/roster/page.test.tsx' -> all pass; use deferred responses, actual confirmation interaction, two successful batches followed by a failed batch, and failed reload."
  - "V-02 [AC-05..07] npm --prefix backend test -- dormitory-roster-identity.service.spec.ts dormitory-roster.service.spec.ts dormitory-permissions.spec.ts dormitory-roster-privacy.spec.ts --runInBand -> all pass with the synthetic identity cases and bounded query assertions."
  - "V-03 [AC-05..07] npm --prefix backend test -- students/test/students.service.spec.ts --runInBand -> existing individual/bulk/import callers remain compatible."
  - "V-04 [AC-01..07] npm --prefix frontend run typecheck; npm --prefix backend run build; git diff --check -> all exit 0."
  - "V-05 [AC-01..04,06] Local synthetic browser verification at 375/768/1280px: slow 120-row import, 25-ID deletion, interruption, 162-row result group and reconciliation. Capture visible percent/bar without confirmation occlusion; verify result scrollWidth <= clientWidth, accessible expandable rows and retained partial outcomes. DOM/class assertions alone do not prove layout."

temporary_artifacts:
  create: []
  cleanup: []
  retain: ["docs/task/taskscope-02.md: user-requested reusable taskscope slot"]
risks:
  - "Predecessor is active; its final changes may supersede this baseline."
  - "Identity linking affects Student-associated access; preserve conservative ambiguity rules and independent review."
  - "A lost response may follow committed writes; show uncertainty instead of automatic retry."
stop_conditions:
  - "Remain blocked while predecessor owns overlapping paths. Resume only through explicit user pin and fresh conflict/baseline validation."
  - "If exact user-data diagnosis requires runtime records, request narrowly scoped authorization or anonymized examples; do not read secrets/uploads/database data."
  - "New business matching rules, schema/index migration, permission expansion, external effects or additional write paths require scope amendment."
  - "Live reconciliation, bulk deletion or production mutation requires the repository Human Gate; synthetic verification only is authorized here."
