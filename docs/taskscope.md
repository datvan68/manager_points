# 1. Task ID + Pipeline

- Task ID: `ACTIVITY-SCHEDULE-WEEK-CAPTURE-20260716`
- Pipeline: `feature_development`

# 2. Risk Level

Low — the change is limited to the development frontend schedule toolbar, weekly schedule rendering, client-side image export, and related tests. It requires no elevated permissions, does not alter persisted data, has no external communication by itself, and is reversible through a source diff.

# 3. Objective

Simplify the `/activities/schedule` toolbar by reducing the visible time text and replacing the refresh control with a weekly schedule image-capture action. The exported image must include every scheduled activity, including activities hidden behind the normal in-session scrollbar.

# 4. Scope

- `frontend/src/app/(dashboard)/activities/schedule/page.tsx` — `/activities/schedule` route composition: provide only the state, schedule reference, and callback wiring required by the compact toolbar and weekly image export; new technical content must be in English.
- `frontend/src/components/activities/ActivityScheduleWorkspace.tsx` — schedule toolbar and capture orchestration: replace the refresh icon action with a weekly schedule capture icon, reduce the visible time copy to a compact week range, expose an accessible Vietnamese label/tooltip for image capture, handle capture progress and failure feedback, and download the generated weekly schedule image; new technical content must be in English, with required Vietnamese UI strings as approved functional exceptions.
- `frontend/src/components/activities/ActivityScheduleTimeline.tsx` — weekly schedule capture target and capture-only layout: mark the exact weekly schedule region to export and render or clone a temporary capture state that removes per-session height limits and overflow scrolling so all activities appear in the image, then restore the normal scrollable UI without changing its interaction state; new technical content must be in English.
- `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx` — toolbar and export tests: verify compact time text, replacement of the refresh control, capture progress/error behavior, image generation, filename, and cleanup; new test names, fixtures, and assertion messages must be in English, except exact Vietnamese UI strings required by behavioral assertions.
- `frontend/src/components/activities/ActivityScheduleTimeline.test.tsx` — capture-layout regression tests: verify normal sessions remain scrollable when they contain more than two activities and the capture-only representation includes every activity without clipped or scroll-hidden content; new test content must be in English, except exact existing localized activity content used as fixtures.

# 5. Out of Scope

- Backend files, APIs, DTOs, database schemas, migrations, schedule persistence, and stored activity data.
- Adding, removing, or upgrading npm dependencies; reuse the repository's existing compatible `html-to-image` capability.
- Automatic upload, email, messaging, social sharing, clipboard writes, Web Share integration, or any other external communication.
- Changes to schedule creation, editing, deletion, recurrence, cancellation, registration, permissions, or refresh/data-fetch behavior outside removal of the toolbar refresh control.
- The club schedule route and components under `frontend/src/app/(dashboard)/club/**`.
- Redesign of the entire schedule page, timeline, cards, navigation, or shared icon system.
- Deployment, release, merge, publish, CI/CD changes, broad formatting, unrelated refactoring, translation, bulk localization changes, or encoding conversion.
- Existing user changes outside the listed Scope files.

# 6. Context & Dependencies

- The route exists at `frontend/src/app/(dashboard)/activities/schedule/page.tsx`; related schedule UI and tests exist in `ActivityScheduleWorkspace` and `ActivityScheduleTimeline`.
- Repository history contains use of `html-to-image`; implementation must confirm that a compatible installed API is still available before using it. If it is absent, adding a dependency requires Scope clarification.
- The normal schedule UI may use a vertical scrollbar when a session contains more than two activities. That compact behavior must remain unchanged outside capture.
- Image capture must use a detached/off-screen clone or an equivalent temporary capture-only state. The capture target must remove `max-height` and `overflow` constraints, measure its full content, wait for layout/fonts to settle, export once, and clean up in a `finally` path.
- The capture must not permanently change the selected week, scroll positions, expanded state, filters, or schedule data.
- The visible time value must omit redundant descriptive text and show only a compact current-week range in `dd/MM – dd/MM/yyyy` form, with the year displayed once when the range is within one year and on both endpoints when it crosses a year boundary.
- The exported PNG filename must be deterministic and contain the displayed week bounds, for example `activity-schedule-2026-07-13_2026-07-19.png`.
- Windows with PowerShell is the current execution environment.
- All new technical content must be English. Exact Vietnamese user-facing labels and feedback for the capture action are approved functional localization exceptions.
- Preserve existing UTF-8 encoding, BOM state, and line endings. Terminal mojibake must not be treated as file corruption.

# 7. Steps

## PLAN

- Inspect the route, toolbar, timeline DOM structure, normal overflow rules, existing icon imports, `html-to-image` usage/API, tests, and verified frontend package scripts.
- Identify the existing refresh control and confirm whether data refresh is available elsewhere before removing only this toolbar affordance.
- Identify the smallest schedule DOM boundary that represents one complete displayed week without unrelated page controls or modals.
- Confirm Scope, Out of Scope, low risk, Safety Gates, verification commands, English technical content, Vietnamese UI exceptions, and encoding conventions.
- Resolve missing capture-library support or browser limitations before editing.

## EXECUTE

