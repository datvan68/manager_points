# Task: dormitory-rooms-workspace-redesign

- Pipeline: `feature_development`
- Risk: high
- Profile: Full
- Repository: `D:\PROJECT\manager_points`
- Base: current working tree

## Objective

Complete the **“Phòng”** tab so it follows the existing KTX registration workspace design. It must provide matching page spacing, a room table with actionable row selection, room type and VND price data, accurate occupancy data, a single area-management dialog with full CRUD, safe single/bulk delete confirmation, and registration-style mobile card/infinite-load behavior.

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

- Reuse the menu bar, page padding/gaps, responsive table/card surface, dialog styling, colors, and controls from `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`.
- Reuse `Research`, `Button`, `Input`, `Select`, `Dialog`, `ResponsiveDataView`, `CustomPagination`, `FloatingActionBar`, and `ConfirmModal`; do not introduce another UI library or duplicate these primitives.
- Preserve existing room QR generation/public room URLs, bed management, room assignment, permissions, and building APIs.
- Exclude direct MongoDB writes, backfills, deletion of legacy room/building data, redesign of other KTX tabs, deployment, and unrelated refactors.

## Required changes

1. Rename only the dormitory navigation label **“Khu vực & Phòng”** to **“Phòng”** while retaining the existing tab id and `/dormitory/buildings` route so bookmarks and active-tab behavior remain compatible.
2. Use the same outer layout spacing as **“Đăng ký”**, including equivalent left/right and top/bottom padding, vertical gap between the menu bar and data surface, scroll behavior, rounded border, shadow, and translucent background. Avoid an extra heading, area-chip row, or wrapper margin that makes the content narrower or taller than the registration tab.
3. Use the same compact glass-style menu bar as **“Đăng ký”**:
   - responsive `Research` input that searches room code and room name;
   - `Button` with the add icon and visible text **“Thêm phòng”**; retain an accessible name and allow a compact responsive treatment only where required on narrow screens;
   - one icon `Button` labeled **“Quản lý khu vực”** that opens the area-management dialog; it must not directly open a blank create-area form;
   - accessible labels/tooltips and permission-based visibility for create actions;
   - loading/refresh behavior consistent with the registration workspace.
4. Replace the building-card/room-card split with a responsive room data view/table. Desktop must start with a checkbox selection column, followed by columns ordered exactly as:
   - **Mã phòng**;
   - **Tên phòng**;
   - **Loại phòng**;
   - **Giường** (rename the current **“Tổng số giường”** header);
   - **Số sinh viên** (rename the current **“Tổng số sinh viên tại phòng”** header);
   - **Giá phòng**;
   - **Thao tác**.
5. Render **Loại phòng** from the existing `loai_phong` field and **Giá phòng** from the existing `gia_phong` field. Format room prices consistently in Vietnamese locale with the `VNĐ` unit, define a safe display for zero/missing legacy values, and do not change the stored numeric value or API/schema contract.
6. Connect `ResponsiveDataView.selection` to controlled room selection state. The header checkbox selects or clears only the currently loaded desktop page, each desktop row and mobile card has its own checkbox, and selection is cleared when search/filter/page-size context changes.
7. When at least one room is selected, show the shared `FloatingActionBar` with the selected count, a clear-selection control, and a permission-aware **“Xóa”** action. The action must:
   - appear only for users with `DORM_ROOM_DELETE` and never bypass existing per-room server permission/dependency checks;
   - open a danger `ConfirmModal` that identifies the selected count before any request is sent;
   - reuse the existing room delete API for each selected id without adding a new bulk endpoint in this task;
   - prevent repeated submission, avoid optimistic removal, refresh the room list after completion, clear only successfully deleted selections, and report full success, full failure, or partial success with actionable conflict/error feedback.
