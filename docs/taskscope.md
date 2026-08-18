# Taskscope: Fix PDF Template Editor and Complete Table-based CRUD

## Task Identity and Pipeline

- Task ID: `fix-pdf-template-management-crud-editor`.
- Pipeline: `bug_fix` plus scoped feature completion; profile/protocol: Full / 3.2.0; environment: development.
- Repository: `D:\PROJECT\manager_points`, branch `main`.
- Planning authority only: this taskscope authorizes no code implementation, dependency installation, database write, permission assignment, deletion, deployment, or access to personal data.
- Effective Rules Manifest (version 3.2.0): `safety.md` `6a3f283b...a772`; `global.md` `67806f70...3f`; operating contract `51f3677c...1790`; orchestrator `b782109e...d716`; pipeline `0419c072...1f3` (SHA-256).
- Selected PDF skill: package `pdf/26.813.12317`, used to define PDF loading, rendering, font, Poppler inspection, and visual-QA requirements.

## Risk Level

- Risk: high.
- Evidence: the change crosses Next.js, NestJS, MongoDB persistence, authorization, PDF parsing/rendering, and business exports. Delete permanently removes the saved source PDF and layout for a collection.
- Current defect evidence: `PdfTemplateCatalog.tsx` renders cards and mounts the editor inline; `PdfTemplateEditor.tsx` renders the PDF through an `iframe` backed by a Blob URL, silently ignores source-load failures, and renders field overlays before confirming that the PDF page loaded. This is consistent with the supplied screenshot showing “Không tải được tài liệu PDF” while field boxes remain visible.
- The exact source-load failure must still be reproduced and recorded before fixing; likely causes must not be treated as proven without browser/network evidence.
- Blast radius: PDF-template administrators and every feature consuming a saved template. CRUD must never alter source business/student records.

## Objective

Repair the `Edit template` flow and finish `/pdf-templates` as the system-wide table-based management page for source PDF templates.

The operator flow is intentionally simple:

1. View all registered template collections in a management table.
2. Add the one saved template for an unconfigured collection, edit an existing template, or delete its saved PDF/layout.
3. In Add/Edit, load and render the source PDF reliably, position the collection's fields, preview, and save directly.
4. The saved template becomes current immediately; after delete, the collection remains registered but returns to `Chưa cấu hình`.

The aggregate rule remains: **one registered collection equals at most one saved template aggregate** containing one uploaded PDF and the complete `layoutItems[]`. A field is an item inside that aggregate, never a template. “Add template” configures an available registered collection; it does not create arbitrary data paths, field catalogs, adapters, modules, or one template per field.

There is no draft, publish, approval, revision-history, restore, or archive state.

## Scope Boundaries

- Frontend: `frontend/src/app/(dashboard)/pdf-templates/**`, `frontend/src/components/pdf-template/**`, `frontend/src/api/pdf-template-api.ts`, shared confirmation/dialog/table primitives only when already project-owned, and focused tests.
- Backend: `backend/src/pdf-template/**`, related module wiring, DTO/API/security tests, and the minimum permission-registry/group updates under `backend/src/auth/**`.
- Business compatibility: focused KTX adapter/export/fallback tests under `backend/src/dormitory/**` and API compatibility tests under `frontend/src/api/dormitory-api.ts`.
- `/pdf-templates` becomes a responsive semantic table, with server-backed catalog data and Add/Edit/Delete actions at the template-aggregate level.
- Add/create accepts a validated source PDF plus complete initial layout for one registered, currently unconfigured `templateTypeCode`.
- Edit/update replaces the PDF when requested and/or changes the complete layout, guarded by optimistic versioning.
- Delete removes only the saved `PdfTemplate` aggregate, including its stored PDF bytes and layout. It does not delete the code-owned collection descriptor, field catalog, permissions, business data, or generated exports.
- Shared permissions: `PDF_TEMPLATE_READ`, `PDF_TEMPLATE_MANAGE`, and a distinct `PDF_TEMPLATE_DELETE`. KTX real-data preview/export continues to require `DORM_REG_READ`.

## Out of Scope

- Creating collection descriptors, module/feature adapters, arbitrary fields, database paths, queries, expressions, JavaScript, HTML, or custom resolvers from the UI.
- More than one saved template per collection, cloning, version history, soft-delete archive, restore, recycle bin, draft, publish, approval, or scheduled activation.
- Managing generated per-record PDFs, export retention, a general document/file manager, DOCX/images/spreadsheets, OCR, e-signatures, AcroForm/XFA authoring, or email delivery.
- Editing business/student data or allowing generic template APIs to load a real record ID or caller-provided value map.
- Object storage/CDN, external template services, production migration/deployment, real role assignment, or real personal-data testing.
- Redesigning unrelated pages or converting unrelated existing export features.

