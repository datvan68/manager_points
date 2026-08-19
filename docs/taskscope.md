# Taskscope: Text-Only PDF Fields and Shared Select Controls

Task: `simplify-pdf-fields-and-standardize-selects` | Pipeline: full-stack PDF editor | Risk: high | Profile: Full

## Authority

Planning only. This scope does not authorize implementation.

## Objective

Make PDF-template fields behave as simple movable text labels with direct font-size control, while preserving export compatibility and replacing every native editor select with the existing system `Select` component.

## Boundary

PDF-template editor canvas, field property panel, shared Select compatibility/accessibility, renderer geometry regression coverage, and focused tests. Preserve the catalog, permissions, source-upload flow, page/view controls, saved template schema, KTX export workflow, and unrelated forms using the shared Select.

## Current Evidence

- A canvas field is currently an absolute rectangular box with border, background, selected ring, shadow, and 4 corner resize handles.
- Pointer state supports both `move` and `resize`; resize changes normalized `width/height` and scales `fontSize`. Existing editor tests explicitly require this behavior.
- The property panel exposes raw geometry plus Formatter, horizontal/vertical alignment, Overflow, and Font size. The requested editing workflow only needs placement, deletion, and readable text-size adjustment.
- `width` and `height` remain required by the API validator and both PDF render paths. Removing them from persisted layouts would require a schema migration and could break saved templates.
- `PdfTemplateEditor.tsx` contains 5 native `<select>` controls: PDF page, Formatter, horizontal alignment, vertical alignment, and Overflow. None currently uses the shared `Select` primitives.
- The shared `Select` exists, but its trigger/item interactions are div-based and the trigger does not currently forward all supplied accessibility props. Replacing native selects without focused compatibility checks would reduce keyboard and labeling quality.

## Decisions

- Keep drag-to-move, click/tap selection, arrow-key movement, and Delete-key removal.
- Remove all resize handles, resize pointer state, resize calculations, resize cursors, and font scaling tied to box height.
- Render each field as text only: transparent background, no border, ring, rectangle, or persistent box decoration. Show selection through text color/weight or another glyph-only treatment that does not draw a surrounding rectangle.
- Keep normalized `width/height` and the complete style object internally for API and renderer compatibility. Do not rewrite existing layouts or change the public schema.
- Make Font size the only directly editable visual sizing control. Keep field deletion. Hide raw geometry and advanced style controls from the normal property panel; use existing/default stored values internally.
- Add new fields with deterministic text-safe defaults: transparent background, single-line text behavior, and stable internal bounds. Existing fields retain their stored output values unless the user changes font size or position.
- Replace every native select remaining in the editor with the shared `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem` primitives. After the property-panel simplification, the page selector is required; retain any other select only when its feature remains visible.
- Apply only backward-compatible Select improvements needed for semantic labeling, visible focus, keyboard open/navigation/selection, Escape close, and prop forwarding. Do not redesign unrelated consumers.

## Targets

- `frontend/src/components/pdf-template/PdfTemplateEditor.tsx`
- `frontend/src/components/pdf-template/PdfTemplateEditor.test.tsx`
- `frontend/src/components/ui/select.tsx`
- Focused shared Select test beside `select.tsx`
- `backend/src/pdf-template/pdf-template-renderer.service.ts`
- `backend/src/pdf-template/pdf-template.spec.ts`

## Steps

1. Define the text-only field interaction contract: text is the visible and draggable target; selection is glyph-only; keyboard movement/deletion remains available; no resize gesture or rectangular decoration is rendered.
2. Remove `Handle`, `resizeField`, resize pointer branches, corner-handle constants/markup, and resize-derived font updates from the editor. Keep the generic geometry helper untouched if it remains independently tested or used outside this editor.
3. Simplify the selected-field panel to the field identity, Font size, and Delete action. Remove visible geometry, alignment, formatter, and overflow controls while retaining their stored values in save payloads.
4. Ensure new fields receive text-safe internal dimensions and style defaults without changing the API schema. Confirm that moving or changing font size mutates only the intended coordinates/style property.
5. Keep editor, Preview, and exported PDF text anchors aligned even though the editor no longer visualizes the internal box. Do not compensate with template-specific offsets or persisted-coordinate rewrites.
6. Replace the PDF page native select, plus any remaining visible editor selects, with the shared Select primitives. Provide explicit Vietnamese labels, selected-value display, stable option values, and compact styling consistent with the `Danh sách` tab-navigation family.
7. Harden the shared Select only where required: forward supported trigger props, expose combobox/listbox semantics, support keyboard navigation and selection, preserve visible focus, and avoid regressions for existing consumers.
8. Rewrite focused tests: remove resize expectations; assert zero resize handles and no field rectangle classes; verify drag/keyboard movement, font-size edits, deletion, saved schema preservation, shared Select usage/behavior, and renderer geometry.

## Verify

- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/pdf-template/PdfTemplateEditor.test.tsx src/components/ui/select.test.tsx` => text-only field and shared Select behavior pass
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand pdf-template.spec.ts` => existing layout and renderer compatibility pass
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles
- Manual keyboard QA => page Select opens, navigates, selects, and closes by keyboard; field text can be selected, moved, font-sized, and deleted without resize affordances
- Manual A4 portrait/landscape QA => canvas shows only field text; Preview and downloaded KTX PDF retain the saved position and font size without a systematic offset
- `D:\PROJECT\manager_points` :: `git diff --check`, scoped diff review, and `git status --short` => no unintended changes

## Done

- Canvas fields display as text only with no surrounding rectangle, background, ring, shadow, or resize handle in normal, hover, selected, and keyboard-focus states.
- Fields can still be positioned by pointer and keyboard; Font size remains editable; resize is unavailable by pointer and keyboard.
- Saving preserves required internal `width/height` and hidden style values, so existing templates and the KTX PDF engine require no migration.
- No native `<select>` remains in `PdfTemplateEditor.tsx`; every retained choice control uses the shared Select component with labels, visible focus, and keyboard operation.
- Focused frontend/backend checks and manual editor/preview/export comparison pass.

## Gate

Implementation must stop for approval if text-only behavior requires removing `width/height` from the persisted schema, rewriting saved coordinates, or changing output formatting for existing templates. No gate for removing editor-only resize/decorations, hiding advanced controls, or making backward-compatible shared Select improvements.
