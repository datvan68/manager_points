# Task Identity and Pipeline

- Task: `grading-wide-export-student-affiliation-and-action-ui`
- Pipeline: `bug_fix`; Profile: **Full**; rules version `3.2.0`.
- Repository: `D:\PROJECT\manager_points`; environment: development; base state: `main@7a2eeb89`.
- Authority: planning-only. This taskscope does not authorize implementation.

# Risk Level

- **High**: faculty/all exports span multiple classes and departments and therefore require data-scope and authorization regression coverage.
- Reversible through Git; no database mutation, migration, deployment, or external communication.

# Objective

Make each student in an Admin faculty/all Excel export identifiable by both class and department, and restyle the `Xác nhận` and `Xuất Excel` controls to match the neutral glass filter UI shown in the supplied reference image without changing their behavior.

# Scope Boundaries

- Approved/write: `frontend/src/app/(dashboard)/grading/**` and `backend/src/summaries-point/**`.
- Known implementation targets:
  - `frontend/src/app/(dashboard)/grading/page.tsx`
  - `frontend/src/app/(dashboard)/grading/page.test.tsx`
  - `backend/src/summaries-point/summaries-point.service.ts`
  - `backend/src/summaries-point/export/pl03-summary-excel.service.ts`
  - `backend/src/summaries-point/export/pl03-summary-excel.service.spec.ts`
  - `backend/src/summaries-point/test/summaries-point.service.spec.ts`
- Excluded: files outside these module boundaries.

# Out of Scope

- No API route/DTO shape, role catalog, database schema, stored data, pagination behavior, unrelated grading tabs, deployment, or Git-history changes.
- Do not redesign the export popover or the rest of the filter bar beyond adjustments required to keep the two action controls visually consistent and responsive.

# Context and Dependencies

- `page.tsx` already defaults pagination to 40 and supports Admin scopes `class | faculty | all`.
- The current wide export fetches only `full_name` and `student_code`; the workbook table has no per-row class or department fields. Its header-level class/department labels are generic for faculty/all exports.
- The export generator uses a seven-column PL03 layout and receives summaries plus aggregate class/department metadata.
- The two current actions use blue/emerald tinted treatments, while the reference uses a neutral translucent light surface, white border, dark text, rounded corners, and subtle shadow consistent with the adjacent filters.
- Existing backend authorization remains authoritative: only Admin may export `faculty` or `all`; existing allowed class exports must remain unchanged.

# Steps

1. Establish regression baselines for wide-scope query population, workbook cells, authorization, action states, and responsive layout.
2. Enrich exported student records with their class and department using existing model relations; avoid per-student queries and preserve semester/scope filtering.
3. Pass explicit export scope/affiliation data into the workbook generator. For `faculty` and `all`, add per-row `LỚP` and `KHOA` columns and update merges, borders, widths, statistics, and signature ranges accordingly. Preserve the existing class-scope PL03 layout.
4. Restyle `Xác nhận` and the Admin `Xuất Excel` trigger to the same neutral glass control language as the reference/filter inputs while retaining labels/icons, loading indicators, disabled rules, popover behavior, titles, keyboard focus, and touch usability.
5. Add focused frontend/backend regression tests, run affected checks, independently review authorization/data isolation, and inspect the final diff.

# Acceptance Criteria

- **AC1:** Every populated row in Admin `faculty` and `all` workbooks shows the correct non-generic class name and department name for that student; students from different affiliations are distinguishable in the same file.
- **AC2:** `class` export keeps its existing seven-column PL03 presentation and correct header metadata; score, rank, approval note, statistics, and filename behavior do not regress for any scope.
- **AC3:** Faculty export contains only students in the selected department, all export is still semester-bound, and non-Admin `faculty/all` requests remain forbidden server-side.
- **AC4:** `Xác nhận` and `Xuất Excel` visually match the adjacent neutral glass filters/reference (height, rounded shape, translucent light background, border, dark text, and subtle shadow) on desktop and responsive layouts, with clear loading/disabled/focus states.
- **AC5:** The existing Admin export-scope popover and confirmation flow work unchanged; pagination remains at its current 40-row default; no unintended files change.

# Verification

- `D:\PROJECT\manager_points\frontend :: npm test -- "src/app/(dashboard)/grading/page.test.tsx"` => action behavior/states and existing export request tests pass.
- `D:\PROJECT\manager_points\frontend :: npm run typecheck` => no new TypeScript errors.
- Responsive visual inspection of `Rèn luyện > Danh sách` at desktop and narrow viewport => AC4, without clipping or overlap.
- `D:\PROJECT\manager_points\backend :: npm test -- --runInBand summaries-point/export/pl03-summary-excel.service.spec.ts summaries-point/test/summaries-point.service.spec.ts` => AC1-AC3 workbook, query, and authorization regressions pass.
- `D:\PROJECT\manager_points\backend :: npm run build` => Nest build passes.
- `D:\PROJECT\manager_points :: git diff --check -- docs/taskscope.md` and final `git status --short`/diff inspection => valid taskscope now; implementation phase must remain within the declared boundary.

# Safety Gates

- None for planned development changes. Stop and request approval if implementation requires permission-model changes, real student-data handling, migration, deployment, or any boundary expansion.

# Artifacts and Checkpoints

- Required implementation evidence: focused test outputs, typecheck/build results, sanitized workbook assertions for at least two classes and two departments, responsive UI screenshots, authorization review, and final diff/status.
- Material Full checkpoint: implementation diff plus current commit identity before independent review; no real student data in artifacts.

# Execution Budgets

- One writer per path; maximum three non-overlapping workers if implementation is separately authorized.
- Step deadline: 600 seconds; idempotent retries `0..2`; engineering loop `0..3`; review remediation `0..2`.
