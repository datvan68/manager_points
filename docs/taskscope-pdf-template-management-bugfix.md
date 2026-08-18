# Taskscope: Fix PDF-template management page defects

## Task Identity and Pipeline

- Task: `fix-pdf-template-management-page-defects`
- Pipeline: `bug_fix`
- Profile: `Full`
- Version: `3.2`
- Repository: `D:\PROJECT\manager_points`
- Base state: branch `main`; the current worktree now contains pre-existing changes in PDF-template/auth files and `frontend/src/components/pdf-template/PdfTemplateCatalog.test.tsx`. Preserve and reconcile those changes before implementation; this task artifact did not modify them.

## Risk Level

- Risk: `medium`
- Evidence: the change affects the shared PDF-template editor, dashboard layout scrolling, registered-collection discovery, and the source-PDF HTTP boundary. A bad fix can block template editing or hide valid collection choices, but no schema, business records, or deployment state needs to change.
- Reversibility: application-code change, recoverable through Git.
- Blast radius: users with `PDF_TEMPLATE_READ`/`PDF_TEMPLATE_MANAGE` using `/pdf-templates` and its Add/Edit routes.

## Objective

Make the PDF-template management page reliably load an existing source PDF, allow the full page/editor to scroll, and expose every valid unconfigured logical PDF template type with the complete field catalog from all linked schemas.

## Scope Boundaries

- Approved boundary: `frontend/src/app/(dashboard)/pdf-templates/**`, `frontend/src/components/pdf-template/**`, `frontend/src/api/pdf-template-api.ts`, `frontend/src/app/(dashboard)/layout.tsx`, focused frontend tests, `backend/src/pdf-template/**`, and `backend/src/dormitory/pdf-template-adapter.ts` plus its focused tests when multi-schema metadata/resolver coverage requires it.
- Write boundary: the same paths plus focused test files under the owning frontend/backend modules.
- Excluded: database migrations/data repair, PDF-template schema redesign, permissions, exports/rendering business logic, unrelated dashboard pages, deployment, and production data.

## Out of Scope

- Do not recreate or delete stored PDF-template records.
- Do not alter the one-active-template-per-`templateTypeCode` contract.
- Do not use a physical MongoDB collection as the template's field boundary.
- Do not broaden “Add template” to arbitrary collection names, schema paths, or user-created descriptors.

## Context and Dependencies

- `frontend/src/api/pdf-template-api.ts` rejects a source response when the Blob has zero bytes.
- `backend/src/pdf-template/pdf-template.service.ts` reads `sourcePdf` from MongoDB and `pdf-template.controller.ts` streams it with `Content-Length`; verify the returned bytes and MIME before deciding whether the defect is storage serialization or client handling.
- `frontend/src/components/pdf-template/PdfTemplateEditor.tsx` loads the source asynchronously and renders through PDF.js.
- `frontend/src/app/(dashboard)/layout.tsx` sets the dashboard shell and content column to `overflow-hidden`; the editor route currently does not establish a vertical scroll container.
- `frontend/src/components/pdf-template/PdfTemplateCatalog.tsx` builds the Add dropdown from the current paginated/filtered `items` array, so valid unconfigured registry entries can be absent; it also labels the logical template code as “Collection code”.
- `backend/src/pdf-template/types.ts` defines a descriptor-wide field catalog, and the KTX descriptor already proves that one logical template can contain namespaced fields from `student.*`, `applicant.*`, `roster.*`, and `parent.*`.
- `backend/src/dormitory/pdf-template-adapter.ts` resolves those namespaces from linked roster/student context, so filtering the palette or catalog by one physical collection would lose valid fields.

## Steps

