# Task Identity and Pipeline

Task: `fix-dormitory-roster-frontend-regressions` | Pipeline: `bugfix` | Profile: Full | Risk: medium | Base: `5c09d966` | Planning state: taskscope only; frontend implementation, backend changes, database mutation, deployment, and production operations are not authorized by this document update.

# Objective

Fix the current KTX frontend regressions without redesigning the established “Danh sách” UI. The admin roster, standalone public registration page, and room-QR registration path must use one canonical `DormitoryRosterEntry` form/data contract, reflect server-authoritative Student fields correctly, and remain stable under overlapping requests.

# Confirmed Findings

1. `frontend/src/app/(dashboard)/dormitory/roster/page.tsx` declares the “Định danh” column twice with the same key, so the desktop/mobile data view can render duplicate content and unstable keys.
2. `frontend/src/app/public/room/[qrId]/page.tsx` still owns a legacy registration form. It posts `full_name`, phone, email, Student code, priority group, and notes, but omits the date of birth and gender required by the canonical roster service. This room-QR path can therefore fail while `/public/dormitory/register` succeeds.
3. The two public entry points have drifted: the room page uses raw `fetch`, `alert`, legacy fields, and “xác nhận” copy, while the standalone page uses `PublicDormitoryRegistrationModal` and the canonical payload builder.
4. Linked Student fields have misleading edit behavior. The manager create form allows users to alter prefilled date of birth and gender even though the backend resolves linked identity from `student_id`. The edit modal also leaves date of birth/gender editable but locks manager-supplied room type/notes, causing apparent successful edits to revert or preventing valid edits.
5. Legacy wording remains after the approval/source flow was removed: “đơn đăng ký”, “họ tên tạm”, “lưu tạm để phân loại”, and “chờ xác nhận”. This conflicts with the canonical “Danh sách KTX” flow and suggests an approval step that no longer exists.
6. Roster loading and Student lookup rely only on timers. Requests already in flight are not cancelled or sequence-guarded, so an older search/page response can overwrite a newer result. A create operation also calls `reset()` and immediately invokes a `load` closure that may still contain the previous page.
7. The public modal renders a controlled `Dialog open` without a controlled close handler. The visible close affordance has no reliable outcome, especially when the form is reused from the room detail page.
8. Current focused tests cover API helpers and payload builders but do not render the roster page, submit either complete public flow, verify linked-field locking, exercise dialog closing, or simulate out-of-order responses. The existing focused tests, typecheck, and production build pass despite the confirmed UI bugs.

# Scope Boundaries

Read/write boundaries:

- `frontend/src/app/(dashboard)/dormitory/roster/page.tsx`
- `frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx`
- `frontend/src/app/public/dormitory/register/page.tsx`
- `frontend/src/app/public/room/[qrId]/page.tsx`
- a focused test beside `frontend/src/app/public/room/[qrId]/page.tsx`
- `frontend/src/components/dormitory/PublicDormitoryRegistrationModal.tsx`
- `frontend/src/components/dormitory/PublicDormitoryRegistrationModal.test.tsx`
- `frontend/src/components/dormitory/DormitoryRegistrationEditModal.tsx`
- `frontend/src/components/dormitory/DormitoryRegistrationEditModal.test.tsx`
- `frontend/src/api/dormitory-api.ts` and `frontend/src/api/dormitory-api.test.ts` only if a frontend type or API wrapper must be aligned with the already-existing canonical backend contract

Preserve:

- the current “Danh sách” layout, toolbar, table/card hierarchy, responsive behavior, pagination, mobile incremental loading, selection/floating actions, QR dialog, create/edit dialogs, room assignment, delete confirmation, PDF preview/export, permission-aware actions, and loading/empty/error presentation;
- the room information page and its room/bed/amenity presentation;
- `/dormitory/roster`, `/public/dormitory/register`, `/public/room/[qrId]`, canonical API paths, permission codes, and public privacy behavior.

# Out of Scope

- Backend services, DTOs, schemas, indexes, identity matching, room assignment rules, or response changes.
- Database reset, seed, migration, deployment, production changes, or legacy-data recovery.
- Reintroducing `Registration`, `PublicRegistration`, approval/rejection, source filters, temporary collections, or compatibility endpoints.
- Redesigning the KTX UI, changing shared visual tokens, or broadly refactoring common UI components.
- Adding new applicant requirements beyond the existing canonical contract.
- Exposing Student existence, PII, or raw MongoDB identifiers on public pages.

# Implementation Steps

1. Add characterization tests that render the affected pages/components and fail for the confirmed regressions before changing behavior. Keep existing helper tests, but do not treat them as sufficient interaction coverage.
2. Make `PublicDormitoryRegistrationModal` the single owner of public registration state, validation, canonical payload construction, active-semester blocking, submit state, inline errors, and success-code display.
3. Replace the legacy form/state/submit code inside `/public/room/[qrId]` with the canonical public form component configured with `qr_room_id`. Preserve the room detail page and CTA. Do not keep a second payload builder, raw registration `fetch`, `alert`, email, priority-group, or confirmation-specific copy in that page.
4. Give the reusable public form explicit open/close behavior. Closing from the room page must return to the room detail without losing its loaded data. The standalone route must not render a close control that does nothing; it must either provide a meaningful navigation result or intentionally omit the affordance without changing shared dialog behavior globally.
5. Define one frontend field-authority policy:
   - linked Student: full name, Student code, date of birth, and gender are displayed as server-authoritative and are not presented as editable overrides;
   - linked Student: phone number, room type, notes, and applicant profile remain editable when allowed by the backend contract;
   - unlinked entry: validated full name, optional Student code, date of birth, gender, phone number, room type, notes, and applicant profile remain editable;
   - active semester remains server-resolved and display-only.
