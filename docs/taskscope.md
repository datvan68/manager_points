# Task Identity and Pipeline

- Task: `dormitory-attendance-style-navigation-and-unclassified-order`
- Pipeline: `feature_development`
- Profile: Full; canonical rules version `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch `main`; base `3ff84126ed18551940fdf772e4835d6e5411ce31`; worktree clean at planning time.
- Rule manifest (Git blob): safety `a80986be`, global `029706f3`, contract `bb3ba10e`, orchestrator `4db1d471`, pipeline `ca63259a`.

# Risk Level

- Risk: medium; development-only and reversible in Git.
- Evidence: the requested presentation changes span shared navigation, the KTX registration workspace, and the student grouping UI. No migration, deployment, destructive action, permission expansion, or external effect is requested.
- Blast radius: KTX navigation/registration presentation and ordering of the existing virtual student group.

# Objective

Make the global “Chưa phân loại” student group appear before “Hệ Cao đẳng”, render KTX navigation with the shared `TabNavigation` component, and align the KTX “Đăng ký” toolbar and data view with the attendance page without changing registration business behavior.

# Scope Boundaries

- Approved: KTX tab navigation, KTX registration-page presentation and responsive states, ordering/presentation of the existing unclassified student group, focused tests, and only the minimal shared-component adjustment proven necessary for route-backed tabs.
- Write:
  - `frontend/src/app/(dashboard)/dormitory/layout.tsx`
  - `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`
  - `frontend/src/app/(dashboard)/students/page.tsx`
  - focused tests colocated with these pages
  - `frontend/src/components/ui/TabNavigation.tsx` and its focused test only if the existing callback API cannot support route-backed KTX tabs without changing shared behavior
- Read/reference:
  - `frontend/src/app/(dashboard)/activities/attendance/page.tsx`
  - `frontend/src/components/ui/{TabNavigation.tsx,ResponsiveDataView.tsx,FloatingActionBar.tsx,pagination.tsx,Research.tsx}`
  - existing KTX API types and registration actions
- Excluded: backend/API/schema changes and all files outside the listed frontend boundaries unless a scope amendment is approved.

# Out of Scope

- Changing registration search semantics, approval/rejection rules, bulk-action eligibility, status values, pagination contracts, KTX default route, tab order beyond preserving “Đăng ký” first, or the membership definition/detail route of “Chưa phân loại”.
- Creating or assigning `Student`, `Class`, or `Department` records; redesigning other KTX pages; modifying the attendance page; adding a new design system; deployment.

# Context and Dependencies

- `frontend/src/app/(dashboard)/dormitory/layout.tsx` currently renders a custom icon-and-`Link` navigation even though the shared `TabNavigation` is already used by student, grading, permission, and profile pages.
- The shared `TabNavigation` accepts `tabs`, `activeTab`, and `onTabChange`; the KTX layout must derive the active tab from `usePathname` and route through the Next router while keeping “Đăng ký” first.
- The KTX registration page currently has an `h1` title and a custom search/filter/table layout.
- The attendance reference page uses a compact responsive toolbar built from `Research`, `Button`, and `Select`, plus `ResponsiveDataView`, `CustomPagination`, mobile loading behavior, and `FloatingActionBar` for selected-row actions.
- In the student “Danh sách” view, the existing “Chưa phân loại” / “Chưa phân lớp” card is currently rendered inside the “Hệ Trung cấp” section. It is a global virtual group and must remain outside faculty ownership and class CRUD.

# Steps

1. Add or update focused UI tests that capture KTX active-tab routing, registration-page structure, responsive controls/table states, and the exact student-section order.
2. Replace the custom KTX navigation markup with `TabNavigation`. Map each KTX route to a stable tab ID, derive the active ID from the current pathname (including nested routes), navigate in `onTabChange`, and preserve “Đăng ký” as the first tab.
3. Remove only the page-level “Đăng ký KTX” heading from the registration tab; retain semantic headings inside dialogs such as the rejection modal.
4. Rebuild the registration toolbar using the attendance page’s compact responsive pattern: `Research` on desktop, icon-triggered search mode on small screens, relevant status/source filters, refresh/action controls, reset pagination/selection when filters change, and horizontal overflow protection. Reuse the pattern, not attendance-only controls such as its back button or date filter unless a KTX requirement already needs them.
5. Render registrations through `ResponsiveDataView` with typed columns, the attendance-style glass container, loading/error/empty states, desktop `CustomPagination`, and the established mobile data-loading behavior. Preserve existing row actions, badges, registration fields, and permissions.
6. Where registration bulk actions exist, connect selection to `ResponsiveDataView` and render them through `FloatingActionBar`; do not invent new bulk operations or expose formal-only actions to ineligible public rows.
7. Move the complete global “Chưa phân loại” section, containing exactly one “Chưa phân lớp” card, to the top of the class-list content before “Hệ Cao đẳng”. Keep it outside the “Hệ Cao đẳng” and “Hệ Trung cấp” containers and independent of the selected faculty.
8. Run focused tests, frontend static/build checks, manual responsive inspection, and final diff/status review.

# Acceptance Criteria

- AC1: “Chưa phân loại” is the first section in Student Management → “Danh sách”, immediately before “Hệ Cao đẳng”; it contains exactly one “Chưa phân lớp” card.
- AC2: The virtual card remains outside every faculty and training-system container, does not affect faculty/class counts, and keeps its existing count, navigation, and read-only semantics.
- AC3: KTX navigation is rendered by `frontend/src/components/ui/TabNavigation.tsx`; “Đăng ký” remains the first tab, the current/nested route selects the correct tab, and each tab navigates to its existing route.
- AC4: The “Đăng ký” page has no page-level title above its controls; rejection and other dialog titles remain present and accessible.
- AC5: The registration toolbar follows the attendance toolbar’s component, spacing, responsive-search, filter, refresh/action, and overflow conventions while exposing only KTX-relevant controls.
- AC6: The registration list uses `ResponsiveDataView` and `CustomPagination`, with attendance-consistent table/card presentation and loading, error, empty, desktop, and narrow-screen behavior.
- AC7: Existing search, filtering, pagination, row selection, approve/reject, and eligible bulk actions produce the same business results as before the presentation refactor.
- AC8: Other KTX tabs and the attendance page remain behaviorally unchanged; the final diff contains only approved paths.

# Verification

- Focused frontend tests: `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/dormitory" "src/app/(dashboard)/students"` => AC1–AC8 UI behavior passes.
- Shared component test, only if changed: `D:\PROJECT\manager_points\frontend :: npm test -- "src/components/ui/TabNavigation.test.tsx"` => existing consumers and route-backed callback behavior pass.
- Frontend static/build: `D:\PROJECT\manager_points\frontend :: npm run typecheck` and `npm run build` => TypeScript and Next production build pass.
- Manual responsive inspection at desktop and narrow viewport => KTX tabs remain usable; registration search/menu/table/card layout matches the attendance interaction pattern without clipping or inaccessible actions.
- Final: `D:\PROJECT\manager_points :: git diff --check`, `git diff --stat`, and `git status --short` => no whitespace defects, unintended paths, or overwritten user work.

# Safety Gates

- G0 — Planning-only: this file does not authorize implementation. Resume only after an explicit implement/fix request.
- G1 — Any backend/API/schema change, new registration behavior, migration, or permission change requires a scope amendment before mutation.
- G2 — Deployment or production-data changes require separate explicit approval with reviewed verification and rollback evidence.

# Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md` at the recorded base commit.
- C1: baseline screenshots/tests and confirmed target manifest before mutation.
- C2: navigation and registration UI diff with focused passing tests before final integration.
- C3: final diff, test/build summary, and responsive screenshots before implementation completion.

# Execution Budgets

- Default step deadline: 600 seconds; maximum 1,800 seconds for build/full tests.
- Idempotent retries: 2 per command/API; engineering loops: 3; review-remediation cycles: 2.
- At most 3 independent read-only/test workers; one writer per path. Serialize shared `TabNavigation` and page edits.
- Stop on permission regression, registration-action behavior change, overlapping dirty edits, boundary expansion, migration need, or a Human Gate.
