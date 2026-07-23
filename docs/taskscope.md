Task: `activity-card-registration-action` | `bug_fix` | Risk: medium | Profile: Quick

Objective: Make the activity-card registration action follow the activity’s registration requirement and visually match the activity-list control-bar buttons.

Boundary: `frontend/src/components/activities/**` | Write: `frontend/src/components/activities/ActivityCard.tsx`, `frontend/src/components/activities/ActivityCard.test.tsx`.

Targets: `ActivityCard` membership action branch for `membership_status === 'none'`; `activity.settings.require_registration_for_attendance`; registration-button classes; the glass/outlined control-button treatment in `ActivityListWorkspace.tsx` as a read-only design reference.

Steps: Baseline the current student registration action -> suppress it only when `require_registration_for_attendance === false` while preserving legacy `undefined` behavior -> replace the solid registration-button treatment with the menu/control-bar visual language at card scale, including hover, disabled, focus, and dark/light-card readability -> add focused rendering and interaction regressions -> inspect the final diff.

Verify: `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/activities/ActivityCard.test.tsx` => required-registration cards retain a working registration action, no-registration cards have no registration button, and pending state remains disabled; `npm run typecheck` => no affected TypeScript errors; repository root :: `git diff --check` => clean diff.

Done: Student cards with “No registration required” do not render “Đăng ký”; required or legacy cards keep the action; its appearance matches the activity menu’s translucent outlined buttons without changing membership callbacks, other membership states, table view, or detail-page behavior.

Gate: None
