# Taskscope: Consolidate PDF Template UI into Dormitory Navigation

## Task Identity and Pipeline

- Task ID: `consolidate-pdf-template-ui-into-dormitory`.
- Pipeline: frontend route consolidation; profile/protocol: Full / 3.2.0; environment: development.
- Repository: `D:\PROJECT\manager_points`, branch `main`.
- Planning authority only: this taskscope does not authorize implementation, source deletion, deployment, database changes, or permission assignment.

## Risk Level

- Risk: medium.
- Reason: the task removes three standalone Next.js route pages and changes shared navigation paths used by the PDF catalog/editor. The backend PDF engine, persistence, and KTX export behavior remain unchanged.

## Objective

Remove the standalone `/pdf-templates` user interface and restore a permission-aware `PDF` tab in the Dormitory `TabNavigation`. All PDF template management UI must live under `/dormitory/pdf-template/**`, while the shared frontend components and backend PDF engine continue serving KTX.

## Scope Boundaries

### Approved frontend changes

- Restore the `PDF` tab in `frontend/src/app/(dashboard)/dormitory/layout.tsx`, targeting `/dormitory/pdf-template`.
- Show the tab only to users with `PDF_TEMPLATE_READ`, and keep it active for all nested PDF routes.
- Keep `frontend/src/app/(dashboard)/dormitory/pdf-template/page.tsx` as the KTX PDF catalog entry point.
- Add KTX-owned editor routes:
  - `frontend/src/app/(dashboard)/dormitory/pdf-template/new/page.tsx`.
  - `frontend/src/app/(dashboard)/dormitory/pdf-template/[templateTypeCode]/edit/page.tsx`.
- Parameterize the shared catalog/editor route base so Add, Edit, Save, Cancel, and Back stay under `/dormitory/pdf-template/**` and preserve the existing `returnTo` query state.
- Scope the KTX catalog to Dormitory-owned PDF collections so unrelated modules are not exposed in the Dormitory tab.
- Remove the standalone route page files:
  - `frontend/src/app/(dashboard)/pdf-templates/page.tsx`.
  - `frontend/src/app/(dashboard)/pdf-templates/new/page.tsx`.
  - `frontend/src/app/(dashboard)/pdf-templates/[templateTypeCode]/edit/page.tsx`.
- Add permanent redirects in `frontend/next.config.js` from the three legacy URL shapes to their Dormitory equivalents. Redirects replace the old UI; they do not preserve a standalone module.
- Update focused tests for Dormitory navigation, KTX PDF routes, shared catalog/editor navigation, legacy redirects, and the absence of the sidebar item.

### Retained without behavioral redesign

- `frontend/src/components/pdf-template/**`: shared catalog/editor/designer implementation.
- `frontend/src/api/pdf-template-api.ts`: existing PDF template API client.
- `backend/src/pdf-template/**`: registry, validation, storage, renderer, controllers, and permissions.
- `backend/src/dormitory/pdf-template-adapter.ts` and KTX roster PDF generation services.
- Existing template records and the one-template-per-`templateTypeCode` model.

## Out of Scope

- Deleting the shared PDF components, API client, backend PDF module, database schema, template records, permissions, renderer, or KTX adapter.
- Changing PDF upload, layout design, save/delete semantics, validation, storage, or rendering.
- Adding multiple templates per collection, version history, draft/publish workflow, or a template chooser during KTX roster export.
- Changing roster selection/export, merging multiple PDFs, ZIP export, backend endpoints, permission seeds, database migrations, or deployment.
- Redesigning unrelated Dormitory tabs, the sidebar, or other modules.

## Context and Dependencies

- The standalone UI currently exists at `/pdf-templates`, `/pdf-templates/new`, and `/pdf-templates/:templateTypeCode/edit`.
- The KTX catalog route already exists at `/dormitory/pdf-template`, but the Dormitory tab is absent.
- Git history shows the previous Dormitory tab used `/dormitory/pdf-template`; this task restores that ownership with the requested label `PDF`.
- `PdfTemplateCatalog.tsx` and `PdfTemplateEditorRoute.tsx` currently hard-code `/pdf-templates`; they must accept a route base before the standalone pages are removed.
- The main sidebar currently has no `/pdf-templates` item; implementation must preserve that state.

