# Taskscope: PDF Geometry Parity, Command Bar, and Save Guards

Task: `align-pdf-output-and-rework-editor-command-bar` | Pipeline: full-stack PDF editor | Risk: high | Profile: Full

## Authority

Planning only. This scope does not authorize implementation.

## Objective

Make field placement and alignment match between the editor, preview, and exported PDF; simplify the editor header into a PDF command bar; and protect save/leave actions with the correct confirmation UI.

## Boundary

PDF-template editor route, editor UI, PDF renderer geometry, and focused tests. Preserve the catalog, layout/API schema, permissions, KTX export workflow, stored templates, and unrelated dormitory navigation.

## Current Evidence

- The editor overlay always uses a vertically centered flex label, regardless of `style.verticalAlign`, so it does not represent rendered text placement.
- The pdf-lib renderer converts normalized top-left coordinates into PDF bottom-left coordinates, while the Unicode/browser renderer uses CSS top-left placement and does not implement the same vertical-alignment calculation. Rotation origins also differ.
- Preview and KTX export share the renderer, so the geometry contract must be fixed in the engine, not hidden with editor-only offsets.
- `PdfTemplateEditorRoute` renders a separate Back/title/metadata banner above the editor. Save and Back currently use `window.confirm`; refresh protection already relies on `beforeunload`.

## Targets

- `frontend/src/components/pdf-template/PdfTemplateEditorRoute.tsx`
- `frontend/src/components/pdf-template/PdfTemplateEditor.tsx`
- `frontend/src/components/pdf-template/PdfTemplateEditor.test.tsx`
- New focused route test beside `PdfTemplateEditorRoute.tsx`, if needed
- `backend/src/pdf-template/pdf-template-renderer.service.ts`
- `backend/src/pdf-template/pdf-template.spec.ts`

## Steps

1. Define one placement contract: normalized `x/y/width/height` use a top-left page origin; padding, horizontal/vertical alignment, line height, rotation origin, and fitted font size produce equivalent bounds in the editor, pdf-lib, and Unicode/browser paths.
2. Extract or centralize deterministic placement calculations in the renderer. Correct both render paths without migrating persisted layouts or adding compatibility offsets, and add regression cases for left/center/right plus top/middle/bottom on known page dimensions.
3. Make the editor overlay honor the same geometry/alignment contract. Keep the field key recognizable, but do not center it in a way that falsely represents exported placement.
4. Remove the standalone `Quay lại catalog / Sửa mẫu PDF / metadata` banner. Move Back into a compact local PDF command bar and redesign all editor commands using `TabNavigation` as the visual reference: 41 px rhythm, translucent surface, bottom border, compact grouping, clear hover/active/focus states, responsive overflow, and semantic buttons/labels. Do not turn command actions into fake tabs.
5. Replace Save's `window.confirm` with the shared `ConfirmModal`. Use the same modal before Back when dirty; skip confirmation when clean. Keep unsaved state intact on cancel and disable duplicate actions while saving.
6. Keep native `beforeunload` protection for browser refresh, tab close, and hard navigation while dirty; clear the dirty guard after a successful save. A custom `ConfirmModal` is not used for refresh because browsers only permit their native unload prompt.
7. Add focused frontend tests for the command bar, Back placement, clean/dirty Back behavior, Save confirmation/cancel/pending/success, and `beforeunload`; retain existing preview/resize coverage.

## Verify

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand pdf-template.spec.ts` => renderer geometry regressions pass
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles
- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/pdf-template/PdfTemplateEditor.test.tsx` plus the focused route test => editor and navigation tests pass
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors
- Manual fixture QA with ASCII and Vietnamese values at 50%, 100%, and 150% zoom => editor boxes, preview text, and downloaded KTX PDF align within a small rendering tolerance and show no systematic offset
- `D:\PROJECT\manager_points` :: `git diff --check`, scoped diff review, and `git status --short` => no unintended changes

## Done

- A field placed and aligned in the editor renders at the same normalized bounds in preview and KTX export for both renderer paths.
- No persisted-layout migration or per-template offset workaround is introduced.
- The separate editor heading strip is gone; Back and PDF commands live in the redesigned local command bar modeled on the system tab-navigation language.
- Save and dirty Back use `ConfirmModal`; cancel preserves edits; successful save clears dirty state; refresh/close while dirty triggers the native browser warning.
- Focused tests, builds/typecheck, manual geometry QA, and final diff checks pass.

## Gate

Implementation must stop for approval if correcting existing saved templates requires data migration or coordinate rewriting. No gate for renderer/UI corrections that preserve the current layout schema.
