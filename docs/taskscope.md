# Task Identity and Pipeline

- Task: `hide-dormitory-contract-tab-and-export-multi-roster-pdf`
- Pipeline: `feature_development`
- Profile: Full, planning-only
- Rules/protocol: 3.2.0
- Repository: `D:\PROJECT\manager_points`
- Branch/base commit: `main` / `60e3ba1b95519fa45c4505f3f628e5c6224a0982`
- Base state: clean before this taskscope update.

## Risk Level

- Risk: high.
- Environment: development.
- Evidence: the behavior spans the Next.js UI/API client and NestJS PDF endpoint/service, processes multiple student records, and can create a resource-intensive document.
- Reversibility: source-only changes are Git-reversible; no persistent data mutation is required.
- Blast radius: Dormitory navigation and PDF export from the Dormitory **Roster** page.

## Objective

Remove **Contracts** from the Dormitory tab bar and allow authorized users to preview and download one combined PDF containing every selected student on the **Roster** page.

## Scope Boundaries

- Approved boundaries: `frontend/src/app/(dashboard)/dormitory/**`, `frontend/src/api/dormitory-api.ts`, `backend/src/dormitory/**`, and `docs/taskscope.md`.
- Expected write paths:
  - `frontend/src/app/(dashboard)/dormitory/layout.tsx`
  - `frontend/src/app/(dashboard)/dormitory/layout.test.tsx`
  - `frontend/src/app/(dashboard)/dormitory/roster/page.tsx`
  - `frontend/src/app/(dashboard)/dormitory/roster/page.test.tsx`
  - `frontend/src/api/dormitory-api.ts`
  - `backend/src/dormitory/controllers/dormitory-roster.controller.ts`
  - `backend/src/dormitory/services/dormitory-roster.service.ts`
  - `backend/src/dormitory/services/dormitory-roster.service.spec.ts`
  - `backend/src/dormitory/dto/bulk-roster-pdf.dto.ts` (new)
- Excluded boundaries: contract routes/pages/services/data, PDF Template Designer behavior, permission registry, deployment, migrations, and unrelated navigation or exports.

## Out of Scope

- Do not delete or disable `/dormitory/contracts` or its backend APIs; remove only the shared navigation tab.
- Do not alter contract-dependent room assignment, invoices, reports, or roster deletion protection.
- Do not change the content/layout of an individual student's application PDF.
- Do not export records outside the IDs explicitly selected by the user.

## Context and Dependencies

- `baseDormitoryTabs` currently contains `{ id: 'contracts', href: '/dormitory/contracts', label: 'Hợp đồng' }`.
- The Roster page already has checkbox selection and a `FloatingActionBar`, but `selectedPdfRosterEntry` rejects every selection whose length is not exactly one.
- The frontend currently calls `GET /dormitory/roster/:id/application-pdf`; the backend renders one application PDF through `DormitoryRosterService.generateApplicationPdf` and `pdf-lib` is already installed.
- The largest existing Roster page size is 100. The bulk contract will accept 1–100 unique Mongo IDs, preserving request order and bounding render cost.
- The existing `DORM_REG_READ` permission remains the authorization boundary for both single and bulk PDF exports.

## Steps

1. Capture focused frontend and backend test baselines.
2. Remove the Contracts entry from `baseDormitoryTabs`; keep remaining tabs, conditional PDF tab, active-tab resolution, and direct child rendering intact.
3. Add `BulkRosterPdfDto` validating a non-empty, unique list of 1–100 Mongo IDs.
4. Add `POST /dormitory/roster/application-pdf/bulk` before dynamic `:id` routes, guarded by `DORM_REG_READ`, returning an inline or attachment PDF with safe response headers.
5. Refactor/reuse the existing single-record renderer, render the requested entries in input order, copy all pages into one `PDFDocument`, and return a stable bulk filename. Reject an invalid or missing entry without returning a partial document.
6. Add a typed frontend API method for the bulk endpoint. Update Roster preview/download state to work with one or many selected rows; send one ID through the existing endpoint and two or more IDs through the bulk endpoint.
7. Keep the selected-count action bar and delete behavior unchanged. Disable duplicate export clicks while loading, clean up object URLs, and surface validation/render failures without clearing selection.
8. Add regression coverage and run affected tests, typecheck/builds, and final diff review.

