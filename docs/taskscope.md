# Taskscope: Accurate PDF Field Anchoring and Catalog Source Replacement

Task: `fix-pdf-field-anchor-and-add-catalog-upload` | Pipeline: full-stack PDF template | Risk: high | Profile: Full

## Authority

Planning only. This scope does not authorize implementation.

## Objective

Make the text position shown in the PDF editor match Preview and exported KTX PDFs, and let an operator replace a configured template's source PDF from the catalog without losing its saved fields. Show the last-updated date on every template card.

## Boundary

PDF editor field overlay, PDF render geometry for both standard and Unicode text, configured-template card actions, source replacement using the existing aggregate update flow, update-date presentation, and focused tests. Preserve permissions, template type registration, field keys, saved layout schema, KTX value resolution, delete behavior, and the existing edit route.

## Current Evidence

- The editor positions the visible field key directly at normalized `x/y`, but does not apply the stored internal width, height, padding, horizontal alignment, vertical alignment, font family, or renderer font metrics.
- Preview/export applies those hidden style values. The KTX default is `verticalAlign: middle` with padding, so the real value is displaced inside an invisible field box even when the editor marker appears correctly placed.
- Unicode values such as `Nguyễn Thị Minh Khánh` use the browser renderer, while non-Unicode values use `pdf-lib`; the two paths currently calculate text placement differently.
- The editor uses a monospace field-key label, while output uses the saved PDF font. This prevents a reliable visual position comparison.
- A configured catalog card currently exposes only `Chỉnh sửa` and `Xóa`. Source replacement exists inside the editor and the current update API already accepts a new PDF together with the existing version and layout.
- Catalog data already includes nullable `updatedAt`; no backend schema or catalog response change is required to display the update date.

## Decisions

- Define `x/y` as the top-left text anchor visible to the operator. Text-only fields must not receive a second horizontal or vertical displacement from hidden box alignment.
- Keep `width/height` and the complete style object in persisted layouts for validation and backward compatibility. Do not migrate or rewrite saved coordinates.
- Make editor, browser-rendered Unicode output, and `pdf-lib` output use one documented anchor contract. Convert top-left coordinates to a PDF baseline with actual font metrics rather than assuming `fontSize` equals glyph height.
- Render the editor marker with the saved font family, weight, size, line height, and padding contract; remove the forced monospace font. Field-key text may differ from the final value, but its first glyph must start at the same anchor.
- Existing horizontal/vertical alignment values remain stored but do not shift single-line text-only fields. Overflow and internal bounds remain available to constrain long output without changing the anchor.
- Add `Tải lên mẫu` to configured cards for users with manage permission. The action selects a PDF, obtains the current metadata/layout, confirms replacement, and calls the existing versioned save endpoint with the new source and unchanged layout.
- Do not silently fall back to a default layout. If metadata has no valid saved layout, the catalog action stops with an actionable error and directs the operator to `Chỉnh sửa`.
- Use `ConfirmModal` before replacing the configured source. On validation failure or version conflict, keep the current card data, show the error, and reload the catalog when appropriate.
- Show `Ngày cập nhật` on every card using `Intl.DateTimeFormat('vi-VN')`; show `Chưa cập nhật` for null or invalid values. Do not hardcode a date pattern.
- Use the shared `Button` component for visible catalog actions and retain visible focus, disabled/loading state, an accessible file-input label, and permission gating.

## Targets

- `frontend/src/components/pdf-template/PdfTemplateEditor.tsx`
- `frontend/src/components/pdf-template/PdfTemplateEditor.test.tsx`
- `frontend/src/components/pdf-template/PdfTemplateCatalog.tsx`
- `frontend/src/components/pdf-template/PdfTemplateCatalog.test.tsx`
- `backend/src/pdf-template/pdf-template-renderer.service.ts`
- `backend/src/pdf-template/pdf-template.spec.ts`
- Existing `frontend/src/api/pdf-template-api.ts` save/metadata methods, inspected and reused without a new endpoint unless implementation evidence proves a narrow compatibility change is required

## Steps

1. Write geometry regression cases from the reported `student.fullName` example that compare the same normalized anchor across editor, Unicode browser output, and `pdf-lib` output on the known A4 page dimensions.
2. Extract or centralize the text-anchor calculation used by the renderer. Remove hidden middle/center offsets for text-only fields and calculate the PDF baseline from the selected font's measured height/ascent.
3. Make browser overlay CSS follow the same top-left anchor, font, padding, line-height, rotation origin, and overflow contract. Keep background transparent and avoid a visible field rectangle.
4. Update the editor overlay to mirror the output typography and anchor contract at Fit and 100% zoom while preserving pointer/keyboard movement, selection, deletion, and direct font-size editing.
5. Add a formatted `Ngày cập nhật` row to each catalog card with stable empty/invalid-date handling and long-content-safe layout.
6. Add the configured-card `Tải lên mẫu` flow: select an `application/pdf` file, fetch current metadata, verify a saved layout exists, present `ConfirmModal`, then save with the card version, unchanged layout, and selected file.
7. Reload the catalog after success, expose loading/error state without duplicate submission, clear the file input so the same file can be selected again, and preserve permission behavior.
8. Extend focused tests for anchor parity, Vietnamese Unicode output, unchanged field payload during source replacement, date rendering, confirm/cancel, stale-version/error behavior, permission gating, and no regression to Edit/Delete/unconfigured upload.

## Verify

- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/pdf-template/PdfTemplateEditor.test.tsx src/components/pdf-template/PdfTemplateCatalog.test.tsx` => editor anchor and catalog replacement tests pass
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand pdf-template.spec.ts pdf-template-crud.spec.ts` => standard/Unicode geometry and versioned source replacement contracts pass
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles
- Manual A4 QA at Fit and 100% => the first glyph of `student.fullName` in editor, Preview, and downloaded KTX PDF starts at the same visual anchor within a 1 px/pt tolerance
- Manual catalog QA => configured card shows update date; replacing its PDF retains every field id, key, page, coordinate, size, and style; failed replacement leaves the active template unchanged
- `D:\PROJECT\manager_points` :: `git diff --check`, scoped diff review, and `git status --short` => no unintended changes

## Done

- A field placed in the editor no longer shifts because of hidden padding or alignment when Previewed or exported, for both Vietnamese Unicode and standard text.
- Fit/100% editor zoom changes display scale only and does not change the saved or rendered anchor.
- A configured template card has an accessible `Tải lên mẫu` action that requires confirmation and replaces only the source PDF through optimistic version control.
- Source replacement preserves the existing layout byte-for-byte at the API boundary except for server normalization that does not alter field values.
- Every card displays a localized update date or `Chưa cập nhật`.
- Focused frontend/backend checks and manual editor/Preview/export comparison pass.

## Gate

Stop for approval if accurate anchor parity requires rewriting persisted `x/y`, removing `width/height` from the schema, or changing the meaning of multi-line/wrapped fields. No gate is required for correcting renderer baseline math, ignoring hidden alignment for single-line text-only fields, reusing the existing versioned update endpoint, or displaying existing `updatedAt` data.
