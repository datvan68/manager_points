Task: `registration-room-picker-popover` | `bugfix` | Risk: medium | Profile: Quick

Objective: Clicking the room-assignment icon in the registration table opens a compact room picker directly below the icon, with each room showing its name, capacity/available quantity, and status.

Boundary: Registration room-picker UI and its focused tests only. Preserve the existing room suggestion API, bed selection and assignment flow, table actions, permissions, loading/error handling, and Vietnamese UI labels. The “small modal” is an anchored non-blocking popover, not a page-level dialog. | Write: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`

Targets: Room-assignment action renderer, `PopoverTrigger`/`PopoverContent` placement, room option rows, open/close state, and focused interaction tests.

Steps: Baseline the current room picker and room data shape; extract or simplify the dense action renderer where needed; anchor the compact picker with `side="bottom"` and suitable alignment/collision behavior so it appears beneath the clicked icon; present each option with room name/code, available beds versus total beds, and localized status; keep unavailable/full/locked/maintenance rooms visibly disabled; retain loading, empty, error, assignment-in-progress, and close-after-success behavior; add tests for opening from the icon, rendered room details, disabled states, and popover placement attributes.

Verify:

- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => clicking the room icon opens the picker, room name/quantity/status are shown, and unavailable rooms cannot be selected.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend type-checks.
- `D:\PROJECT\manager_points` :: `git diff --check -- docs/taskscope.md "frontend/src/app/(dashboard)/dormitory/registrations/page.tsx" "frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => scoped diff has no whitespace errors.

Done: The room icon reliably opens one compact picker beneath its trigger; every returned room displays name, available/total bed quantity, and Vietnamese status; invalid choices remain disabled; selecting an available room retains the current assignment behavior; other registration actions are unchanged.

Gate: None
