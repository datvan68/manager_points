# Taskscope: Dormitory PDF Template Designer

## Task Identity and Pipeline

- Task ID: `build-dormitory-pdf-template-designer`
- Pipeline: `feature_development`; profile/protocol: Full / 3.2.0; environment: development.
- Repository/base: `D:\PROJECT\manager_points`, branch `main`, commit `f8593d237120ac0c582080dc504d7eefbc2e1ba6`; working tree was clean at discovery.
- Planning authority only: this document does not authorize implementation, package installation, database writes, permission assignment, template publication, deployment, or production access.
- Effective Rules Manifest (version 3.2.0): `safety.md` `6a3f283b...a772`; `global.md` `67806f70...3f`; operating contract `51f3677c...1790`; orchestrator `b782109e...d716`; pipeline `0419c072...1f3` (SHA-256).
- Selected PDF skill: versioned package `pdf/26.813.12317`, used for rendering, font, PDF validation, and visual-QA requirements.

## Risk Level

- Risk: high.
- Evidence: cross-frontend/backend feature with authorization, PDF parsing/rendering, file upload, a new MongoDB collection, and output containing student identity, citizen ID, phone, address, and parent information.
- Reversibility: source changes are Git-reversible; an active template is rolled back by publishing a previously validated immutable revision. Persistent records and permission assignments require a Human Gate.
- Blast radius: template administrators and every `GET /dormitory/roster/:id/application-pdf` consumer. Failure can corrupt newly generated forms but must never modify roster/student source data.
- Primary threats: malicious PDFs, unauthorized publication, arbitrary field/expression execution, stored personal preview data, font licensing/missing Vietnamese glyphs, coordinate drift, concurrent overwrite, and renderer exhaustion.

## Objective

Deliver an authenticated visual designer for the `DORMITORY_APPLICATION` template that lets authorized staff upload a static PDF, freely place/resize allowlisted student fields, configure typography and fit behavior, preview safely, save a draft, and explicitly publish an immutable revision. Existing roster export must use the active published definition and produce a faithful one-page A4 PDF with Vietnamese text, without label overlap or clipping.

## Scope Boundaries

- Approved implementation boundaries:
  - `backend/src/dormitory/**`
  - `backend/src/auth/permissions.registry.ts`
  - minimum permission-group binding in `backend/src/auth/services/auth.service.ts`
  - `backend/scripts/**` for an idempotent default-template seed with separate dry-run/execute modes
  - backend package manifests and `nest-cli.json` only for approved renderer/font assets and verification commands
  - `frontend/src/app/(dashboard)/dormitory/**`
  - `frontend/src/components/dormitory/pdf-template/**`
  - `frontend/src/api/dormitory-api.ts` and focused tests
  - frontend package manifests only for an approved browser PDF renderer
  - `docs/**` for the operator runbook and field-layout contract
- Known targets: `dormitory-roster.service.ts` and spec, `dormitory-roster.controller.ts`, `dormitory.module.ts`, the existing KTX template PDF, roster page, dormitory layout, and dormitory API client.
- Planned backend additions: template/revision schemas, DTOs, controller, template service, renderer service, field catalog, upload validator, and tests under `backend/src/dormitory/**`.
- Planned frontend route: `/dormitory/pdf-template`, with isolated designer components under the approved boundary.
- Planned permissions: `DORM_PDF_TEMPLATE_READ`, `DORM_PDF_TEMPLATE_MANAGE`, and `DORM_PDF_TEMPLATE_PUBLISH`. Role/group assignment is gated and must not be inferred from `DORM_REG_UPDATE`.
- The architecture may be reusable, but MVP activation is limited to template code `DORMITORY_APPLICATION` and the current roster export.

## Out of Scope

- A system-wide document builder, DOCX/image templates, email delivery, e-signatures, OCR, annotations, arbitrary JavaScript/HTML/formulas, user-defined database queries, or custom expressions.
- Editing student, roster, class, faculty, room, or applicant-profile records from the designer.
- Batch/ZIP export, public access, student template editing, PDF signing, AcroForm/XFA editing, or preserving interactive form fields.
- Destructive template deletion. MVP uses inactive metadata and immutable published revisions; restore creates a draft that must be republished.
- Production/staging deployment, production migration, object-storage adoption, CI/CD work, or permission assignment without approval.
- General multi-page acceptance. The schema retains `pageIndex`, but MVP publication and verification support the current one-page A4 application only.
- Uploading or committing real-student PDFs, images, fixture data, or logs.

