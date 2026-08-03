# Task Identity and Pipeline

- Task: `activity-attendance-hssv-table-toolbar`
- Pipeline: `feature_development`
- Profile: Full
- Risk: medium
- Repository: `D:\PROJECT\manager_points`
- Rule manifest: canonical rules `3.2.0`

# Objective

Make the activity-attendance page visually and behaviorally consistent with the “Tình hình HSSV” table, remove its heading block, provide server-backed search, status filters, and a `CustomCalendar` date-range filter, and support non-disruptive manual table refresh.

# Scope Boundaries

- Approved: activity-attendance list query, page UI, and focused tests.
- Write:
  - `backend/src/activity-attendance/dto/attendance.dto.ts`
  - `backend/src/activity-attendance/activity-attendance.service.ts`
  - `backend/src/activity-attendance/activity-attendance.module.ts`
  - `backend/src/activity-attendance/activity-attendance.service.spec.ts` (new)
  - `frontend/src/api/activity-api.ts`
  - `frontend/src/app/(dashboard)/activities/attendance/page.tsx`
  - `frontend/src/app/(dashboard)/activities/attendance/page.test.tsx`
- Reference only: `backend/src/classes/schemas/class.schema.ts`, `frontend/src/app/(dashboard)/students/record/page.tsx`, `frontend/src/components/ui/Research.tsx`, `frontend/src/components/calendar/CustomCalendar.tsx`, `frontend/src/components/ui/pagination.tsx`.
- Out of scope: attendance creation/approval rules, export semantics, permissions, navigation, other activity pages, migrations, and deployment.

# Implementation Steps

1. Baseline the current attendance query, page tests, and the student-record table/toolbar layout.
2. Extend `QueryAttendanceDto` and `findAll` with validated text search and inclusive recorded-date range parameters while retaining activity, attendance-status, approval-status, page, and limit filters; populate the class name required by the table.
3. Type the new query parameters in `activityAttendanceApi.getAll`.
4. Remove the `Tổng hợp điểm danh` heading/subtitle and build the responsive toolbar with `Research` as the leftmost, left-aligned control, followed by attendance/approval filters, a `CustomCalendar` popover, and an accessible icon-only refresh button; debounce search and reset page/selection when filters change.
5. Implement manual refresh as a background refetch of the complete current table query (active search, filters, date range, page, and page size), retaining rendered rows and controls while the request runs so the page does not flash; prevent duplicate refresh requests and expose a localized loading/disabled state on the button.
6. Align the responsive table/card container, sticky desktop header, spacing, initial loading/empty states, and pagination with “Tình hình HSSV” without changing attendance columns or Excel selection behavior.
7. Add backend query tests and frontend interaction/rendering tests, including toolbar order and non-disruptive refresh behavior.

# Acceptance Criteria

- AC1: The heading and subtitle are absent; the table shell matches the established “Tình hình HSSV” desktop/mobile pattern.
- AC2: Search covers activity name/code, student name/code, and class name across the complete server-side result set.
- AC3: Attendance status, approval status, and inclusive date range compose correctly and reset pagination to page 1.
- AC4: Clearing search/filters/calendar restores the unfiltered list; loading, empty, error, permission, selection, Excel export, and 40-row default pagination remain intact.
- AC5: Toolbar controls have accessible names, visible active states, and do not overflow at 320/375px widths.
- AC6: Search is the first toolbar control and sits flush left on desktop and mobile layouts; remaining controls follow it without an unintended leading gap.
- AC7: Activating the refresh icon refetches the complete current table query without clearing rows, resetting pagination/filters/selection, or showing the initial full-table loading state; the button prevents repeated activation while the request is pending and reports refresh failure through the existing error mechanism.

# Verification

- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/activity-attendance/activity-attendance.service.spec.ts` => search/date/status combinations and pagination pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => Nest compiles.
- `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/activities/attendance/page.test.tsx"` => toolbar order, reset, query, heading removal, background refresh without row flashing, duplicate-click protection, and preserved selection/export cases pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors.
- Browser QA on `/activities/attendance` at desktop, 375px, and 320px => HSSV-aligned layout, search flush left, usable responsive toolbar/table, and no visible page flash during manual refresh.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => clean formatting and no unintended paths.

# Safety Gates

- Planning-only: implementation requires a separate explicit request.
- Gate: None for development implementation; stop if the query requires schema/index migration or scope outside the listed paths.
