# Task Identity and Pipeline

- Task: `fix-dormitory-registration-pdf-export`; pipeline: `bugfix`; profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; base commit: `80201f4fddda5574adbe78b3c7eee50655d9eefb`; planning date: `2026-08-14`; environment: development.
- Planning-only authority: this taskscope authorizes no implementation, dependency change, migration, deployment, or live-data mutation. Implementation requires a separate explicit request.
- Effective Rules Manifest (SHA-256): `safety.md` `6A3F283B835394B1AF1F6380D94CBA260ACBED8A60D3065DD5365BB15806A772`; `global.md` `67806F70A5F89ADF42E3BE88413CC76CC27A02C90FAD0609AE71DE34D046A43F`; operating contract `51F3677C7E44121529CC0A4B17E5667BCBD2147EE63C6F30207C10D5DEB51790`; orchestrator `B782109E896B2FA48A6523358A788A9DB9B81B72F3D8FC66F70019395738D716`; pipeline `0419C072380887F96B37FE4EB48DAE764306F46FB03190B176A43EBCEA3F41F3`.

# Risk Level

- Risk: high. The fix crosses the KTX frontend/API/backend boundary and generates a document containing student identity, citizen-ID, address, phone, and parent information.
- No database schema, migration, backfill, or persistent-data write is expected. Source changes are Git-revertible.
- Blast radius is limited to the KTX registration list and its application-PDF endpoint. Excel exports in other modules, the shared `FloatingActionBar` component, student profile editing, registration creation, room assignment, contracts, billing, and approval flows must remain unchanged.

# Objective

Remove Excel export from the KTX registration page, including its `FloatingActionBar` action, and make preview/download of one application PDF work for every listed registration source (`FORMAL`, `PUBLIC`, and `ADMIN_TEMPORARY`). The generated A4 PDF must reproduce `D:\WORK - OFF\KTX\ĐƠN XIN VÀO KÝ TÚC XÁ (MỚI).docx`; any unavailable value must render as an empty field without preventing export.

# Scope Boundaries

- Frontend KTX page: `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx` and `page.test.tsx`.
- Frontend PDF API contract: `frontend/src/api/dormitory-api.ts` and `dormitory-api.test.ts`.
- Backend PDF route and source-aware data loading: `backend/src/dormitory/controllers/registrations.controller.ts`, `controllers/registrations.controller.spec.ts`, `services/registrations.service.ts`, and `services/registrations.service.spec.ts`.
- The existing endpoint remains authenticated and protected by `DORM_REG_READ`. Extend its contract to include the row discriminator: `GET /dormitory/registrations/:id/application-pdf?source=FORMAL|PUBLIC|ADMIN_TEMPORARY&disposition=inline|attachment`.
- The server must resolve the record from the collection identified by `source`:
  - `FORMAL`: load `Registration`, populate Student -> Class -> Department, and use registration snapshots before canonical Student fallbacks where applicable;
  - `PUBLIC`: load a non-`ADMIN_ENTRY` `PublicRegistration` and use its top-level applicant values;
  - `ADMIN_TEMPORARY`: load a `PublicRegistration` whose stored source is `ADMIN_ENTRY` and use its top-level applicant values.
- A single normalized PDF view model must map both collections to the supplied-form fields: full name, date of birth, gender, student code, class, faculty/department, ethnicity, religion, phone, citizen ID, issue date/place, permanent address, complete father and mother blocks, priority group/certificate details, commitment, date/signature areas, and any other static label present in the supplied form.
- The PDF remains one registration per file. Row actions, the top toolbar action, and the KTX page's `FloatingActionBar` action use the same source-aware PDF flow. Exactly one selected registration opens the preview; multiple selection retains bulk delete but must show a clear one-form-at-a-time message for PDF rather than exporting Excel or inventing ZIP/bulk-PDF behavior.
- Missing, null, undefined, malformed legacy, unpopulated relation, and not-yet-entered values render as blank. They must never render as `undefined`, `null`, `N/A`, `—`, `Chưa có`, `Không tìm thấy`, fabricated defaults, or raw enum codes.

# Out of Scope

- Removing Excel export globally, uninstalling `xlsx`, changing Excel behavior in grading/reports/attendance/other modules, or modifying `frontend/src/components/ui/FloatingActionBar.tsx`.
- Bulk PDF, merged PDF, ZIP export, email/send/share, PDF storage, digital signatures, certificate uploads, OCR, DOCX editing, or adding a client-side PDF library.
- Changing KTX registration schemas, existing records, student profile fields, public registration conversion, registration status, room/bed assignment, contracts, invoices, permissions, or unrelated UI.
- Public unauthenticated PDF access, data migration, deployment, or production execution.

# Context and Dependencies

