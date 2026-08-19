# Taskscope: Two Dormitory PDF Template Types and Simplified Catalog Actions

## Task Identity and Pipeline

- Task: `add-dormitory-residence-and-contract-pdf-types`
- Pipeline: `feature_development`
- Profile: Full
- Rules: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Branch/base: `main` at `7b1f1dbd3755715c1a4faad12099e821c73db0cd`
- Base state: `docs/taskscope.md` is the only pre-existing modified path and is replaced by this planning artifact.
- Authority: Planning only. This scope does not authorize implementation.

## Risk Level

- Risk: high because the change spans the Dormitory domain, the shared PDF registry, and the catalog UI.
- Environment: development.
- Reversibility: code-only and reversible; no database migration or persistent-template rewrite is included.
- Blast radius: Dormitory PDF catalog registration and configured-card actions. Existing roster PDF generation must remain compatible.

## Objective

Show exactly two registered Dormitory PDF template cards named `Mẫu đơn thông tin cư trú` and `Mẫu đơn hợp đồng nội trú`, while removing the configured-card action `Tải lên mẫu` without removing the initial `Tải PDF lên` action required to configure an empty template.

## Scope Boundaries

- Approved boundaries: `backend/src/dormitory/**`, `backend/src/pdf-template/**` tests that validate registry compatibility, and `frontend/src/components/pdf-template/**`.
- Write boundaries:
  - `backend/src/dormitory/pdf-template-adapter.ts`
  - `backend/src/dormitory/dormitory.module.ts`
  - `backend/src/dormitory/dormitory-pdf-template.spec.ts`
  - `backend/src/pdf-template/pdf-template.spec.ts`
  - `frontend/src/components/pdf-template/PdfTemplateCatalog.tsx`
  - `frontend/src/components/pdf-template/PdfTemplateCatalog.test.tsx`
- Known compatibility targets inspected but not expected to change: `backend/src/dormitory/services/dormitory-roster.service.ts`, `backend/src/pdf-template/pdf-template-crud.spec.ts`, and `backend/src/dormitory/dormitory-pdf-renderer.spec.ts`.
- Existing template code `DORMITORY_ROSTER_APPLICATION`, saved PDF/layout records, editor routes, permissions, delete behavior, and shared PDF APIs are preserved.

## Out of Scope

- Adding contract-row Preview/Export controls or a contract PDF endpoint.
- Changing the KTX roster selection/export workflow.
- Migrating or renaming persisted template records.
- Changing field placement, rendering geometry, editor UI, source validation, or the `Tải PDF lên` new-template flow.
- Removing `metadata` or `save` APIs used by the editor; only the catalog's direct source-replacement UI is removed.
- Adding building data or other fields that require new population/query behavior.

## Context and Dependencies

- The catalog is generated from registered `PdfTemplateTypeDescriptor` values; the Dormitory module currently registers only `DORMITORY_ROSTER_APPLICATION_DESCRIPTOR`.
- Reuse `DORMITORY_ROSTER_APPLICATION` for `Mẫu đơn thông tin cư trú`. Only its display name changes, so the configured source/layout and current roster rendering remain addressable.
- Add one new stable code, `DORMITORY_RESIDENCE_CONTRACT`, for `Mẫu đơn hợp đồng nội trú`; use feature `DORMITORY_CONTRACT` and verified permission `DORM_CONTRACT_READ`. Do not add an alias descriptor, which would create a third card.
- The information descriptor keeps its existing 25 field keys, fixtures, resolver, and default layout.
- The contract descriptor exposes semantic keys resolved from `{ contract, student, room, bed, roster }`: contract code, start/end date, status; student code, full name, date of birth, gender; roster phone; citizen ID and permanent address; room code/name; and bed code/position. Personal identity/contact fields remain marked sensitive.
- `ContractsService.findOne()` already populates student, room, bed, and roster references, but no runtime contract PDF export currently consumes a descriptor. This task registers and makes the type editable only.
- Configured catalog cards currently contain a complete direct replacement flow: `Tải lên mẫu`, hidden file input, metadata fetch, pending state, save call, and replacement `ConfirmModal`. All of that catalog-only dead code is removed together.

## Steps

