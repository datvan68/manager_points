# Task Identity and Pipeline

- Task: `match-dormitory-application-template-and-remove-pdf-icons`; pipeline: `bug_fix`; profile: Full; rules version: `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; branch: `main`; base commit: `1b884a21ad971a0e6dc9221793b56669d721d25f`; planning date: `2026-08-14`; environment: development.
- Planning-only authority: this document defines implementation and verification but does not authorize source-code changes, dependency changes, deployment, or persistent-data mutation. A separate explicit implementation request is required.
- Reference DOCX: `D:\WORK - OFF\KTX\ĐƠN XIN VÀO KÝ TÚC XÁ (MỚI).docx`; SHA-256: `07BB674AC7C5DA874D36A32F3070B11C336D09FE3A1215F302457BB35267A711`.
- UI reference image: `C:\Users\hoang\AppData\Local\Temp\codex-clipboard-78e92833-d4de-40cc-b19e-28089175b579.png`; the prohibited glyphs are the outlined eye and download-arrow icons.
- Effective Rules Manifest (SHA-256): `safety.md` `6A3F283B835394B1AF1F6380D94CBA260ACBED8A60D3065DD5365BB15806A772`; `global.md` `67806F70A5F89ADF42E3BE88413CC76CC27A02C90FAD0609AE71DE34D046A43F`; operating contract `51F3677C7E44121529CC0A4B17E5667BCBD2147EE63C6F30207C10D5DEB51790`; orchestrator `B782109E896B2FA48A6523358A788A9DB9B81B72F3D8FC66F70019395738D716`; pipeline `0419C072380887F96B37FE4EB48DAE764306F46FB03190B176A43EBCEA3F41F3`.

# Risk Level

- Risk: high. The change crosses frontend/backend boundaries, changes an official form layout, and renders student and parent personal data.
- Source changes are Git-revertible. No database schema, migration, stored PDF, permission, or registration-state change is expected.
- Exact visual fidelity is a release gate, not a best-effort goal. The PDF cannot be accepted from HTML assertions alone.
- Preserve the current in-progress fixes in the dirty worktree, including source-aware PDF lookup, TargetClose retry/cleanup behavior, and top-toolbar PDF-button removal. Do not overwrite or regress unrelated user changes.

# Objective

Remove the eye and download glyphs shown in the supplied screenshot from the KTX registration UI while preserving their preview/download actions as clear text controls, and make every generated KTX application PDF visually and textually match the supplied DOCX template with no observable deviation. Registration data that is unavailable must leave the corresponding template field blank without changing the template's geometry.

# Scope Boundaries

- Backend PDF template, mapping, and focused regression tests:
  - `backend/src/dormitory/services/registrations.service.ts`
  - `backend/src/dormitory/services/registrations.service.spec.ts`
- Frontend KTX PDF action presentation and focused tests:
  - `frontend/src/app/(dashboard)/dormitory/registrations/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/registrations/page.test.tsx`
- The supplied DOCX is the sole design and wording authority. It remains read-only and must not be modified.
- Remove use of the `Eye` and `Download` Lucide glyphs throughout the KTX registrations page. Keep the same permission checks and handlers, but render the affected preview/export actions as text-only controls with explicit accessible labels.
- Keep the standalone top-menu/toolbar PDF button absent. Retain per-row preview/download, selected-row `FloatingActionBar` PDF, and preview-dialog download behavior unless the user separately requests removal.
- Consolidate the KTX application form into one active template implementation; remove the unused `legacyApplicationHtml` duplicate.

# Out of Scope

- Removing PDF preview/download capabilities, changing `DORM_REG_READ`, changing the endpoint contract, changing source-aware lookup for `FORMAL|PUBLIC|ADMIN_TEMPORARY`, or changing filename/content-disposition behavior.
- Removing or redesigning unrelated icons such as edit, delete, refresh, QR, search, calendar, loading, or room assignment.
- Changing registration forms, schemas, DTOs, profile fields, room assignment, contracts, Excel behavior outside this page, or the shared `FloatingActionBar` component.
- Adding a PDF library, changing Puppeteer versions, browser pooling, infrastructure or font installation, storing generated PDFs, bulk/merged PDF export, migrations, deployment, or real-data processing.
- Adding static text, branding, fields, dates, status, source, room, registration code, or explanatory copy that does not appear in the supplied DOCX.

# Context and Dependencies

- Structural audit of the reference confirms one A4 portrait section (`210 x 297 mm`) with margins `left 30 mm`, `right 20 mm`, `top 20 mm`, and `bottom 20 mm`; no header/footer text.
- The reference uses Times New Roman throughout: `14 pt` for the national heading, recipient, body fields, commitment, and signatures; `15 pt bold` for `ĐƠN XIN VÀO KÝ TÚC XÁ`. Student/parent field paragraphs use approximately `1.5` line spacing.
- Exact reference text/flow is: national heading; `Độc lập - Tự do - Hạnh phúc`; title; `Kính gửi: Phòng Học sinh sinh viên.`; student details; father details; mother details; priority-certificate line; the exact commitment paragraph; then the two-column signature block.
- The reference contains no school/ministry block and no `Mã số sinh viên` line. The current HTML incorrectly adds both, uses `Ban Quản lý Ký túc xá`, uses Arial at `11 pt`, changes labels/field grouping, changes commitment wording, adds a date line, and conditionally hides the parent-signature column.
- Exact reference field labels/order are:
  1. `Họ và tên HSSV:`
  2. `Ngày, tháng, năm sinh:` and `Nam(nữ):`
  3. `Lớp:` and `Khoa`
  4. `Dân tộc:`, `Tôn giáo:`, and `Điện thoại`
  5. `CCCD:`, `Ngày cấp:`, and `Nơi cấp:`
  6. student `Hộ khẩu thường trú:`
  7. father name/age, permanent address, contact address, occupation/phone
  8. mother name/age, permanent address, contact address, occupation/phone
  9. `Các giấy chứng nhận ưu tiên (nếu có):`
- Exact commitment text: `Nay tôi làm đơn này kính đề nghị Phòng Học sinh sinh viên xem xét cho tôi được vào ở Ký túc xá. Nếu được giải quyết, tôi cam kết thực hiện Nội quy Ký túc xá của Nhà trường./.`
- Exact signature labels are always present: left `PHHS ký và ghi rõ họ tên` plus `(Dành cho HSSV dưới 18 tuổi)`; right `NGƯỜI LÀM ĐƠN` plus `(Ký tên, ghi rõ họ, tên)`. The template contains no date line above the applicant signature.
- The reference uses tabs, dotted writing lines, a two-column signature table, and two anchored drawing objects. These must be measured from the DOCX package/render rather than approximated from extracted text.
- Current source contains an active `applicationHtml` and an unused `legacyApplicationHtml`; keeping two variants risks future drift.
- Current row actions use icon-only `Eye` and `Download` buttons, while the selected-row bar and preview dialog also render the `Download` glyph. The prohibited glyphs must disappear without removing the actions.
- The current environment has no callable LibreOffice executable, so reference PNG rendering was not available during planning. Structural audit succeeded, but implementation acceptance requires an environment with Microsoft Word or LibreOffice capable of rendering the DOCX baseline.

# Steps

1. Preserve the supplied DOCX byte-for-byte and distill it into a task-local fidelity contract: page geometry, paragraph positions, tabs, dotted lines, font metrics, table widths, cell alignment, anchored drawings, static text, field slots, and expected single-page flow.
2. Render the reference DOCX to a reference PDF and page PNG using Microsoft Word or LibreOffice. Record renderer/version, page count, dimensions, and SHA-256 of the reference artifacts; inspect the full page at 100% zoom.
3. Add focused backend tests that capture generated HTML and assert the exact reference wording/order, Times New Roman sizing, A4 margins, unconditional two-column signature block, absence of non-template content, escaped values, and blank behavior.
4. Replace the active HTML/CSS form with a faithful reconstruction of the DOCX. Use fixed, explicit measurements derived from the fidelity contract for page box, paragraph rhythm, tab stops/field lines, signature columns, and whitespace; do not rely on browser defaults.
5. Map existing canonical data only into reference slots. Remove extra rendered fields such as student code and registration metadata. For missing/invalid values, emit an empty slot while retaining its line length, label, row height, and surrounding spacing.
6. Preserve the exact Vietnamese spelling, punctuation, capitalization, diacritics, and commitment/signature wording from the DOCX. Use HTML escaping and a font stack headed by Times New Roman; wait for `document.fonts.ready` before `printToPDF` where supported so glyph metrics are stable.
7. Remove `legacyApplicationHtml` after the one active template passes content tests; do not alter the existing source lookup, TargetClose retry, cleanup, response, or authorization logic.
8. Replace every KTX-page occurrence of the pictured `Eye`/`Download` glyphs with text-only actions. Per-row controls must read `Xem trước` and `Xuất PDF`; selected-row and dialog controls keep their existing text. Remove only now-unused icon imports and keep keyboard focus, accessible names, permission checks, loading/error states, and click handlers unchanged.
9. Extend frontend tests to prove no `Eye`/`Download` glyph is rendered/imported on this page, text actions remain discoverable, the top toolbar PDF button remains absent, and row/floating/dialog actions still call the same source-aware preview/download flow.
10. Generate PDFs from complete and maximally incomplete synthetic records for all three sources. Rasterize each PDF at the same DPI as the reference, create overlay and pixel-diff artifacts, inspect the entire page at 100%, and iterate until no visible difference exists outside populated field characters.
11. Run focused tests, builds/typecheck, PDF stability regressions, accessibility checks, and final diff/status review without modifying the reference DOCX or unrelated worktree changes.

# Acceptance Criteria

- AC1: The KTX registration page renders neither the outlined-eye glyph nor the download-arrow glyph shown in the screenshot; `Eye` and `Download` are absent from this page's imports and JSX.
- AC2: Per-row `Xem trước` and `Xuất PDF`, selected-row `Xuất PDF`, and preview-dialog `Xuất PDF` remain usable as text-only controls with explicit accessible names, keyboard focus, existing permissions, and unchanged handlers.
- AC3: The top menu/toolbar contains no PDF export button. Other unrelated icons and actions remain unchanged.
- AC4: The generated PDF is exactly one A4 portrait page with `30/20/20/20 mm` left/right/top/bottom margins and the reference's measured content positions, spacing, line lengths, table geometry, and signature whitespace.
- AC5: All visible text matches the DOCX exactly in wording, order, punctuation, capitalization, and diacritics. The PDF uses Times New Roman `14 pt` body/header/signature text and `15 pt bold` title text as measured from the reference.
- AC6: The PDF contains no school/ministry header, `Mã số sinh viên`, `Ban Quản lý Ký túc xá`, replacement commitment, date line, status/source/room data, or other content absent from the DOCX.
- AC7: The left parent-signature and right applicant-signature columns always render exactly as the template, including the under-18 explanatory line; age does not add, remove, or move either column.
- AC8: Every available canonical value appears in the correct reference slot. Every missing/invalid value is blank and never renders `undefined`, `null`, `Invalid Date`, raw enum values, placeholders, or fabricated text; blank slots retain the template's geometry.
- AC9: Complete and incomplete synthetic records from `FORMAL`, `PUBLIC`, and `ADMIN_TEMPORARY` all generate a non-empty readable PDF through preview and download with the existing authorization and source-aware lookup.
- AC10: Equal-DPI overlay comparison shows no observable difference between the reference and generated blank-form layout. For populated forms, differences are limited to characters inserted within the documented field slots; no static pixel, line, alignment, wrapping, pagination, or signature displacement differs.
- AC11: Existing TargetClose retry/cleanup tests, source matrix, safe filename, response headers, and object-URL lifecycle continue to pass.
- AC12: The reference DOCX SHA-256 remains `07BB674AC7C5DA874D36A32F3070B11C336D09FE3A1215F302457BB35267A711`, and no unrelated source, dependency, schema/data, shared UI component, or user change appears in the final diff.

# Verification

- Reference audit environment :: render `D:\WORK - OFF\KTX\ĐƠN XIN VÀO KÝ TÚC XÁ (MỚI).docx` to PDF and PNG at fixed DPI with Microsoft Word or LibreOffice => one clean A4 page; record renderer/version and hashes; inspect at 100%.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/registrations.service.spec.ts` => exact wording/layout-contract, blank-value, escaping, three-source, TargetClose, and cleanup regressions pass.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => PDF mapping/template and renderer compile.
- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/registrations/page.test.tsx"` => prohibited icons are absent and retained text-only PDF actions work.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => icon removal and action changes introduce no type errors.
- Repository root :: `rg -n -S "legacyApplicationHtml|font-family:Arial|Ban Quản lý Ký túc xá|BỘ GIÁO DỤC VÀ ĐÀO TẠO|TRƯỜNG CAO ĐẲNG|<Eye|<Download" backend/src/dormitory/services/registrations.service.ts "frontend/src/app/(dashboard)/dormitory/registrations/page.tsx"` => no match in active KTX PDF/UI code.
- Visual fidelity harness :: render a blank synthetic PDF and populated PDFs for all three sources at the reference DPI; compare page bounds, static-text mask, field lines, paragraph baselines, signature table, and whitespace against the DOCX render => AC4-AC10 pass with no unexplained pixels.
- Manual UI inspection at desktop and mobile widths :: row, selected-row bar, and preview dialog show text controls without the pictured glyphs; tab order, focus indicator, click behavior, loading, error, retry, preview, and download work.
- Repository root :: `(Get-FileHash -Algorithm SHA256 -LiteralPath 'D:\WORK - OFF\KTX\ĐƠN XIN VÀO KÝ TÚC XÁ (MỚI).docx').Hash` => reference hash unchanged.
- Repository root :: `git diff --check` and `git status --short` => only authorized implementation paths plus this scope change; pre-existing user changes are preserved.

