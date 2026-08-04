# Task: dormitory-registration-modal-ui-refinement

- Pipeline: `feature_development`
- Risk: medium
- Profile: Quick
- Repository: `D:\PROJECT\manager_points`
- Branch/base: `main` / `ae5d65e6`

## Objective

Refine the KTX registration toolbar and create-registration modal to match the existing **“Tạo hoạt động mới”** visual pattern, while keeping the current registration payload and active-semester rules unchanged.

## Boundary

- Write: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`.
- Reference only: `frontend/src/app/(dashboard)/activities/page.tsx`, `frontend/src/components/activities/ActivityForm.tsx`, `frontend/src/components/calendar/CustomCalendar.tsx`, and shared `Button`, `Dialog`, `Input`, `Select`, `Popover` components.
- Out of scope: API/backend/schema changes, semester configuration, Student/User updates, database writes, sample data, and unrelated registration/list behavior.

## Required changes

1. Restyle the create-registration `DialogContent`, header, responsive layout, translucent cards, spacing, typography, and footer after the **“Tạo hoạt động mới”** modal. Group fields into two responsive cards without copying unrelated activity fields.
2. Keep the modal title and show the resolved active semester name beside it using the same secondary-label treatment as the activity modal. Remove the separate read-only “Học kỳ active” and “Năm học active” inputs; continue deriving and submitting `ky_hoc` and `nam_hoc` internally. Loading/error states remain visible and submission remains disabled when the active semester is unresolved.
3. Remove the dialog description **“Chọn sinh viên hiện có và nhập thông tin đăng ký.”** and remove the unused `DialogDescription` import.
4. In the list menubar, render the permission-aware add-registration action with the shared `Button` and place it immediately to the right of the source filter whose default label is **“Tất cả nguồn”**. Preserve search, status/source filtering, refresh, responsiveness, and permission checks.
5. Replace the native date input for “Ngày sinh” with a shared `Button` trigger, `Popover`, and `CustomCalendar`. Use it as a single-date picker by storing the confirmed start date as `ngay_sinh`, display Vietnamese date text, allow cancel/confirm, and retain the existing valid-past-date submission check.
6. Keep room type controlled at all times. When gender is `Female`, enable the shared room-type `Select` with `Thường` and `Máy lạnh (Ưu tiên cho nữ)`. For empty, `Male`, or `Other` gender, force the value to `Thường` and disable the room-type choice. Changing away from `Female` must immediately reset a prior `Máy lạnh` selection to `Thường`.
7. Preserve student lookup/prefill, phone and priority fields, building/note fields, duplicate-submit protection, errors, toast, reset/close, pagination selection reset, and table refresh.

## Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => toolbar order, modal header/semester, removed description/inputs, calendar behavior, gender-room rules, payload, and existing create flow pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no introduced TypeScript errors.
- Manual inspection at desktop and narrow viewport => modal cards, calendar popover, footer, and toolbar remain usable without clipping.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => only approved planning/code/test paths change during later implementation.

## Done

- The add button is the shared `Button` immediately after “Tất cả nguồn”.
- The modal visually follows “Tạo hoạt động mới”, has no description, and shows one active-semester label beside its title instead of two semester inputs.
- Date of birth uses `CustomCalendar`; only female registrations can select an air-conditioned room, while all other gender states submit `Thường`.
- Focused tests, typecheck, responsive inspection, and final diff checks pass.

## Gate

Planning-only: this taskscope authorizes no implementation or persistent-data mutation. Implementation starts only after an explicit implementation request. Any direct MongoDB write or production-data change requires separate explicit authority and the applicable Human Gate.
