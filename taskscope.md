# 1. Task ID + Pipeline

`TSK-ACTIVITY-SCHEDULE-COMPACT-PALETTE-AND-LIST-CONTROLS-20260710`
Pipeline: `feature_development`

# 2. Risk Level

Medium â€” this task changes client-side scheduling, membership-state presentation, and manager actions. It does not change database schemas, backend routes, authorization rules, or deployment configuration.

# 3. Objective

Make the `/activities` manager list and weekly schedule workspace match the established Club-management behavior more closely while preserving the generic Activity module. The schedule must provide more room for the weekly board, keep recurrence and refresh controls in one toolbar, and separate initial attendee-capacity entry from later session configuration.

# 4. Scope

Modify only the following files:

- `taskscope.md`
- `frontend/src/components/activities/ActivityCard.tsx`
- `frontend/src/components/activities/ActivityCard.test.tsx`
- `frontend/src/components/activities/ActivityListWorkspace.tsx`
- `frontend/src/components/activities/ActivityListWorkspace.test.tsx` (new)
- `frontend/src/components/activities/ActivityManagementModals.tsx`
- `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`
- `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx`
- `frontend/src/app/(dashboard)/activities/page.tsx`
- `frontend/src/app/(dashboard)/activities/page.test.tsx`

# 5. Out of Scope

- Do not change `backend/**`, database schemas, API route contracts, role/authorization policies, or deploy configuration.
- Do not create a new schedule, membership, bulk-action, or status API. Reuse `activityApi.update`, `activityApi.delete`, `activityApi.joinActivity`, and the existing activity-schedule API methods.
- Do not change the `/club/**` pages or replace their terminology with Activity terminology.
- Do not add an activity/semester selector back to `/activities/schedule`.
- Do not add horizontal scrolling to the weekly calendar.
- Do not change the public Activity detail tabs, card-design modal behavior, attendance logic, or completion/point rules.

# 6. Context & Dependencies

- `ActivityScheduleWorkspace.tsx` is the shared schedule UI used by `/activities/schedule` and the legacy Club schedule wrapper. Preserve the `activityType="club"` wrapper behavior and the legacy `club_id` schedule payload field.
- The schedule API already accepts `title`, `description`, `location`, `start_time`, `end_time`, `semester_id`, `max_attendees`, and recurrence fields. The client must preserve a saved `max_attendees` value when the session-configuration form no longer exposes it.
- `Activity.participation_status` supports `draft`, `published`, `completed`, and `cancelled`. The manager list will expose three direct icon targets: Draft, Published, and Cancelled. `completed` remains a display-only lifecycle state in this list.
- The existing `ActivityManagementModals` component already has confirmation wording and variants for multi-delete and multi-deactivate. Extend its typed props only when needed by the selection flow; do not duplicate confirmation dialogs in the list component.
- A student with `membership_status === 'active'` has already registered. The card label must be `Äang tham gia`; `ÄÄƒng kĂ½`, `Chá» duyá»‡t`, and `Bá»‹ tá»« chá»‘i` retain their existing meanings and no duplicate join request is sent.
- The initial schedule-create form is opened from the explicit create action. The session-configuration form is opened for a dropped, pending, or saved calendar item. These are distinct entry modes even if they share form state and submit code.

# 7. Steps

## PLAN

1. Inspect the table branch of `ActivityListWorkspace.tsx`, the create/edit/delete state in `activities/page.tsx`, and `ActivityManagementModals.tsx` before changing callbacks. Map every manager action to the existing `activityApi.update` or `activityApi.delete` method and keep student rows read-only for manager-only controls.
2. Inspect the weekly branch of `ActivityScheduleWorkspace.tsx`: the toolbar near the recurrence and refresh buttons, the `lg:col-span-3` source palette, the seven-day header, the three shift rows, and the modal branches controlled by `isSimplifiedModal`.

## EXECUTE

3. In `ActivityScheduleWorkspace.tsx`, replace the split recurrence/refresh control placement with one responsive schedule toolbar containing week navigation/status, the `Cáº¥u hĂ¬nh chuá»—i láº·p` button, and the refresh icon button. Keep the recurrence dialog and refresh handler unchanged; only relocate their triggers into this shared toolbar.
4. Change the desktop weekly layout from a `3/12` palette plus `9/12` board to a compact `2/12` palette plus `10/12` board. Keep the palette searchable, vertically scrollable inside its fixed panel, and drag-and-drop capable. Ensure the seven day columns shrink within the available board width without `min-width`, `overflow-x-auto`, or a horizontal scrollbar.
5. Remove vertical day separators from the desktop weekly board: remove `border-r` and `divide-x` classes from the day header, shift label boundary, and day cells. Retain horizontal shift separation and each schedule card's colored left accent because those are not day-divider borders.
6. Separate the two schedule modal modes in `ActivityScheduleWorkspace.tsx`:
   - The initial create modal keeps attendee-capacity input together with its existing new-session fields.
   - The session-configuration modal for dropped, pending, or saved sessions exposes only title, description, location, start time, and end time. It does not expose attendee capacity, activity selection, schedule type, date editing, or recurrence controls.
   - Preserve the calendar-cell date in configuration mode and preserve an existing `max_attendees` value in its PATCH/create payload. Recurrence remains configurable only through the shared recurrence controls and related dialogs.
