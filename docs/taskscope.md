# Task Identity and Pipeline

- Task: `dormitory-pdf-catalog-and-responsive-data-views`
- Pipeline: `feature_development`
- Profile: Full, planning-only
- Rules/protocol: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Branch/base commit: `main` / `497733a94054304394ebcce658306bb28a7613fe`
- Base state: clean before this taskscope update.

## Risk Level

- Risk: high.
- Environment: development.
- Evidence: the work changes a shared navigation component, two data-heavy Dormitory pages, dashboard summaries, and a backend PDF descriptor contract that validates persisted layouts.
- Reversibility: source changes are Git-reversible; no automatic database or production mutation is planned.
- Blast radius: Dormitory PDF catalog/designer, Roster, Rooms, Overview, and the opt-in responsive behavior of shared `TabNavigation`.

## Objective

Simplify the Dormitory PDF catalog header, make the residence-contract template upload use the same field palette as the KTX registration template, and provide usable mobile/tablet navigation and scalable card-based data views across Roster, Rooms, and Overview.

## Scope Boundaries

- Approved boundaries:
  - `frontend/src/app/(dashboard)/dormitory/**`
  - `frontend/src/components/pdf-template/**`
  - `frontend/src/components/ui/TabNavigation.tsx` and its focused test
  - `frontend/src/components/ui/ResponsiveDataView.tsx` and its focused test only if the verified component contract must be extended
  - `backend/src/dormitory/pdf-template-adapter.ts`
  - `backend/src/dormitory/dormitory-pdf-template.spec.ts`
  - `backend/src/pdf-template/pdf-template.spec.ts`
  - `docs/taskscope.md`
- Expected write paths:
  - `frontend/src/components/pdf-template/PdfTemplateCatalog.tsx`
  - `frontend/src/components/pdf-template/PdfTemplateCatalog.test.tsx`
  - `frontend/src/components/ui/TabNavigation.tsx`
  - `frontend/src/components/ui/TabNavigation.test.tsx` (new)
  - `frontend/src/app/(dashboard)/dormitory/layout.tsx`
  - `frontend/src/app/(dashboard)/dormitory/layout.test.tsx`
  - `frontend/src/app/(dashboard)/dormitory/roster/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx`
  - `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/buildings/page.test.tsx`
  - `frontend/src/app/(dashboard)/dormitory/overview/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx`
  - `backend/src/dormitory/pdf-template-adapter.ts`
  - `backend/src/dormitory/dormitory-pdf-template.spec.ts`
  - `backend/src/pdf-template/pdf-template.spec.ts`
- Excluded boundaries: contract CRUD/routes, room or invoice APIs, report logic, permissions, schema/data migration, deployment, and unrelated consumers of `TabNavigation`.

## Out of Scope

- Do not remove the PDF template catalog items or their upload/edit/delete actions. “Keep only the title” applies to the catalog header: remove the `PDF Template Designer` eyebrow/tag and descriptive sentence while retaining `Quản lý mẫu PDF` and functional template cards.
- Do not add a contract-document export endpoint or restore the hidden Contracts tab.
- Do not change backend pagination responses or Overview aggregation calculations.
- Do not truncate records or monetary values; limiting display means a bounded viewport with scrolling.
- Do not automatically rewrite or delete existing persisted PDF template layouts.

## Context and Dependencies

