# Task Identity and Pipeline

- Task: `dormitory-bed-capacity-and-explicit-bed-picker`
- Pipeline: `feature_development` + `bug_fix`
- Profile: Full; rules version `3.2.0`
- Repository: `D:\PROJECT\manager_points`; branch `main`; base commit `13333a7d`; initial worktree clean.

# Risk Level

- Risk: medium. The task changes room-capacity presentation and assignment selection across the dormitory frontend/backend, but does not authorize persistent-data repair, migration, deployment, or production changes.
- Main risks: displaying a declared bed count instead of persisted beds, accidentally allowing selection of occupied/maintenance beds, hiding the student's current bed, or submitting a reassignment when the current bed is clicked.
- Reversibility: all scoped source and test changes are Git-revertible.

# Objective

The buildings table has one `Giường` column whose value is the room's actual persisted bed count and therefore the maximum number of students the room can receive. The room-assignment picker shows every bed in the relevant room, including the student's current bed, marks that bed `Đang chọn`, and only submits a valid different available bed.

# Scope Boundaries

- Frontend: `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx`, `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `frontend/src/api/dormitory-api.ts` only if the response typing must be aligned, and focused tests beside/in `frontend/src/api/dormitory-api.test.ts`.
- Backend: `backend/src/dormitory/services/room-assignment.service.ts`, `backend/src/dormitory/services/rooms.service.ts`, their focused tests, and a response DTO/type only if required to identify the current room/bed without ambiguity.
- Capacity source of truth: the count of persisted `beds` documents for a room. Existing projected `max_students` may remain an internal/API field, but the buildings UI must present it under the single heading `Giường`; it must not add or retain a `Số SV tối đa` column.
- Assignment source of truth: the effective `room_id` and `bed_id` from the registration list response, including active-contract normalization already implemented.
- Bed picker states:
  - current effective bed: visible, disabled, text `Đang chọn`;
  - other `Trống` bed in an assignable room: visible and selectable;
  - `Đang sử dụng` or `Bảo trì` bed: visible, disabled, with its status shown;
  - the current room remains visible even when it has no other free bed.

# Out of Scope

- Creating, deleting, reconciling, or migrating bed records; changing `rooms.bed_count`; database writes outside the normal assignment transaction.
- Removing `max_students` from the backend/API if other consumers still require it. This task changes the user-facing column name and mapping, not the established capacity projection contract.
- Changing assignment concurrency/rollback rules, room pricing, permissions, registration approval, floor removal, deployment, or production data.
- Allowing the current bed, another occupied bed, or a maintenance bed to be submitted.

# Context and Dependencies

- The buildings table currently renders `max_students` under `Số SV tối đa` and also shows `current_students`. The requested change is to rename only the maximum-capacity column to `Giường`, still using persisted-bed-derived `max_students`; `rooms.bed_count` must not be used as a fallback when it disagrees with persisted beds.
- `RoomAssignmentPopover` currently presents rooms, removes the current room from suggestions, fetches beds only after a room click, automatically chooses the first free bed, and never renders individual beds. This cannot display or label the current bed.
- Registration list rows already carry populated/effective `room_id` and `bed_id`. `beds.getByRoom(roomId)` returns all bed records and includes `bed_code` and `status`.
- `suggestRooms()` currently filters out rooms with zero free beds. It must include the effective current room for display while preserving existing eligibility filters for other suggested rooms; read paths must remain read-only.
- The assignment endpoint already accepts an explicit `{ registration_id, room_id, bed_id }` and rejects reselecting the current bed or reserving a non-free bed. Those backend safeguards remain authoritative.

# Steps

1. Add focused failing tests for the `Giường` column mapping and for a bed-level assignment picker that shows all bed states, including the current bed labelled `Đang chọn`.
2. Adjust the room suggestion projection so the effective current room is returned even when full, without admitting unrelated full/locked/maintenance rooms or performing writes during the read request.
3. Refactor `RoomAssignmentPopover` into explicit room-and-bed selection: load/render every bed for the chosen room, identify the current effective bed by normalized ID, and keep unavailable beds visible but disabled.
4. Submit assignment only when the user clicks a different `Trống` bed. Keep the current bed disabled with `Đang chọn`; show the backend bed status for other disabled beds; preserve loading, empty, and error states.
5. Replace the buildings table heading `Số SV tối đa` with `Giường` and render the persisted-bed-derived maximum (`max_students`). Do not introduce a second maximum-capacity column and do not fall back to declared `bed_count`.
6. Run focused frontend/backend tests, frontend typecheck, backend build, and inspect the final diff/status for unintended changes.

# Acceptance Criteria

- AC1: The buildings table contains `Giường` and does not contain `Số SV tối đa`; its displayed value equals the backend count of persisted beds (`max_students`), which is the maximum students accepted for that room.
- AC2: A room with declared `bed_count = 5` but one persisted bed displays `Giường = 1`; the UI does not silently show 5.
- AC3: Opening assignment/change-room shows the effective current room and every persisted bed in a selected room, including free, occupied, maintenance, and current beds.
- AC4: The effective current bed is visually labelled exactly `Đang chọn`, remains visible even when its status is `Đang sử dụng`, and cannot trigger an API request.
- AC5: A different free bed is selectable and sends its exact `room_id` and `bed_id`. Occupied/maintenance beds remain visible but disabled and send no request.
- AC6: If the current room has no other free bed, it is still present so the current bed can be seen; unrelated rooms with no assignable beds are not offered as choices.
- AC7: Assignment errors keep the picker state understandable and do not optimistically change the table row; successful assignment applies the server-confirmed room/bed and closes the picker.
- AC8: Suggestion and bed-list reads perform no inserts, updates, deletes, or automatic reconciliation.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/room-assignment.service.spec.ts dormitory/services/rooms.service.spec.ts` => current-room suggestion inclusion, unrelated-full-room exclusion, read-only behavior, and persisted-bed capacity projection pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/registrations/page.test.tsx" "src/app/(dashboard)/dormitory/buildings/page.test.tsx" "src/api/dormitory-api.test.ts"` => explicit bed states/selection, `Đang chọn`, exact assignment DTO, error behavior, and `Giường` mapping pass. Create the missing buildings test file within scope.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => TypeScript passes.
- Manual development check: open a student's room picker, verify the current bed plus all sibling beds and statuses, click the current/occupied/maintenance beds and confirm no request, then select another free bed and confirm the row updates to the server-confirmed assignment.

# Safety Gates

- Gate: None for scoped source edits, tests, builds, and read-only development inspection.
- Persistent database repair/migration, deployment, production mutation, or destructive cleanup is not authorized and requires a separate explicit request and applicable Human Gate.

# Artifacts and Checkpoints

- Base checkpoint: commit `13333a7d`; clean worktree before this planning edit.
- Required execution evidence: focused test/build/typecheck outputs and final `git diff`/status.
- Do not log connection strings, credentials, or student PII.

# Execution Budgets

- Serialize backend suggestion-contract changes before frontend picker alignment; one writer per path.
- Step deadline: 900 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
- Stop and amend scope if implementation requires a new collection/schema, persistent bed repair, a public breaking API change, modules outside the listed dormitory boundary, production effects, or security-sensitive work.