## Context and Dependencies

- Current export is guarded by `DORM_REG_READ`, supports `inline|attachment`, maps 23 server-controlled values, and overlays a Puppeteer-generated page on the versioned PDF with `pdf-lib`.
- Current template is an unencrypted, non-interactive, one-page A4 PDF (`595.32 x 842.04 pt`), SHA-256 `b527f4f28af2a9acab4b936c830071de635fcff8c1a3cb0eecb641e7ca9fa9ac`.
- The fixed HTML coordinate table causes label erasure and inconsistent font fitting. The published layout becomes the single coordinate authority.
- Canonical geometry uses a top-left origin and normalized values in `[0,1]`: `pageIndex`, `x`, `y`, `width`, `height`, `rotation`, and `zIndex`. Backend rendering converts to PDF coordinates; zoom never changes stored values.
- The backend supplies an allowlisted field catalog. Initial keys mirror current mappings: identity/name, birth date, gender, class, faculty, ethnicity, religion, phone, citizen ID/date/place, permanent address, father fields, mother fields, and priority details. Unknown keys are rejected; missing values render blank.
- Supported properties: approved bundled font, font size/minimum, available weight, color, horizontal/vertical alignment, line height, padding, background (`transparent|white`), overflow (`shrink|wrap|clip`), maximum lines, allowlisted formatter, and geometry. `clip` is forbidden in the default KTX layout.
- Storage: MongoDB template metadata plus revision documents. Published revisions are immutable and checksum-addressed; drafts use optimistic `revision` tokens. PDF bytes are stored once per revision as a bounded `Buffer`, maximum 10 MiB, avoiding runtime dependence on local writable disk and remaining below MongoDB's 16 MiB document limit.
- Lifecycle: `DRAFT -> PUBLISHED -> SUPERSEDED`. Saving never affects export. Publish atomically selects one active revision. Editing or restoring a published revision creates a new draft.
- Planned `/dormitory/pdf-templates` APIs: list/read metadata, stream source, multipart create, update draft, validate, synthetic/authorized-roster preview, publish, list revisions, and restore-to-draft. No delete endpoint.
- Upload policy: content-sniff and parse; enforce MIME, size, one-page A4, dimensions, and resource limits; reject encrypted, signed, AcroForm/XFA, JavaScript/action, embedded-file, malformed, or password-protected PDFs.
- Rendering: replace the active Puppeteer overlay with `pdf-lib` plus an approved `@pdf-lib/fontkit`-compatible embedded font. Measure real glyph widths, deterministically shrink/wrap, and fail validation on unsupported glyphs or unresolved overflow.
- Browser: use an approved pinned `pdfjs-dist` version to render the source on canvas. DOM fields share the scaled page container.
- Candidate dependencies (`pdfjs-dist`, `@pdf-lib/fontkit`) and font files require Gate G-01. No installation is authorized by this plan.
- Compatibility: until a database revision is published, export uses a versioned default layout matching the bundled PDF. An idempotent dry-run/execute script seeds it. Read/export requests must never write defaults to MongoDB.

## Steps

