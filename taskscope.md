### 1. Task ID + Pipeline

- Task ID: `ACTIVITY-SCHEDULE-20260715-007`
- Pipeline: `feature_development`

### 2. Risk Level

Medium — this is a reversible frontend interaction and workflow change in the development workspace with no production, permission, database, secret, paid-service, or external communication impact; incorrect event handling could nevertheless dismiss dialogs unexpectedly or alter schedule-placement behavior.

### 3. Objective

Adjust `/activities/schedule` so the compact activity-configuration dialog closes when the user clicks outside it, and so activities can first be placed into any displayed week before the user optionally configures time and recurrence. This separates schedule placement from subsequent configuration while retaining the existing save and recurrence semantics.

### 4. Scope

- `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`
  - Compact `Cấu hình buổi sinh hoạt` dialog interaction: detect pointer/click interaction outside the dialog and close it, while preserving interaction inside the dialog.
  - Dialog cleanup state: clear the active pending target consistently when outside-click dismissal occurs, matching explicit close/cancel behavior.
  - Activity drag-and-drop placement flow in `handleDrop` and its directly related pending-schedule state: allow an activity to be dropped into a day/shift in any displayed week and create the pending schedule card before configuration.
  - Pending schedule card actions and directly related configuration handlers: let the user open time configuration and recurrence configuration only after placement, without forcing either dialog during the initial drop.
  - Recurrence source-week data: use the week containing the placed activity card as the source week when recurrence is configured for that pending schedule.
- `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx`
  - Add or adjust focused regression tests for outside-click dismissal, inside-dialog interaction, placement into an arbitrary displayed week, deferred time/recurrence configuration, and source-week selection.
- `taskscope.md`
  - Record the approved implementation scope, acceptance criteria, safety gates, and verified commands for this request.

### 5. Out of Scope

- Backend APIs, controllers, models, database schemas, migrations, and persisted recurrence rules outside the existing frontend payload contract.
- Changes to semester navigation, week-range generation, activity availability, authorization, or role permissions.
- Changes to the previously scoped location-default behavior or confirmation-modal visual redesign unless required to keep existing tests passing.
- Automatic saving of a dropped pending schedule to the backend before the user invokes the existing save action.
- Deployment, release, merge, branch history changes, dependency upgrades, broad refactoring, repository-wide formatting, or bulk encoding conversion.

### 6. Context & Dependencies

- The schedule workspace is implemented in `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`.
- `handleDrop` currently owns calendar drop handling and pending-schedule creation; `handleConfigurePending` and `handleConfigureSaved` open the compact configuration dialog.
- The compact dialog is rendered when `showCreateModal` is true and uses `isSimplifiedModal` to distinguish it from the full create/edit modal.
- Existing explicit close, cancel, `Escape`, validation, save, update-series, and recurrence business behavior must remain available.
- “Any week” means any week already displayed and accepted by the current calendar navigation and semester constraints; this task does not expand the allowed date range.
- Initial drop creates frontend pending state only. Time and recurrence remain editable through the existing post-placement configuration actions.
- Tests use Vitest and Testing Library through the verified `test` script in `frontend/package.json`; TypeScript verification uses the verified `typecheck` script.
- Environment: Windows, PowerShell, Node.js/npm as configured by the repository.
- Preserve UTF-8 Vietnamese UI text, the existing BOM convention of each modified file, and existing line-ending conventions. Do not treat terminal mojibake as file corruption.

### 7. Steps

#### PLAN

- Inspect the dialog container/ref structure, close-state cleanup, drag/drop handlers, pending schedule model, recurrence source-week derivation, and focused tests.
- Confirm that all changes remain within the listed files, retain Medium risk, and trigger no Human Gate.
- Define event boundaries so dialog content clicks are inside interactions and calendar/page clicks are outside interactions.

#### EXECUTE