# Safety Gates

- No Human Gate is required for scoped source edits, synthetic fixtures, or local visual comparison.
- Fidelity Gate F1: implementation is not complete until the DOCX reference can be rendered and every page is visually inspected. Structural extraction or HTML unit tests alone cannot approve “100% giống mẫu.”
- Gate G1 is required before staging/production execution, deployment, access to real student/parent data, server or font installation, or persistent-data mutation. Required artifact: exact environment/action, redacted evidence, impact, rollback, and explicit user authorization.
- Stop and amend this scope if exact fidelity requires a new runtime/dependency, copying the external DOCX into deployable assets, changing the public endpoint, changing permissions, or adding fields/data not already available.

# Artifacts and Checkpoints

- Reference fidelity contract: DOCX path/hash, renderer/version, page/section count, A4 geometry, margins, font roles, paragraph baselines, tab stops, dotted-line coordinates, table/signature geometry, anchored-drawing positions, static-text inventory, and editable-slot map.
- Data-slot matrix: reference label -> view-model key -> formal/public/admin-temporary source -> formatter -> blank rule -> maximum safe length -> overflow behavior.
- Required synthetic fixtures: blank/maximally incomplete, complete formal, complete public QR, complete admin temporary, long Vietnamese values, invalid dates/enums, HTML-like unsafe text, and over-capacity field values.
- Required visual artifacts: reference PNG, generated PNG per fixture, transparent overlay, pixel-diff image, and a reviewed deviation report. Expected populated-field differences must be masked only inside documented slot bounds.
- Checkpoint after exact static-content tests; after text-only UI tests; after blank-form visual overlay; after all populated/incomplete visual cases; and after final independent diff review.
- Review must inspect visual fidelity, template wording, missing-value geometry, overflow/clipping, Vietnamese glyphs, icon absence, accessibility, source authorization, HTML escaping, PII leakage, renderer cleanup, and preservation of the dirty worktree.

# Execution Budgets

- Dependency order: preserve/hash reference -> distill/render reference -> backend content tests -> template implementation -> frontend icon replacement/tests -> focused builds -> visual diff loop -> independent review -> final diff/status.
- One writer per path. Step deadline: `1200 seconds`; tooling retries: `2`; engineering loops: `3`; visual-remediation cycles: `5`; reviewer remediation cycles: `2`; no unapproved branch/worktree creation.
- Visual fidelity has no waiver within this scope. If the render prerequisite remains unavailable after the retry budget, report the task as partially completed/blocked at Fidelity Gate F1 rather than claiming exact-match completion.
