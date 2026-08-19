# Taskscope: Redesign Dormitory PDF Catalog as Cards

Task: `redesign-dormitory-pdf-catalog-cards` | Pipeline: frontend UI | Risk: medium | Profile: Quick

## Authority

Planning only. This scope does not authorize implementation, deletion, deployment, or persistent-data changes.

## Objective

Rewrite `/dormitory/pdf-template` as a simple responsive card catalog consistent with the existing UI system. Each registered PDF type shows only its name, configuration status, and permitted actions.

## Boundary

- Replace the current filter panel, wide table, visible pagination, and header collection dropdown in `frontend/src/components/pdf-template/PdfTemplateCatalog.tsx`.
- Render one card per registered Dormitory PDF type, ordered by display name, with:
  - template name;
  - status badge: `Đã tải lên` or `Chưa tải lên`;
  - configured actions: `Chỉnh sửa`, plus `Xóa` when permitted;
  - unconfigured action: `Tải PDF lên`.
- `Tải PDF lên` navigates to the existing `/dormitory/pdf-template/new?templateTypeCode=...` flow; that screen remains responsible for selecting and saving the PDF file.
- Load all matching catalog pages without exposing pagination UI; fetch remaining pages in parallel after the first response.
- Preserve loading, empty, error/retry states, permission guards, delete confirmation/version checks, `returnTo`, and vertical scrolling.

## Targets

- `frontend/src/components/pdf-template/PdfTemplateCatalog.tsx`
- `frontend/src/components/pdf-template/PdfTemplateCatalog.test.tsx`

## Out of Scope

Editor redesign, backend/API/schema changes, direct upload from the catalog, route changes, PDF engine behavior, saved-template migration, and unrelated worktree changes.

## Verify and Done

- `D:\PROJECT\manager_points\frontend` :: `npm test -- src/components/pdf-template/PdfTemplateCatalog.test.tsx`
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck`
- `D:\PROJECT\manager_points` :: `git diff --check` and scoped diff review
- Done when the page has no table/filter/dropdown/pagination UI; cards expose only name, status, and permission-aware buttons; upload/edit/delete routes and states behave as specified on mobile and desktop.

## Gate

None for a later frontend-only implementation request. Preserve all existing backend and Dormitory layout edits; stop if implementation requires changing the upload API or editor contract.
