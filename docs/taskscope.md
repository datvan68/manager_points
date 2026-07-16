# 1. Task ID + Pipeline

- Task ID: `ACTIVITY-SCHEDULE-RECURRENCE-UX-20260716`
- Pipeline: `bug_fix`

# 2. Risk Level

Low — the change is limited to the development frontend schedule interface and its tests, requires no elevated permissions or production action, does not modify persisted data directly, has no external side effects, and is reversible through a source diff.

# 3. Objective

Correct the `/activities/schedule` card layout so every scheduled card retains an accessible delete action when multiple cards share a session, and simplify recurring-series configuration around the existing range-capable custom calendar. Expose recurring-series cancellation outside the configuration modal and remove recurrence controls that are no longer required.

# 4. Scope

- `frontend/src/app/(dashboard)/activities/schedule/page.tsx` — `/activities/schedule` route composition: pass through only the state and callbacks required by the revised schedule workspace; new technical content must be in English.
- `frontend/src/components/activities/ActivityScheduleWorkspace.tsx` — schedule workspace and recurring-series configuration modal: keep delete controls visible for every card in a session containing two or more cards; replace separate start/end date inputs with one `CustomCalendar` range selection; remove the recurrence end-type and recurrence-cycle controls; add an external `Huỷ chuỗi lặp` action in the schedule workspace; preserve the existing recurring-series cancellation confirmation and request flow; new technical content must be in English, with the Vietnamese UI label as an approved functional exception.
- `frontend/src/components/activities/ActivityScheduleTimeline.tsx` — scheduled-card/timeline layout: adjust card action positioning, stacking, overflow, or responsive layout as needed so the delete icon is visible and operable on each card without hiding schedule content; new technical content must be in English.
- `frontend/src/components/activities/utils/schedule-helper.ts` — recurrence form mapping and validation: derive the recurrence date interval from the selected calendar range and stop depending on removed end-type/cycle UI fields while preserving the API contract already used by the schedule feature; new technical content must be in English.
- `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx` — workspace regression tests: cover range selection, removed controls, external recurring-series cancellation, and the delete action for multiple cards in one session; new test names, fixtures, and assertions must be in English, except exact Vietnamese UI labels required for queries or assertions.
- `frontend/src/components/activities/ActivityScheduleTimeline.test.tsx` — timeline regression tests: verify that every rendered card exposes an enabled delete control when at least two cards occupy the same session; new test content must be in English, except exact localized UI text required by the behavior.
- `frontend/src/components/activities/utils/schedule-helper.test.ts` — helper tests: verify range-to-recurrence mapping and validation after the obsolete recurrence fields are removed; new test content must be in English.
- `frontend/src/components/calendar/CustomCalendar.tsx` — range-selection integration only if its existing public props do not already expose the selected interval needed by the workspace; do not redesign the shared calendar; new technical content must be in English.

# 5. Out of Scope

- All backend files, API endpoints, DTOs, database schemas, migrations, and stored schedule data.
- Authentication, authorization, permissions, notifications, registration, activity membership, and unrelated activity-management behavior.
- The club schedule route and components under `frontend/src/app/(dashboard)/club/**`.
- A general redesign of `CustomCalendar`, the schedule page, cards, timeline, or modal system.
- Changes to recurrence creation/cancellation business rules or the backend request contract beyond adapting the frontend form to the selected date range.
- Dependency installation or upgrades, deployment, release, merge, publish, CI/CD changes, broad formatting, unrelated refactoring, translation, bulk localization work, or encoding conversion.
- Existing user changes in unrelated files, including activity DTO/schema and activity-card design/policy files.

# 6. Context & Dependencies

- The route is implemented at `frontend/src/app/(dashboard)/activities/schedule/page.tsx` and delegates schedule behavior to the activity schedule components.
- Existing related components and tests include `ActivityScheduleWorkspace`, `ActivityScheduleTimeline`, and `schedule-helper`.
- `frontend/src/components/calendar/CustomCalendar.tsx` already supports selecting a date range; the recurrence modal must use that capability rather than maintaining separate start and end controls.
- The external cancellation action must reuse the existing recurring-series cancellation flow. If no such frontend flow or compatible API contract exists, implementation must stop for Scope clarification rather than adding backend behavior.
- Removing recurrence end-type and cycle controls is a UI/form simplification. Existing backend-required values, if any, must be supplied through the current compatible defaults or existing mapping; the request contract must not be changed in this task.
- Windows with PowerShell is the current execution environment.
- All newly written technical content must be English. Exact Vietnamese user-facing strings, including `Cấu hình chuỗi lịch lặp lại` and `Huỷ chuỗi lặp`, are approved functional localization exceptions.
- Preserve each touched file's existing UTF-8 encoding, BOM state, and line endings. Do not treat terminal rendering issues as file corruption.

# 7. Steps

## PLAN

- Inspect the route, workspace, timeline, helper, calendar API, related tests, and frontend package scripts before editing.
- Reproduce or identify the layout rule that hides delete icons when a session contains at least two cards.
- Trace the existing recurring-series creation and cancellation state, callbacks, request payload, and confirmation behavior.
- Confirm Scope, Out of Scope, low risk, Safety Gates, and exact targeted verification commands from `frontend/package.json`.
- Confirm all new technical content will be English and restrict Vietnamese additions to the required UI labels and exact test assertions.
- Verify file encoding and line-ending conventions before modification.

## EXECUTE

