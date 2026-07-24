# Task Identity and Pipeline

- Task: `unify-activity-menu-control-design`
- Pipeline: `refactor`
- Profile: Full
- Rules: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base state: branch `main`, commit `b48f7c07`; preserve the pre-existing change in `frontend/next-env.d.ts`.

# Risk Level

- Risk: medium
- Environment: development
- Evidence: frontend-only visual/API refactor across shared primitives and multiple consumers; reversible through Git; no persistent data or external effects.

# Objective

Make buttons, selects, search fields, inputs, and textareas use one reusable visual system derived from the active `/activities` sidebar item: rounded shape, blue accent, subtle blue border/background, slate text, compact typography, and consistent hover/focus/disabled/error states.

# Scope Boundaries

- Approved: `frontend/src/**`
- Write: `frontend/src/components/ui/**`, affected frontend consumers under `frontend/src/components/**` and `frontend/src/app/**`, and their focused tests.
- Known targets: `layout/Sidebar.tsx`, `ui/button.tsx`, `ui/select.tsx`, `ui/Input.tsx`, `ui/Research.tsx`, `ui/select.test.tsx`.
- Additional consumer paths may be added only after inventory confirms they use duplicated button/select/search/input styling.

# Out of Scope

- Backend, business logic, routing, permissions, API contracts, data models, and activity-specific content/layout.
- Brand redesign, new dependencies, and unrelated formatting/refactors.
- Implementation in this planning task.

# Context and Dependencies

- Canonical desktop menu reference: active item classes at `Sidebar.tsx` (`bg-[#1A73E8]/10`, `border-[#1A73E8]/20`, `text-[#1A73E8]`, `rounded-xl`, compact weight/height).
- Mobile navigation remains behaviorally unchanged.
- Existing React, Tailwind, `class-variance-authority`, and `cn` utilities are sufficient.
- Preserve component props and accessible semantics; avoid forcing active-state blue text onto normal text-entry content.

# Steps

1. Inventory native controls and duplicated control classes; capture current focused test/typecheck baseline.
2. Extract shared control tokens/variants in the UI layer, using the `/activities` menu item as the visual source of truth.
3. Refactor `Button`, `Select`, `Input`/textarea, and `Research` to consume the shared system while retaining variants, labels, errors, portals, search, refs, and disabled behavior.
4. Replace in-scope duplicated consumer styles with shared primitives/variants; do not change behavior or copy.
5. Add/update focused tests for class contracts and interactive states, then run affected and frontend-wide verification.
6. Review the final diff for unintended visual, behavioral, or unrelated-file changes.

# Acceptance Criteria

- AC-01: The four shared control families visibly share the reference radius, blue accent, border/background treatment, typography, and interaction states.
- AC-02: Existing public props and button/select/search/input behavior remain compatible.
- AC-03: In-scope consumers use shared primitives/variants instead of repeating the canonical style bundle.
- AC-04: Focus, disabled, error, selected/open, and destructive/cancel states remain distinguishable and keyboard-usable.
- AC-05: Focused tests, frontend typecheck, and final diff review pass without modifying `frontend/next-env.d.ts`.

# Verification

- AC-01/03/04: `D:\PROJECT\manager_points\frontend :: npm test -- --run src/components/ui` => focused UI tests pass.
- AC-02/05: `D:\PROJECT\manager_points\frontend :: npm run typecheck` => exits successfully.
- Affected consumers: run their exact Vitest files discovered during inventory => all pass.
- Final: `D:\PROJECT\manager_points :: git diff --check` and `git status --short` => no whitespace errors or unintended paths.

# Safety Gates

None. Stop and amend scope if implementation requires a dependency, public breaking API, backend change, fourth material module outside the frontend design system, or production action.

# Artifacts and Checkpoints

- Artifact: `docs/taskscope.md`
- Checkpoints/hashes: None required before implementation; Git is the recovery mechanism.

# Execution Budgets

- Step deadline: 600 seconds (maximum 1800).
- Concurrency: one writer per path.
- Retries: 2; engineering loops: 3; review remediation cycles: 2.
