# Task: dormitory-rooms-workspace-redesign

- Pipeline: `feature_development`
- Risk: high
- Profile: Full
- Repository: `D:\PROJECT\manager_points`
- Base: current working tree

## Objective

Replace the current **“Khu vực & Phòng”** workspace with a **“Phòng”** tab that follows the existing KTX registration workspace design. It must provide a shared-style menu bar, room and area create/edit dialogs, and a responsive room table with accurate occupancy data.

## Boundary

### Frontend writes

- `frontend/src/app/(dashboard)/dormitory/layout.tsx`
- `frontend/src/app/(dashboard)/dormitory/layout.test.tsx`
- `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx`
- A focused page test beside the buildings page, if absent
- `frontend/src/api/dormitory-api.ts`
- `frontend/src/api/dormitory-api.test.ts` only when the room response/input contract needs focused coverage

### Backend writes

- `backend/src/dormitory/controllers/rooms.controller.ts` only if its list contract must expose new query/response fields
- `backend/src/dormitory/services/rooms.service.ts`
- `backend/src/dormitory/schemas/room.schema.ts`
- `backend/src/dormitory/dto/create-room.dto.ts`
- `backend/src/dormitory/dto/update-room.dto.ts`
- Focused room controller/service specs under `backend/src/dormitory/`
- `backend/src/dormitory/dormitory.module.ts` only if dependency injection for occupancy aggregation requires it

### Reference only / exclusions

- Reuse the menu bar, responsive table, dialog surface, spacing, colors, and controls from `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`.
- Reuse `Research`, `Button`, `Input`, `Select`, `Dialog`, `ResponsiveDataView`, and `CustomPagination`; do not introduce another UI library or duplicate these primitives.
- Preserve existing room QR generation/public room URLs, bed management, room assignment, permissions, and building APIs.
- Exclude direct MongoDB writes, backfills, deletion of legacy room/building data, redesign of other KTX tabs, deployment, and unrelated refactors.

## Required changes

1. Rename only the dormitory navigation label **“Khu vực & Phòng”** to **“Phòng”** while retaining the existing tab id and `/dormitory/buildings` route so bookmarks and active-tab behavior remain compatible.
2. Replace the page heading/card toolbar with the same compact glass-style menu bar used by **“Đăng ký”**:
   - responsive `Research` input that searches room code and room name;
   - icon `Button` for **“Thêm phòng”**;
   - icon `Button` for **“Thêm khu vực”**;
   - accessible labels/tooltips and permission-based visibility for create actions;
   - loading/refresh behavior consistent with the registration workspace.
3. Replace the building-card/room-card split with a responsive room data view/table. Desktop columns must be ordered exactly as:
   - **Mã phòng**;
   - **Tên phòng**;
   - **Tổng số giường**;
   - **Tổng số sinh viên tại phòng**;
   - **Thao tác**.
4. The action column supplies the scoped CRUD entry points: create remains in the menu bar; each row exposes edit and delete icon buttons. Keep room QR access only if it fits the action group without changing the five required table columns. All action buttons must have accessible names and obey `DORM_ROOM_CREATE`, `DORM_ROOM_UPDATE`, and `DORM_ROOM_DELETE` permissions.
5. Add pagination, loading, empty, error, and mobile-card states using the same `ResponsiveDataView`/`CustomPagination` pattern as **“Đăng ký”**. Search resets the page and is sent to the room list endpoint rather than filtering only the loaded page.
6. Add an explicit room display-name field (for example `ten_phong`) to the room frontend type, DTO validation, and schema. New rooms require both room code and room name. Existing legacy records without a name display `ma_phong` as a safe fallback and remain editable; no migration/backfill is part of this task.
7. Return an explicit read-only occupancy field (for example `total_students`) in each room-list row. Compute it server-side from active KTX contracts assigned to that room (`trang_thai = “Hiệu lực”`), not from `so_giuong - so_giuong_trong`, and do not persist this derived count in the room document.
8. Extend room search to match both `ma_phong` and `ten_phong`. Preserve existing building, status, and room-type filters supported by the endpoint.
9. Implement **add/edit room** dialogs with the same `DialogContent` gradient background, translucent border, header/footer, spacing, responsive width, and validation/error treatment as the **“Thêm đăng ký”** dialog. Use existing `Input` and `Select` components for fields such as area, room code, room name, floor, room type, bed count, price, and status; retain current room fields required by the backend.
10. Implement **add/edit area** dialogs with the same dialog design and existing `Input`/`Select` primitives. Preserve area code, name, address, floor count, status, and description behavior. Editing can be reached through an area selector/management control inside the area dialog without restoring the old card layout.
11. Dialog state must be deterministic: opening create clears stale edit data; opening edit loads the selected entity; cancel/close does not save; successful save closes/resets and refreshes the room table plus affected area options. Disable repeated submission and show precise validation, duplicate, dependency, delete-conflict, and server errors.
12. Deletion remains confirmation-gated. Preserve backend safeguards preventing removal of a room with occupied beds and surface that conflict to the user. Do not cascade-delete students, contracts, or assignments from this UI change.
13. Preserve current QR/public-room behavior, room availability synchronization, server permission guards, and all functionality outside this tab.

## Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run 'src/app/(dashboard)/dormitory/layout.test.tsx' 'src/app/(dashboard)/dormitory/buildings/page.test.tsx' 'src/api/dormitory-api.test.ts'` => covers renamed tab, menu actions, search/pagination, required table columns, permission-aware actions, dialog create/edit/reset behavior, and room API payloads.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand dormitory/services/rooms.service.spec.ts dormitory/controllers/rooms.controller.spec.ts` => covers room-name validation/search, legacy fallback contract, active-contract occupancy aggregation, pagination, CRUD conflicts, and unchanged filters.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no introduced TypeScript errors.
- `D:\PROJECT\manager_points\backend :: npm run build` => NestJS build and dependency injection pass.
- Manual mocked/isolated verification at desktop and mobile widths:
  - tab label is **“Phòng”** and remains selected on `/dormitory/buildings`;
  - menu search and both add buttons follow the registration-tab design;
  - room and area dialogs use the registration-modal surface and shared controls;
  - table shows the five required columns and an accurate active-student count;
  - create, edit, delete, validation, conflict, empty, loading, and permission states behave correctly;
  - legacy rooms without `ten_phong` render without crashing.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => only intended changes and no whitespace errors.

## Done

- The KTX tab is labeled **“Phòng”** and presents the requested registration-style menu bar and room table.
- Room and area create/edit flows use the shared design-system components and modal styling.
- Every room row exposes room code, room name, total beds, server-derived active student count, and permitted actions.
- Existing QR, room assignment, bed availability, permission, and legacy-room behavior remain compatible.
- Focused tests, frontend typecheck, backend build, and final diff checks pass.

## Gate

Planning-only: this taskscope authorizes no implementation, schema deployment, migration, deletion, or persistent-data mutation. Implementation requires a separate explicit request. Automated tests must use mocks or an isolated test database. Any operation that creates, updates, or deletes records in the connected MongoDB requires explicit persistent-data authority and the applicable Human Gate.
