# Task Identity and Pipeline

Task: `rename-dormitory-list-and-registration-summary` | Pipeline: `feature_development` | Profile: Full | Rules: Fast and Accurate Coding Instructions v3.2.0 | Repository: `D:\PROJECT\manager_points` | Base: `main@dae6ccb8`, clean worktree at planning time.

# Risk Level

Medium. The change extends a dashboard API contract and updates two UI surfaces. It is reversible, has no persistence migration, and affects only dormitory reporting/navigation.

# Objective

Rename the dormitory `Đăng ký` tab to `Danh sách` and replace the Overview registration summary cards with accurate assigned-room, male, female, and air-conditioned-room-request counts.

# Scope Boundaries

Approved: dormitory dashboard reporting and dormitory navigation UI.

Write:

- `backend/src/dormitory/services/dormitory-reports.service.ts`
- `backend/src/dormitory/services/dormitory-reports.service.spec.ts`
- `frontend/src/api/dormitory-api.ts`
- `frontend/src/app/(dashboard)/dormitory/layout.tsx`
- `frontend/src/app/(dashboard)/dormitory/layout.test.tsx`
- `frontend/src/app/(dashboard)/dormitory/overview/page.tsx`
- `frontend/src/app/(dashboard)/dormitory/overview/page.test.tsx`

# Out of Scope

Routes/URLs, registration workflows and action labels, authentication registration, public KTX forms, database schema/migrations, and unrelated modules remain unchanged.

# Context and Dependencies

`registration_summary` already deduplicates linked public records and exposes `requested_room_type.may_lanh`, but does not expose assigned or gender totals. Formal and unlinked public/admin rows contain `gender`; assignment can be represented by room/bed references or an active contract.

# Steps

1. Backend owner: extend `registration_summary` with `assigned` and `by_gender` (`male`, `female`, `other`); count each deduplicated row once. Treat a row as assigned when it has `room_id`, `bed_id`, or a matching active contract.
2. Backend tests: cover mixed formal/public/admin sources, linked-public exclusion, gender values, and assignment paths.
3. Frontend owner: update `DormitoryRegistrationSummary`; preserve compatibility defaults for the new fields.
4. Rename the dormitory tab and Overview shortcut/link text from registration-oriented navigation to `Danh sách`; keep `/dormitory/registrations` unchanged.
5. Replace the four `Tóm tắt đăng ký` cards, in order, with `Đã xếp phòng`, `Nam`, `Nữ`, `Máy lạnh`. Use `assigned`, `by_gender.male`, `by_gender.female`, and `requested_room_type.may_lanh`.
6. Update focused UI tests, then perform independent diff review and affected verification.

# Acceptance Criteria

- AC-01: Dormitory navigation displays `Danh sách`, routes to `/dormitory/registrations`, and no Overview navigation control is labeled only `Đăng ký`.
- AC-02: `registration_summary.assigned` counts deduplicated registrations assigned through a room/bed reference or active contract exactly once.
- AC-03: `by_gender` counts `Male`, `Female`, and all remaining/missing values as `other` without double-counting linked public records.
- AC-04: The Overview summary shows exactly the requested four cards in the specified order; `Máy lạnh` remains the requested room-type count.
- AC-05: Existing loading, partial-data fallback, realtime refresh, room, and invoice behavior remain intact.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/dormitory-reports.service.spec.ts` => AC-02 and AC-03 pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend contract compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/layout.test.tsx" "src/app/(dashboard)/dormitory/overview/page.test.tsx"` => AC-01, AC-04, and AC-05 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => frontend contract compiles.
- `D:\PROJECT\manager_points` :: `git diff --check` and scoped diff review => no whitespace errors or unintended changes.

# Safety Gates

None. Stop for any required route change, persistent-data change, or expansion outside the approved boundary.

# Artifacts and Checkpoints

Final scoped diff and command outputs only; no checkpoint is required for this reversible change.

# Execution Budgets

Concurrency: at most one writer per path. ENG loop: 0..3; review remediation: 0..2; idempotent retries: 0..2. Independent review is required before final affected verification.
