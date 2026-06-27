# Taskscope2: Fix `/grading` PL01 PDF Date and Header Wrapping

## Objective

Fix the `/grading` PDF preview and downloaded PDF so they render the official PL01 form consistently, with correct birthdate formatting and no unwanted wrapping in the national header.

Latest reported issues:

1. `Ngay sinh` is currently rendering a full ISO timestamp such as `2006-02-28T17:00:00.000Z`; the PDF must display only the date.
2. The right-side national header `CONG HOA XA HOI CHU NGHIA VIET NAM` is too large and wraps `VIET NAM` onto a second line; reduce or fit the font so the header stays on one line.
3. The downloaded PDF must remain 100% consistent with the preview after these changes.

Official reference file:

`C:\Users\hoang\OneDrive\Máy tính\PL01- Phiếu đánh giá RL (TT40).rtf`

## Current Scope

Relevant files to inspect and adjust:

- `frontend/src/app/grading/page.tsx`
- `frontend/src/components/grading/GradingPdfTemplate.tsx`
- `frontend/src/utils/pdf-score-utils.ts`
- `frontend/src/api/summaries-point-api.ts`
- `backend/src/summaries-point/summaries-point.controller.ts`
- `backend/src/summaries-point/summaries-point.service.ts`

Preserve unrelated uncommitted changes. Only change the PL01 PDF preview/export flow, document data normalization, and supporting formatting utilities where required.

## Required Result

- `Ngay sinh` displays date only in PL01 format, preferably `dd/MM/yyyy`.
- `Ngay sinh` must not show time, timezone, ISO suffix, or raw database string.
- The right header line `CONG HOA XA HOI CHU NGHIA VIET NAM` stays on one line in both preview and downloaded PDF.
- Preview and downloaded PDF use the same normalized document data and the same layout rules.
- Downloaded PDF output must match the preview 100% for the same selected student.
- The exported PDF follows the official PL01 form, not a dashboard/card-style UI.

## Birthdate Formatting Requirements

- Normalize student birthdate before rendering preview/export.
- Accept common input shapes:
  - ISO string: `2006-02-28T17:00:00.000Z`
  - date string: `2006-03-01`
  - existing formatted date: `01/03/2006`
  - `Date` object if already parsed by the app.
- Output must be date only:
  - preferred: `01/03/2006`
  - never: `2006-02-28T17:00:00.000Z`
- Avoid timezone day-shift bugs:
  - If the backend/database value represents a student's date of birth, treat it as a calendar date, not an instant in time.
  - Do not let browser timezone conversion change the displayed day.
  - If input is an ISO timestamp generated from a date-only field, extract or normalize the calendar date intentionally before formatting.
- The same formatted birthdate must be used in preview and download.

## Header Layout Requirements

### Right National Header

- Keep `CONG HOA XA HOI CHU NGHIA VIET NAM` on one line.
- Reduce font size, letter spacing, or column width constraints as needed.
- Keep the second line `Doc lap - Tu do - Hanh phuc` centered and underlined per the PL01 form.
- Preserve formal document style:
  - Times New Roman or equivalent system serif font.
  - Bold for the national header.
  - Center alignment in the right header column.
- Avoid layout fixes that break A4 print:
  - no CSS transforms for print fitting
  - no viewport-dependent scaling
  - no clipping hidden text

### Header Grid

- Use a stable two-column header matching the official PL01 structure:
  - left: school/agency block
  - right: national title block
- Ensure both preview and export use identical widths and font sizes.
- Header must remain inside A4 printable margins.

## Preview and Download Parity Requirements

The preview and download must render from the same normalized PL01 document model.

Required parity:

- Same birthdate value and formatting.
- Same header text, font size, and line wrapping.
- Same student fields.
- Same criterion order.
- Same maximum scores.
- Same achieved scores.
- Same category totals.
- Same final score and classification.
- Same signature block.
- Same A4 page-break behavior as closely as possible.

Implementation direction:

- Build one normalized PDF payload per selected student before preview/export.
- Put birthdate formatting in one shared helper or shared normalization path.
- Do not format dates separately in preview and backend export unless tests prove both paths produce identical output.
- If backend PDF is generated with Puppeteer/HTML, send the same normalized HTML/data used by the preview.
- Mock/config-preview data must never be used for real download.

## Existing PDF Requirements to Preserve

- The full-name row must stay on one line when possible.
- `GIAO VIEN CHU NHIEM/CO VAN HOC TAP` must stay on one line.
- `Diem dat duoc` must match actual grading data and must not default to `0.0`.
- Category totals, bonus score, capped final score, and classification must remain correct.
- A4 pagination must not split important blocks incorrectly.
- PDF size should remain reasonable: no screenshot-based PDF for text tables, no remote fonts, no large unused assets.

## A4 Print Requirements

- Use print CSS:
  - `@page { size: A4; margin: ... }`
  - `preferCSSPageSize` for Puppeteer export.
- Use print-safe document CSS:
  - `border-collapse: collapse`
  - fixed table column widths
  - stable header grid widths
  - no Tailwind CDN or Google Fonts in exported HTML
  - no transforms, shadows, gradients, or decorative dashboard styles.

## Acceptance Criteria

1. `Ngay sinh` in preview displays only a date, for example `01/03/2006`.
2. `Ngay sinh` in downloaded PDF displays exactly the same date as preview.
3. Raw ISO timestamps such as `2006-02-28T17:00:00.000Z` never appear in preview or downloaded PDF.
4. `CONG HOA XA HOI CHU NGHIA VIET NAM` stays on one line in preview.
5. `CONG HOA XA HOI CHU NGHIA VIET NAM` stays on one line in downloaded PDF.
6. `Doc lap - Tu do - Hanh phuc` remains centered and underlined below the national header.
7. Downloaded PDF is visually identical to preview for the same selected student.
8. Scores and totals remain unchanged by the date/header layout fixes.
9. A4 margins and page breaks remain valid.
10. No TypeScript/runtime/backend export errors are introduced.

## Verification Plan

- Select the student shown in the screenshot or another student whose birthdate currently renders as an ISO timestamp.
- Open `/grading` PDF preview and verify:
  - `Ngay sinh` is date-only.
  - the right national header stays on one line.
  - the header is still aligned with the official PL01 layout.
- Download the PDF and compare it with the preview:
  - same birthdate text
  - same header line wrapping
  - same scores/totals
  - same A4 page layout.
- Add or update tests for:
  - birthdate normalization from ISO timestamp
  - birthdate normalization from date-only string
  - preview/export normalized payload equivalence
  - header class/style snapshot if practical.

## Non-goals

- Do not redesign the `/grading` dashboard/list page.
- Do not change unrelated grading business rules.
- Do not rewrite Excel export.
- Do not change approval, lock, or permission behavior unless required for PDF correctness.
