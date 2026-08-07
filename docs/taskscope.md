Task: `registration-room-action-visibility` | `bugfix` | Risk: medium | Profile: Quick

Objective: Ensure the room-assignment icon is visible in the registration table action column for every registration that the current user is allowed to assign, and display “Chưa xếp phòng” with a subtle yellow treatment.

Boundary: Registration table presentation and assignment-action eligibility only. Preserve the existing room picker, assignment request, other row actions, permissions, and responsive behavior. | Write: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`

Targets: The `canAssignRoom`/row eligibility condition, the `actions` column renderer, the `room` column renderer, and focused render/formatting tests.

Context: The icon component already exists, but rendering is currently gated by both `canAssignRoom` and `r.source === 'FORMAL'`. Existing tests cover helper functions only and do not verify that the icon is rendered for an eligible row. The room column currently returns plain text for both assigned and unassigned states.

Steps: Verify the effective assignment permission and eligible registration states against the existing assignment endpoint; centralize the row eligibility rule so an assignable, unassigned registration reliably renders the icon; keep unsupported or already assigned rows protected; render only the exact “Chưa xếp phòng” fallback as a compact pale-yellow badge/text treatment with readable amber text; add focused UI tests for visible/hidden icon states and assigned/unassigned room styling.

Verify:

- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => eligible rows show the room icon, ineligible rows do not expose an unusable assignment action, and the unassigned label receives the yellow treatment.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend type-checks.
- `D:\PROJECT\manager_points` :: `git diff --check -- docs/taskscope.md "frontend/src/app/(dashboard)/dormitory/registrations/page.tsx" "frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => scoped diff has no whitespace errors.

Done: A permitted user can see the room-assignment icon on every eligible unassigned registration; clicking it retains the existing room picker behavior; “Chưa xếp phòng” is shown with a light yellow background and amber text; assigned room names and all other table actions remain visually and functionally unchanged.

Gate: Stop if making non-formal registrations assignable requires a backend lifecycle or permission change; promote that work to a separate Full scope rather than exposing an action that cannot succeed.