## Context and Dependencies

- Current management UI is implemented in `frontend/src/components/pdf-template/PdfTemplateCatalog.tsx` as a two-column card grid with only `Edit template`; it has no create or delete action.
- Current editor is mounted below the catalog in the same page. `frontend/src/components/pdf-template/PdfTemplateEditor.tsx` calls the source endpoint, suppresses fetch errors with `.catch(() => undefined)`, uses `<iframe src="blob:...#page=n">`, and renders layout items regardless of `sourceUrl` or PDF-render success.
- No `pdfjs-dist` or `@pdf-lib/fontkit` entry was found in the current frontend/backend manifests or lockfiles during planning. Any dependency/font addition is gated by G-01.
- Current backend has catalog/read/source/preview/validate/update endpoints and one MongoDB record keyed by `templateTypeCode`; it has no delete endpoint and no explicit create endpoint. The registry owns module/feature/type identity and field catalogs.
- API contract after remediation:
  - `GET /pdf-templates/catalog`: paged/sortable/filterable registered collections with configured state and metadata.
  - `GET /pdf-templates/:templateTypeCode` and `/source`: edit metadata and PDF stream.
  - `POST /pdf-templates/:templateTypeCode`: create the first aggregate only when unconfigured; duplicate create returns `409`.
  - `PUT /pdf-templates/:templateTypeCode`: update an existing aggregate only; missing aggregate returns `404`, stale version returns `409`.
  - `DELETE /pdf-templates/:templateTypeCode`: delete an existing aggregate only, requiring its current version; missing returns `404`, stale version returns `409`.
  - Preview and validation remain synthetic by default and never persist.
- Create, update, and delete must be separate service operations with explicit state preconditions; do not retain ambiguous upsert behavior.
- Source responses must use correct `application/pdf`, content length, safe content disposition, and `nosniff`. The client must verify HTTP success and MIME before rendering.
- The editor must render pages to controlled canvas elements with a pinned `pdfjs-dist` worker, not rely on the browser's native PDF plugin. Object URLs, loading tasks, render tasks, canvases, and workers must be cleaned up on template/page/source changes and unmount.
- Until a page is successfully rendered, field overlays must remain hidden or disabled. Loading, missing-source, parse failure, HTTP failure, unsupported PDF, and retry states must be distinct.
- Geometry remains normalized top-left `[0,1]` per page. PDF replacement must refresh page metadata and revalidate page count, dimensions, bounds, glyphs, and overflow before saving.
- Delete behavior is descriptor-specific: KTX must continue to use its bundled validated fallback; any collection without an approved fallback must return its existing controlled “template not configured” response. Reads/exports must never recreate a deleted record.

## Steps

1. **Reproduce and baseline Edit failure.** Run the current frontend/backend locally, open a configured template, capture browser console/network status, response headers/MIME, Blob size, lifecycle timing, and a screenshot. Add a failing regression test that proves the observed failure or the unsafe “overlay without rendered PDF” state.
2. **Freeze CRUD and state contracts.** Document registered collection versus saved aggregate, create/update/delete preconditions, status/error codes, optimistic version requirements, fallback behavior, permissions, and the table/editor route contract.
3. **Split backend CRUD operations.** Replace update-upsert ambiguity with explicit create and update service methods, add version-guarded delete, retain atomic PDF-plus-layout persistence, and return sanitized metadata without PDF bytes.
4. **Secure delete.** Require `PDF_TEMPLATE_DELETE`, current version, typed confirmation in the UI, and a structured audit/security event containing collection code, actor, time, and checksum but no PDF bytes, layout values, or personal data. Do not cascade outside the aggregate.
5. **Build the management table.** Replace cards with a semantic responsive table. Provide search, module, feature, configuration filters, sortable columns, loading/empty/error states, pagination when the result exceeds the configured page size, and mobile horizontal scrolling or an accessible compact representation.
6. **Add complete row actions.** Show `Thêm mẫu` for unconfigured rows, `Sửa` and `Xóa` for configured rows, according to permissions. Provide a top-level `Thêm mẫu` action that selects only unconfigured registered collections. Disable duplicate creation and prevent actions during an in-flight mutation.
7. **Move Add/Edit to dedicated routes.** Use `/pdf-templates/new?templateTypeCode=...` and `/pdf-templates/:templateTypeCode/edit` or equivalent repository-consistent routes. Preserve table filters/page on return, protect unsaved changes, and do not mount the heavy editor inside every table row or below the list.
8. **Fix PDF source loading and rendering.** Replace the native-plugin iframe with `pdfjs-dist` canvas rendering, configure its worker correctly for Next production builds, validate response/MIME, handle race/cancellation/cleanup, expose retry, and render overlays only after the active page reports success.
9. **Complete designer behavior.** Support PDF upload/replacement, page navigation, field palette, add/remove field placement, drag, resize, keyboard nudge, zoom, snap/grid/guides, layer order, numeric geometry, typography/fit controls, synthetic preview, validation, and direct save.
10. **Implement delete/fallback UX.** Show the affected collection/file and consequence, require explicit confirmation, submit current version, refresh the table to `Chưa cấu hình`, close stale editors, and verify KTX falls back without database writes.
11. **Add focused automated coverage.** Cover CRUD state transitions, authorization, duplicate/stale/missing cases, source errors and MIME validation, PDF.js render success/failure/retry/cancellation, overlay gating, table behavior, route navigation, unsaved changes, delete confirmation, and KTX compatibility.
12. **Perform PDF and UI QA.** Render synthetic short/long/missing/Vietnamese fixtures, rasterize at 150 DPI with Poppler, visually compare against the source, test responsive/accessibility behavior, run affected builds, and review the final diff/status.

