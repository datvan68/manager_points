# Taskscope: Central PDF Template Management and Designer with Direct Save

## Task Identity and Pipeline

- Task ID: `build-shared-pdf-template-designer-direct-save`
- Pipeline: `feature_development`; profile/protocol: Full / 3.2.0; environment: development.
- Repository/base: `D:\PROJECT\manager_points`, branch `main`, base commit `f8593d237120ac0c582080dc504d7eefbc2e1ba6`.
- Planning authority only: this taskscope authorizes no implementation, package installation, database write, permission assignment, deployment, or production/personal-data access.
- Effective Rules Manifest (version 3.2.0): `safety.md` `6a3f283b...a772`; `global.md` `67806f70...3f`; operating contract `51f3677c...1790`; orchestrator `b782109e...d716`; pipeline `0419c072...1f3` (SHA-256).
- Selected PDF skill: package `pdf/26.813.12317`, used for PDF validation, embedded-font rendering, Poppler inspection, and visual-QA requirements.

## Risk Level

- Risk: high.
- Evidence: a shared frontend/backend subsystem with PDF upload/parsing/rendering, authorization, MongoDB persistence, shared dependencies, and generated documents that may contain personal data.
- Blast radius: template administrators and every business feature that registers a PDF adapter. Saving a template changes subsequent exports immediately, but must never modify source business records.
- Reversibility: code is Git-reversible. The UI intentionally has no draft, publish, revision, or restore workflow; therefore operators must confirm replacement of an existing source PDF and the bundled KTX fallback remains available when no valid saved template exists.
- Primary threats: malicious PDF input, unauthorized changes, cross-module data exposure, arbitrary field resolution, concurrent overwrite, invalid saved layouts, font/glyph failure, coordinate drift, resource exhaustion, and KTX export regression.

## Objective

Build a reusable `PDF Template Designer` subsystem with one simple operator flow:

1. Select a registered PDF template collection.
2. Edit the collection's uploaded PDF background, field positions, and typography.
3. Preview and save.
4. The saved template becomes the current template used by subsequent exports immediately.

The aggregate boundary is explicit: **one registered collection equals one template**. That template contains one uploaded PDF source plus the complete `layoutItems[]` list for all fields placed on that PDF. A field is only an item inside the collection's template; it is never an independent template or persistence record.

If the operator needs another change, they select the same collection, edit its template, and save again. There are no draft, publish, approval, revision-history, or restore states.

`/pdf-templates` is the system-wide administration page for all registered PDF template collections, not a KTX-only page. It lists every registered collection whether or not its PDF has been uploaded, groups and filters them by module/feature, exposes current file metadata, and provides the single `Edit template` entry point. A newly registered collection must appear automatically without a page-specific frontend change.

The first production collection is `DORMITORY_ROSTER_APPLICATION`, display name `Mẫu đơn đăng ký KTX`, under `moduleCode=DORMITORY` and `featureCode=DORMITORY_ROSTER`. It owns one KTX template containing the uploaded application PDF and all 23 mapped field items. Its existing roster preview/download must use the shared renderer and retain the bundled fallback only when no valid saved template exists.

## Scope Boundaries

- Shared backend additions under `backend/src/pdf-template/**`: module, schema, DTOs, collection/adapter registry, template service, secure intake, validation, renderer, controller, and focused tests.
- Shared frontend additions under `frontend/src/app/(dashboard)/pdf-templates/**`, `frontend/src/components/pdf-template/**`, and `frontend/src/api/pdf-template-api.ts` plus focused tests. The page is the centralized inventory and management surface for every registered PDF template collection in the system.
- Integration paths: `backend/src/app.module.ts`, `frontend/src/components/layout/Sidebar.tsx`, and directly related navigation/permission tests.
- First business adapter and compatibility changes under `backend/src/dormitory/**`, `frontend/src/app/(dashboard)/dormitory/**`, and `frontend/src/api/dormitory-api.ts` plus focused tests.
- Authorization paths: `backend/src/auth/permissions.registry.ts`, minimum permission-group binding in `backend/src/auth/services/auth.service.ts`, and focused tests.
- Operational paths: `backend/scripts/**` for an idempotent default KTX template seed with dry-run/execute modes; backend/frontend package manifests and lockfiles only for approved PDF/font dependencies; `backend/nest-cli.json` only for required assets; `docs/**` for contracts and operator guidance.
- Shared permissions: `PDF_TEMPLATE_READ` and `PDF_TEMPLATE_MANAGE`. Real-data preview/export additionally requires the business adapter's source permission; KTX uses `DORM_REG_READ`.
- Core supports multiple registered collections, each with exactly one current template aggregate and one static PDF of 1-10 pages. The first release activates one production collection; a test-only second adapter proves reuse and field-catalog isolation.