- The KTX page currently contains two Excel entry points: a top toolbar `Xuất Excel` button and a selected-row `FloatingActionBar` `Xuất Excel` button. It also contains Excel-only state, `buildRegistrationExportRows`, a dynamic `xlsx` import, workbook generation, a spreadsheet preview dialog, Excel labels, tests, and a `FileSpreadsheet` icon import.
- The same page already has per-row PDF preview/download and a top-level selected PDF action. Both call `getApplicationPdf(row._id, disposition)` without the registration source.
- The KTX list merges formal and public collections. Each returned row already has a normalized `source` value: `FORMAL`, `PUBLIC`, or `ADMIN_TEMPORARY`.
- `RegistrationsService.generateApplicationPdf(id)` currently queries only `registrationModel`. Therefore an ID belonging to `PublicRegistration` cannot be found and produces `Không tìm thấy đơn đăng ký`. This is the verified cause of the reported failure for QR and temporary entries.
- Update and delete endpoints already use the same source discriminator pattern. PDF should reuse `validateSource` and the corresponding source/record consistency checks instead of probing both collections, which prevents ambiguity if identical ObjectIds exist in different collections.
- The existing server uses Puppeteer and already emits A4. Reuse it; do not add dependencies. Browser/page cleanup must run on success and failure.
- The supplied DOCX is A4 portrait with margins top/right/bottom 20 mm and left 30 mm. Its structure includes the national/school header, application title, recipient, student details, identity/contact details, father and mother details, priority evidence, commitment, parent/guardian signature area, and applicant signature area.

# Steps

1. Add failing regression tests that reproduce PDF lookup for one row from each source and confirm that the current public/temporary calls fail because only `registrationModel` is queried.
2. Change the typed frontend API to require `DormRegistrationSource` for `getApplicationPdf`, encode it as the `source` query parameter, and keep `disposition` restricted to `inline|attachment`.
3. Change the controller to accept `source`, pass it to the service, retain `DORM_REG_READ`, and preserve safe PDF response headers for both preview and download.
4. Refactor `generateApplicationPdf` into source-aware lookup plus a shared normalized view-model mapper. Validate ObjectId and source, enforce `PUBLIC` versus stored `ADMIN_ENTRY` consistency, populate formal Student/Class/Department when available, and do not fail merely because related/student or optional form data is absent.
5. Make date and enum formatting defensive and sample-compatible: valid dates use the form's Vietnamese display format; missing/invalid dates are blank; gender labels follow the DOCX; all interpolated values are HTML-escaped; optional nested parent/applicant objects safely collapse to empty strings.
6. Rework the HTML/CSS template against the supplied DOCX, preserving exact static wording, section/field order, A4 portrait geometry, margins, alignment, borders/lines, spacing, signature areas, and Vietnamese glyph rendering. Do not insert application status, source, room, system placeholders, or other fields absent from the sample.
7. Remove the KTX page's Excel feature completely: toolbar and floating buttons, spreadsheet preview dialog, Excel-only helpers/state/functions, dynamic `xlsx` import, labels, icon import, and Excel-specific tests. Keep one toolbar PDF action and the existing row PDF actions.
8. Replace the KTX page's `FloatingActionBar` Excel action with `Xuất PDF`. For one selected row it opens the same PDF preview; for multiple rows it gives an actionable one-form-at-a-time message while leaving bulk delete unchanged. Pass both `_id` and normalized `source` from the selected row to every preview/download call.
9. Ensure preview lifecycle remains safe: loading, retry, error, close, and download states are visible; object URLs are revoked on replacement, close, download, and unmount; no failed request leaves a stale PDF visible.
10. Run focused backend/frontend tests, builds/static checks, final diff/status review, and manual visual comparison of exported PDFs for all three sources and incomplete data against the supplied DOCX.

# Acceptance Criteria