- `PdfTemplateCatalog.tsx` currently renders the eyebrow, title, description, and cards. The unconfigured residence-contract card already routes to `/dormitory/pdf-template/new?templateTypeCode=DORMITORY_RESIDENCE_CONTRACT`; this upload path must remain operational.
- `DORMITORY_ROSTER_APPLICATION_DESCRIPTOR` exposes 25 registration fields. `DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR` currently exposes a different 15-field contract/room/bed palette. The requested contract palette will reuse the registration field definitions, formatters, sensitivity flags, and synthetic fixtures while retaining its own type code, display name, feature code, and `DORM_CONTRACT_READ` source permission.
- Existing stored contract layouts may reference removed `contract.*`, `room.*`, or `bed.*` keys. No data migration is authorized; validation must not silently accept stale keys, and replacement/re-layout remains an explicit user action.
- `ResponsiveDataView` already supports `breakpoint`, mobile cards, `mobileFooter`, a scroll ref, and optional `@tanstack/react-virtual` virtualization.
- Roster currently has an IntersectionObserver infinite loader but does not enable `mobileVirtualization`. Rooms enables virtualization and infinite loading only for `max-width: 767px`; both pages use the default `md` card breakpoint, so tablet behavior is incomplete.
- The Rooms mobile search icon has no click handler or expanded input state. Roster already provides the intended open/focus/close search interaction.
- `TabNavigation` currently distributes tabs with `flex-1` below `lg` but has no horizontal overflow viewport or equal-width inner track. An opt-in Dormitory mode avoids changing unrelated navigation consumers.
- Overview renders `Tình trạng phòng` and `Công nợ theo phòng` only as wide tables with horizontal scrolling and no bounded high-row viewport.

## Steps

1. Capture focused frontend/backend test baselines and preserve the current clean implementation state.
2. Simplify only the PDF catalog header, retaining catalog loading, states, permissions, and all template actions. Verify the residence-contract upload button opens the correct editor route.
3. Refactor the residence-contract descriptor to reuse the exact registration field palette and fixtures. Adapt its value resolver to registration/roster data when context is supplied; keep descriptor identity and permission unchanged. Update descriptor/registry regression tests, including rejection of removed contract-only field keys.
4. Add an opt-in scrollable/even-distribution mode to `TabNavigation`: tabs share available width on mobile/tablet, have a consistent minimum width, and the containing bar scrolls horizontally when the minimum widths exceed the viewport. Enable it only in Dormitory layout and keep the active indicator and navigation behavior intact.
5. Standardize Roster and Rooms compact mode to widths below `lg` (mobile and tablet). In compact mode, start at page 1, append unique pages through IntersectionObserver, expose loading/end/error/retry states, hide desktop pagination, and enable virtualization with stable row keys. Keep desktop table pagination unchanged and reset compact paging safely after search, page-size, or breakpoint changes.
6. Implement the Rooms compact search interaction using an accessible open button, focused full-width input, and close button. Preserve the search value, debounce/load behavior, and pagination reset; ensure toolbar actions remain reachable.
7. Remove the Overview header description and reduce `Tổng quan Quản lý KTX` from `text-2xl` to the repository-consistent smaller heading size.
8. Add mobile/tablet card renderers for `Tình trạng phòng` and `Công nợ theo phòng`, preserving every current field/action and empty/anomaly state. Keep desktop tables, but bound both record containers with a responsive maximum height and vertical scrolling so large result sets do not grow the page indefinitely.
9. Add responsive, interaction, observer, virtualization, accessibility, and PDF descriptor regression tests; run focused tests, typecheck/builds, then inspect the final diff and status.

## Acceptance Criteria

