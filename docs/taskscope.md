# Task Identity and Pipeline

Task: `dormitory-area-room-uppercase-and-floor-removal` | Pipeline: `feature_development` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points`

# Risk Level

Risk: medium. The change spans the dormitory frontend and backend validation/schema defaults, but is development-only, reversible, and requires no migration or persistent-data rewrite.

# Objective

Make area and room codes uppercase by default while typing, and remove floor inputs from the “Quản lý khu vực” and “Thêm/Sửa phòng” forms without breaking room creation.

# Scope Boundaries

Approved/write: `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx`, a focused test under the same page directory, `backend/src/dormitory/dto/create-room.dto.ts`, `backend/src/dormitory/schemas/room.schema.ts`, and focused backend tests if required by the repository test layout.

# Out of Scope

Database migrations, removal of existing `floor`/`floor_count` data, public room pages, API response fields, room/building list columns, unrelated dormitory forms, and renaming domain fields.

# Context and Dependencies

Both modals are implemented in the buildings page. Area `floor_count` is already optional with a schema default of `1`. Room `floor` is currently required by both `CreateRoomDto` and `RoomSchema`, so hiding the UI field alone would make new room creation fail. Existing records and update payloads must remain compatible.

# Steps

1. Normalize `building_code` and `room_code` to uppercase in their controlled input handlers while preserving the remaining form behavior.
2. Remove “Số tầng” from the area form and “Tầng” from the room form and mutation payload.
3. Make room `floor` optional at the create boundary and give it a backend default of `1`, preserving existing stored values and response compatibility.
4. Add focused frontend coverage for uppercase input and absent floor fields, plus backend coverage for creating a room without `floor`.

# Acceptance Criteria

- AC1: Text entered or pasted into “Mã khu vực” is immediately represented in uppercase and the submitted payload is uppercase.
- AC2: Text entered or pasted into “Mã phòng” is immediately represented in uppercase and the submitted payload is uppercase.
- AC3: “Số tầng” is absent from the area create/edit form and is not sent by that form.
- AC4: “Tầng” is absent from the room create/edit form and is not sent by that form.
- AC5: A new room can be created without a client-supplied `floor`; the backend stores the compatibility default `1`.
- AC6: Existing room/building records, API response shapes, and public displays remain unchanged.

# Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/buildings/page.test.tsx"` => focused modal behavior tests pass.
- `D:\PROJECT\manager_points\backend` :: run the focused dormitory room DTO/service/schema test selected during implementation => room creation without `floor` passes.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend type-checks.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles.
- `D:\PROJECT\manager_points` :: `git diff --check -- docs/taskscope.md "frontend/src/app/(dashboard)/dormitory/buildings/page.tsx" backend/src/dormitory/dto/create-room.dto.ts backend/src/dormitory/schemas/room.schema.ts` => scoped diff has no whitespace errors.

# Safety Gates

None.

# Artifacts and Checkpoints

Taskscope, focused test output, final diff, and status. No migration or checkpoint artifact is required.

# Execution Budgets

One writer per path; up to 3 implementation/verification iterations and 2 remediation cycles. Stop on migration, persistent-data rewrite, public API removal, dependency addition, or expansion beyond the dormitory buildings/rooms boundary.
