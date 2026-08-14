# Task Identity and Pipeline

- Task: `confirm-room-unassignment-remove-registration-approval-and-align-unclassified-ui`; pipeline: `feature_development`; profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; base commit: `ad0b6011d4265765bcebbddf268c8d837c88450c`; initial worktree: clean.

# Risk Level

- Risk: high. The work changes a room-unassignment interaction, removes authenticated API operations and an RBAC permission, and aligns two student-list experiences backed by different record types.
- Source changes are Git-revertible. No migration, live-data rewrite, deployment, or destructive verification is authorized by this planning task.

# Objective

Require explicit modal confirmation before unassigning a dormitory room, remove the unused registration approval/rejection workflow while preserving information capture and room assignment, and present unclassified registrations with the same responsive list language as a normal class except that they have no student code.

# Scope Boundaries

- Registration page behavior and focused tests: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx` and `page.test.tsx`.
- Typed dormitory client and tests: `frontend/src/api/dormitory-api.ts` and `dormitory-api.test.ts`.
- Registration approval API removal, room-operation authorization, and focused tests: `backend/src/dormitory/controllers/registrations.controller.ts`, `controllers/registrations.controller.spec.ts`, `services/registrations.service.ts`, `services/registrations.service.spec.ts`, and removal of `backend/src/dormitory/dto/approve-registration.dto.ts` when no references remain.
- Dormitory permission registry/bootstrap and its focused permission/registry tests, if present: `backend/src/auth/permissions.registry.ts`, `backend/src/auth/services/auth.service.ts`, and directly related specs.
- Unclassified class card/list UI and focused tests: `frontend/src/app/(dashboard)/students/page.tsx`, `frontend/src/app/(dashboard)/students/unclassified/page.tsx`, and a new or existing test beside each changed page. Use `frontend/src/app/(dashboard)/students/[classId]/page.tsx` and shared list components as read-only UI references unless a small shared extraction is proven necessary.

# Out of Scope

- Changing room-assignment or unassignment domain rules, deleting registrations, converting unclassified registrations into student records, assigning classes/student codes, redesigning ordinary class pages, changing dormitory public-registration submission, schema migrations, historical status cleanup, deployment, or persistent-data mutation.
- Do not copy student-only class actions into the unclassified list: create/import/transfer/delete student, account actions, discipline summaries, and student detail drawers remain excluded unless backed by an actual `Student` record.

# Context and Dependencies

- `RoomAssignmentPopover` currently calls `window.confirm` before `unassignRoom`; the registration page already imports and uses the shared `ConfirmModal` for deletion flows.
- New formal registrations are already stored as `Đã duyệt`, so the visible approve/reject actions and the single/bulk approval API are a redundant workflow. Existing records may still contain legacy `Chờ duyệt` or `Từ chối` values and must remain readable without a data migration.
- `DORM_REG_APPROVE` currently guards approve/reject, assign room, unassign room, public auto-link, and single-student link checks. Removing approval must not disable the non-approval operations: move those guards to the existing `DORM_REG_UPDATE` permission, update the permission description if needed, and remove `DORM_REG_APPROVE` from the registry only after all runtime references are gone.
- The students index renders “Chưa phân loại” as a special amber card. Its destination currently uses a standalone 50-item list, while a normal class uses the shared responsive data view, search, loading/empty states, and desktop/mobile list behavior.
- Unclassified rows are public/admin-temporary registration records, not `Student` entities. Their list should omit the `MÃ SV` column/value and expose only fields supported by that contract, such as name, contact, room, source/status, and registration code.

# Steps

1. Add regression tests for confirm-before-unassign behavior, approval UI/client/API removal, continued authorization of assign/unassign/link operations, legacy registration rendering, and the unclassified card/list responsive states.
2. Replace the native unassignment confirmation with controlled `ConfirmModal` state. Keep the room picker open when confirmation is cancelled, call the API only after confirmation, block duplicate submission, surface failure without losing the current selection, and apply the existing successful unassignment update without a full-page flash.
3. Remove approve/reject handlers, buttons, rejection dialog/state, approval-only client methods and DTO/service/controller endpoints. Remove approval-specific imports and tests while retaining registration create/edit/delete, information fields, source labels, room selection, and legacy record display.
4. Reauthorize assign room, unassign room, public auto-link, and student link-check endpoints with `DORM_REG_UPDATE`; remove the unused `DORM_REG_APPROVE` registry entry and verify no source reference remains. Do not rename persisted registration statuses or rewrite existing records.
5. Restyle the “Chưa phân loại” class card to follow the same card anatomy and responsive grid behavior as an ordinary class while retaining a clear unclassified badge/count and no class edit/delete actions.
6. Rebuild `/students/unclassified` with the ordinary class page's header/back-navigation, search, responsive table/mobile cards, loading, empty, error, and pagination/infinite-loading language. Omit `MÃ SV`, map only registration-backed fields, preserve URL/list navigation context where practical, and prevent stale search responses or white flashes.
7. Run focused frontend/backend tests, type/build checks, search for removed approval references, then inspect the final diff/status.

# Acceptance Criteria

- AC1: Clicking “Bỏ chọn phòng” opens the shared `ConfirmModal`; cancelling makes no API call and leaves the current room selection and picker available.
- AC2: Confirming sends exactly one unassignment request, disables repeated confirmation while pending, and updates the row in place on success. Failure keeps the current assignment visible and shows an actionable error.
- AC3: Registration rows expose no approve or reject actions/dialogs, and the frontend client no longer exposes single or bulk registration approval methods.
- AC4: The backend no longer exposes `PATCH /dormitory/registrations/:id/approve` or `POST /dormitory/registrations/bulk-approve`, contains no approval DTO/service implementation, and has no `DORM_REG_APPROVE` runtime or registry reference.
- AC5: Room assignment, room unassignment, public auto-link, and student link checking continue to work for users with `DORM_REG_UPDATE`; unrelated registration permissions and room-assignment business rules remain unchanged.
- AC6: New registrations still capture and display their information without an approval step. Legacy `Chờ duyệt`, `Đã duyệt`, and `Từ chối` records remain listable/searchable and are not migrated or silently deleted.
- AC7: The “Chưa phân loại” card visually follows an ordinary class card at supported breakpoints, shows the unclassified count, routes to `/students/unclassified`, and provides no class edit/delete controls.
- AC8: The unclassified destination follows the normal class list's responsive presentation and interaction quality, including back navigation, search, loading, empty/error, desktop table, mobile cards, and complete paginated loading without a 50-row truncation.
- AC9: Unclassified rows do not render a `MÃ SV` column, placeholder student code, or student-only actions; supported registration information remains visible and accessible.

# Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/registrations/page.test.tsx" src/api/dormitory-api.test.ts "src/app/(dashboard)/students/page.test.tsx" "src/app/(dashboard)/students/unclassified/page.test.tsx"` => AC1-AC3 and AC7-AC9 pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => changed registration and student-list code compiles.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/controllers/registrations.controller.spec.ts dormitory/services/registrations.service.spec.ts` => AC4-AC6 and non-approval endpoint authorization pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS compiles after DTO/method/permission removal.
- Repository root :: `rg -n "DORM_REG_APPROVE|bulkApprove|approve-registration\.dto|registrations\.approve" backend/src frontend/src` => no obsolete registration-approval references remain.
- Repository root :: `git diff --check` and `git status --short` => only scoped changes exist and unrelated work is preserved.

# Safety Gates

- Development implementation with mocked/in-memory verification requires no additional gate. Do not call unassignment or deletion endpoints against persistent user data during verification.
- Any status/schema migration, live permission reassignment, production deployment, or persistent-data correction requires a scope amendment and explicit approval before execution.

# Artifacts and Checkpoints

- Record focused regression fixtures for confirm/cancel/pending/failure, endpoint authorization, legacy statuses, and unclassified pagination. Checkpoint after backend approval removal and permission tests before completing the UI alignment.
- Stop for evidence that an external consumer still calls the approval endpoints, `DORM_REG_UPDATE` cannot safely authorize room/link operations, unclassified records lack fields required by the agreed list, or unrelated edits conflict in scoped paths.

# Execution Budgets

- Order: regression baseline -> backend approval removal/authorization -> room confirmation -> unclassified card/list -> affected verification -> final review.
- One writer per path; step deadline: 1200 seconds; retries: 2; engineering loops: 3; review-remediation cycles: 2.
