## Task Identity and Pipeline

Task: `buildings-form-validation-mobile-virtualization` | Pipeline: `feature_development` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `c1b551459f6646397f13219d459e95b7b42b9bb3`

## Risk Level

Risk: medium. Frontend-only, reversible changes affect shared responsive list rendering and the Buildings room/building forms; no database or API contract change.

## Objective

Buildings forms provide complete client-side validation, while the mobile room list combines reliable infinite loading with true windowed virtualization.

## Scope Boundaries

Approved/write: `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx`, `frontend/src/app/(dashboard)/dormitory/buildings/page.test.tsx`, `frontend/src/components/ui/ResponsiveDataView.tsx`, `frontend/src/components/ui/ResponsiveDataView.test.tsx`.

## Out of Scope

Backend DTO/business-rule changes, room/bed persistence, other screens unless an existing `ResponsiveDataView` behavior must be preserved, desktop pagination redesign, dependencies, and visual redesign.

## Context and Dependencies

Room/building forms currently use native `required` only; they do not expose field-level errors or client checks for missing selects, trimmed values, positive-integer bed count, or non-negative finite price. Mobile already fetches subsequent pages with `IntersectionObserver` and deduplicates by ID, but `ResponsiveDataView` renders every loaded card with `data.map`; therefore Infinite Scroll exists and Virtualization does not. `@tanstack/react-virtual` is already installed.

## Steps

1. Extract deterministic room/building validators and normalized payload construction; keep backend validation authoritative.
2. Show accessible field-level errors, clear errors when corrected/reopened, block invalid submissions, and prevent duplicate submits.
3. Add optional mobile virtualization to `ResponsiveDataView` using the existing scroll container, measured dynamic card heights, stable keys, bounded overscan, and spacer positioning; preserve non-virtual callers and desktop tables.
4. Enable virtualization for Buildings and keep the sentinel inside the virtual scroll extent so page loading continues near the end.
5. Harden reset/search/retry/end-of-list/in-flight behavior so pages are neither duplicated nor skipped across responsive transitions.
6. Add focused validation, infinite-scroll, virtualization, selection/action, empty/loading/error, and desktop regression tests; inspect final diff/status.

## Acceptance Criteria

- AC1: Room submit is blocked with visible errors when code/name/building/type is missing, bed count is not a positive integer, or price is negative/non-finite.
- AC2: Building submit is blocked when trimmed code/name is empty; valid create/edit payloads remain normalized and submit once.
- AC3: Mobile loads page 2+ when the sentinel approaches, merges unique IDs in order, supports retry, and stops at `totalPages`.
- AC4: Only the visible mobile card window plus overscan is mounted for a long loaded list; scrolling preserves actions, selection, and stable item identity.
- AC5: Desktop table and pagination, non-virtual `ResponsiveDataView` consumers, and mobile loading/empty states retain current behavior.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/buildings/page.test.tsx" src/components/ui/ResponsiveDataView.test.tsx` => validation, infinite-scroll, virtualization, and regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors in affected frontend code.
- `D:\PROJECT\manager_points` :: `git diff --check` => no whitespace errors.

## Safety Gates

None.

## Artifacts and Checkpoints

Focused test output and final diff; no checkpoint required.

## Execution Budgets

One writer per path; up to 3 engineering iterations and 2 review-remediation cycles. Stop for API/backend changes, new dependencies, or shared-component behavior outside the stated compatibility boundary.