## Out of Scope

- Draft, publish, approval, revision history, rollback/restore, scheduled activation, template comparison, or multi-stage lifecycle.
- Allowing operators to create database paths, queries, joins, JavaScript, HTML, formulas, expressions, custom formatters, or source resolvers from the UI.
- Automatically converting every existing PDF/export feature. Each future business integration requires a separately reviewed collection registration, adapter, field catalog, source permission, and tests.
- Treating generated per-record PDFs as managed templates, retaining export results, or turning `/pdf-templates` into a general document/file archive. The page manages source PDF templates only; generated outputs remain transient under their business export flows.
- Editing business records from the designer; generic real-record lookup; public/student access; email delivery; batch/ZIP output; e-signatures; OCR; annotations; or AcroForm/XFA editing.
- DOCX, spreadsheet, image, or HTML templates; a general report/query builder; object storage/CDN; external runtime fonts; or third-party template services.
- Hard-delete and asset cleanup APIs. Collection identities are code-owned; the collection's single saved template may be replaced only through the edit-and-save flow.
- Production/staging deployment, production migration, real permission assignment, or committing PDFs/previews/logs containing personal data.

## Context and Dependencies

- Current KTX export is `GET /dormitory/roster/:id/application-pdf`, guarded by `DORM_REG_READ`, supporting `inline|attachment`. It maps 23 controlled values, generates a fixed Puppeteer HTML overlay, and combines it with the bundled PDF through `pdf-lib`; current fixed coordinates cause overlap and typography drift.
- Supplied KTX PDF: unencrypted, non-interactive, one-page A4 (`595.32 x 842.04 pt`), SHA-256 `b527f4f28af2a9acab4b936c830071de635fcff8c1a3cb0eecb641e7ca9fa9ac`.
- Naming contract: `moduleCode` is the owning subsystem; `featureCode` is the consuming function; `collectionCode` is the immutable key of the one-template collection; `fieldKey` is an allowlisted value placed inside that template. Initial values are `DORMITORY`, `DORMITORY_ROSTER`, `DORMITORY_ROSTER_APPLICATION`, and keys such as `student.fullName`. Here, collection is a logical PDF-template collection, not a MongoDB collection name.
- A code-owned `PdfTemplateCollectionDescriptor` registers the collection code/display name, field catalog, page policy, formatter allowlist, synthetic fixture provider, source permission metadata, and server-side value resolver. Duplicate collection codes fail startup.
- Dependency direction is one-way: business modules register adapters through an explicit provider token; adapters may call business services; shared schemas, API, renderer, and editor never import dormitory/student models or accept arbitrary property paths.
- Generic administration APIs expose registered collection/catalog data, template metadata, source streaming, create/replace, save, validate, and synthetic preview. Routes address the aggregate by `collectionCode`; they never address a field as a template and never accept business record IDs or caller-supplied resolved value maps. Real preview/export remains on a business endpoint that performs domain authorization and invokes the shared renderer.
- Persistence uses exactly one `PdfTemplate` aggregate per `collectionCode`. The same record contains the current validated uploaded PDF source, checksum, page metadata, complete normalized `layoutItems[]`, optimistic `version`, audit actor/time, and active flag. There is no `PdfTemplate` record or PDF asset per field. A successful save atomically replaces the collection's PDF/layout configuration and increments `version`; there is no separate status or revision collection.
- The edit API returns the current `version`. Save requires that version and returns `409 Conflict` if another operator saved first. The client retains local edits and offers reload; it never silently overwrites.
- Geometry uses top-left normalized `[0,1]` coordinates per page: `pageIndex`, `x`, `y`, `width`, `height`, `rotation`, and `zIndex`. Page metadata records actual CropBox/MediaBox dimensions; zoom does not change stored geometry.
- Field definitions include key, Vietnamese label, data type, sensitivity, synthetic sample, allowed formatters, default style, and constraints. They form the allowlisted field catalog of a collection. `layoutItems[]` may contain zero or more placements referencing those keys; adding or moving a field updates the same collection template rather than creating another template.
- Supported styles: approved bundled font, available weight/style, font size/minimum, color, alignment, line height, padding, transparent/white background, wrap/shrink/clip, maximum lines, rotation, and layer order. Save is rejected for unsupported glyphs, invalid bounds, unknown fields, or unresolved required overflow.
- PDF intake: content sniff and parse; maximum 10 MiB and 1-10 pages with bounded dimensions/object count; reject malformed, encrypted/password-protected, signed, AcroForm/XFA, JavaScript/actions, embedded-file, or active PDFs. Preserve source page boxes and rotation.
- Backend rendering uses `pdf-lib` with an approved `@pdf-lib/fontkit`-compatible embedded Vietnamese font and actual glyph metrics. Browser editing uses an approved pinned `pdfjs-dist`. Exact dependencies, versions, font files, hashes, and licenses require G-01.
- Replacing the PDF background is explicit. The editor warns that page-size/count changes may invalidate positions, revalidates every item, and does not save until all blocking errors are resolved.
- With no saved KTX record, export reads the bundled source and versioned default normalized layout. Read/export requests never create or update database records.