- In `ActivityScheduleWorkspace.tsx`, replace the refresh icon/button with a camera/image capture icon button while preserving consistent toolbar sizing and responsive layout.
- Format the visible current-week time as a compact date range and retain the complete meaning through an accessible name or tooltip.
- Add capture state that prevents duplicate captures, communicates progress, handles failure through the existing feedback pattern, and always resets after completion or error.
- In `ActivityScheduleTimeline.tsx`, expose the weekly schedule capture boundary and create an off-screen or temporary capture-only representation with every session activity fully laid out and no vertical clipping or scrollbar.
- Wait for the capture representation to complete layout, generate one PNG using the existing compatible `html-to-image` API, trigger a deterministic client-side download, and remove all temporary DOM/state in a `finally` path.
- Preserve the normal rule that sessions with more than two activities remain compact and scrollable when the user is not capturing.
- Update scoped tests for the compact toolbar, accessible capture control, complete multi-activity export, successful download, error recovery, and cleanup.
- Modify only Scope files and preserve unrelated working-tree changes.

## VERIFY

- Run the targeted workspace and timeline tests through the repository-native frontend test script confirmed during PLAN.
- Run frontend type-checking and linting only through scripts verified in `frontend/package.json`.
- Manually inspect `/activities/schedule` at desktop and narrow widths with a week containing a session of at least three activities.
- Confirm normal mode retains its scrollbar, while the captured PNG displays all activities without clipping, overlapping, omitted rows, or visible scrollbars.
- Confirm the toolbar remains compact, the capture action is keyboard accessible, and no refresh icon remains in that toolbar location.
- Inspect the final diff for Scope, localization, encoding, and line-ending compliance.

## REFINE

- Identify the exact failed acceptance criterion and apply the smallest in-Scope correction.
- Re-run the affected targeted test and recapture the multi-activity fixture before broader verification.
- Preserve English technical content and approved Vietnamese UI exceptions during corrections.
- Stop on success, a Human Gate, Scope expansion, increased risk, missing compatible capture support, or the iteration limit.

# 8. Acceptance Criteria

1. The `/activities/schedule` toolbar displays the selected week as a compact `dd/MM – dd/MM/yyyy` range without redundant time-description text; a cross-year week displays both years.
2. The toolbar refresh icon/control is replaced by a camera/image capture icon control and is not rendered in its previous location.
3. The capture control has an accessible Vietnamese name or tooltip that clearly describes capturing the weekly schedule and is operable by keyboard.
4. Activating capture while another capture is running does not create a duplicate export.
5. A successful capture downloads one PNG whose deterministic filename contains the selected week's ISO start and end dates.
6. The PNG contains the complete displayed week and excludes unrelated toolbar controls, open modals, temporary capture UI, and scrollbars.
7. When any session contains more than two activities, normal UI mode remains constrained and scrollable, but the exported PNG visibly includes every activity from that session without clipping, overlap, or omission.
8. After successful or failed capture, all temporary cloned DOM, capture-only styles, object URLs, and loading state are cleaned up, and the user's week, filters, and scroll positions are unchanged.
9. Capture failure uses the existing feedback pattern and leaves the capture action usable for a later retry.
10. Targeted workspace and timeline regression tests pass, including the three-or-more-activities capture case.
11. The final diff contains only scoped files and does not overwrite unrelated working-tree changes.
12. All newly written technical content is English; non-English additions are limited to the explicitly required Vietnamese UI labels or localized test assertions.
13. Existing localized content remains unchanged except for the authorized toolbar text adjustment, and no unintended translation occurs.
14. Touched files preserve project encoding, BOM, and line-ending conventions; no `U+FFFD` character or encoding-only diff is introduced.

# 9. Verification Commands

- `frontend :: npm test -- ActivityScheduleWorkspace.test.tsx ActivityScheduleTimeline.test.tsx -> 0; all targeted toolbar and full-week capture regression tests pass`
- `D:\PROJECT\manager_points :: git diff --check -> 0; no whitespace errors are reported`
- `D:\PROJECT\manager_points :: git diff -- "frontend/src/app/(dashboard)/activities/schedule/page.tsx" frontend/src/components/activities/ActivityScheduleWorkspace.tsx frontend/src/components/activities/ActivityScheduleTimeline.tsx frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx frontend/src/components/activities/ActivityScheduleTimeline.test.tsx -> 0; only intended schedule toolbar, capture, and test changes are present`
- `D:\PROJECT\manager_points :: git status --short -> 0; changed files are reviewed against Scope and pre-existing unrelated changes remain untouched`
- `Manual browser verification at /activities/schedule :: capture a week containing at least three activities in one session -> pass; normal UI scrolls and the downloaded PNG shows all activities without a scrollbar or clipped content`

# 10. Safety Gates

- Trigger: no compatible installed `html-to-image` capability exists or implementation requires an npm dependency change. Pause dependency modification and obtain explicit user approval for exact Scope expansion.
- Trigger: capture requires upload, sharing, clipboard access, browser permission, paid service, or external communication. Pause the affected action and obtain explicit user approval; local PNG download alone does not trigger this gate.
- Trigger: any backend, API, DTO, database, schema, migration, authentication, authorization, or permission change. Pause before modification and obtain explicit user approval for Scope expansion and reassessed risk; database migration also requires the mandatory Human Gate.
- Trigger: modification of any file outside Scope or an increase above low risk. Pause before editing and obtain explicit user approval for the exact expansion.
- Trigger: production deployment, release, merge, publish, CI/CD change, destructive action, or secret/credential operation. Pause and obtain the approval required by `safety.md`.
- Trigger: bulk translation, localization changes, or encoding conversion. Pause affected writes and obtain explicit user approval with exact files, rollback plan, and review evidence.
- Approval for one gate does not authorize unrelated gated actions.

# 11. Artifacts to Review

None — no Human Gate is triggered by writing this taskscope or by the currently scoped local frontend implementation.

# 12. Loop_iterations Override

Loop_iterations: 3 (default, stop early on success)
