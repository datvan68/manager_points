Task: dormitory-temporary-registration-edit-defaults | feature-development | Risk: medium | Profile: Quick

Objective: Make the “Edit temporary registration” dialog use the single active semester for its semester/academic-year values and use the shared `CustomCalendar` for date of birth.

Boundary: Dormitory registration edit UI and focused tests only. Preserve create, QR, formal-registration, approval, delete, list, and backend persistence behavior. | Write: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`

Targets: `openEdit`, edit-dialog state/loading/error handling, semester display, date-of-birth picker, and focused page tests. Reuse `semesterApi.getSemesters`, `mapActiveSemester`, `Popover`, and `CustomCalendar`; add no dependency or duplicate calendar.

Steps: Inspect the existing edit initialization and test baseline -> when editing `ADMIN_TEMPORARY`, resolve exactly one `status === 'active'` semester and populate `semester`/`academic_year`; display them as non-editable defaults and block save while loading or when the active semester is missing, duplicated, or malformed -> replace the edit dialog's native date input with a separately controlled `CustomCalendar` popover, preserving `YYYY-MM-DD` payloads and valid past-date checks -> keep `FORMAL` edit behavior unchanged -> add tests for active defaults, error/blocking states, calendar selection/cancel, payload, and dialog reset.

Verify: `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => focused tests pass. `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no affected TypeScript errors. `D:\PROJECT\manager_points` :: `git diff --check -- docs/taskscope.md "frontend/src/app/(dashboard)/dormitory/registrations/page.tsx" "frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => no whitespace errors and only scoped changes.

Done: Editing an `ADMIN_TEMPORARY` row always submits the uniquely active semester/year, users cannot type alternate values, date of birth is selected with `CustomCalendar`, invalid semester/date states cannot submit, reopening starts cleanly, and formal edits remain unchanged.

Gate: None
