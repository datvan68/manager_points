Task: `mobile-sidebar-active-glass` | `ui_change` | Risk: medium | Profile: Quick

Objective: Refine the mobile bottom navigation to match the supplied references: a visually balanced active control centered within its equal-width slot, plus a clearly visible frosted-glass container.

Boundary: Mobile bottom navigation only. Preserve destinations, role/permission filtering, active-route logic, accessibility, safe-area behavior, and the desktop sidebar. Do not change backend or PWA loading behavior.

Write:

- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/globals.css`
- `frontend/src/components/layout/Sidebar.test.tsx`

Targets: `.mobile-bottom-nav`, `.mobile-bottom-nav-item`, `.mobile-bottom-nav-item-active`, loading placeholders, and focused mobile navigation tests.

Steps: Inspect active dimensions across role-dependent item counts; separate each equal-width navigation slot from its fixed-size active surface if required; center the icon and active surface; tune translucent background, border, shadow, `backdrop-filter`, and `-webkit-backdrop-filter`; retain reduced-motion, focus-visible, and safe-area behavior; add focused regressions for active semantics and class structure.

Verify:

- `D:\PROJECT\manager_points\frontend :: npm test -- --run src/components/layout/Sidebar.test.tsx` => focused tests pass.
- Inspect at 375x812, 390x844, and 430x932 => active surface is centered and consistent; glass blur is visible; no clipping or horizontal overflow.
- `D:\PROJECT\manager_points :: git diff --check` => valid patch formatting.

Done: Active items have consistent centered geometry matching the reference, the navigation visibly uses frosted glass with a legible fallback, authorized actions remain unchanged, and desktop layout is unaffected.

Gate: None.