6. Apply that policy consistently to manager create and edit. Selecting a Student must prefill and lock authoritative identity values; clearing/changing the selection must explicitly return to manual mode. Never submit identity overrides that the server will discard for a linked Student.
7. Remove the duplicate “Định danh” column. Keep exactly one column/badge and preserve the current ordering, styling, and responsive priorities of all other columns.
8. Replace obsolete approval/temporary/source terminology with canonical user-facing language such as “mục Danh sách KTX”, “hồ sơ chưa liên kết”, and “đăng ký thành công”. “Đăng ký” remains valid as an action; no text may imply that a separate approval or confirmation is required before the entry appears in “Danh sách”.
9. Make roster list/search and Student lookup latest-request-wins using request cancellation or a monotonically increasing request token. Debouncing must not permit stale responses to overwrite the current query. After create/edit/delete, reload using the settled current page/filter state; when creation resets to page 1, only the page-1 result may commit.
10. Keep independent frontend requests parallel where safe and avoid adding new client-side waterfalls or duplicate API calls. Do not add dependencies for request management.
11. Add focused regression tests for the acceptance criteria, then run focused tests, full frontend typecheck, production build, and a final scoped diff/status review.

# Acceptance Criteria

- AC-01: “Danh sách” renders exactly one “Định danh” column on desktop and one corresponding field on mobile; no duplicate column key is present.
- AC-02: Both `/public/dormitory/register` and the registration CTA on `/public/room/[qrId]` submit the same canonical required fields: full name, date of birth, gender, phone number, room type, optional Student code/notes/profile, and `qr_room_id` only for the room path.
- AC-03: A valid room-QR submission reaches `dormitoryApi.public.register`, shows the returned `roster_entry_code`, and does not use a parallel raw registration `fetch` or browser `alert` flow.
- AC-04: Public validation and server errors are displayed inline, double-submit is prevented, active-semester failure blocks submission, and closing the room registration form returns to the already-loaded room page.
- AC-05: Linked Student identity fields are visibly authoritative and cannot be edited as fake overrides. Editable supplied fields remain editable. Unlinked entries retain the manual edit capability required for later stable linking.
- AC-06: Manager create sends `student_id` for a selected Student and does not send user-edited identity overrides; manual create sends the complete validated identity without raw ObjectId input.
- AC-07: No affected KTX registration UI contains “lưu tạm để phân loại”, “chờ xác nhận”, approval/rejection wording, legacy source controls, email, or priority-group fields from the removed public flow.
- AC-08: Slow older list/search/Student-lookup responses cannot replace newer state. Creation from any current page finishes on page 1 with data matching the current filter.
- AC-09: The established “Danh sách” and room-detail visual structure and interaction set remain unchanged outside the scoped bug corrections.
- AC-10: Focused interaction tests, frontend typecheck, and production build pass. Tests must reproduce the previously missed bugs rather than only inspecting source strings or pure helpers.

# Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/roster/page.test.tsx" "src/app/(dashboard)/dormitory/layout.test.tsx" "src/app/public/room/[qrId]/page.test.tsx" "src/components/dormitory/PublicDormitoryRegistrationModal.test.tsx" "src/components/dormitory/DormitoryRegistrationEditModal.test.tsx" "src/api/dormitory-api.test.ts"` => all focused render, submit, field-policy, close, API, and stale-response tests pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors.
- `D:\PROJECT\manager_points\frontend` :: `npm run build` => Next.js production build succeeds and includes `/dormitory/roster`, `/public/dormitory/register`, and `/public/room/[qrId]`.
- `D:\PROJECT\manager_points` :: focused `rg` inspection of the affected KTX paths => one canonical public submit implementation; no duplicate identity column; no obsolete temporary/approval copy or legacy room-form fields.
- `D:\PROJECT\manager_points` :: `git diff --check` plus scoped status/diff review => no backend, database, shared UI redesign, generated artifact, or unrelated change.

# Baseline Evidence

Recorded on base `5c09d966`:

- focused Vitest: 5 files, 10 tests passed;
- `npm run typecheck`: passed;
- `npm run build`: passed and generated all three affected routes;
- static inspection still confirmed Findings 1 through 7, demonstrating the test coverage gap described in Finding 8.

# Safety and Stop Conditions

- This is planning-only. Stop after writing this taskscope.
- Preserve public privacy: no Student lookup response or UI may disclose whether a Student code exists.
- Stop and request a backend follow-up if the canonical frontend payload is still rejected because the existing backend contract differs from the inspected DTO/service; do not silently expand this frontend task into backend work.
- Stop if fixing the bugs requires a global dialog/data-table redesign, a new dependency, a route/API compatibility layer, persistent-data mutation, or deployment authority.

# Rollback

Revert only the scoped frontend bugfix commit. No data rollback is required because this task does not authorize database or backend mutation.
