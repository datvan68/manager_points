# Task Identity and Pipeline

- Task: `activity-attendance-hssv-table-toolbar`
- Pipeline: `feature_development`
- Profile: Full
- Risk: medium
- Repository: `D:\PROJECT\manager_points`
- Rule manifest: canonical rules `3.2.0`

# Objective

Make the activity-attendance page visually and behaviorally consistent with the “Tình hình HSSV” table, remove its heading block, provide back navigation, server-backed search, status filters, a `CustomCalendar` date-range filter, non-disruptive manual refresh, and mobile incremental loading without pagination controls.

# Scope Boundaries

- Approved: activity-attendance list query, page UI/navigation, and focused tests.
- Write:
  - `backend/src/activity-attendance/dto/attendance.dto.ts`
  - `backend/src/activity-attendance/activity-attendance.service.ts`
  - `backend/src/activity-attendance/activity-attendance.module.ts`
  - `backend/src/activity-attendance/activity-attendance.service.spec.ts` (new)
  - `frontend/src/api/activity-api.ts`
  - `frontend/src/app/(dashboard)/activities/attendance/page.tsx`
  - `frontend/src/app/(dashboard)/activities/attendance/page.test.tsx`
- Reference only: `backend/src/classes/schemas/class.schema.ts`, `frontend/src/app/(dashboard)/students/record/page.tsx`, `frontend/src/components/ui/Research.tsx`, `frontend/src/components/calendar/CustomCalendar.tsx`, `frontend/src/components/ui/pagination.tsx`.
- Out of scope: attendance creation/approval rules, export semantics, permissions, changes to the destination activities page, migrations, and deployment.

# Implementation Steps

1. Baseline the current attendance query, page tests, and the student-record table/toolbar layout.
2. Extend `QueryAttendanceDto` and `findAll` with validated text search and inclusive recorded-date range parameters while retaining activity, attendance-status, approval-status, page, and limit filters; populate the class name required by the table.
3. Type the new query parameters in `activityAttendanceApi.getAll`.
4. Remove the `Tổng hợp điểm danh` heading/subtitle and build the responsive toolbar with an accessible icon-only back button that navigates to `/activities`, immediately followed by the left-aligned `Research` control; place attendance/approval filters, a `CustomCalendar` popover, and the refresh button after search, debounce search, and reset loaded results/selection when filters change.
5. Implement manual refresh as a background refetch of the complete current table query (active search, filters, date range, page, and page size), retaining rendered rows and controls while the request runs so the page does not flash; prevent duplicate refresh requests and expose a localized loading/disabled state on the button.
6. Retain the 40-row default and `CustomPagination` on desktop. On mobile, hide pagination and mirror the “Tình hình HSSV” incremental-loading flow: append the next server page from an `IntersectionObserver` sentinel, prevent duplicate requests, retain existing rows while loading, and expose localized loading-more, retry-on-error, and end-of-list states.
7. Align the responsive table/card container, sticky desktop header, spacing, and initial loading/empty states with “Tình hình HSSV” without changing attendance columns or Excel selection behavior.
8. Add backend query tests and frontend interaction/rendering tests, including toolbar order/navigation, non-disruptive refresh, desktop pagination, and mobile incremental loading.

# Acceptance Criteria

- AC1: The heading and subtitle are absent; the table shell matches the established “Tình hình HSSV” desktop/mobile pattern.
- AC2: Search covers activity name/code, student name/code, and class name across the complete server-side result set.
- AC3: Attendance status, approval status, and inclusive date range compose correctly and reset pagination to page 1.
- AC4: Clearing search/filters/calendar restores the unfiltered list; loading, empty, error, permission, selection, Excel export, and the 40-row default remain intact.
- AC5: Toolbar controls have accessible names, visible active states, and do not overflow at 320/375px widths.
- AC6: The back icon is the first flush-left toolbar control on desktop and mobile, has an accessible name, navigates directly to `/activities`, and is immediately followed by search without an unintended gap.
- AC7: Activating the refresh icon refetches the complete current table query without clearing rows, resetting pagination/filters/selection, or showing the initial full-table loading state; the button prevents repeated activation while the request is pending and reports refresh failure through the existing error mechanism.
- AC8: Desktop continues to use `CustomPagination`; mobile renders no pagination controls and appends successive 40-row server pages when the sentinel enters the scroll threshold, without replacing previously loaded rows or issuing duplicate page requests.
- AC9: A mobile query change restarts loading from page 1; append failure preserves current rows and offers retry, and exhaustion displays a localized end-of-list state without further requests.

# Verification

- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand src/activity-attendance/activity-attendance.service.spec.ts` => search/date/status combinations and pagination pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => Nest compiles.
- `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/activities/attendance/page.test.tsx"` => back navigation and toolbar order, query reset, heading removal, background refresh without row flashing, desktop-only pagination, mobile append/retry/exhaustion behavior, duplicate-request protection, and preserved selection/export cases pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors.
- Browser QA on `/activities/attendance` at desktop, 375px, and 320px => back icon precedes search, desktop pagination remains usable, mobile pagination is absent and incremental loading works, and manual refresh causes no visible page flash.
- `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => clean formatting and no unintended paths.

# Safety Gates

- Planning-only: implementation requires a separate explicit request.
- Gate: None for development implementation; stop if the query requires schema/index migration or scope outside the listed paths.