## Acceptance Criteria

- AC-01: **Contracts** is absent from Dormitory tabs for every permission set; remaining navigation and the conditional **PDF** tab still work.
- AC-02: Visiting `/dormitory/contracts` directly still renders its child route; contract frontend/backend implementation is not removed or modified.
- AC-03: Selecting one student retains the current preview/download result and single-PDF API behavior.
- AC-04: Selecting 2–100 visible students enables **Export selected PDF** and makes one bulk request containing their unique IDs in deterministic selection/list order.
- AC-05: The combined response is a valid PDF whose page count and page order equal the concatenation of the selected students' rendered PDFs; no student's pages are omitted or overwritten.
- AC-06: The bulk endpoint requires `DORM_REG_READ`, validates 1–100 unique Mongo IDs, and rejects invalid/missing records without returning a partial PDF.
- AC-07: Preview, retry, download, loading state, filename, object-URL cleanup, and readable error feedback work for multi-selection without changing deletion or selection behavior.
- AC-08: Individual PDF field values and PDF Template Designer integration remain unchanged.
- AC-09: Focused frontend/backend tests, frontend typecheck, and affected builds pass.

## Verification

- `D:\PROJECT\manager_points\frontend` :: `npm test -- --run "src/app/(dashboard)/dormitory/layout.test.tsx" "src/app/(dashboard)/dormitory/roster/page.test.tsx"` => tab removal and single/multi-selection export behaviors pass.
- `D:\PROJECT\manager_points\backend` :: `npm test -- --runInBand dormitory/services/dormitory-roster.service.spec.ts` => single render and ordered multi-PDF merge/validation behavior pass.
- `D:\PROJECT\manager_points\frontend` :: `npm run typecheck` => no TypeScript errors.
- `D:\PROJECT\manager_points\frontend` :: `npm run build` => Next.js build passes.
- `D:\PROJECT\manager_points\backend` :: `npm run build` => NestJS DTO/controller/service build passes.
- `D:\PROJECT\manager_points` :: `git diff --check` and `git status --short` => no whitespace errors or unintended paths.

## Safety Gates

- Implementation and automated verification require a separate implementation request because this task is planning-only.
- Human Gate: None. The planned feature reads existing records and creates an in-memory/downloaded PDF; it does not mutate persistent or production data.
- Stop and amend scope if implementation requires changing permissions, PDF templates, contract data/routes, persistent storage, deployment, or a limit beyond the verified 100-row page boundary.

## Artifacts and Checkpoints

- Task artifact: `docs/taskscope.md`.
- Review evidence: focused test outputs, build/typecheck results, and final diff/status.
- Checkpoint: base commit plus final scoped diff; no intermediate planning checkpoint required.
- Effective Rules Manifest (SHA-256):
  - `safety.md`: `6a3f283b835394b1af1f6380d94cba260acbed8a60d3065dd5365bb15806a772`
  - `global.md`: `67806f70a5f89adf42e3be88413cc76cc27a02c90fad0609ae71de34d046a43f`
  - `antigravity-operating-contract.md`: `51f3677c7e44121529cc0a4b17e5667bcbd2147ee63c6f30207c10d5deb51790`
  - `orchestrator.md`: `b782109e896b2fa48a6523358a788a9db9b81b72f3d8fc66f70019395738d716`
  - `pipeline.md`: `0419c072380887f96b37fe4eb48dae764306f46fb03190b176a43ebcea3f41f3`

## Execution Budgets

- Step deadline: 600 seconds; maximum 1,800 seconds for PDF/build verification.
- Concurrency: one writer per path; serialize shared frontend/backend edits.
- Idempotent retries: 2; engineering loops: 3; review remediation cycles: 2.
- Stop on scope expansion, permission/contract behavior changes, persistent-data mutation, or unrelated failures.