8. Right-align the **“Thao tác”** header, cells, and icon group flush with the table's right content edge while preserving the standard horizontal cell padding. Create remains in the menu bar; each row exposes edit and delete icon buttons. Keep room QR access only if it fits the action group without changing the required data columns. All actions must have accessible names and obey `DORM_ROOM_CREATE`, `DORM_ROOM_UPDATE`, and `DORM_ROOM_DELETE` permissions.
9. Replace native `window.confirm` room deletion with shared `ConfirmModal` using the danger variant. Clicking delete only opens the confirmation; cancellation performs no API call; confirmation is single-submit, shows the room identity, calls the delete endpoint once, closes on success, refreshes data, and surfaces occupied-room/server conflicts without optimistic removal.
10. Desktop retains `CustomPagination`. Mobile/tablet uses `ResponsiveDataView` cards and hides pagination, matching **“Đăng ký”** with an internal scroll container, sentinel plus `IntersectionObserver`, appended next-page results, loading/end states, and retry on load-more failure. Prevent duplicate concurrent page loads; reset the accumulated list and mobile cursor on search/filter/page-size changes.
11. Search is sent to the room-list endpoint rather than filtering only loaded data. Desktop page changes replace rows; mobile page changes append de-duplicated rows. Loading, empty, initial-error, refresh, and load-more-error states must remain distinct.
12. Add an explicit room display-name field (for example `ten_phong`) to the room frontend type, DTO validation, and schema. New rooms require both room code and room name. Existing legacy records without a name display `ma_phong` as a safe fallback and remain editable; no migration/backfill is part of this task.
13. Return an explicit read-only occupancy field (for example `total_students`) in each room-list row. Compute it server-side from active KTX contracts assigned to that room (`trang_thai = “Hiệu lực”`), not from `so_giuong - so_giuong_trong`, and do not persist this derived count in the room document.
14. Extend room search to match both `ma_phong` and `ten_phong`. Preserve existing building, status, and room-type filters supported by the endpoint.
15. Implement **add/edit room** dialogs with the same `DialogContent` gradient background, translucent border, header/footer, spacing, responsive width, and validation/error treatment as the **“Thêm đăng ký”** dialog. Use existing `Input` and `Select` components for fields such as area, room code, room name, floor, room type, bed count, price, and status; retain current room fields required by the backend.
16. Replace the standalone add-area dialog and area chips with one **area-management dialog** opened from the menu bar. The dialog:
    - lists all areas and exposes permission-aware **add**, **edit**, and **delete** actions;
    - provides a clear empty state and a create action inside the modal;
    - uses the registration-modal surface and existing `Input`/`Select` primitives for area code, name, address, floor count, status, and description;
    - supports create/edit without leaving the modal, returning predictably to the refreshed area list after save or cancel;
    - uses `ConfirmModal` with danger styling for area deletion and preserves backend dependency/conflict safeguards.
17. Dialog state must be deterministic: opening create clears stale edit data; opening edit loads the selected entity; cancel/close does not save; successful room save closes/resets; successful area mutation refreshes the management list, room table, and room-form area options as applicable. Disable repeated submission and show precise validation, duplicate, dependency, delete-conflict, and server errors.
18. Preserve current QR/public-room behavior, room availability synchronization, server permission guards, non-cascading deletion, and all functionality outside this tab.

## Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- --run 'src/app/(dashboard)/dormitory/layout.test.tsx' 'src/app/(dashboard)/dormitory/buildings/page.test.tsx' 'src/api/dormitory-api.test.ts'` => covers renamed tab, registration-matched spacing, visible **“Thêm phòng”** button text, room selection, `FloatingActionBar`, single/bulk `ConfirmModal` delete flows including partial failure, room type and VNĐ price rendering, renamed headers, right-aligned actions, area-management CRUD dialog, desktop pagination, mobile card/infinite loading, search reset, permission-aware actions, dialog state, and room API payloads.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand dormitory/services/rooms.service.spec.ts dormitory/controllers/rooms.controller.spec.ts` => covers room-name validation/search, legacy fallback contract, active-contract occupancy aggregation, pagination, CRUD conflicts, and unchanged filters.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no introduced TypeScript errors.
- `D:\PROJECT\manager_points\backend :: npm run build` => NestJS build and dependency injection pass.
- Manual mocked/isolated verification at desktop and mobile widths:
  - tab label is **“Phòng”** and remains selected on `/dormitory/buildings`;
  - page padding, gaps, menu search, add-room button with visible **“Thêm phòng”** text, and area-management button match the registration tab;
  - the area-management modal contains working permission-aware add/edit/delete flows and no separate area-chip row remains;
  - desktop table shows selection, the required room code/name/type, **“Giường”**, **“Số sinh viên”**, VNĐ-formatted **“Giá phòng”**, right-aligned actions, and pagination;
  - selecting rooms opens `FloatingActionBar`; clearing selection is inert, bulk delete requires one danger confirmation, and success/partial-failure/failure states preserve accurate selections and data;
  - mobile/tablet shows selectable cards, appends subsequent pages on scroll, has retry/end feedback, and never shows pagination;
  - room and area deletes open `ConfirmModal`; cancel is inert and confirm performs exactly one guarded request;
  - create, edit, delete, validation, conflict, empty, loading, and permission states behave correctly;
  - legacy rooms without `ten_phong` render without crashing.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => only intended changes and no whitespace errors.

## Done

- The KTX tab is labeled **“Phòng”** and its outer spacing, menu bar, and data surface align with **“Đăng ký”**.
- The menu bar opens room creation and one consolidated area-management modal; area add/edit/delete is completed inside that modal.
- Desktop rooms have checkboxes, a deletion `FloatingActionBar`, right-aligned actions, and pagination; mobile/tablet rooms render as cards with selection and registration-style infinite loading without pagination.
- Single-room, selected-room, and area destructive actions use shared `ConfirmModal` and retain backend conflict protections.
- Every room row exposes room code, room name, room type, **“Giường”**, server-derived **“Số sinh viên”**, VNĐ-formatted room price, and permitted actions.
- Existing QR, room assignment, bed availability, permission, and legacy-room behavior remain compatible.
- Focused tests, frontend typecheck, backend build, and final diff checks pass.

## Gate

Planning-only: this taskscope authorizes no implementation, schema deployment, migration, deletion, or persistent-data mutation. Implementation requires a separate explicit request. Automated tests must use mocks or an isolated test database. Any operation that creates, updates, or deletes records in the connected MongoDB requires explicit persistent-data authority and the applicable Human Gate.