- AC1: The KTX registration page contains no visible `Xuất Excel` action in the toolbar, `FloatingActionBar`, dialogs, menus, or row actions, and no KTX-only Excel export code or spreadsheet preview remains.
- AC2: The shared `FloatingActionBar` component and Excel features outside the KTX registration page are unchanged.
- AC3: Every PDF request includes the selected row's exact `_id`, `source`, and requested `disposition`; missing or unsupported `source` is rejected with the repository-standard 400 response.
- AC4: An authorized user can preview and download a non-empty PDF for a listed `FORMAL`, `PUBLIC`, or `ADMIN_TEMPORARY` registration. Public and temporary records no longer return `Không tìm thấy đơn đăng ký` solely because they live in `PublicRegistration`.
- AC5: Source/record mismatches are rejected deterministically: `FORMAL` never reads the public collection, `ADMIN_TEMPORARY` accepts only stored `ADMIN_ENTRY`, and `PUBLIC` rejects stored `ADMIN_ENTRY`. The implementation does not probe alternate collections after a mismatch.
- AC6: The existence of the registration record is the only business-data prerequisite for PDF generation. Missing student relation, student code, class, department, room, identity, parent, priority, or other optional data does not disable the action and does not cause a not-found/validation failure.
- AC7: Every missing or unusable form value appears as an empty field in preview and download; the document contains none of `undefined`, `null`, `Invalid Date`, raw `Male|Female|Other`, fabricated values, or UI placeholders.
- AC8: Preview and download use the same server view model and template. Both return `application/pdf`, safe `inline|attachment` disposition, a sanitized deterministic filename based on the available formal/public registration code, and no client-supplied personal values.
- AC9: The PDF matches the supplied DOCX in A4 size, margins, static text, label/section order, alignment, spacing, field lines, commitment, and signature areas. Populated Vietnamese data renders without mojibake, clipping, overlap, or unexpected blank pages.
- AC10: Row preview, row download, top toolbar PDF, and the one-selected-row `FloatingActionBar` PDF all work. Zero/multiple selection shows clear guidance and never falls back to Excel.
- AC11: `DORM_REG_READ` remains required; unauthorized access cannot infer another record's existence; logs and errors contain no citizen ID, address, phone, or parent data.
- AC12: No schema/data migration, new dependency, registration mutation, or unrelated behavioral/UI change appears in the final diff.

# Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/registrations.service.spec.ts dormitory/controllers/registrations.controller.spec.ts` => source-aware lookup, source mismatch, incomplete-data rendering, escaping, response delegation, and error contracts pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => controller query contract, service mapper, Mongoose population, and Puppeteer code compile.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run src/api/dormitory-api.test.ts "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => API includes source; KTX Excel UI/code expectations are removed; every PDF entry point forwards the selected row/source; selection and object-URL lifecycle pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no stale `buildRegistrationExportRows`, `exportPreviewRows`, `FileSpreadsheet`, or old two-argument PDF call remains.
- Repository root :: `rg -n -S "Xuất Excel|Xác nhận xuất Excel|Xem trước xuất Excel|buildRegistrationExportRows|exportPreviewRows|Danh_sach_dang_ky_KTX|FileSpreadsheet" "frontend/src/app/(dashboard)/dormitory/registrations/page.tsx" "frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => no match.
- Manual development QA with synthetic records :: preview and download one `FORMAL`, one `PUBLIC`, one `ADMIN_TEMPORARY`, and one maximally incomplete record from every UI entry point; inspect the rendered PDFs at 100% zoom => all generate successfully, missing values are blank, and AC4-AC10 pass.
- Manual DOCX comparison :: render the supplied DOCX and each representative PDF to page images at equal size; compare page count, A4 bounds, margins, text, field order, alignment, line positions, wrapping, commitment, and signatures; implementation is not accepted until all observable differences are resolved or explicitly approved by the user.
- Repository root :: `git diff --check` and `git status --short` => only scoped files changed, whitespace is valid, and unrelated user changes are preserved.

# Safety Gates

- No gate is required for scoped source edits and synthetic tests.
- Gate G1 is required before any database migration/backfill, production/staging data access, deployment, or public PDF exposure. Required review artifact: exact environment/command, affected records without personal values, backup/rollback plan, and explicit user authorization. Resume immediately before the first external or persistent mutation.
- Stop and amend this scope if implementation requires changing permissions, storing PDFs, adding a dependency, bulk/merged export, touching real personal data, or modifying the supplied DOCX.

# Artifacts and Checkpoints

- Maintain a source matrix in tests: UI `source` -> Mongo model -> stored-source constraint -> identity fallback -> registration-code fallback -> expected PDF result.
- Maintain a DOCX mapping checklist: sample label/static text -> view-model key -> formal source -> public/temporary source -> blank rule -> PDF location -> test/visual evidence.
- Required synthetic fixtures: complete formal, incomplete formal with missing Student relation, complete public QR, incomplete public QR, complete admin temporary, invalid legacy date, long Vietnamese values, source mismatch, invalid ObjectId, and unauthorized request.
- Checkpoint after backend tests prove all three sources; after frontend tests prove no KTX Excel path remains; and after visual QA proves exact sample conformance.
- Review must independently inspect source authorization, HTML escaping, blank-value normalization, date/gender localization, filename sanitization, Puppeteer cleanup, personal-data logging, object-URL cleanup, and final DOCX/PDF visual evidence.

# Execution Budgets

- Dependency order: regression baseline -> API source contract -> backend lookup/view model -> exact template -> frontend Excel removal/PDF wiring -> focused tests -> builds/typecheck -> visual QA -> final diff review.
- One writer per path. Step deadline: 1200 seconds; retries: 2; engineering loops: 3; visual-remediation cycles: 3; no unapproved branch/worktree creation.