## Steps

1. Baseline the existing Dormitory layout, standalone routes, KTX catalog route, shared catalog/editor navigation, permissions, and focused tests.
2. Add a permission-aware `PDF` tab to the Dormitory layout and make nested `/dormitory/pdf-template/**` routes activate it.
3. Parameterize shared PDF catalog/editor navigation and constrain the Dormitory catalog to KTX-owned collections.
4. Add the KTX new/edit route pages and verify Add, Edit, Save, Cancel, Back, and `returnTo` navigation never leave the Dormitory route family.
5. Add legacy redirects for list, new, and edit URLs, preserving query parameters.
6. Delete only the three standalone `/pdf-templates` page files listed in scope.
7. Update focused tests, run frontend type/build checks, then review the final diff and status for unintended changes.

## Acceptance Criteria

- AC-01: Users with `PDF_TEMPLATE_READ` see a `PDF` tab in Dormitory; users without it do not.
- AC-02: `/dormitory/pdf-template` and its new/edit descendants keep the `PDF` tab active.
- AC-03: The KTX PDF page supports list, Add, Edit, Save, Cancel, and Back without navigating to `/pdf-templates`.
- AC-04: The KTX catalog exposes only Dormitory/KTX template collections, not collections belonging to unrelated modules.
- AC-05: The three standalone `/pdf-templates` page files are deleted and no sidebar item points to `/pdf-templates`.
- AC-06: Legacy list/new/edit URLs redirect to equivalent `/dormitory/pdf-template/**` URLs and preserve query parameters.
- AC-07: Shared PDF components, API client, backend engine, saved template data, and KTX PDF generation remain present and compatible.
- AC-08: No backend endpoint, schema, permission seed, database record, or KTX roster export behavior changes.
- AC-09: Focused tests, frontend typecheck, production build, `git diff --check`, and scoped diff review pass.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- "src/app/(dashboard)/dormitory/layout.test.tsx" "src/app/(dashboard)/dormitory/pdf-template" "src/components/pdf-template" "src/components/layout/Sidebar.test.tsx"` => permission visibility, active tab, route navigation, KTX filtering, and sidebar absence pass.
- `D:\PROJECT\manager_points\frontend` :: focused test or config inspection for `next.config.js` redirects => all three legacy URL shapes map to KTX equivalents with query preservation.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => TypeScript passes.
- `D:\PROJECT\manager_points\frontend` :: `npm run build` => Next.js production routes and redirects compile.
- Manual route checks: `/dormitory/pdf-template`, `/dormitory/pdf-template/new?templateTypeCode=...`, and `/dormitory/pdf-template/:templateTypeCode/edit` => correct tab state and no navigation back to the legacy module.
- `D:\PROJECT\manager_points` :: `git diff --check`, `git status --short`, and final scoped diff review => only approved files changed and no generated/user-owned file is overwritten.

## Safety Gates

- No Human Gate is required for development-only, git-recoverable deletion of the three explicitly listed route page files after a separate implementation request.
- Stop and amend scope if implementation requires deleting shared PDF components/engine, changing backend contracts or persistence, modifying permissions, migrating data, or changing KTX roster export behavior.
- Preserve unrelated working-tree edits and generated-file ownership; do not overwrite `frontend/next-env.d.ts` if it is modified outside this task.

## Artifacts and Checkpoints

- Before deletion: record the exact standalone route files and confirm replacement KTX routes compile.
- After route consolidation: record focused test results and inspect all remaining `/pdf-templates` references; only API endpoint strings and intentional legacy redirects may remain.
- Final checkpoint: confirm the retained shared engine paths and KTX adapter are unchanged except for approved frontend route-base wiring.

## Execution Budgets

- Order: baseline -> tab -> route-base wiring -> KTX new/edit routes -> redirects -> standalone page deletion -> tests/build -> final review.
- Maximum one writer per file; preserve unrelated edits.
- Engineering loops: 3; review/remediation cycles: 2.
- Stop on scope expansion, unintended backend/persistence impact, or inability to retain the KTX PDF engine.
