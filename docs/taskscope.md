Task: `activity-create-modal-usability` | `bug_fix` | Risk: medium | Profile: Quick

Objective: Make the “Create new activity” popup usable and context-aware: the advisor list scrolls, club-only fields stay club-only, unnecessary registration controls disappear, and selected media is previewed.

Boundary: `frontend/src/components/**` | Write: `frontend/src/components/activities/ActivityForm.tsx`, `frontend/src/components/ui/select.tsx` only if the shared dropdown needs a bounded scrolling fix, and `frontend/src/components/activities/ActivityForm.test.tsx`.

Targets: advisor `SelectContent`; `activity_type`/`category` controls; create-mode `president_id`; advanced-settings visibility; logo/cover file state and preview lifecycle.

Steps: Reproduce/inspect popup behavior -> make the advisor menu wheel/touch scroll within a capped viewport -> show “Category” only for `club` and normalize non-club category to the existing API-safe value -> omit President from create UI/payload while preserving edit behavior -> hide the entire advanced section when registration is not required -> render logo and cover previews immediately after valid file selection and release object URLs -> add focused regressions -> inspect final diff.

Verify: `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/activities/ActivityForm.test.tsx` => all five popup behaviors pass; `npm run typecheck` => no affected TypeScript errors; repository root :: `git diff --check` => clean diff.

Done: Advisor options are scrollable; Category appears only for Club; create mode has no President field or payload value; “No registration required” hides Advanced settings; valid logo/cover files show distinct previews; edit/API behavior outside these rules is unchanged.

Gate: None
