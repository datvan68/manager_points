Task: `fix-null-room-assignment-id` | `bug_fix` | Risk: medium | Profile: Quick

Objective: Prevent the dormitory registrations page from crashing when an unassigned registration has `room_id` or `bed_id` equal to `null`, while preserving room assignment and unassignment behavior.

Boundary: `frontend/src/app/(dashboard)/dormitory/registrations/**` and its dormitory API types | Write: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`, `frontend/src/api/dormitory-api.ts`

Targets: `DormRegistration.room_id`, `DormRegistration.bed_id`, and the current-room/current-bed ID normalization in `RoomAssignmentPopover`.

Steps: Confirm the registration list intentionally supplies `null` for unassigned room/bed values -> update the frontend contract to represent nullable values -> normalize populated objects, string IDs, `null`, and `undefined` without property access on null -> add a focused render regression for an unassigned row and retain coverage for assigned string/object IDs -> run focused tests and type checking.

Verify: `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => registration-page tests pass, including a `RoomAssignmentPopover` render with `room_id: null` and `bed_id: null`; `npm run typecheck` => no introduced TypeScript errors; repository root :: `git diff --check` => valid patch formatting.

Done: Rendering an unassigned registration no longer throws; assigned string and populated-object IDs still select/compare correctly; assign and unassign actions remain unchanged; no backend/API behavior is modified.

Gate: None