1. Diagnose and capture a focused regression baseline for the source endpoint, editor lifecycle, scroll behavior, and Add dropdown with configured/unconfigured collections across page/filter boundaries.
2. Fix source loading end-to-end: preserve valid PDF bytes, handle empty/malformed responses explicitly, avoid premature URL cleanup or render gating, and keep a useful retry/error state. Do not mask a genuinely missing source as a successful load.
3. Give the PDF-template route a bounded vertical scroll region compatible with the existing dashboard shell, while retaining horizontal scrolling for the PDF canvas/table and preventing nested layout overflow regressions.
4. Change the catalog/add flow to use logical registered `templateTypeCode`/document type as the unit of configuration, independently of physical collection names and visible table page/search/filter. Keep each logical type's full descriptor field catalog available.
5. Group the editor field palette by field namespace/source schema (for example `student`, `applicant`, `roster`, `parent`) without removing any allowlisted field. If metadata is extended, expose stable source-group labels and provenance for display only; field keys and resolver behavior remain code-owned.
6. Add or update focused regression tests, run affected checks, and review the final diff for unrelated changes.

## Acceptance Criteria

- **AC-01 — Existing source PDF:** Opening “Sửa mẫu PDF” for a valid configured template loads a non-empty `application/pdf`, renders the first page and field overlays only after PDF.js succeeds, and does not show “Source PDF rỗng”. A missing/invalid source shows a clear error and retry path.
- **AC-02 — Scroll:** On a viewport shorter than the editor content, the user can scroll from the editor header through the canvas, field controls, and synthetic preview; horizontal canvas overflow remains usable and no page-level content is clipped by the dashboard shell.
- **AC-03 — Add logical template choices:** “Thêm mẫu” lists every registered logical `templateTypeCode`/document type that is currently unconfigured, even when the table is paginated or filtered to another subset. It does not treat a physical collection as the complete template boundary. Configured logical types never appear, and selecting an option routes to the correct new-template page.
- **AC-04 — State safety:** Loading/error/empty states do not produce stale or duplicate options; existing Add/Edit permissions and return-query behavior remain unchanged.
- **AC-05 — Complete multi-schema field catalog:** For a template whose descriptor links multiple schemas, the editor exposes every descriptor field, grouped by stable namespace/source group, including the KTX `student.*`, `applicant.*`, `roster.*`, and `parent.*` fields. No field is dropped because it originates outside the primary business collection.
- **AC-06 — Field safety:** Layout validation accepts only the complete descriptor field union and allowlisted formatters; it rejects unknown/arbitrary paths and preserves resolver compatibility for linked records.
- **AC-07 — Regression protection:** Focused tests cover empty/non-PDF source responses, successful source loading, scroll-container classes/structure, logical-template selection independent of table pagination/filtering, and multi-schema field completeness/grouping.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/api/pdf-template-api.test.ts` => source-response and API regressions pass.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/pdf-template src/app/(dashboard)/pdf-templates` => focused editor/catalog/route tests pass, including newly added regression tests.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand pdf-template` => source/catalog regressions pass if backend code is changed.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory` => linked-schema descriptor/resolver and field-completeness regressions pass if descriptor metadata or validation is changed.
- Manual browser inspection in development at `/pdf-templates`, `/pdf-templates/new`, and `/pdf-templates/:templateTypeCode/edit` with a short viewport => source renders, page scrolls, Add lists all valid unconfigured logical template types, and the field palette contains every linked-schema namespace.

## Safety Gates

- Trigger: None for local code/test work.
- Approval: None.
- Data/deployment gate: do not run seed/execute/migration/deploy commands; use isolated test fixtures or existing development data only.
- Rollback: revert the task commit/diff; no database rollback is required.

## Artifacts and Checkpoints

- None required for implementation beyond the final diff and test output. Record any pre-existing or environment-only failures separately.

## Execution Budgets

- One writer per path; serialize frontend/backend edits where ownership overlaps.
- Maximum 3 implementation/verification iterations and 2 review-remediation cycles.
- Stop and amend scope if the fix requires schema/data migration, permission changes, a fourth unrelated module, or production/staging mutation.
