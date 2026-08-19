# Taskscope: PDF Editor Scale, Geometry, and System UI Alignment

Task: `align-pdf-editor-canvas-and-simplify-system-ui` | Pipeline: full-stack PDF editor | Risk: high | Profile: Full

## Authority

Planning only. This scope does not authorize implementation.

## Objective

Make the uploaded PDF easy to edit at a predictable, preview-equivalent scale; keep field placement consistent through preview/export; and simplify the editor so its breadcrumb, command bar, buttons, and selects follow the existing dormitory UI system.

## Boundary

PDF-template editor route and UI, route-specific breadcrumb presentation, shared PDF renderer geometry, and focused tests. Preserve the catalog, permissions, layout/API schema, stored templates, KTX export workflow, backend fixture support, and unrelated navigation.

## Current Evidence

- PDF.js reads the real page dimensions correctly, but the editor renders `page.width * zoom` with a fixed default zoom of `1`. An A4 page therefore appears near 595 px wide instead of fitting the available workspace, while browser preview applies its own fit behavior.
- Field coordinates are normalized against the page, so the editor can use a computed fit scale without changing stored coordinates. Drag/resize math must use the same effective scale.
- The editor exposes `Snap`, `Grid`, and `Fixture` as operator controls. Grid is only a visual aid; Fixture selects synthetic preview data; Snap improves placement accuracy but does not need a visible toggle for the current workflow.
- The global breadcrumb renders every raw URL segment, producing `pdf-template / <templateTypeCode> / edit` instead of a short Vietnamese route trail.
- The editor still uses hand-styled native buttons and selects although shared `Button` and `Select` components already define the system control language used around the `Danh sách` tab navigation.
- Preview and KTX export share renderer behavior, so any remaining alignment offset must be corrected in the geometry contract rather than hidden with editor-only compensation.

## Decisions

- Default the canvas to `Fit page` within the actual editor viewport while preserving the PDF aspect ratio and source page dimensions. Recalculate on page change and container resize; never stretch width and height independently.
- Keep an explicit compact `Fit page / 100%` view control only if manual inspection at native scale is still needed. Do not keep the current 50%/100%/200% selector as the primary sizing model.
- Remove Grid and its state/rendering from the editor.
- Remove the visible Snap control but keep snapping enabled with the current normalized step for stable placement.
- Remove the visible Fixture selector. Preview uses one deterministic default fixture suitable for Vietnamese data; retain backend fixture variants for tests and API compatibility.
- Keep the page selector because uploaded templates can contain multiple pages.
- Present the edit breadcrumb as `Quản lý KTX / PDF / Sửa mẫu` and the new route as `Quản lý KTX / PDF / Thêm mẫu`; omit the raw template code and route token. `PDF` links back to the catalog.

## Targets

- `frontend/src/components/pdf-template/PdfTemplateEditor.tsx`
- `frontend/src/components/pdf-template/PdfTemplateEditorRoute.tsx`
- `frontend/src/components/pdf-template/PdfTemplateEditor.test.tsx`
- `frontend/src/components/ui/Breadcrumb.tsx`
- New focused breadcrumb test beside `Breadcrumb.tsx`
- `backend/src/pdf-template/pdf-template-renderer.service.ts`
- `backend/src/pdf-template/pdf-template.spec.ts`

## Steps

1. Define one placement contract: normalized `x/y/width/height` use a top-left page origin; page aspect ratio, padding, horizontal/vertical alignment, line height, rotation origin, and fitted font size produce equivalent bounds in editor, preview, and export.
2. Correct both pdf-lib and Unicode/browser renderer paths without rewriting persisted layouts or adding template-specific offsets. Add regression cases for left/center/right and top/middle/bottom placement on known page dimensions.
3. Add a measured canvas viewport and derive one effective display scale from the available width and height. Render the PDF canvas, overlays, drag deltas, resize deltas, grid-free workspace, and font labels from that scale. Refit on initial load, PDF replacement, page switch, and responsive container resize without layout jumps or distorted pages.
4. Simplify the command bar: remove Grid, visible Snap, and Fixture; retain the multi-page selector; make `Fit page` the default view; keep only Back, page/view controls, replace PDF, Preview, Save, and concise status feedback.
5. Replace hand-styled controls with the shared `Button` and `Select` components. Match the 41 px translucent surface, spacing, typography, border, active/hover/focus states, and responsive overflow of the `Danh sách` tab-navigation language while keeping actions as semantic buttons rather than fake tabs.
6. Optimize the PDF routes in `Breadcrumb` with a narrowly scoped route representation: human-readable Vietnamese labels, no raw collection code, correct catalog link, truncation on narrow widths, and no behavior change for unrelated routes.
7. Keep the prior save/leave safeguards: Save and dirty Back use `ConfirmModal`; clean Back navigates immediately; browser refresh/tab close uses native `beforeunload`; successful save clears dirty state.
8. Add focused tests for fit-scale calculation and resize, page aspect ratio, overlay/drag coordinate stability, removed controls, default preview fixture, shared control usage/behavior, compact breadcrumb links, command-bar actions, confirmation flows, and renderer geometry.

## Verify

- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand pdf-template.spec.ts` => renderer geometry regressions pass
- `D:\PROJECT\manager_points\backend` :: `npm run build` => backend compiles
- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/pdf-template/PdfTemplateEditor.test.tsx src/components/ui/Breadcrumb.test.tsx` => editor and breadcrumb behavior pass
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors
- Manual QA with A4 portrait, landscape, and multi-page PDFs at desktop and narrow widths => each page initially fits the workspace, retains its aspect ratio, remains scrollable at 100%, and field coordinates do not move when the viewport is resized
- Manual fixture QA with ASCII and Vietnamese values => editor boxes, Preview, and downloaded KTX PDF align within a small rendering tolerance with no systematic offset
- `D:\PROJECT\manager_points` :: `git diff --check`, scoped diff review, and `git status --short` => no unintended changes

## Done

- Uploaded PDFs open at a useful fit-to-workspace size matching preview proportions; no page is stretched, clipped without scrolling, or stored at display-specific coordinates.
- Field placement remains stable across fit view, 100% view, viewport resize, Preview, and KTX export.
- Grid, visible Snap, and Fixture controls are absent; snapping stays enabled; preview uses the default fixture; multi-page navigation remains available.
- Breadcrumbs show `Quản lý KTX / PDF / Sửa mẫu|Thêm mẫu` with working links and no raw route identifiers.
- Command-bar buttons and selects reuse system components and visually match the `Danh sách` tab-navigation family with accessible labels and visible keyboard focus.
- Existing ConfirmModal and unsaved-change behavior remains intact, and all focused checks pass.

## Gate

Implementation must stop for approval if geometry parity requires persisted-layout migration or coordinate rewriting. No gate for responsive display scaling, route-specific breadcrumb compaction, or UI simplification that preserves the current schema and saved values.
