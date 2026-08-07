# Task Identity and Pipeline

- Task: `dormitory-registration-table-actions`
- Pipeline: `feature_development`
- Risk: high
- Profile: Full
- Rule set: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Base commit: `b2a7d24187ffb5a281df744c51fc5f468e9e3431`
- Base state: clean worktree at planning time.

## Risk Level

The change spans the dormitory UI, frontend API contract, backend controller/service/DTOs, and authorization registry. Delete is a persistent-data operation and registration records may be referenced by contracts or public-registration links. Code and isolated automated tests are reversible through Git; invoking delete or applying new permissions to a non-test database requires a Human Gate.

## Objective

Make the dormitory registration table show the seven requested data columns in the specified order, add right-aligned edit/delete actions, edit the correct underlying registration type, and require the shared `ConfirmModal` before a safe deletion.

## Scope Boundaries

### Approved/read boundary

- `frontend/src/app/(dashboard)/dormitory/registrations/**`
- `frontend/src/api/dormitory-api.ts` and its focused test
- `frontend/src/components/modals/ConfirmModal.tsx` for contract/reference only
- `frontend/src/components/ui/ResponsiveDataView.tsx` for alignment behavior/reference only
- `backend/src/dormitory/controllers/registrations.controller.ts`
- `backend/src/dormitory/services/registrations.service.ts` and focused specs
- `backend/src/dormitory/dto/**`
- `backend/src/dormitory/schemas/{registration,public-registration,contract}.schema.ts` for constraints/reference only
- `backend/src/auth/permissions.registry.ts`
- `backend/src/auth/services/auth.service.ts`

### Expected write boundary

- `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`
- `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`
- `frontend/src/api/dormitory-api.ts`
- `frontend/src/api/dormitory-api.test.ts`
- `backend/src/dormitory/controllers/registrations.controller.ts`
- `backend/src/dormitory/services/registrations.service.ts`
- `backend/src/dormitory/services/registrations.service.spec.ts`
- `backend/src/dormitory/controllers/registrations.controller.spec.ts`
- New focused update DTO under `backend/src/dormitory/dto/`
- `backend/src/auth/permissions.registry.ts`
- `backend/src/auth/services/auth.service.ts`

### Table contract

After the existing optional selection checkbox, render exactly this data-column order:

1. `Mã SV`: show the student code; use `Chưa có mã SV` when null, empty, or whitespace. Do not substitute the registration code.
2. `Họ và tên`: resolve the existing normalized/formal/public name and use `—` only when unavailable.
3. `Kỳ/năm`: render `<semester> / <academic_year>` with a safe `—` fallback.
4. `Ưu tiên`: render `Không` when `priority_group` is missing or equals `Không`; otherwise render `Có`.
5. `Trạng thái`: render source mode only: `QR` for `PUBLIC`, and `Thủ công` for `FORMAL` or `ADMIN_TEMPORARY`. Approval status/filtering remains functional but is not rendered in this column.
6. `Ngày tạo`: format `createdAt` with locale `vi-VN`, or `—` when invalid/missing.
7. `Thao tác`: apply `text-right` to header/cells and `justify-end` to its icon container so it sits against the right edge.

## Out of Scope

- Removing the selection/bulk-approval workflow or changing approval business rules.
- Editing student master data such as a formal student's name or student code.
- Cascading deletion of contracts, room/bed assignments, linked registrations, or student records.
- Changing persisted schema field names, enum storage values, collection names, pagination, filters, QR registration flow, or unrelated dormitory pages.
- Redesigning `ConfirmModal` or `ResponsiveDataView` globally.
- Production deployment, database cleanup, or executing a delete against real data.

## Context and Dependencies

- The page currently combines `Registration` rows (`FORMAL`) and `PublicRegistration` rows (`PUBLIC`/`ADMIN_TEMPORARY`) in `RegistrationsService.findAll`; update/delete must route by an explicit, validated source and must never guess between collections.
- No registration update/delete endpoints or frontend client methods currently exist.
- Existing permissions are `DORM_REG_READ`, `DORM_REG_CREATE`, and `DORM_REG_APPROVE`; add `DORM_REG_UPDATE` and `DORM_REG_DELETE`, assign them to the dormitory manager role, guard the endpoints, and use the same permission checks to show icons.
- The shared `ConfirmModal` accepts async `onConfirm`, owns its pending state, and closes only after successful completion. The page must keep the modal open and show an error toast when deletion rejects.
- Relevant page/test strings currently contain mojibake. Any touched user-facing Vietnamese string in these files must be restored as valid UTF-8 with full accents; assertions must use the corrected text.
- Icons come from the existing `lucide-react` dependency (`Pencil`, `Trash2`); no new dependency is needed.

## Steps