1. **Contract and threat baseline — architecture/review owner.** Freeze the 23-key catalog, normalized schema, DTO limits, lifecycle, API shapes, upload threat model, font/license decision, checksums, and a synthetic baseline render. Result: no arbitrary data path or expression is possible.
2. **Persistence and permissions — backend owner.** Add schemas/indexes, validated DTOs, optimistic drafts, immutable publishing, revision listing, restore-to-draft, permission registry entries, and an idempotent seed script. Do not execute writes before G-02. Result: lifecycle tests prove one active revision and stale-save rejection.
3. **Secure PDF intake — backend owner.** Implement in-memory multipart validation, content sniffing, 10 MiB/A4/one-page limits, active-content/form/signature/encryption rejection, checksum calculation, sanitized metadata, and bounded parsing. Result: valid static KTX input is accepted and adversarial fixtures are rejected before storage.
4. **Deterministic renderer — backend owner.** Separate value resolution from layout, embed Vietnamese fonts, measure glyphs, render normalized bounds, enforce overflow, and preserve the source page. Remove hard-coded HTML coordinates as the active path while retaining headers, filename, mapping, dates, and errors. Result: deterministic render output under the defined tolerance.
5. **Template APIs — backend owner.** Add guarded endpoints for read/manage/publish, safe source streaming, validation, synthetic preview, and optional real roster preview only with `DORM_REG_READ`. List responses never include source bytes. Result: controller/privacy tests prove authorization, limits, and concurrency.
6. **Designer shell — frontend owner.** Add permission-aware navigation/page, upload/create, status/revision selector, loading/error/empty states, unsaved-change protection, and accessible keyboard/focus behavior. Read/manage/publish controls are independently gated.
7. **Canvas editor — frontend owner.** Add field palette, selection, add/duplicate/remove, drag, eight-handle resize, arrow nudge, zoom, snap/grid/guides, layer order, and numeric geometry. Add typography/fit property controls. Clamp fields to page bounds and save normalized values only.
8. **Preview, validation, and publication UX — frontend/backend owners.** Use synthetic preview by default; add authorized roster preview, overflow/glyph/bounds/duplicate warnings, explicit validation, publish confirmation with revision/checksum, stale-conflict recovery, and restore-to-draft. Publication is blocked on errors.
9. **Roster integration and fallback — backend/frontend owners.** Route existing preview/download through the active revision while preserving permission, disposition, filename, and UI behavior. Verify default fallback and no database write during export.
10. **Regression, visual QA, and documentation — test/review/doc owners.** Add unit, controller/privacy, frontend interaction, coordinate-property, malicious-upload, and synthetic-render tests; add a Poppler 150-DPI verification command; independently review security/privacy/accessibility/visuals; document upload through rollback.

## Acceptance Criteria

