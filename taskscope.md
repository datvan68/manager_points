### 1. Task ID + Pipeline

- Task ID: `ACTIVITY-SCHEDULE-20260715-009`
- Pipeline: `feature_development`

### 2. Risk Level

Medium — this is a reversible frontend interaction change in the development workspace with no production, database, permission, secret, paid-service, or external side effects; incorrect event handling could still dismiss the dialog unexpectedly or open it for an invalid drop.

### 3. Objective

Correct the `Cấu hình buổi sinh hoạt` dialog on `/activities/schedule` so interaction with either time-range control does not dismiss it, and a valid activity drop into the calendar automatically opens configuration for that dropped activity.

### 4. Scope

- `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`
  - Keep the compact dialog open during click, drag, and selection in either time-range control, including portal-rendered control content.
  - In `handleDrop` and directly related pending state, select the newly placed pending activity and open its configuration dialog after a valid drop.
  - Preserve genuine outside-click, explicit close/cancel, and `Escape` dismissal.
- `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx`
  - Add or adjust focused regression tests for both time controls, valid-drop auto-open, invalid drops, and outside dismissal.
- `taskscope.md`
  - Record this scope and its verification requirements.

### 5. Out of Scope

- Backend APIs, database schemas, migrations, or persistence contracts.
- Time validation, recurrence, source-week, navigation, calendar eligibility, authorization, or permission changes.
- Dialog visual redesign, classroom/location loading, or save-semantics changes.
- Dependency upgrades, broad refactoring, repository-wide formatting, deployment, release, merge, history changes, or bulk encoding conversion.

### 6. Context & Dependencies

- The schedule workspace is implemented in `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`.
- `handleDrop` owns calendar drop handling and pending-schedule creation.
- A valid drop is one already accepted by the component's existing activity, day, shift, and calendar constraints.
- Tests use the verified Vitest `test` script and TypeScript `typecheck` script in `frontend/package.json`.
- Environment: Windows, PowerShell, and repository-configured Node.js/npm.
- Preserve UTF-8 Vietnamese content, BOM convention, and existing line endings.

### 7. Steps

#### PLAN

- Inspect dialog containment, outside-dismiss handling, both time controls and their portals, `handleDrop`, pending-item activation, and focused tests.
- Confirm Scope, Medium risk, verification, and absence of a Human Gate.

#### EXECUTE

- In `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`, ensure pointer interactions belonging to either time control are treated as inside the dialog while genuine outside interactions still dismiss it.
- In the same component, make a valid `handleDrop` result activate the newly created pending item and open `Cấu hình buổi sinh hoạt` exactly once.
- In `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx`, add focused regression coverage for both interaction paths.

#### VERIFY

- Run focused tests, frontend typecheck, `git diff --check`, and a scoped diff review.
- Confirm only Scope files changed and no encoding or line-ending-only diff was introduced.

#### REFINE

- Identify the exact failed criterion, apply the smallest scoped correction, and re-run the affected verification first.
- Stop on success, a Human Gate, scope expansion, or the iteration limit.

### 8. Acceptance Criteria

- Clicking, dragging, or selecting values in the first time-range control leaves the dialog open.
- Clicking, dragging, or selecting values in the second time-range control leaves the dialog open.
- Portal-rendered content for either time control is treated as an inside interaction.
- A genuine outside click still closes the dialog; explicit close/cancel and `Escape` retain existing behavior.
- A valid activity drop creates or positions the pending activity, selects that exact item, and opens its compact configuration dialog exactly once.
- An invalid or rejected drop neither creates a pending activity nor opens the dialog.
- Existing validation, save, recurrence, authorization, and calendar eligibility behavior remains unchanged.
- Focused Vitest tests and TypeScript typecheck pass; `git diff --check` reports no errors.
- Vietnamese content remains valid UTF-8, no `U+FFFD` is introduced, and BOM/line endings follow project conventions.

### 9. Verification Commands

`D:\PROJECT\manager_points\frontend :: npm test -- --run "src/components/activities/ActivityScheduleWorkspace.test.tsx" -> 0; focused regression tests pass`

`D:\PROJECT\manager_points\frontend :: npm run typecheck -> 0; TypeScript reports no errors`

`D:\PROJECT\manager_points :: git diff --check -> 0; no whitespace errors are reported`

`D:\PROJECT\manager_points :: git diff -- taskscope.md frontend/src/components/activities/ActivityScheduleWorkspace.tsx frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx -> 0; only scoped changes are present`

### 10. Safety Gates

- Trigger: implementation requires a file, contract, validation rule, permission behavior, or calendar constraint outside Scope, or raises risk above Medium. Pause and obtain explicit user approval.
- Trigger: any production, deployment, release, merge, destructive, database, infrastructure, secret, authorization, external communication, paid-service, or bulk encoding action becomes necessary. Pause and obtain the approval required by `safety.md`.
- Approval for one trigger does not authorize unrelated actions.

### 11. Artifacts to Review

None — no Human Gate triggered.

### 12. Loop_iterations Override

Loop_iterations: 3 (default, stop early on success)