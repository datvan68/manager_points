# Task Identity and Pipeline

Task: `dormitory-registration-selection-room-export` | Pipeline: `feature_development` | Profile: Full | Rules: 3.2.0 | Repository: `D:\PROJECT\manager_points` | Branch/base: `main` / `04a06e54afd04c292a87bfb7d582c69d99962d38`

# Risk Level

Risk: medium. Development-only, reversible UI/API response enrichment; no migration, persistent-data mutation, dependency, deployment, or external effect.

# Objective

Allow registration rows to be selected for confirmed bulk deletion or Excel export, display assigned room instead of semester/year, and make “Thêm sinh viên” visually consistent with adjacent menu items.

# Scope Boundaries

Approved/write: `backend/src/dormitory/services/registrations.service.ts`, `backend/src/dormitory/services/registrations.service.spec.ts`, `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`.

# Out of Scope

Shared `FloatingActionBar`/`ResponsiveDataView`, database schemas/migrations, assignment workflows, other dormitory pages, and API route changes.

# Context and Dependencies

The page already renders checkboxes and `FloatingActionBar`, but selection is limited to approvable formal rows and the bar only bulk-approves. `xlsx` is installed. Registration responses do not consistently expose the assigned room; formal assignments are represented by active contracts, while public registrations retain a room reference/code.

# Steps

1. Enrich registration list rows with the assigned room name from the active contract or public room reference, using one batched lookup and a stable optional response field.
2. Make all visible registrations selectable; replace bulk approval with permission-aware “Xóa” and “Xuất Excel” actions. Confirm deletion with `ConfirmModal`, preserve failed selections, refresh successful deletions, and export only selected rows with Vietnamese column labels and Unicode values.
3. Replace “Kỳ/năm” with “Phòng”, rendering the room name or “Chưa xếp phòng”. Change “Thêm sinh viên” to the same outline/translucent style as neighboring menu items.
4. Add focused backend and frontend regression tests.

# Acceptance Criteria

- AC1: Selecting one or more visible rows opens the bar with delete and Excel actions; clearing or paging resets selection.
- AC2: Bulk deletion requires confirmation, respects delete permission, reports full/partial failure, and retains failed row selections.
- AC3: Excel contains only selected registrations and preserves fully accented Vietnamese text without mojibake.
- AC4: The table shows “Phòng”; assigned rows show the room name and unassigned rows show “Chưa xếp phòng”.
- AC5: “Thêm sinh viên” has no solid blue background and matches adjacent outline items.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/registrations.service.spec.ts` => room enrichment tests pass.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => selection, export mapping, room label, and styling tests pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend type-checks.
- `D:\PROJECT\manager_points` :: `git diff --check -- docs/taskscope.md backend/src/dormitory/services/registrations.service.ts backend/src/dormitory/services/registrations.service.spec.ts "frontend/src/app/(dashboard)/dormitory/registrations/page.tsx" "frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => scoped diff has no whitespace errors.

# Safety Gates

None.

# Artifacts and Checkpoints

Taskscope plus focused test output and final diff/status; no checkpoint or hash artifact required.

# Execution Budgets

One writer per path; up to 3 implementation/verification iterations and 2 remediation cycles; stop on boundary expansion, migration, dependency, destructive persistent-data work, or a new gate.