- **AC-01:** Read, draft management, and publish require their dedicated permissions; real roster preview additionally requires `DORM_REG_READ`. Unauthorized route/API access leaks neither template bytes nor student data.
- **AC-02:** Only a parseable static, unencrypted, unsigned, non-form, one-page A4 PDF up to 10 MiB is accepted. Spoofed MIME, malformed/active/embedded/encrypted/signed/form/multi-page/wrong-size files are rejected before persistence.
- **AC-03:** Fields can be added, dragged, resized, keyboard-nudged, numerically positioned, and reordered at 50%, 100%, and 200% zoom. Save/reload reproduces normalized geometry within `0.0005` and all bounds remain in `[0,1]`.
- **AC-04:** Only approved fonts/properties are selectable. Vietnamese diacritics render without replacement glyphs; unsupported glyphs and unresolved overflow block publish.
- **AC-05:** Only catalog keys and allowlisted formatters save successfully. HTML/JavaScript, arbitrary database paths, custom expressions, prototype-pollution keys, and unknown keys are rejected. Missing data renders blank.
- **AC-06:** Draft saves do not affect export; stale updates return conflict without overwrite; published source/layout/checksums are immutable.
- **AC-07:** Validation precedes publish; exactly one active revision exists. Publish records actor/time/checksum but no preview values. Restore creates a draft and needs a new publish confirmation.
- **AC-08:** The active KTX layout emits a valid one-page A4 PDF. All available fields stay within configured bounds; static labels remain visible; no overlap, clipping, white-mask damage, extra page, missing glyph, or unapproved typography drift occurs.
- **AC-09:** Synthetic short, long, Vietnamese, and missing fixtures obey wrap/shrink rules. No non-empty value is silently lost; blocking overflow is reported before publish.
- **AC-10:** Existing roster URL, `DORM_REG_READ`, `inline|attachment`, MIME/nosniff headers, safe filename, dates, gender labels, and controlled errors remain compatible. Export performs no persistent write and has a default fallback.
- **AC-11:** Synthetic preview is default. Real preview is ephemeral, authorization-checked, and absent from logs, audit payloads, cache, snapshots, and template records. No committed artifact contains real student data.
- **AC-12:** Controls are keyboard reachable with visible focus/accessibility names and associated errors. Unsaved navigation warns; save/publish conflicts retain recoverable local draft state.
- **AC-13:** Upload/preview/render enforce file, page, field-count, string/property, font, concurrency, and timeout limits. Bad input yields controlled 4xx; render failure yields controlled 503 without crash or sensitive diagnostics.
- **AC-14:** Focused tests, package builds, visual verification, final diff check, and independent security/privacy/visual review pass without unintended changes.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory-pdf-template dormitory-pdf-renderer dormitory-roster.service dormitory-roster-privacy` => lifecycle, intake, authorization, rendering, fallback, privacy, and compatibility pass.
- `D:\PROJECT\manager_points\backend` :: `npm run verify:dormitory-pdf-template` => implementation-added command renders synthetic short/long/missing/Vietnamese fixtures with Poppler at 150 DPI and rejects static-region differences, bounds/glyph/overflow defects, or wrong page output.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => Nest compiles and approved PDF/font/default-layout assets exist at runtime paths.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/pdf-template/page.test.tsx" "src/components/dormitory/pdf-template" "src/api/dormitory-api.test.ts"` => permissions, editor interactions, zoom-independent geometry, conflicts, preview, validation, and publication pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` and `npm run build` => TypeScript and Next production build pass; missing repository environment is reported separately.
- `D:\PROJECT\manager_points` :: inspect complete 150-DPI PNGs for every synthetic fixture against the supplied form => no covered label, clipping, overlap, glyph loss, page shift, or extra page.
- `D:\PROJECT\manager_points` :: run the implementation-defined seed command in dry-run mode => exact template code, PDF/layout checksums, intended revision, and permission records are reported with zero database writes.
- `D:\PROJECT\manager_points` :: `git diff --check`, scoped `git status --short`, and diff review => no whitespace issue, secret/personal-data artifact, unrelated file, or unapproved generated binary.

## Safety Gates

- **G-01 — Dependencies/fonts:** before manifest/lock or font-binary changes, approve exact pinned versions, security/transitive review, font source/license, file hashes/sizes, and removal rollback. Resume at intake/renderer implementation.
- **G-02 — Persistence/permissions:** before any database write, seed execute, shared index creation, or role/group assignment, provide dry-run output, exact environment/database, counts, permission matrix, PDF/layout checksums, backup/rollback, and command. Resume only in the approved development target.
- **G-03 — Real personal data:** synthetic fixtures are mandatory by default. Real-roster verification needs explicit authorization for dataset, reviewer, retention, and cleanup; otherwise AC-11 is verified synthetically.
- **G-04 — Deployment/publication:** shared staging/production deployment, migration, or template publication is outside scope and needs a separate release approval with monitoring and rollback revision.
- Stop for a scope amendment if implementation needs object storage, general multi-page support, arbitrary expressions, external services/fonts, broader permissions, or schema beyond the approved model.

## Artifacts and Checkpoints

- Design evidence: field catalog/formatter allowlist, normalized-layout schema, API contract, permission matrix, upload threat model, font/license manifest, and lifecycle diagram.
- Implementation evidence: base/current commits, changed-path manifest, PDF/layout/font SHA-256 values, seed dry-run, focused test/build summaries, and visual report.
- Synthetic-only PDF/PNG/diff outputs live in ignored `tmp/pdfs/`; do not commit them unless an explicitly approved deterministic redacted fixture is needed.
- C-01 after backend contract/persistence/renderer tests: record commit or scoped diff hash plus schema/API/font/template checksums.
- C-02 after frontend integration: validate C-01 and record frontend diff hash/test evidence before independent review.
- C-03 after remediation: validate current hashes, final verification, and scoped diff before any gated seed or publication.
- Preserve unrelated changes. One writer per path; overlapping dirty changes stop that writer until ownership is resolved.

## Execution Budgets

- Order: contract/security -> backend persistence/intake/renderer/API -> frontend shell/editor -> integration -> tests/docs -> independent review -> final verification.
- Maximum four active agents only when explicitly authorized; one writer per path. Disjoint frontend/backend writes may overlap only after the API/layout contract checkpoint.
- Deadline: 600 seconds per step, 1800 maximum; provide progress at least every 60 seconds during active work.
- Idempotent retries: 2; engineering loops: 3; review-remediation cycles: 2.
- Limits to implement/test: 10 MiB PDF, one A4 page, at most 100 fields, bounded strings/properties, one active render per request, and a server timeout selected from a measured development baseline before publish.
- Stop conditions: safety violation, failed gate, stale hash/checkpoint, overlapping writer, unapproved dependency/font, persistent write, permission assignment, real-data access, scope expansion, or inability to meet a mandatory criterion within budget.
