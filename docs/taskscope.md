Task: student-activity-menubar-select-filter | bug_fix | Risk: LOW
Objective: Limit the `/activities` controls shown to student accounts to search and activity-type filtering, using the shared Select component for the filter.
Scope:
- `frontend/src/components/activities/ActivityListWorkspace.tsx` :: controls bar :: conditionally render only the search and type filter for students; replace the native activity-type `select` with the existing shared `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem` components while preserving query-parameter synchronization and local filtering.
- `frontend/src/components/activities/ActivityListWorkspace.test.tsx` :: student controls and filter regression coverage :: verify students cannot access schedule, refresh, create, or view-toggle controls, and verify selecting an activity type through the shared Select invokes the existing filter callback and filters the displayed records.
Out: Backend APIs, activity permissions, student activity visibility/data rules, non-student controls, shared Select implementation, unrelated files and behavior.
Context: Student detection is already derived from the authenticated token user in `ActivityListWorkspace`; the shared Select component already supports controlled values and searchable item selection.
Steps:
1. Replace the native type selector with the shared Select component and retain the current type options, selected value, and callback behavior.
2. Gate the action and view-mode section from student accounts, leaving the search and filter controls available.
3. Add focused component tests for student-only controls and Select-based filtering.
Verify:
- `frontend` :: `npm test -- src/components/activities/ActivityListWorkspace.test.tsx` => student-control and filter regression tests pass.
- `frontend` :: `npm run typecheck` => changed component and tests compile without TypeScript errors.
- repository root :: `git diff --check` and `git status --short` => no whitespace errors and only scoped files plus this taskscope are changed by the implementation task.
Done:
- A student on `/activities` sees only search and the activity-type filter in the controls bar.
- The activity-type filter uses the shared Select component and still updates the existing filtering/query synchronization path.
- The targeted test and type check pass.
Gate/Stop: None.
