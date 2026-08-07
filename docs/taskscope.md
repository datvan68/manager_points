# Task Identity and Pipeline

Task: `registration-inline-room-assignment` | Pipeline: `feature_development` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points`

# Risk Level

Risk: medium. The change adds an interactive table action and uses the existing room/bed assignment flow across frontend and backend. It must prevent invalid or duplicate occupancy while preserving current registration behavior.

# Objective

Add an “assign room” icon to the registration table action column. Clicking it opens a select-style popover directly below the icon, where each room option shows the room name, capacity/availability, and status; choosing an eligible room completes the assignment and refreshes the row.

# Scope Boundaries

Approved/write: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, its focused test file, `frontend/src/api/dormitory-api.ts` only if typing or request behavior must change, `backend/src/dormitory/services/room-assignment.service.ts`, `backend/src/dormitory/dto/assign-room.dto.ts` only if room-only selection requires server-side bed resolution, and focused dormitory assignment tests.

# Out of Scope

Bulk room assignment, room creation/editing, transfers between rooms, occupancy reports, database migrations, destructive contract changes, redesigning the registration table, or changing unrelated registration actions.

# Context and Dependencies

The registration table already has a right-aligned “Thao tác” column and a “Phòng” column. The existing suggestion endpoint returns rooms with `room_name`, `room_code`, `bed_count`, `available_bed_count`, and `status`. The current assignment endpoint also requires a `bed_id`; therefore implementation must safely resolve an available bed when the user selects only a room and persist the assignment so the refreshed registration row displays that room. Assignment remains subject to existing approval permission and backend validation.

# Steps

1. Add a room-assignment icon to each eligible row in the existing action group, with an accessible Vietnamese label and tooltip.
2. On click, load suggested/available rooms and open one anchored popover below the clicked icon; handle loading, empty, and error states without shifting the table layout.
3. Render every option with room name (falling back to room code), available/total capacity, and localized status; disable rooms that cannot accept another student.
4. When a room is selected, resolve and reserve a valid available bed through the assignment boundary, persist the registration-room relationship, close the popover, show success/error feedback, and refresh the table.
5. Add focused frontend interaction coverage and backend assignment coverage, including unavailable-room and concurrent/duplicate-assignment protection.

# Acceptance Criteria

- AC1: The “Thao tác” column contains an assign-room icon for a formal, approved, currently unassigned registration when the user has the existing assignment permission.
- AC2: Clicking the icon opens a single select/popover visually anchored below that icon; clicking outside or pressing Escape closes it.
- AC3: Each room option shows its name or code, available beds over total beds, and a correctly accented Vietnamese status without mojibake.
- AC4: Full, locked, or maintenance rooms cannot be selected; loading, no-room, and request-failure states are visible and accessible.
- AC5: Selecting an available room assigns exactly one available bed, prevents duplicate assignment, reports the result, refreshes the registration list, and updates the row’s “Phòng” value.
- AC6: Edit, delete, approve, reject, checkbox, and responsive table behaviors remain unchanged.

# Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => focused icon, popover, option-detail, assignment, and failure-state tests pass.
- `D:\PROJECT\manager_points\backend` :: run the focused room-assignment service test selected during implementation => room-only selection resolves one available bed, persists the assignment, and rejects unavailable or duplicate assignment.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend type-checks.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles.
- `D:\PROJECT\manager_points` :: `git diff --check -- docs/taskscope.md "frontend/src/app/(dashboard)/dormitory/registrations/page.tsx" frontend/src/api/dormitory-api.ts backend/src/dormitory/services/room-assignment.service.ts backend/src/dormitory/dto/assign-room.dto.ts` => scoped diff has no whitespace errors.

# Safety Gates

Stop for a database migration, destructive replacement of an active contract, permission-model expansion, or a public API breaking change.

# Artifacts and Checkpoints

Taskscope, focused frontend/backend test output, final scoped diff, and repository status. No migration or production checkpoint is authorized.

# Execution Budgets

One writer per path; up to 3 implementation/verification iterations and 2 remediation cycles. Preserve unrelated working-tree changes and stop if correct persistence requires work outside the approved dormitory registration/assignment boundary.