## Acceptance Criteria

- **AC-01 — Table management:** `/pdf-templates` uses one semantic table, not a card grid. It shows name, collection code, module, feature, status, source filename, pages, size, checksum, last editor/time, and actions; search, filters, sorting, empty/loading/error states, and responsive behavior work.
- **AC-02 — Correct aggregate:** Each registered collection has zero or one saved aggregate containing exactly one PDF plus all layout items. No field becomes a template or standalone PDF record.
- **AC-03 — Add:** A permitted user can choose an unconfigured registered collection, upload a valid PDF, edit its layout, preview, and save. The table changes to `Đã cấu hình`. Duplicate create returns `409` and does not overwrite.
- **AC-04 — Edit defect fixed:** Opening `Sửa` for a configured template loads the correct PDF page without the browser “Không tải được tài liệu PDF” state. No field overlay appears until that page is successfully rendered. HTTP/parse/render failures show a recoverable error and retry action without layout overlap.
- **AC-05 — Edit:** A permitted user can change layout and replace the PDF, then save directly. Reload reproduces normalized geometry within `0.0005`; a stale version returns `409` without overwriting or discarding local edits.
- **AC-06 — Delete:** Only a user with `PDF_TEMPLATE_DELETE` can delete. Confirmation identifies the exact template and consequence. Success removes the one aggregate/PDF/layout, refreshes the row to `Chưa cấu hình`, and leaves its descriptor, fields, permissions, and business data intact.
- **AC-07 — Fallback:** Deleting the configured KTX template makes subsequent KTX exports use the bundled validated fallback with no database write. A collection without fallback fails through its documented controlled response.
- **AC-08 — PDF rendering lifecycle:** PDF.js canvas rendering works on supported pages and zoom levels in development and production build. Rapid template/page changes and unmount cancel stale tasks and release URLs/resources; stale renders cannot replace the current page.
- **AC-09 — Validation/security:** Invalid, spoofed, encrypted, active, form, signed, malformed, oversized, or over-page-limit PDFs fail before persistence. Unknown fields, invalid geometry/fonts/glyphs/overflow, arbitrary paths, and cross-collection fields are rejected.
- **AC-10 — Permissions/privacy:** Read, manage, and delete permissions are enforced independently in API and UI. Synthetic preview is default; generic endpoints accept no real record ID/value map, and logs/audit contain no PDF bytes, layout values, or personal data.
- **AC-11 — Simple lifecycle:** Add/Edit save directly and become current immediately. No draft, publish, approval, revision, archive, or restore UI/API/status is introduced.
- **AC-12 — KTX fidelity:** The saved or fallback KTX template emits a valid one-page A4 PDF matching the supplied form with no overlap, clipping, covered labels, extra page, missing Vietnamese glyph, or typography drift.
- **AC-13 — Accessibility/resilience:** Table headers, row actions, dialogs, editor controls, errors, focus order, keyboard operation, and visible focus meet existing accessibility conventions. Failed loads/mutations retain recoverable state.
- **AC-14 — Quality:** Focused tests, builds, 150-DPI PDF visual QA, final diff/status, and security/privacy review pass with no unintended changes.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand pdf-template pdf-renderer dormitory-roster` => explicit create/update/delete, state preconditions, version conflicts, permissions, validation, fallback, and privacy pass.
- `D:\PROJECT\manager_points\backend` :: `npm run verify:pdf-templates` => implementation-provided command parses generated PDFs, runs Poppler checks, rasterizes every page at 150 DPI, and rejects glyph/bounds/overflow/static-region defects.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => Nest compiles and PDF assets/providers resolve.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/pdf-templates" "src/components/pdf-template" "src/api/pdf-template-api.test.ts"` => table, filters/sort, CRUD actions, routes, PDF source/render lifecycle, overlay gating, errors/retry, permissions, conflicts, and unsaved-state tests pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` and `npm run build` => TypeScript and Next production build pass, including the pinned PDF.js worker asset path.
- Browser QA at desktop and narrow viewport :: add, edit, rapid page/template switching, failed source plus retry, save, delete, and table return => no native PDF-plugin error, overlay-before-page, stale render, clipped controls, or lost table state.
- Visual QA :: compare implementation-produced 150-DPI PNGs for KTX short/long/missing/Vietnamese fixtures with the supplied source => no static-label damage, overlap, clipping, shift, or glyph loss.
- `D:\PROJECT\manager_points` :: `git diff --check`, scoped `git status --short`, and final diff review => no whitespace defect, secret/personal artifact, unrelated path, or unapproved binary.

## Safety Gates

- **G-01 — Dependencies/fonts:** before changing manifests/lockfiles or adding font/worker binaries, approve exact pinned versions, security review, license, hashes/sizes, runtime/bundle impact, and rollback.
- **G-02 — Persistence/permissions/delete:** before schema/index/seed/role writes or testing a real delete, provide dry-run evidence, exact environment/database, affected collection and count, current checksum/version, fallback result, backup/rollback, and exact command. Automated tests use isolated test data.
- **G-03 — Personal data:** real-record PDF preview/testing requires explicit dataset, reviewer, retention, and cleanup approval. Otherwise use synthetic fixtures only.
- **G-04 — Deployment:** staging/production migration, deployment, permission assignment, or adapter activation requires separate release approval with monitoring and fallback validation.
- Stop for a scope amendment if implementation needs runtime-created descriptors/fields, object storage, external fonts/services, deletion outside one template aggregate, broader source access, or a lifecycle beyond direct save.

## Artifacts and Checkpoints

- Design evidence: current-failure reproduction, network/MIME/render findings, CRUD state table, REST/error contract, permission matrix, fallback matrix, renderer lifecycle, and deletion threat model.
- Implementation evidence: base/current commits, changed-path manifest, dependency/font/worker/source/layout hashes, focused test/build summaries, browser screenshots, Poppler output, and visual-QA report.
- Synthetic-only PDF/PNG outputs live under ignored `tmp/pdfs/`; do not commit real-record output. A deterministic redacted fixture may be committed only when approved and license-safe.
- C-01 after failure reproduction and contract freeze: record root cause, failing regression test, API/schema/security decisions, and approved dependency gate.
- C-02 after backend CRUD and table/routes: validate C-01 and record API, permission, deletion, and frontend-state evidence before editor renderer replacement.
- C-03 after editor/KTX remediation: validate hashes, automated checks, browser/visual QA, final scoped diff, and unresolved gates before any deployment or real-data operation.
- Preserve unrelated changes, encodings, and line endings. One writer per path; overlapping dirty changes stop that writer until ownership is resolved.

## Execution Budgets

- Order: reproduce -> contract -> backend CRUD/security -> management table/routes -> PDF renderer/editor -> KTX fallback -> tests/QA -> final review.
- Maximum four active agents only when explicitly authorized; one writer per path. Disjoint frontend/backend work may overlap only after C-01 freezes contracts.
- Deadline: 600 seconds per step, 2400 seconds maximum; report progress at least every 60 seconds during active work.
- Idempotent retries: 2; engineering loops: 3; review-remediation cycles: 2.
- Limits to implement/test: 10 MiB source, 1-10 pages, at most 100 items per page and 500 total, bounded metadata, one active render per canvas, and measured client/server timeouts.
- Stop conditions: safety violation, failed gate, stale checkpoint/hash, overlapping writer, unapproved dependency/font, unauthorized persistent write/delete/permission assignment/personal-data access, descriptor/core dependency inversion, scope expansion, or inability to meet a mandatory criterion within budget.