- In `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`, add a stable reference or equivalent containment check for the compact dialog and register lifecycle-safe outside-pointer/click handling only while it is open; close the dialog and clear its active pending target on an outside interaction, but leave it open for interactions within the dialog.
- In `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`, adjust `handleDrop` and directly related pending-state initialization so dropping an activity into an eligible day/shift of any displayed week immediately produces a pending schedule card at that location without automatically requiring time or recurrence configuration.
- In `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`, retain explicit pending-card controls that open time configuration and recurrence configuration after placement, and derive recurrence source-week boundaries from the pending card’s placed date rather than the current real-world week.
- In `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx`, add focused tests proving outside click closes once, inside controls remain interactive, drop placement precedes configuration, arbitrary displayed-week placement is retained, and recurrence uses the placed week as its source.

#### VERIFY

- Run the focused component tests, frontend typecheck, `git diff --check`, and a scoped final diff review.
- Record exit statuses and relevant failures or passing summaries.
- Confirm only Scope files changed and no dialog, placement, recurrence, localization, encoding, or line-ending regression is visible in the diff.

#### REFINE

- Identify the exact failed acceptance criterion or test assertion.
- Apply the smallest correction in the scoped component or test file.
- Re-run the affected focused test first, then the complete verification list after it passes.
- Stop immediately on success, a Human Gate, required scope expansion, or the iteration limit.

### 8. Acceptance Criteria

- With the compact `Cấu hình buổi sinh hoạt` dialog open, one pointer/click outside its rendered bounds closes it and clears the active pending target.
- Clicking, typing, selecting, or using buttons inside the compact dialog does not trigger outside-dismissal; explicit close/cancel and `Escape` continue to close it.
- Dropping an activity into an eligible day/shift in any displayed week creates a visible pending schedule card in that exact week before any time or recurrence dialog is opened.
- Initial placement does not require recurrence configuration and does not persist the pending item to the backend earlier than the existing save workflow.
- After placement, the user can open the pending card’s time configuration and recurrence configuration through their existing controls.
- When recurrence is enabled for a placed pending schedule, its source-week start/end values correspond to the week containing that pending card, not the current real-world week.
- Existing validation, save/update, cancel, authorization, semester-date constraints, and recurrence payload semantics remain unchanged except for the explicitly scoped ordering and source-week behavior.
- Focused Vitest tests pass and verify outside/inside interactions, arbitrary-week placement, deferred configuration, and placed-week recurrence source behavior.
- TypeScript typecheck exits successfully, `git diff --check` reports no whitespace errors, and the final diff contains only intended scoped changes.
- Existing Vietnamese content remains valid UTF-8, no `U+FFFD` is introduced, file BOM/line endings follow existing conventions, and no encoding-only diff is introduced.

### 9. Verification Commands

`D:\PROJECT\manager_points\frontend :: npm test -- --run "src/components/activities/ActivityScheduleWorkspace.test.tsx" -> 0; focused ActivityScheduleWorkspace regression tests pass`

`D:\PROJECT\manager_points\frontend :: npm run typecheck -> 0; TypeScript reports no errors`

`D:\PROJECT\manager_points :: git diff --check -> 0; no whitespace errors are reported`

`D:\PROJECT\manager_points :: git diff -- taskscope.md frontend/src/components/activities/ActivityScheduleWorkspace.tsx frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx -> 0; review shows only scoped interaction, workflow, test, and taskscope changes`

### 10. Safety Gates

- Trigger: implementation requires a file, module, backend contract, permission behavior, or date-range rule outside Scope, or increases risk above Medium. Pause before that change and obtain explicit user approval for the expanded scope and revised risk.
- Trigger: any production action, deployment, release, merge, destructive or irreversible operation, database/infrastructure change, secret/authentication/authorization change, external communication, paid service, or bulk encoding conversion becomes necessary. Pause before the action and obtain the specific approval required by `safety.md`.
- Approval for one trigger does not authorize any unrelated action.

### 11. Artifacts to Review

None — no Human Gate triggered.

### 12. Loop_iterations Override

Loop_iterations: 3 (default, stop early on success)
