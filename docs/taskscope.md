Task: `activity-detail-mobile-tabs-and-rule-button` | `bug_fix` | Risk: medium | Profile: Quick

Objective: On `activities/[activityId]`, render “Cấu hình quy tắc hoàn thành” with the shared `Button` and make permitted tabs icon-only, evenly distributed, and accessible below `sm`, while preserving icon-and-label tabs from `sm` upward.

Boundary: Activity-detail presentation and focused regression coverage only. Preserve permissions, tab order, active state, URL synchronization, dialog behavior, and larger-screen labels. | Write: `frontend/src/app/(dashboard)/activities/[activityId]/page.tsx`, `frontend/src/app/(dashboard)/activities/[activityId]/page.test.tsx`, `docs/taskscope.md`.

Targets: The activity-detail tab navigation and completion-rule configuration trigger; existing `@/components/ui/button` is the canonical button component.

Steps: Capture role/tab behavior -> ensure the rule trigger is a typed shared `Button` -> hide visual labels below `sm`, retain accessible names, and equally size visible tabs -> add focused assertions -> verify.

Verify: `D:\PROJECT\manager_points\frontend :: npm test -- --run "src/app/(dashboard)/activities/[activityId]/page.test.tsx"` => tests pass; `npm run typecheck` => no errors; inspect at `390x844` and `768x1024` => mobile icons are evenly spaced and labels hidden, while tablet labels and interactions remain; `D:\PROJECT\manager_points :: git diff --check` => clean.

Done: No raw `<button>` implements the named rule action; it opens the same dialog. Mobile shows only permitted tab icons at equal widths with accessible names and a clear active state. At `sm` and above, existing labels return. Role visibility and tab routing are unchanged.

Gate: None
