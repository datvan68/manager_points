Task: dormitory-registration-table-and-temporary-edit | bug-fix | Risk: medium | Profile: Quick

Objective: Reduce registration table body text size and make the “Edit temporary registration” dialog show its active semester/year in the title while updating successfully without sending an invalid `preference` field.

Boundary: Dormitory registrations page and focused frontend tests only; preserve shared `ResponsiveDataView`, create/QR/formal edit, approval, delete, and backend persistence behavior. | Write: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`, `frontend/src/api/dormitory-api.test.ts`

Targets: registration-specific `ResponsiveDataView` styling; temporary edit title and active-semester state; `submitEdit` payload construction; focused page/API regression tests.

Steps: Inspect the rendered table and capture the failing temporary PATCH payload -> apply a registration-local smaller body font without changing the shared table component or action alignment -> display the resolved active semester name (including semester/year) beside “Sửa đăng ký tạm”, with loading/error states consistent with the create dialog, and remove the separate temporary semester/year inputs -> ensure `ADMIN_TEMPORARY`/`PUBLIC` updates send top-level `room_type` and `notes`, never `preference`, while `FORMAL` retains nested `preference` -> add regression tests for title/defaults, payload separation, successful update, and table typography.

Verify: `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/registrations/page.test.tsx" "src/api/dormitory-api.test.ts"` => focused tests pass. `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no affected TypeScript errors. `D:\PROJECT\manager_points` :: `git diff --check -- docs/taskscope.md "frontend/src/app/(dashboard)/dormitory/registrations/page.tsx" "frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx" "frontend/src/api/dormitory-api.test.ts"` => no whitespace errors and only scoped changes.

Done: Desktop registration table body text is visibly smaller; temporary edit title displays the unique active semester/year like the create dialog; temporary semester/year cannot be manually changed; temporary updates contain no `preference` key and complete without the reported validation error; formal edit behavior remains unchanged.

Gate: None
