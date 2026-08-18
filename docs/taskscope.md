# Taskscope: Fix PDF overlay đơn xin vào KTX

## Task Identity and Pipeline

- Task: `fix-dormitory-application-pdf-overlay`
- Pipeline: `bug_fix`
- Profile/rules: Full / 3.2.0
- Repository/base: `D:\PROJECT\manager_points`, branch `main`, commit `654f7aa2`.
- State: the PDF implementation is currently uncommitted. This taskscope update authorizes planning only; it does not authorize implementation, dependency changes, database changes, deployment, or production operations.

## Risk Level

- Risk: high; the generated document contains student identity, CCCD, phone, address, and parent information.
- Environment: development. The change is source-reversible and does not require persistent-data mutation.
- Blast radius: the authenticated single-student PDF preview/download path under Dormitory Roster.

## Objective

Correct the PDF value overlay so every mapped value is legible and placed only in the corresponding blank region of the original one-page A4 form, without covering labels, shifting static content, clipping valid data, or creating an additional page.

## Scope Boundaries

- Approved/write boundaries:
  - `backend/src/dormitory/services/dormitory-roster.service.ts`
  - `backend/src/dormitory/services/dormitory-roster.service.spec.ts`
  - `backend/src/dormitory/templates/dormitory-roster-application.pdf` only to verify that the versioned asset still matches the approved source; do not visually alter it.
  - a focused synthetic visual fixture or test helper under `backend/src/dormitory/**` when required.
- Review-only boundaries: `backend/package.json`, `backend/package-lock.json`, and `backend/nest-cli.json`; retain only changes required by the existing renderer/template asset.
- Known symbols: `generateApplicationPdf`, `applicationPdfValues`, `applicationPdfOverlayHtml`, `formatPdfDate`.

## Out of Scope

- Frontend workflow changes, batch export, editing roster/student data, schema or DTO changes, migrations, signatures, photo upload, public registration, deployment, and production data.
- Do not add new fields or fabricate unavailable values.
- Do not replace or redesign the supplied static form.

## Context and Dependencies

- The source/template is an unencrypted, non-interactive, one-page A4 PDF (`595.32 x 842.04 pt`) using Times New Roman at approximately `14.04 pt` for form labels.
- Confirmed root cause: every value is rendered as a fixed-width white `span`; several spans begin before the dotted blank and erase the underlying label.
- Confirmed coordinate conflicts:
  - `dob` currently starts at `x=294`, while `sinh:` ends near `x=323.5`;
  - `ethnicity` starts at `x=218`, while `tộc:` ends near `x=241.0`;
  - `religion` starts at `x=324`, while `giáo:` ends near `x=354.5`;
  - `citizenIssueDate` covers `x=395..479`, overlapping the complete `Nơi cấp:` label at approximately `x=428.8..477.1`;
  - permanent/parent address overlays start near `x=178`, before `trú:` has ended;
  - phone and several other values begin at or before the final label glyph.
- The overlay currently uses Arial `9 pt`, `white-space: nowrap`, and `overflow: hidden`, causing a visible typography mismatch and silent truncation of long values.
- Existing tests validate page size and selected HTML strings but do not detect label erasure, overlap, font mismatch, or clipping.
- Preserve the current server-authoritative mapping, `DORM_REG_READ`, `inline|attachment`, safe filename behavior, HTML escaping, Vietnamese Unicode, and one-page A4 response contract.

## Steps

1. Capture a regression baseline by rendering a synthetic representative PDF at 150 DPI. Record the damaged static labels and the bounds of every variable region using the source PDF bbox data.
2. Replace ad hoc field arguments with an explicit field-layout definition containing the verified blank-region bounds, alignment, font-size range, and overflow behavior for every mapped value.
3. Move each white mask so it begins after the complete label and remains inside its dotted blank. In particular, separate CCCD, issue date, and issue place into non-overlapping regions.
4. Match the template typography using a Vietnamese-capable Times New Roman-compatible font. Use deterministic shrink-to-fit for short single-line fields and bounded wrapping only for designated multiline address/priority fields; never silently clip a non-empty value.
5. Keep missing values blank and preserve the existing mapping. Normalize dates deterministically without server-timezone date drift; render gender using the product-approved `Nam`, `Nữ`, or `Khác` value in its blank region.
6. Add focused unit/regression tests for mapping, date formatting, escaping, missing values, field-layout non-overlap, and fit behavior. Add a synthetic rendered-PDF visual regression that masks only approved variable regions and verifies static pixels remain unchanged.
7. Render fixtures containing short, maximum realistic, Vietnamese-diacritic, and missing values. Inspect the complete page after each correction, then run affected tests/build and final diff/status review.

## Acceptance Criteria

- AC-01: The complete static phrases `Ngày, tháng, năm sinh:`, `Dân tộc:`, `Tôn giáo:`, `Điện thoại`, `CCCD:`, `Ngày cấp:`, `Nơi cấp:`, and every parent/address label remain fully visible.
- AC-02: Each value begins inside its own dotted blank and no field mask or text intersects another label or variable region.
- AC-03: Output typography is visually consistent with the source; Vietnamese glyphs render correctly and normal values are not undersized.
- AC-04: Long representative names, faculty names, addresses, occupations, phone/CCCD values, and priority details are fully readable through bounded shrink or approved wrapping, with no silent clipping, overlap, or extra page.
- AC-05: Dates are formatted `dd/MM/yyyy` consistently across server timezones; gender and all other available canonical values appear in the correct semantic field. Missing data produces a blank, never `undefined`, `null`, or a fabricated value.
- AC-06: The output remains a valid one-page A4 PDF based on the unchanged approved template. Non-variable template pixels remain unchanged within the visual-test tolerance.
- AC-07: Permission, response headers, inline/attachment behavior, safe filename, and privacy behavior remain unchanged.
- AC-08: Focused backend tests and build pass, and the final diff contains no unrelated or real-person fixture data.

## Verification

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory-roster.service.spec.ts` => mapping, layout bounds, fit behavior, missing values, dates, escaping, and one-page A4 assertions pass.
- `D:\PROJECT\manager_points\backend` :: repository-native visual regression command added by the implementation, or the focused Jest test invoking its helper => the 150-DPI static-region comparison passes for all synthetic fixtures.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => Nest build succeeds and the template asset is present at its runtime path.
- `D:\PROJECT\manager_points` :: render the final representative PDFs with Poppler at 150 DPI and inspect the complete page => no covered label, clipping, overlap, missing glyph, layout shift, or extra page.
- `D:\PROJECT\manager_points` :: `git diff --check` and scoped `git status --short` review => no unintended changes or personal data artifacts.

## Safety Gates

- Stop and request approval if the fix requires a new dependency/font download, template replacement, broader personal-data access, logging/telemetry of field values, schema/data mutation, or deployment.
- Required gate artifact: dependency/license or privacy assessment, amended scope, exact rollback, and resume point.
- Current planning gate: None.

## Artifacts and Checkpoints

- Required implementation evidence: source/template checksum, field-layout table, synthetic fixture inputs, rendered 150-DPI PNGs or visual-diff result, focused test output, build output, and final scoped diff/status.
- Never commit a PDF, PNG, snapshot, log, or test fixture containing real student information.
- Validate the template checksum before final verification; checkpoint only at implementation-to-review handoff.

## Execution Budgets

- One writer per path; implementation followed by independent visual/privacy review.
- Step deadline: 600 seconds, maximum 1800 seconds.
- Idempotent retries: 2; engineering loops: 3; review remediation cycles: 2.