7. In `ActivityCard.tsx`, change only the active-membership visual label from `ÄĂ£ tham gia` to `Äang tham gia`. Keep it non-clickable, prevent card navigation from action clicks, and do not render edit/delete controls on grid cards.
8. In `ActivityListWorkspace.tsx`, add manager-only table selection state: a header checkbox selects or clears all currently filtered activities, each row checkbox toggles that activity, and selection is cleared after a completed bulk action or when a selected item is no longer in the filtered result set. Show a selection toolbar only when one or more rows are selected, with `VĂ´ hiá»‡u hĂ³a` and `XĂ³a` actions wired to the existing confirmation modal.
9. In the manager table status column, retain the current status badge and add exactly three compact icon-only buttons with accessible names/tooltips: `ÄÆ°a vá» nhĂ¡p`, `CĂ´ng khai Ä‘Äƒng kĂ½`, and `Há»§y hoáº¡t Ä‘á»™ng`. Wire each button to a page callback that calls `activityApi.update(id, { participation_status: 'draft' | 'published' | 'cancelled' })`, shows success/error feedback, and reloads the activity list. Do not offer direct status changes to students or for a `completed` row.
10. Replace the manager table's text controls (`Sá»­a`, `XĂ³a`) with icon-only buttons for configure-design, edit, and delete. Keep their existing callbacks, stop row-click propagation, and supply `aria-label` and `title` text. Preserve the favorite button and the student registration-state behavior.
11. In `activities/page.tsx`, own the selected activity IDs, bulk-confirmation state, single status-change loading state, and callbacks passed to the list/modal. For bulk deactivation, PATCH every selected ID to `cancelled`; for bulk deletion, call the existing delete API for every selected ID. Await the independent requests together, report a single outcome, clear selection only on success, then reload data.

## VERIFY

12. Extend `ActivityCard.test.tsx` to assert `Äang tham gia` for active membership and retain the no-grid-edit/delete assertion.
13. Create `ActivityListWorkspace.test.tsx` to cover manager-only checkboxes, select-all over filtered rows, icon-only edit/delete/design controls with accessible labels, the three direct status callbacks, and absence of those manager controls for students.
14. Update `activities/page.test.tsx` to verify the exact PATCH payloads for Draft/Published/Cancelled and the bulk deactivate/delete confirmation flows without introducing new API methods.
15. Update `ActivityScheduleWorkspace.test.tsx` to assert the compact palette heading, one toolbar containing recurrence and refresh controls, no desktop vertical day-divider classes, no horizontal calendar overflow class, and the field difference between initial create and session-configuration modes. Retain tests for recurrence payload creation and absence of activity/semester selectors.
16. Run focused tests, lint, production build, and whitespace checks. Manually inspect `/activities` in grid/table modes and `/activities/schedule` at desktop and narrow widths after automated checks pass.

## REFINE

17. If a focused test, lint, or build check fails, correct only the failing in-scope component or test, rerun the failed command, and stop after three PLAN â†’ EXECUTE â†’ VERIFY iterations if the same issue remains unresolved.

# 8. Acceptance Criteria

- The weekly schedule shows a compact left source palette and a wider seven-day board; the board has no horizontal scrollbar and no vertical divider between day columns.
- Recurrence configuration and refresh are present in the same responsive schedule toolbar, and their existing dialogs/handlers still work.
- Initial schedule creation shows the attendee-capacity input. Session configuration for a calendar item shows only title, description, location, start time, and end time; its saved capacity is not lost.
- An Activity card with active membership displays `Äang tham gia`, cannot issue another join request, and still has no grid-card edit/delete action.
- Manager table rows have checkboxes, a select-all checkbox, selected-row bulk deactivate/delete confirmations, three direct icon status actions, and icon-only configure-design/edit/delete actions with accessible labels.
- Students do not see manager checkboxes, bulk controls, manager status icons, or manager edit/delete/design icons.
- Direct status controls use only PATCH payloads for `draft`, `published`, and `cancelled`; `completed` is not directly changed from this table.
- All targeted tests, lint, build, and `git diff --check` pass.

# 9. Verification Commands

```powershell
Set-Location D:\PROJECT\manager_points\frontend
npm test -- "src/components/activities/ActivityCard.test.tsx" "src/components/activities/ActivityListWorkspace.test.tsx" "src/components/activities/ActivityScheduleWorkspace.test.tsx" "src/app/(dashboard)/activities/page.test.tsx"
npm run lint
npm run build
Set-Location D:\PROJECT\manager_points
git diff --check
git status --short
```

# 10. Safety Gates

- Request human approval before any change to backend code, database schema, authentication/authorization policy, production configuration, deployment, or an API contract.
- Stop and request direction if the implementation requires a new bulk API, a new status outside `draft`/`published`/`cancelled`, or a behavior change to the legacy `/club/**` routes.
- No human gate is required for the scoped frontend-only changes when the listed verification commands pass.

# 11. Artifacts to Review

- `git diff -- taskscope.md frontend/src/components/activities/ActivityCard.tsx frontend/src/components/activities/ActivityListWorkspace.tsx frontend/src/components/activities/ActivityManagementModals.tsx frontend/src/components/activities/ActivityScheduleWorkspace.tsx frontend/src/app/(dashboard)/activities/page.tsx`
- Focused Vitest output for the four files listed in the verification command.
- `npm run lint`, `npm run build`, `git diff --check`, and `git status --short` output.
- Desktop and narrow-width screenshots of `/activities` table mode and `/activities/schedule` showing the compact palette, unified toolbar, and borderless day columns.

# 12. loop_iterations override

No override. Use the default maximum of 3 PLAN â†’ EXECUTE â†’ VERIFY â†’ REFINE iterations.
