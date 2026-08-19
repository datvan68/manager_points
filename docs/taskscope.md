# Taskscope: Upgrade the Dormitory PDF Template Experience

Task: `upgrade-dormitory-pdf-template-editor` | Pipeline: frontend UI | Risk: medium | Profile: Full

## Authority

Planning only. This scope does not authorize implementation, deletion, deployment, or persistent-data changes.

## Objective

Make PDF template deletion use the shared confirmation modal and redesign the complete edit experience so operators can upload a PDF, place fields, and resize field boxes easily without changing the PDF engine or API contract.

## Current Evidence

- Catalog deletion currently uses both `window.confirm` and `window.prompt`.
- The active editor supports moving field boxes but renders no resize handles.
- The field palette is capped at `max-h-80`, leaving a large unused area in the sidebar.
- Catalog cards already distinguish `Tải PDF lên` and `Chỉnh sửa`; these routes can be retained and clarified.

## Scope

### Catalog deletion and actions

- Replace native delete confirmation and template-code prompt with `ConfirmModal` using the `danger` variant.
- Store the selected template as modal state. Cancel performs no mutation; confirm calls delete once with the current version, then closes and reloads on success.
- Disable duplicate actions while deletion is pending and expose the API error without requesting typed confirmation.
- Keep permission guards and card actions: unconfigured templates show `Tải mẫu lên`; configured templates show `Chỉnh sửa mẫu` and permitted `Xóa`.

### Editor redesign

- Redesign the route header, document toolbar, PDF canvas, field palette, properties panel, messages, preview, and save actions using the existing UI system.
- Keep upload/replace PDF as a visible primary document action. After a valid PDF is selected, operators edit that template by adding registered fields from the palette.
- On desktop, make the workspace use the available viewport height. The field sidebar must stretch to the bottom of the workspace; its field list and properties area scroll internally instead of stopping at a fixed short height.
- On smaller screens, stack controls and panels without blocking vertical or canvas scrolling.
- Preserve source loading/error/retry, page/zoom, grid/snap, fixture preview, validation, conflict handling, dirty-state protection, save/create behavior, and `returnTo` navigation.

### Field resize interaction

- Show four visible corner handles (`nw`, `ne`, `sw`, `se`) on the selected field box.
- Support pointer resize in every direction with pointer capture, zoom-independent normalized coordinates, snap behavior, a practical minimum size, and clamping inside page bounds.
- Prevent resize gestures from triggering field movement. Keep numeric width/height controls as the keyboard-accessible alternative and provide visible focus states and labels for handles.

## Targets

- `frontend/src/components/pdf-template/PdfTemplateCatalog.tsx`
- `frontend/src/components/pdf-template/PdfTemplateCatalog.test.tsx`
- `frontend/src/components/pdf-template/PdfTemplateEditorRoute.tsx`
- `frontend/src/components/pdf-template/PdfTemplateEditor.tsx`
- `frontend/src/components/pdf-template/PdfTemplateEditor.test.tsx`
- Existing geometry helpers under `frontend/src/components/dormitory/pdf-template/` may be reused or relocated within the PDF-template module, with their focused tests updated if touched.

## Out of Scope

Backend/API/schema changes, PDF rendering/export engine changes, template migration, new dependencies, redesign of the catalog cards beyond action labels, replacement of non-delete confirmation flows, and unrelated worktree changes.

## Verify

- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/pdf-template/PdfTemplateCatalog.test.tsx src/components/pdf-template/PdfTemplateEditor.test.tsx src/components/dormitory/pdf-template/PdfTemplateDesigner.test.tsx`
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck`
- `D:\PROJECT\manager_points` :: `git diff --check` and scoped diff review
- Visual QA at desktop and mobile widths: upload/edit actions remain reachable, the palette fills the workspace, canvas/page scrolling works, and all four resize handles remain usable.

## Done

- Delete uses `ConfirmModal`; no name/code input or native prompt appears.
- Upload and edit actions route to the existing new/edit flows and respect permissions.
- The editor has a cohesive responsive layout with no unused palette column below the short field list.
- A selected field resizes correctly from all four corners at every supported zoom and cannot leave the PDF page.
- Focused tests, typecheck, and final diff checks pass with no unintended changes.

## Gate

None for a later frontend-only implementation request. Stop if implementation requires changing the upload/save API, persisted layout format, or PDF engine behavior.