- AC-01: The PDF catalog header contains the single heading `Quản lý mẫu PDF`; `PDF Template Designer` and the descriptive sentence are absent, while catalog cards and permission-gated actions remain usable.
- AC-02: From the unconfigured `Mẫu đơn hợp đồng nội trú` card, `Tải PDF lên` opens the new-template editor with `DORMITORY_RESIDENCE_CONTRACT`; create, preview, validate, and edit continue through the shared PDF template APIs.
- AC-03: Contract-template metadata exposes the same ordered 25 field keys, formatters, sensitivity flags, and fixture values as `Mẫu đơn đăng ký KTX`, while retaining contract descriptor identity and `DORM_CONTRACT_READ`.
- AC-04: Removed contract-only field keys are not silently accepted in newly validated layouts; existing stored layouts are neither deleted nor automatically mutated.
- AC-05: Dormitory tabs are evenly distributed when they fit below `lg`; when their minimum total width exceeds the viewport, the bar scrolls horizontally without wrapping, clipping labels, or losing the active indicator/navigation action.
- AC-06: On mobile and tablet, Roster and Rooms show virtualized cards and append unique API pages through infinite scroll with loading, completion, error, and retry feedback. Desktop retains its table and explicit pagination.
- AC-07: Changing search, page size, or crossing the compact breakpoint cannot append stale/duplicate rows or continue from the wrong page; selection remains consistent with visible loaded records.
- AC-08: Pressing the Rooms compact search button replaces the toolbar search trigger with an autofocus input and close control; typing reloads filtered page 1 and infinite loading uses the same query.
- AC-09: Overview shows a smaller title without its description. Both room-status and room-debt sections use cards below `lg`, tables on desktop, preserve all current values/actions/empty states, and provide bounded vertical scrolling for large result sets.
- AC-10: Focused frontend/backend tests, frontend typecheck/build, backend build, whitespace check, and final changed-path review pass.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/components/pdf-template/PdfTemplateCatalog.test.tsx" "src/components/ui/TabNavigation.test.tsx" "src/components/ui/ResponsiveDataView.test.tsx" "src/app/(dashboard)/dormitory/layout.test.tsx" "src/app/(dashboard)/dormitory/roster/page.test.tsx" "src/app/(dashboard)/dormitory/buildings/page.test.tsx" "src/app/(dashboard)/dormitory/overview/page.test.tsx"` => catalog, navigation, compact search, infinite/virtualized data, and Overview responsive behavior pass.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/dormitory-pdf-template.spec.ts pdf-template/pdf-template.spec.ts` => contract/application palette parity, registry, fixture, resolver, and validation expectations pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors.
- `D:\PROJECT\manager_points\frontend` :: `npm run build` => Next.js build passes.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS build passes.
- Manual responsive inspection at 375 px, 768 px, 1024 px, and desktop widths => navigation distribution/scroll, search transition, card/table breakpoint, virtualized scrolling, and bounded Overview lists match AC-05 through AC-09.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

## Safety Gates

- Implementation and automated verification require a separate implementation request because this task is planning-only.
- Human Gate: None for source implementation and development verification.
- Stop and amend scope before any permission change, persistent PDF-layout migration/deletion, contract CRUD/export change, backend pagination/API contract change, dependency addition, deployment, or production mutation.
- If product intent was to remove the functional template cards rather than only the PDF header eyebrow/description, stop because that conflicts with the requested contract upload workflow and requires a UI decision.

## Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Review evidence: focused test outputs, build/typecheck results, manual viewport evidence, and final diff/status.
- Checkpoint: base commit plus final scoped diff; no intermediate planning checkpoint required.
- Effective Rules Manifest (SHA-256):
  - `safety.md`: `6a3f283b835394b1af1f6380d94cba260acbed8a60d3065dd5365bb15806a772`
  - `global.md`: `67806f70a5f89adf42e3be88413cc76cc27a02c90fad0609ae71de34d046a43f`
  - `antigravity-operating-contract.md`: `51f3677c7e44121529cc0a4b17e5667bcbd2147ee63c6f30207c10d5deb51790`
  - `orchestrator.md`: `b782109e896b2fa48a6523358a788a9db9b81b72f3d8fc66f70019395738d716`
  - `pipeline.md`: `0419c072380887f96b37fe4eb48dae764306f46fb03190b176a43ebcea3f41f3`

## Execution Budgets

- Step deadline: 600 seconds; maximum 1,800 seconds for affected builds and responsive verification.
- Concurrency: one writer per path; serialize shared navigation/component edits with consuming page changes.
- Idempotent retries: 2; engineering loops: 3; review remediation cycles: 2.
- Stop on scope expansion, stale persisted-layout mutation, permission/API changes, dependency addition, or unrelated failures.
