# 1. Task ID + Pipeline

- Task ID: `ACTIVITY-SCHEDULE-20260715-004`
- Pipeline: `feature_development`

# 2. Risk Level

- Risk level: `medium`
- Reversible frontend changes affect initial week selection and saved location, but require no deployment, database, permissions, secrets, destructive actions, or external side effects.

# 3. Objective

Adjust `/activities/schedule` so **Cấu hình buổi sinh hoạt** is a compact time-configuration dialog, location defaults from the activity's `classroom` while remaining editable, the initial weekly view shows the recurrence source week, and that week is visually distinct.

# 4. Scope

- `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`
  - Render simplified configuration as a compact dialog containing location, start time, end time, cancel, and save/update controls.
  - Resolve location from existing/user value, then selected activity `classroom`, then `Phòng sinh hoạt`.
  - Initialize weekly display from `recurrence.source_week_start_date`, with deterministic selection and current-week fallback.
  - Add an explicit marker and distinct grid/container styling for the source week.
- `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx`
  - Cover dialog contents, location precedence/persistence, source-week initialization/fallback, navigation stability, and presentation.
- `taskscope.md`
  - Record this implementation scope.

# 5. Out of Scope

- Backend controllers, services, DTOs, schemas, recurrence generation, database data, and migrations.
- The full **Lên lịch sinh hoạt mới** modal, activity forms, and the source of `Activity.classroom`.
- Daily view, attendance, registration, completion rules, activity detail pages, deployments, dependencies, broad formatting, and unrelated refactoring.
- Changes to recurrence metadata meanings or timestamp persistence.

# 6. Context & Dependencies

- The route already renders `ActivityScheduleWorkspace`; its wrapper needs no change.
- `Activity.classroom` is already exposed by `frontend/src/api/activity-api.ts` and activities are loaded.
- Pending configuration falls back to `classroom`; saved configuration currently skips it and falls straight to `Phòng sinh hoạt`.
- `isSimplifiedModal` hides unrelated fields but still uses the full-screen create-modal shell.
- `weekOffset = 0` opens the current week. Source metadata is used by badges and **Về tuần nguồn**, but the grid is not distinct.
- If source weeks differ, prefer the selected activity's valid source week; otherwise choose the earliest valid visible source date. With none, keep current week.
- Initialization must run once per relevant data load and not reset manual navigation.
- The reference image indicates a small, rounded, high-contrast panel. Reuse current React/Tailwind primitives and accessible dialog semantics.
- Preserve UTF-8 BOM, Vietnamese content, and line endings; terminal mojibake is not file corruption.

# 7. Steps

## PLAN

1. Inspect data loading, filters, week helpers, simplified modal, save payloads, and source-week rendering.
2. Confirm existing activity and recurrence data require no API changes.
3. Define focused tests for every acceptance criterion.

## EXECUTE

1. Conditionally render the compact accessible dialog for `isSimplifiedModal`.
2. Apply location precedence: non-empty saved/user value → activity `classroom` → `Phòng sinh hoạt`.
3. Persist displayed `formLocation`, unchanged or user-overridden.
4. Compute source-week Monday after data loads and initialize `weekOffset` once.
5. Add non-color-only source-week text and distinct grid/container classes.
6. Add regression tests for all requested behavior.

## VERIFY

1. Run scoped Vitest and frontend typecheck.
2. Inspect final diff for only scoped changes and no whitespace, encoding-only, or line-ending-only changes.
3. If UI execution is available, verify desktop/narrow dialog fit and source-week distinction.

## REFINE

1. Correct only the initialization guard for load races.
2. Correct only activity filtering/date tie-breaking for nondeterministic source selection.
3. Adjust only dialog sizing, labels, focus, and responsive classes for layout/accessibility failures.
4. Stop on success, Human Gate, scope expansion, or after three iterations.

# 8. Acceptance Criteria

- **Cấu hình buổi sinh hoạt** appears as a compact, rounded, high-contrast dialog.
- Only location, start/end time, cancel, and save/update controls appear in simplified mode.
- The dialog has an accessible name, keyboard controls, visible focus, and fits narrow supported viewports.
- Empty schedule location initially shows the selected activity's non-empty `classroom`.
- Non-empty saved/user location takes precedence and remains editable.
- Saving submits the displayed classroom default or user override.
- Initial weekly display opens on the applicable source week even when it is not current.
- No valid source metadata retains current-week fallback.
- Manual navigation is not reset after initialization.
- Source week has explicit **Tuần nguồn** text and distinct grid/container treatment; other weeks do not.
- Existing create, recurrence, drag/drop, filters, daily view, and save behavior outside scope remains unchanged.
- Scoped tests and typecheck pass; final diff has no unintended changes.

# 9. Verification Commands

- `D:\PROJECT\manager_points\frontend :: npm test -- --run "src/components/activities/ActivityScheduleWorkspace.test.tsx" -> 0; scoped tests pass.`
- `D:\PROJECT\manager_points\frontend :: npm run typecheck -> 0; no TypeScript errors.`
- `D:\PROJECT\manager_points :: git diff --check -> 0; no whitespace errors.`
- `D:\PROJECT\manager_points :: git diff -- taskscope.md frontend/src/components/activities/ActivityScheduleWorkspace.tsx frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx -> 0; only scoped changes.`

# 10. Safety Gates

- Backend/data/recurrence-contract changes or any source file outside section 4: pause for explicit scope/risk approval.
- Deployment, release, merge, publish, production configuration, secrets, permissions, destructive actions, or external/paid effects: pause for explicit approval.
- Bulk encoding/line-ending conversion: pause and provide exact files, encodings, and rollback plan for approval.

# 11. Artifacts to Review

None — no Human Gate triggered. If implementation triggers one, provide the scoped diff, Vitest/typecheck output, and screenshots of the dialog and source-week treatment.

# 12. Loop_iterations Override

Loop_iterations: 3 (default, stop early on success)