1. Backend/domain owner: rename the existing descriptor display label while preserving `DORMITORY_ROSTER_APPLICATION`, its 25 fields, resolver, fixture, and default-layout contract.
2. Backend/domain owner: define `DORMITORY_RESIDENCE_CONTRACT_DESCRIPTOR` with the agreed code, feature, permission, semantic field palette, safe synthetic fixtures, default styles, page policy, and context resolver.
3. Backend/module owner: register exactly the information and contract descriptors in `DormitoryModule`; do not register a compatibility alias.
4. Backend/test owner: extend descriptor and registry tests to assert exact codes, names, permissions, uniqueness, expected field keys, sensitive flags, and fixture/resolver values while retaining existing roster-layout compatibility.
5. Frontend/catalog owner: remove only the configured-card `Tải lên mẫu` button and its unreachable replacement state, handlers, hidden input, metadata/save imports, and replacement modal.
6. Frontend/test owner: model the catalog response with exactly the two Dormitory types and verify ordering/status, configured Edit/Delete actions, absence of `Tải lên mẫu`, continued `Tải PDF lên` behavior for unconfigured cards, and permission gating.
7. Verification owner: run focused tests, package static checks/build, then review the final scoped diff and repository status.

## Acceptance Criteria

- AC-01: The Dormitory PDF registry and `moduleCode=DORMITORY` catalog expose exactly two unique types: `DORMITORY_ROSTER_APPLICATION` / `Mẫu đơn thông tin cư trú` and `DORMITORY_RESIDENCE_CONTRACT` / `Mẫu đơn hợp đồng nội trú`.
- AC-02: An existing configured `DORMITORY_ROSTER_APPLICATION` record remains configured, editable, and usable by current roster PDF rendering without data migration.
- AC-03: The information type retains all 25 existing fields; the contract type exposes the approved contract/student/roster/room/bed palette with correct fixture and resolver output.
- AC-04: No configured card renders a button named `Tải lên mẫu`, and the catalog no longer contains its file-selection or replacement-confirmation flow.
- AC-05: A configured card still offers `Chỉnh sửa` and `Xóa` according to permissions; an unconfigured card still offers `Tải PDF lên` and opens the existing new-template route.
- AC-06: No contract export endpoint, database migration, permission mutation, or third Dormitory template card is introduced.

## Verification

- AC-01, AC-02, AC-03 :: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/dormitory/dormitory-pdf-template.spec.ts src/dormitory/dormitory-pdf-renderer.spec.ts` => both descriptors and existing roster layout contracts pass.
- AC-01, AC-02 :: `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand src/pdf-template/pdf-template.spec.ts src/pdf-template/pdf-template-crud.spec.ts` => registry uniqueness and legacy code compatibility pass.
- AC-01, AC-03, AC-06 :: `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles without descriptor or resolver errors.
- AC-04, AC-05 :: `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/pdf-template/PdfTemplateCatalog.test.tsx` => catalog action and two-card tests pass.
- AC-04, AC-05 :: `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no stale replacement-flow imports/state or TypeScript errors.
- AC-01 through AC-06 :: `D:\PROJECT\manager_points` :: `git diff --check`, scoped diff review, and `git status --short` => no unintended changes.

## Safety Gates

- Stop for approval if implementation requires changing the persisted `DORMITORY_ROSTER_APPLICATION` code, migrating/deleting existing templates, adding a contract export endpoint, or expanding contract queries/population.
- No gate is required for changing the existing display name, registering the second descriptor, or removing the catalog-only configured-source replacement control.
- Rollback: revert only the scoped code/test changes; no data rollback is expected.
- Resume point: after the user approves any scope expansion listed above.

## Artifacts and Checkpoints

- Planning artifact: `docs/taskscope.md`.
- Checkpoints/hashes: none during planning. Implementation must preserve the recorded base state and unrelated user changes.

## Execution Budgets

- Step deadline: 600 seconds; maximum 1,800 seconds when a focused build requires it.
- Concurrency: one writer per path; serialize overlapping backend adapter/module edits.
- Retry: at most 2 idempotent retries.
- Engineering loop: at most 3 inspect/change/verify iterations.
- Review remediation: at most 2 cycles.