## Steps

1. **Freeze shared contracts and simple save flow.** Define the `collectionCode -> one PdfTemplate aggregate` contract, descriptor/adapter interfaces, collection-owned field metadata, normalized multipage `layoutItems[]`, single-record persistence, optimistic versioning, DTO/resource limits, error model, permission matrix, API shapes, and synthetic fixtures. Confirm fields cannot become templates and there are no lifecycle statuses or revision APIs.
2. **Create the shared backend module.** Add collection registry/startup validation, the unique `collectionCode` current-template schema/index, services, atomic validation/save of the PDF and complete layout in one aggregate, audit actor/time, and module wiring. Do not execute persistent writes before G-02.
3. **Add permissions and administration APIs.** Register read/manage permissions and guarded endpoints for collection/catalog listing, current-template read, source streaming, create/replace, validate, synthetic preview, and save. All template operations are keyed by `collectionCode`; responses omit PDF bytes unless explicitly streamed.
4. **Implement secure PDF intake.** Validate multipart input in memory, sniff content, enforce parser/resource/page limits, extract page metadata, calculate checksum, sanitize filenames, and reject active/forms/signatures/encryption/malformed input before save.
5. **Implement the shared validator and renderer.** Resolve descriptor fields only, embed approved fonts, measure glyphs, transform normalized geometry, enforce bounds/overflow/multipage rules, preserve static content, and return controlled errors. Save and render use the same validation rules.
6. **Build the centralized PDF management page.** Add a permission-aware global navigation entry and make `/pdf-templates` the inventory for every registered PDF template collection across the system. Fetch the list from the backend registry so new collections appear without hard-coded frontend entries. Provide search plus module/feature/configuration filters and clear loading, empty, error, and permission states. Each row/card shows display name, `collectionCode`, module, feature, configured/missing-PDF state, source filename, page count, file size, checksum, last editor/time, and one `Edit template` action; no draft/publish actions exist.
7. **Build the canvas editor.** Load the selected collection's current template aggregate, render its uploaded PDF pages with `pdfjs-dist`, and provide PDF replacement, page navigation, collection field palette, drag, resize, keyboard nudge, zoom, snap/grid/guides, layer order, numeric geometry, and typography/fit controls. All placements are edited in the same `layoutItems[]` payload.
8. **Implement preview and direct save UX.** Use synthetic data by default; show field/page/glyph/overflow/bounds errors; disable save while blocking errors exist; confirm PDF replacement; save atomically; show success and the new version. Remove all draft/publish/revision/restore controls and wording.
9. **Implement the KTX adapter.** Register collection `DORMITORY_ROSTER_APPLICATION` with one template, its uploaded KTX PDF, its 23-value field catalog/layout, safe formatters, synthetic short/long/missing/Vietnamese fixtures, `DORM_REG_READ`, and a resolver using the already-authorized roster context.
10. **Integrate KTX export and fallback.** Route the existing preview/download through the KTX adapter and shared renderer while preserving URL, guard, disposition, filename, headers, labels, mapping, and controlled errors. Remove Puppeteer coordinates from the active path.
11. **Prove extension and isolation.** Add a test-only second collection descriptor with its own PDF and disjoint fields. Prove each collection owns exactly one template aggregate, it works without changes to shared schema/API/editor/renderer, and cross-collection fields, wrong adapters, and unauthorized real previews fail.
12. **Finish tests, visual QA, and documentation.** Add backend/frontend/security/privacy/accessibility tests, Poppler 150-DPI verification, an idempotent KTX seed dry-run/execute script, an adapter-extension guide, and a short operator guide for centralized listing/search/filter plus select/edit/preview/save.