1. **Backend contract and authorization** — Add a validated partial update DTO and explicit `source` discriminator; register `DORM_REG_UPDATE`/`DORM_REG_DELETE`; expose guarded `PATCH /dormitory/registrations/:id` and `DELETE /dormitory/registrations/:id` routes without altering approve routes.
2. **Backend behavior** — Route `FORMAL` to `Registration` and `PUBLIC`/`ADMIN_TEMPORARY` to `PublicRegistration`. Permit only registration-owned editable fields, reject attempts to mutate IDs, codes, source, timestamps, links, or review metadata, and return `404` for a missing row. Before delete, reject records referenced by a contract or linked registration; perform no cascade.
3. **Frontend API** — Add typed update/delete payloads and methods carrying the immutable row source; preserve the normalized `DormRegistration` response contract.
4. **Table presentation** — Replace the current column definitions with the table contract above, preserve selection and applicable approve/reject controls, correct the page's read check from the nonexistent `DORM_REG_VIEW` to `DORM_REG_READ`, add permission-gated pencil/trash icons, accessible Vietnamese labels/titles, and right-edge alignment on desktop and mobile cards.
5. **Edit flow** — Reuse the page's dialog/form controls, prefill the selected row, and submit only fields valid for its source. Formal student identity stays read-only; public/manual temporary identity fields may be edited. On success, close/reset, toast, and reload without duplicating mobile rows.
6. **Delete flow** — Store the selected row, open `ConfirmModal` with `variant="danger"`, identify the student by name/code in the message, call delete only from `onConfirm`, prevent duplicate submission, toast the result, clear stale selection, and refresh pagination safely.
7. **Regression coverage and review** — Test source/value mapping, exact columns and right alignment, permission visibility, edit dispatch, cancel/no-delete, confirm/delete-once, failure handling, backend source routing/validation/reference guards, and API method/HTTP contracts. Review the final diff for mojibake and unrelated changes.

## Acceptance Criteria

- **AC-01:** The table's seven data columns and displayed values match the Table contract exactly on desktop; mobile cards retain the same information and actions.
- **AC-02:** `Pencil` and `Trash2` are visible only with their corresponding permissions; existing approve/reject actions still work where previously applicable.
- **AC-03:** Editing either storage type updates only allowed fields and refreshes the row; immutable identity/link/review fields cannot be changed through the endpoint.
- **AC-04:** Clicking trash performs no request until the danger `ConfirmModal` is confirmed; cancel performs no request; confirm issues exactly one delete and reports success/failure.
- **AC-05:** Referenced or linked registrations are not deleted or cascaded and return a clear conflict response; missing IDs and invalid sources return controlled errors.
- **AC-06:** All touched Vietnamese UI text is correctly accented UTF-8 and focused checks contain no known mojibake sequences.
- **AC-07:** Focused backend/frontend tests, frontend type-check, backend build, diff check, and final status inspection pass without modifying unrelated files.

## Verification

- `D:\PROJECT\manager_points\backend :: npm test -- registrations.service.spec.ts registrations.controller.spec.ts --runInBand` => update/delete routing, guards, validation, not-found, and reference protection pass (`AC-03`, `AC-05`).
- `D:\PROJECT\manager_points\frontend :: npm test -- src/api/dormitory-api.test.ts "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => table mapping/actions/modal/API regressions pass (`AC-01`, `AC-02`, `AC-04`, `AC-06`).
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no TypeScript errors in the affected frontend contract (`AC-01`–`AC-04`).
- `D:\PROJECT\manager_points\backend :: npm run build` => NestJS controller, DTO, service, and permission changes compile (`AC-03`, `AC-05`).
- `D:\PROJECT\manager_points :: rg -n "ChÆ|Ä‘|Ä|á»|â€”|Æ¯|Ká»" "frontend/src/app/(dashboard)/dormitory/registrations"` => no matches in touched page/tests (`AC-06`).
- `D:\PROJECT\manager_points :: git diff --check` => no whitespace errors (`AC-07`).
- `D:\PROJECT\manager_points :: git status --short` => only approved implementation paths plus any pre-existing user changes appear (`AC-07`).

## Safety Gates

- **Trigger:** Invoking the new delete endpoint against development/staging/production data, or applying permission seeding to a persistent non-test database.
- **Artifact:** Passing focused tests/build, reviewed API behavior, exact environment/database, target registration ID/source, dependency/reference check, and current diff.
- **Approval:** Explicit user approval is required immediately before the persistent action; writing this taskscope does not authorize it.
- **Rollback:** Restore the deleted record from a verified backup/audit snapshot and revert permission assignment/code through Git. Because no cascade is allowed, dependent records remain unchanged.
- **Resume point:** After approval, revalidate target/source/references, perform the single authorized action, then verify the record/permissions and affected list response.

## Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`.
- Implementation evidence: focused test/build output and final Git diff/status.
- Base checkpoint: commit `b2a7d24187ffb5a281df744c51fc5f468e9e3431`; record current commit and hashes of changed files before any gated persistent action.

## Execution Budgets

- Step deadline: 600 seconds; maximum 1,800 seconds for the affected test/build step.
- Maximum concurrent writers per path: 1.
- Idempotent retries: 2; engineering mutation/verification loops: 3; review remediation cycles: 2.
- Stop on overlapping dirty changes, unexpected storage relations, scope expansion, authorization conflict, failed required verification, or any persistent action without the Human Gate.
