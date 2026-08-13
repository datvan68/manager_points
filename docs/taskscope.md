# Task Identity and Pipeline

- Task: `manage-retired-bed-deletion-and-fix-registration-member-update`
- Pipeline: `bug_fix`; Profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; base commit: `1080fb713c6c531481c40ab41e8afbb63e28a579`; initial worktree: clean.

# Risk Level

- Risk: high. The change crosses frontend/backend boundaries and introduces an explicit destructive action for persisted bed records.
- Source changes are Git-revertible. No live data deletion, database migration, deployment, or production mutation is authorized by this planning task.

# Objective

The bed-management modal lets an authorized user explicitly keep or safely delete eligible retired beds, no longer offers manual bed creation, and editing a registration member succeeds without the misleading `Không thể cập nhật trường: preference` error for any supported registration source.

# Scope Boundaries

- Bed UI, permission handling, confirmation state, and tests: `frontend/src/app/(dashboard)/dormitory/buildings/page.tsx` and `page.test.tsx`.
- Bed deletion contract, safety validation, and tests: `backend/src/dormitory/services/beds.service.ts`, a focused `beds.service.spec.ts`, and controller/API tests only if their observable contract changes.
- Registration edit payload/source transport and tests: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`, `page.test.tsx`, `frontend/src/api/dormitory-api.ts`, and `dormitory-api.test.ts`.
- Registration update normalization and tests: `backend/src/dormitory/dto/update-registration.dto.ts`, `backend/src/dormitory/controllers/registrations.controller.ts`, `backend/src/dormitory/services/registrations.service.ts`, and their focused specs only where required by the reproduced failure.

# Out of Scope

- Manual database cleanup, automatic deletion of retired beds, deletion of occupied or historical beds, changing room-capacity semantics, schema/index migration, deployment, unrelated dormitory pages, and visual redesign.
- Removal of backend bed-creation/auto-create APIs used by room-capacity reconciliation; only the pictured manual `Mã giường / Vị trí / Thêm` form is removed from this modal.

# Context and Dependencies

- The modal currently exposes delete only for `Trống` beds and immediately invokes the delete API; `Đã nghỉ` beds have no action. Backend deletion currently blocks only `Đang sử dụng` and does not protect `has_history`.
- Capacity reduction creates `Đã nghỉ` records only from free, history-free beds. Deleting one must not decrement active `bed_count`; retaining it must leave it available for safe reactivation when capacity grows.
- The pictured manual-create form is controlled by `DORM_BED_CREATE`; removing it also requires removing its local form/saving state and avoiding a management entry point that is useful only for create permission.
- Current frontend tests assert flat temporary payloads and backend normalizes a legacy nested temporary `preference`, yet the reported member-edit request still reaches invalid-field validation. Diagnosis must capture the actual row `source`, encoded query, DTO-transformed body, and persisted model before changing the contract.

# Steps

1. Reproduce and add regression tests for deleting/cancelling a retired bed, absence of the manual-create form, and member edits across `FORMAL`, `PUBLIC`, and `ADMIN_TEMPORARY` sources.
2. Remove the manual bed-create controls and dead state/handler from the modal; keep capacity-driven creation unchanged and align modal visibility with remaining update/delete permissions.
3. Add an explicit delete action for eligible `Đã nghỉ` beds behind `DORM_BED_DELETE`, require a confirmation modal, patch/refresh only after success, and preserve the row on cancel or failure.
4. Harden backend bed deletion so occupied or historical beds cannot be deleted and retired-bed deletion leaves active room capacity consistent; return an actionable conflict for protected records.
5. Trace registration edit source and payload through page, API client, controller DTO transformation, and service validation; make source-aware normalization deterministic without weakening unsupported-field validation.
6. Run focused tests, package compile/type checks, independent review, and final diff/status inspection.

# Acceptance Criteria

- AC1: An authorized user sees `Xóa` for an eligible `Đã nghỉ` bed; choosing cancel performs no API call or state change, while confirming calls delete exactly once and removes the row after success.
- AC2: Deleting a history-free retired bed does not decrement active room capacity, and refresh/synchronization reports the correct room and bed availability.
- AC3: Backend rejects deletion of `Đang sử dụng` or `has_history: true` beds; an API failure keeps the bed visible and presents an actionable error.
- AC4: The `Mã giường`, `Vị trí`, and `Thêm` controls from the supplied image are absent from `Quản lý giường`; no manual-create request can originate from that modal.
- AC5: Room creation and `Tổng số giường` increase/decrease continue to create, retire, or reactivate canonical beds as before; the bed create/auto-create backend APIs remain compatible.
- AC6: Editing a formal registration member sends a valid `source=FORMAL` request with nested `preference` and persists supported preference fields without an invalid-field error.
- AC7: Editing `PUBLIC` or `ADMIN_TEMPORARY` members persists flat `room_type`/`notes`; legacy nested `preference` is normalized safely, and missing/invalid sources produce a source-specific error instead of `preference`.
- AC8: Unsupported fields remain rejected, and focused controller/service/client tests exercise the serialized HTTP request rather than only the payload helper.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/beds.service.spec.ts dormitory/services/registrations.service.spec.ts dormitory/controllers/registrations.controller.spec.ts` => AC2, AC3, and AC6-AC8 pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/buildings/page.test.tsx" "src/app/(dashboard)/dormitory/registrations/page.test.tsx" src/api/dormitory-api.test.ts` => AC1 and AC4-AC8 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => modified UI/API types compile.
- Repository root :: `git diff --check` and `git status --short` => only scoped changes exist and unrelated work is preserved.

# Safety Gates

- Implementation and mocked development verification require no additional gate. Do not execute a delete against live/persistent user data during verification.
- The product action must require the end user's explicit confirmation before deleting one resolved retired-bed ID.
- Any migration, bulk cleanup, deletion of historical/occupied records, or deployment requires a scope amendment and explicit approval before execution.

# Artifacts and Checkpoints

- Record the reproduced registration request shape, focused test/build/typecheck results, and final diff/status. Checkpoint after backend deletion and update-contract tests before frontend integration.
- Stop for a required migration, ambiguity in registration source ownership, capacity drift, or inability to prove historical-bed protection.

# Execution Budgets

- Order: regression evidence -> backend guards/normalization -> frontend behavior -> affected verification -> independent review.
- One writer per path; step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