## Acceptance Criteria

- **AC-01 — Central management:** `/pdf-templates` is the single administration page for all registered source PDF template collections in the system. It lists configured and unconfigured collections, supports search and module/feature/configuration filters, displays current file and audit metadata, and exposes one `Edit template` action per collection. Registering a test collection in the backend makes it appear without a collection-specific frontend code change.
- **AC-02 — Aggregate and simple flow:** The catalog groups collections by `moduleCode` and `featureCode` and identifies each by immutable `collectionCode`. Each collection has exactly one `PdfTemplate` aggregate containing one uploaded PDF plus its complete `layoutItems[]`; no field has its own template record or PDF. A permitted operator selects a collection, edits, previews, and saves; the saved template is used immediately. No draft, publish, revision, restore, or approval UI/API/status exists. `DORMITORY_ROSTER_APPLICATION` appears as `Mẫu đơn đăng ký KTX` under `DORMITORY / DORMITORY_ROSTER`.
- **AC-03 — Reusability:** A test-only second collection with a different PDF and field catalog registers, previews, saves, and renders without modifying shared persistence, API, editor, or renderer code.
- **AC-04 — Isolation:** Layout items save only field keys and formatters belonging to their collection descriptor. Unknown/cross-collection/prototype-pollution keys, arbitrary paths/expressions, duplicate collection codes, field-addressed template operations, and mismatched adapter calls are rejected.
- **AC-05 — Authorization/privacy:** Read/manage require their dedicated permissions. Synthetic preview is default. Real KTX preview/export additionally requires `DORM_REG_READ`; generic APIs cannot query a record ID or accept a resolved value map. Personal values are absent from template records, audit data, logs, caches, and fixtures.
- **AC-06 — Intake:** Only parseable static PDFs within 10 MiB, 1-10 pages, and configured limits save. Spoofed MIME, malformed, active, embedded, encrypted, signed, or form PDFs fail before persistence.
- **AC-07 — Editing:** Items can be added, moved, resized, reordered, keyboard-nudged, and numerically positioned on any allowed page at 50%, 100%, and 200% zoom. Save/reload reproduces normalized geometry within `0.0005`.
- **AC-08 — Validated aggregate save:** The uploaded PDF and complete `layoutItems[]` are validated and saved atomically for one `collectionCode`. Save is allowed only when field, page, geometry, font, glyph, and overflow validation passes. A successful save increments `version`, records actor/time/checksum, and becomes current immediately.
- **AC-09 — Concurrency:** A stale `version` returns `409` without overwrite. The editor preserves local changes and provides reload/retry guidance.
- **AC-10 — KTX fidelity:** The saved KTX template emits a valid one-page A4 PDF matching the supplied form with visible static labels and no overlap, clipping, white-mask damage, extra page, missing glyph, or typography drift.
- **AC-11 — Data variation:** Synthetic short, long, Vietnamese, and missing values obey wrap/shrink rules. Missing optional values render blank; non-empty values are not silently lost.
- **AC-12 — Compatibility/fallback:** Existing KTX URL, permission, `inline|attachment`, MIME/nosniff headers, filename, dates, gender labels, and errors remain compatible. Without a saved template, the bundled fallback renders with no database write.
- **AC-13 — Accessibility/resilience:** Controls are keyboard reachable, visibly focused, named, and associated with errors. Unsaved navigation and PDF replacement warn; failed preview/save retains recoverable edits; loading/empty/error/permission states are explicit.
- **AC-14 — Quality:** Focused tests, builds, adapter isolation tests, complete Poppler visual inspection, diff/status checks, and security/privacy/visual review pass without unintended changes.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand pdf-template pdf-renderer pdf-template-registry dormitory-roster.service dormitory-roster-privacy` => direct save, validation, concurrency, isolation, intake, permissions, rendering, KTX fallback, and privacy pass.
- `D:\PROJECT\manager_points\backend` :: `npm run verify:pdf-templates` => implementation-added command renders both collection descriptors plus KTX short/long/missing/Vietnamese fixtures, validates PDFs with Poppler, rasterizes each page at 150 DPI, and rejects bounds/glyph/overflow/static-region defects.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => Nest compiles, registry/providers resolve, and approved font/default-template assets exist at runtime paths.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/pdf-templates" "src/components/pdf-template" "src/api/pdf-template-api.test.ts" "src/api/dormitory-api.test.ts"` => system-wide registry listing, configured/unconfigured states, search/filter, metadata, automatic test-collection discovery, editing, PDF replacement, direct save, validation, conflict handling, permissions, and KTX integration pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` and `npm run build` => TypeScript and Next production build pass; missing repository environment is reported separately.
- `D:\PROJECT\manager_points` :: inspect all implementation-produced 150-DPI PNGs against the supplied KTX PDF and test multipage fixture => no covered static label, clipping, overlap, glyph loss, page shift, or unintended page.
- `D:\PROJECT\manager_points` :: run the implementation-defined KTX seed in dry-run mode => exact collection code, single aggregate shape, PDF/layout/font checksums, intended record/index/permission changes, and zero database writes are reported.
- `D:\PROJECT\manager_points` :: `git diff --check`, scoped `git status --short`, and final diff review => no whitespace defect, personal/secret artifact, unrelated path, or unapproved generated binary.

## Safety Gates

- **G-01 — Dependencies/fonts:** before manifest/lockfile or font-binary changes, approve exact pinned versions, dependency security review, font source/license, hashes/sizes, bundle/runtime impact, and removal rollback.
- **G-02 — Persistence/permissions:** before database writes, seed execute, shared index creation, or role/group assignment, provide dry-run output, exact environment/database, affected counts, permission matrix, source/layout checksums, backup/rollback, and exact command.
- **G-03 — Personal data:** real-record preview/testing needs explicit dataset, reviewer, retention, and cleanup approval. Otherwise all verification uses synthetic data and authorization tests.
- **G-04 — Deployment:** staging/production migration, deployment, permission assignment, or adapter activation requires separate release approval with monitoring and fallback validation.
- Stop for a scope amendment if implementation needs object storage, runtime-configured adapters, arbitrary expressions/queries, external fonts/services, more than 10 pages/10 MiB, broader source access, or schema outside the approved one-template-aggregate-per-collection model.

## Artifacts and Checkpoints

- Design evidence: shared dependency diagram, `collectionCode -> one template aggregate` contract, descriptor/adapter contracts, code taxonomy, collection-owned field metadata, normalized layout, direct-save API, permission matrix, threat model, and font/license manifest.
- Implementation evidence: base/current commits, changed-path manifest, dependency/font/template/layout SHA-256 values, seed dry-run, focused test/build summaries, adapter-isolation result, and visual QA report.
- Synthetic-only PDF/PNG/diff outputs live under ignored `tmp/pdfs/`; do not commit real-record output. A redacted deterministic fixture may be committed only when explicitly approved and license-safe.
- C-01 after contracts/shared backend/renderer: record scoped diff hash plus schema/API/registry/font hashes and security review.
- C-02 after shared frontend/test adapter: validate C-01 and record direct-save/editor/isolation evidence before KTX integration.
- C-03 after KTX integration/remediation: validate current hashes, focused verification, visual report, and final scoped diff before any gated seed or deployment.
- Preserve unrelated changes and original encodings/line endings. One writer per path; overlapping dirty changes stop that writer until ownership is resolved.

## Execution Budgets

- Order: contracts/security -> shared schema/registry/intake/renderer/API -> shared editor/direct save -> extension proof -> KTX adapter/integration -> tests/docs/review -> final verification.
- Maximum four active agents only when explicitly authorized; one writer per path. Disjoint frontend/backend work may overlap only after C-01 freezes contracts.
- Deadline: 600 seconds per step, 2400 seconds maximum; report progress at least every 60 seconds during active work.
- Idempotent retries: 2; engineering loops: 3; review-remediation cycles: 2.
- Limits to implement/test: 10 MiB source, 1-10 pages, at most 100 items per page and 500 total, bounded text/style metadata, one active render per request, and a measured server timeout.
- Stop conditions: safety violation, failed gate, stale checkpoint/hash, overlapping writer, unapproved dependency/font, unauthorized persistent write/permission assignment/personal-data access, adapter/core dependency inversion, scope expansion, or inability to meet a mandatory criterion within budget.