- In `frontend/src/components/activities/ActivityScheduleTimeline.tsx`, make each scheduled card retain its own visible, clickable delete action when cards share a session; avoid clipping, overlap, or inaccessible hover-only behavior.
- In `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`, replace separate recurrence start/end inputs with one `CustomCalendar` range value whose first and last selected dates represent the series bounds.
- In the same workspace, remove recurrence end-type and recurrence-cycle controls and remove their obsolete local form state and validation dependencies.
- In the workspace/helper mapping, continue producing the existing compatible recurrence request from the selected range and established defaults; do not change the backend contract.
- Add a `Huỷ chuỗi lặp` button outside the `Cấu hình chuỗi lịch lặp lại` modal, visible only when the current schedule context has a cancellable recurring series; connect it to the existing confirmation and cancellation flow and prevent duplicate submission while a request is pending.
- Update the route only if prop/state wiring is required for the revised workspace.
- Update the scoped tests with English test content and only the approved Vietnamese UI strings needed for behavioral assertions.
- Modify `CustomCalendar.tsx` only if a minimal backward-compatible prop correction is required for range integration.

## VERIFY

- Run the targeted workspace, timeline, and schedule-helper tests using the repository-native frontend test script verified during PLAN.
- Run frontend type-checking and linting only through scripts confirmed in `frontend/package.json`.
- Confirm a session with two or more cards shows a visible and operable delete icon for every card.
- Confirm the recurrence modal exposes one range calendar and no recurrence end-type or cycle controls.
- Confirm the external cancellation action has the required visibility, confirmation, pending, success, and error behavior already supported by the existing flow.
- Inspect the final diff for Scope compliance, localized-content preservation, encoding, and line-ending-only changes.

## REFINE

- Identify the exact failed acceptance criterion and apply the smallest correction within Scope.
- Re-run the affected targeted test before broader verification.
- Preserve English technical content and the documented Vietnamese UI exceptions during corrections.
- Stop on success, a Human Gate, Scope expansion, increased risk, an incompatible backend contract, or the iteration limit.

# 8. Acceptance Criteria

1. When at least two schedule cards are rendered in the same session, every card has a visible delete icon that can receive pointer and keyboard interaction without being clipped or covered.
2. Activating a card's delete action invokes deletion for that card only and preserves the existing confirmation/request behavior.
3. The `Cấu hình chuỗi lịch lặp lại` modal uses one `CustomCalendar` range selector for both the start and end dates.
4. An incomplete or invalid date range cannot submit the recurring-series configuration and presents the existing validation pattern.
5. The modal no longer renders recurrence end-type or recurrence-cycle controls, and obsolete local state and validation for those controls are removed.
6. A valid selected range maps to the existing compatible recurring-series request without changing backend code or API contracts.
7. A `Huỷ chuỗi lặp` button is rendered outside the recurring-series configuration modal only when a cancellable recurring series exists.
8. Activating `Huỷ chuỗi lặp` uses the existing confirmation and cancellation request, disables duplicate submission while pending, refreshes the schedule after success, and preserves existing error feedback.
9. Targeted workspace, timeline, and helper regression tests pass, including the multi-card delete case and all recurring-series UI changes.
10. The final diff contains only scoped files and does not overwrite the user's unrelated working-tree changes.
11. All newly written technical content is English; non-English additions are limited to the explicitly required Vietnamese UI labels or exact test assertions.
12. Existing localized content remains unchanged except for the authorized UI adjustment, and no unintended translation occurs.
13. Touched files preserve project encoding, BOM, and line-ending conventions; no `U+FFFD` character or encoding-only diff is introduced.

# 9. Verification Commands

- `frontend :: npm test -- ActivityScheduleWorkspace.test.tsx ActivityScheduleTimeline.test.tsx schedule-helper.test.ts -> 0; all targeted schedule regression tests pass`
- `D:\PROJECT\manager_points :: git diff --check -> 0; no whitespace errors are reported`
- `D:\PROJECT\manager_points :: git diff -- frontend/src/app/(dashboard)/activities/schedule/page.tsx frontend/src/components/activities/ActivityScheduleWorkspace.tsx frontend/src/components/activities/ActivityScheduleTimeline.tsx frontend/src/components/activities/utils/schedule-helper.ts frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx frontend/src/components/activities/ActivityScheduleTimeline.test.tsx frontend/src/components/activities/utils/schedule-helper.test.ts frontend/src/components/calendar/CustomCalendar.tsx -> 0; the diff contains only intended schedule changes and preserves localized content and encoding`
- `D:\PROJECT\manager_points :: git status --short -> 0; changed files are reviewed against Scope and pre-existing unrelated modifications remain untouched`

# 10. Safety Gates

- Trigger: any required backend, API, DTO, database, schema, or migration change. Pause implementation and obtain explicit user approval for Scope expansion and reassessed risk; database migration also requires the mandatory Human Gate before execution.
- Trigger: the existing API cannot represent the simplified range-based form or no existing recurring-series cancellation flow exists. Pause request/payload changes and obtain explicit user approval for a revised contract and expanded Scope.
- Trigger: production deployment, release, merge, publish, CI/CD modification, destructive action, secret/credential operation, authentication/authorization change, paid service, or external communication. Pause the affected action and obtain the approval required by `safety.md`.
- Trigger: modification of any file outside Scope or any increase above low risk. Pause before editing and obtain explicit user approval for the exact expansion.
- Trigger: bulk translation, localization changes, or encoding conversion. Pause all affected writes and obtain explicit user approval with exact files, rollback plan, and review evidence.
- Approval for one gate does not authorize any other gated action.

# 11. Artifacts to Review

None — no Human Gate triggered by writing this taskscope or by the currently scoped frontend-only implementation.

# 12. Loop_iterations Override

Loop_iterations: 3 (default, stop early on success)
