### 1. Task ID + Pipeline
- `Task ID: ACTIVITY-SCHEDULE-20260715-006`
- `Pipeline: feature_development`

### 2. Risk Level
- `Risk Level: Medium` — Frontend-only development changes with no production, permission, persistent-data, or external side effects; reversible by scoped Git diff, but scroll positioning and destructive-confirmation regressions require focused tests.

### 3. Objective
Adjust `/activities/schedule` so the compact configuration dialog follows its originating activity card while scrolling, Location loads from the activity classroom, and the delete-schedule and cancel-recurring-series modals have clear, consistent UI.

### 4. Scope
- `frontend/src/components/activities/ActivityScheduleWorkspace.tsx`
  - Keep `Cấu hình buổi sinh hoạt` anchored to and moving with its originating card during vertical/horizontal scroll; ordinary scroll or control interaction must not close it.
  - Initialize editable Location using precedence: non-empty saved/user value, selected activity''s non-empty `classroom`, then existing fallback.
  - Rewrite UI layout, hierarchy, impact copy, and action styling for `Xác nhận xoá lịch trình`, preserving handlers and deletion target.
  - Rewrite UI layout, hierarchy, recurrence-impact copy, and action styling for `Huỷ chuỗi lặp lại`, preserving handlers and recurrence scope.
- `frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx`: add or adjust focused regressions for anchored scrolling, Location precedence, and both confirmation modals.
- `taskscope.md`: record this scope and verification.

### 5. Out of Scope
- Backend, APIs, database, migrations, auth, permissions, or classroom contracts.
- Schedule/recurrence business logic, drag-and-drop, source-week behavior, navigation, or deletion semantics.
- Other pages/dialogs, global design systems, dependencies, broad refactors, unrelated formatting, deployment, release, merge, publish, or bulk encoding conversion.

### 6. Context & Dependencies
- Route `/activities/schedule` is implemented by `ActivityScheduleWorkspace.tsx`.
- The compact dialog must derive its position from the card that opened it as the schedule container scrolls.
- Activity data exposes `classroom`; a non-empty saved/user Location remains authoritative.
- Existing mutation handlers must be reused; presentation changes must not alter destructive behavior.
- Verified `frontend/package.json`: `test` runs `vitest run`; `typecheck` runs `tsc --noEmit`.
- Environment: Windows PowerShell at `D:\PROJECT\manager_points`.
- Preserve Vietnamese text, source encoding/BOM, and line endings; keep `taskscope.md` UTF-8 with BOM.

### 7. Steps
#### PLAN
- Inspect rules, component, activity type, current position/scroll logic, Location-opening paths, confirmation handlers, and focused tests.
- Confirm Scope, Medium risk, gates, and verification before editing.

#### EXECUTE
- In `ActivityScheduleWorkspace.tsx`, make the compact dialog follow its card during scroll without scroll-triggered dismissal; retain explicit close, cancel, Escape, and successful-submit dismissal.
- Apply Location precedence on every compact-dialog opening path: saved/user value, `classroom`, fallback; retain editability.
- Rebuild both named confirmation modal layouts with accessible title/description, clear impact text, and distinct cancel/destructive actions while retaining handlers.
- In `ActivityScheduleWorkspace.test.tsx`, test scroll anchoring/no dismissal, Location precedence, modal copy/actions, and exactly-once handlers.

#### VERIFY
- Run focused Vitest, TypeScript checking, `git diff --check`, and scoped diff review.
- Check all acceptance criteria, localization/encoding integrity, and unintended changed files.

#### REFINE
- Identify the exact failed interaction, precedence branch, modal assertion, type error, or unintended diff.
- Apply the smallest scoped correction and rerun the affected check first.
- Stop on success, Human Gate, required scope/risk expansion, or iteration limit.

### 8. Acceptance Criteria
- Scrolling keeps the compact dialog open and moving with its originating card; it is neither viewport-fixed nor spatially detached.
- Ordinary scroll/control interaction does not dismiss it; explicit close, cancel, Escape, and successful submit retain existing behavior.
- Without non-empty saved/user Location, a non-empty selected activity `classroom` initializes Location and remains editable.
- Saved/user Location overrides `classroom`; fallback appears only when both are empty.
- Each named confirmation modal shows a clear title and impact description with separate cancel/destructive actions, each invoking existing behavior exactly once.
- Focused tests and typecheck pass; `git diff --check` has no errors.
- No invalid Vietnamese text, `U+FFFD`, mojibake, unintended BOM change, or encoding/line-ending-only diff is introduced.
- The task diff contains only scoped files and modifications.

### 9. Verification Commands
`D:\PROJECT\manager_points\frontend :: npm test -- --run "src/components/activities/ActivityScheduleWorkspace.test.tsx" -> exit 0; focused tests pass`

`D:\PROJECT\manager_points\frontend :: npm run typecheck -> exit 0; no TypeScript errors`

`D:\PROJECT\manager_points :: git diff --check -> exit 0; no whitespace errors or conflict markers`

`D:\PROJECT\manager_points :: git diff -- taskscope.md frontend/src/components/activities/ActivityScheduleWorkspace.tsx frontend/src/components/activities/ActivityScheduleWorkspace.test.tsx -> exit 0; only scoped changes and no encoding conversion`

### 10. Safety Gates
- Scope expansion or risk above Medium: pause affected edits and obtain explicit approval.
- Deployment, release, merge, publish, production/destructive repository action, database/infrastructure, secrets/auth/permissions, external communication, or paid service: pause and obtain action-specific approval.
- Bulk encoding/BOM/line-ending conversion: pause and obtain approval after providing files, encoding evidence, and rollback plan.

### 11. Artifacts to Review
`None — no Human Gate triggered.`

If triggered, provide `git status --short`, affected diff, relevant test/typecheck output, and encoding evidence.

### 12. Loop_iterations Override
`Loop_iterations: 3 (default, stop early on success)`
