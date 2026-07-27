Task: `mobile-sidebar-pill-design` | `ui_change` | Risk: medium | Profile: Quick

Objective: Restyle the responsive mobile sidebar as a centered floating pill matching the supplied reference: five evenly distributed icon-only actions, a distinct rounded active item, and stable alignment on supported mobile widths.

Boundary: Mobile bottom navigation only; preserve route visibility, permission filtering, navigation behavior, accessibility, safe-area handling, and the desktop sidebar. Do not change page content, backend behavior, or PWA loading behavior.

Write:

- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/globals.css`
- `frontend/src/components/layout/Sidebar.test.tsx`

Targets: `.mobile-bottom-nav`, its loading placeholders, mobile links/profile action, active-state styling, and the existing mobile navigation tests.

Steps: Reconcile conflicting component/global positioning rules; implement the white rounded pill, icon-only items, spacing, shadow, and active squircle; retain accessible labels and `aria-current`; add focused layout/semantics regressions; visually inspect role-dependent item counts and safe areas.

Verify:

- `D:\PROJECT\manager_points\frontend :: npm test -- --run src/components/layout/Sidebar.test.tsx` => focused tests pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors.
- Inspect at 375x812, 390x844, and 430x932 in mobile browser and standalone PWA modes => centered, unclipped, safe-area clear, and no horizontal overflow.
- `D:\PROJECT\manager_points :: git diff --check` => valid patch formatting.

Done: The mobile navigation matches the reference’s pill hierarchy and icon treatment, stays centered across target widths, exposes accessible names, preserves authorized destinations, and leaves desktop behavior unchanged.

Gate: None.
