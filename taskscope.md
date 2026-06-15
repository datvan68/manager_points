# Task Scope Review: `/grading/score` Student Slider, Approval Indicator, and Summary Availability

## Objective

Review and correct the implementation scope for `/grading/score` so the page reliably:

- Shows every student in the selected class in the "Sinh viên đang chấm điểm" slider.
- Clearly identifies students whose grading summary has already been approved.
- Does not show `Chưa có điểm` or block grading for students who already have a valid `summariesPoint`.
- Keeps the copy-score action consistent with the same roster and summary availability rules.

## Current Review Result

`taskscope.md` was empty after the previous edit, while the current page implementation has already changed. This file now becomes the source of truth for the remaining `/grading/score` work.

The current code already includes several correct updates:

- `frontend/src/app/grading/score/page.tsx` now includes `no_summary` in `GradingStatus`.
- `renderGradingStatusBadge(...)` distinguishes missing summaries with `Chưa có bảng điểm` instead of the misleading `Chưa có điểm`.
- `locked` summaries render an approval indicator on the student slider as `Đã duyệt`.
- Summary fetching now uses `semesterId`, optional `classId`, `limit: 100`, and loops through paginated summary pages.
- The copy-score button is placed before the `Lưu thay đổi` button and opens `CopyScoreModal`.
- `CopyScoreModal` disables source students, locked summaries, and students with no summary.

These fixes should be preserved.

## Remaining Gaps

### 1. Roster fetch should use the selected class as the backend contract

The page currently loads students with:

```ts
studentApi.getStudents()
```

and then filters the roster on the client. The backend already supports:

```ts
GET /students?classId=<classId>
```

For this page, the selected/effective class must be the source-of-truth boundary. The page should call `studentApi.getStudents({ classId: effectiveClassId })` for teacher/admin class grading flows.

Why this matters:

- The slider requirement is "all students of the class", not "all visible students after a client-side filter".
- Passing `classId` lets the backend enforce teacher/class access rules consistently.
- It reduces unnecessary payload and avoids accidental cross-class slider state when no class is selected.

Expected behavior:

- Teacher: load only students from the assigned selected class.
- Admin/supervisor: load only students from the selected class when a class is applied.
- Student: load only the logged-in student's own record, preferably via `studentApi.getMyStudent()` or an equivalent verified identity path.
- If no class is selected for a non-student role, show a clear empty/select-class state instead of silently showing students from all classes.

### 2. Summary matching is still not truly indexed

The page builds `summaryByStudentMap`, but each student still calls:

```ts
summariesData.find((sum) => matchStudentToSummary(student, sum))
```

This is still `students * summaries` matching. For correctness and performance, create a summary index once:

- Key by populated `summary.student_id._id`.
- Key by populated `summary.student_id.id`.
- Key by populated `summary.student_id.student_code`.
- Key by raw `summary.student_id` when it is a string/ObjectId.

Then map each roster student by `_id`, `id`, and `student_code` through that index.

This also makes the slider verification easier: every roster student can be counted once, and summary availability can be explained deterministically.

### 3. Student self-grading summary lookup can still miss valid summaries

For `currentUserRole === "student"`, `fetchAllSummaries(...)` uses:

```ts
params.studentId = currentUser?.student_code || currentUser?.username || "";
```

The backend summary list resolves non-ObjectId `studentId` by `student_code`. If `username` is not the same as `student_code`, the summary query can return empty even when the student has a summary.

Fix scope:

- Resolve the actual student first using `/students/me` or the roster response.
- Fetch summary by the actual student `_id` or `student_code`.
- Keep `matchesCurrentStudent(...)` only as a fallback guard, not as the primary identity source.

### 4. Period-specific summaries are not selectable through the list API

The backend `SummaryPoint` schema includes `period_id`, and the unique identity is effectively:

```ts
student_id + semester_id + period_id
```

However, `GET /summaries-points` currently supports `semesterId`, `classId`, `studentId`, and `status`, but not `periodId`.

If the application can create multiple summaries for the same student and semester across different periods, `/grading/score` may match the wrong summary and then show the wrong status, score, details, and lock state.

Decision required:

- If `/grading/score` is semester-level only, explicitly fetch and match only `period_id: null` summaries.
- If `/grading/score` is period-level, add `periodId` to `summariesPointApi.getSummariesPoints(...)`, `SummariesPointController.findAll(...)`, and `SummariesPointService.findAll(...)`.

### 5. Approval indicator exists, but the acceptance rule should be stricter

The slider now shows `Đã duyệt` for `gradingStatus === "locked"`. Keep that behavior, and make it a tested contract:

- A locked summary must show the approved badge on the slider.
- A locked student must not be editable.
- A locked student must not be selectable as a copy-score target.
- The copy modal reason should stay explicit: `Bảng điểm đã chốt`.

### 6. CopyScoreModal should avoid a runtime import from the page file

`CopyScoreModal.tsx` currently imports `GradingStatus` from `../page`.

Use a type-only import:

```ts
import type { GradingStatus } from "../page";
```

or move `GradingStatus` and route-local student types into a small route-local type file, for example:

```txt
frontend/src/app/grading/score/_types.ts
```

This keeps the modal from depending on the page module at runtime and avoids unnecessary coupling.

### 7. CopyScoreModal repeats summary lookups

Inside `CopyScoreModal`, target status is resolved with:

```ts
apiSummariesPoints.find((s) => s._id === summaryId)
```

for every student. Build a `Map<summaryId, summary>` with `useMemo` first, then read by id. This matches the page's indexed summary direction and avoids repeated scans.

## Updated Implementation Scope

1. Keep the current `no_summary` status and `Chưa có bảng điểm` label.
2. Keep the current `locked -> Đã duyệt` slider badge.
3. Fetch roster data by `effectiveClassId` for non-student grading flows.
4. Fetch student self data from a reliable student identity endpoint before summary lookup.
5. Build an indexed summary map once and reuse it for roster-to-summary matching.
6. Define whether summary matching is semester-level or period-level, then implement the matching/API contract consistently.
7. Convert `CopyScoreModal` type import to `import type` or move shared route-local types into `_types.ts`.
8. Add focused tests for roster completeness, summary matching, approved badge rendering, and copy modal disabled states.

## Acceptance Criteria

- The slider count equals the backend roster count for the selected class.
- Every student in the selected class appears exactly once in the slider.
- Students with `summariesPoint.total_score = 0` and a valid summary are still gradable when role, period, and status allow grading.
- Only truly missing summaries use `no_summary` and show `Chưa có bảng điểm`.
- `locked` summaries show `Đã duyệt` on the slider.
- `locked` summaries disable grading controls and copy-score target selection.
- Copy-score targets come from the same selected-class roster as the slider.
- Summary matching works when `summary.student_id` is either populated or a raw ObjectId string.
- The page does not accidentally show students from every class when a non-student user has not selected a class.
- No runtime import from `page.tsx` is required only to share TypeScript types.

## Regression Tests To Add

Add focused tests around extracted helpers where possible:

- `buildSummaryIndex(...)` matches summaries by `_id`, `id`, raw `student_id`, and `student_code`.
- `mapStudentsWithSummaries(...)` keeps all roster students even when a summary is missing.
- A valid summary with `total_score: 0` maps to `draft`, not `no_summary`.
- A missing summary maps to `no_summary`.
- A `locked` summary maps to `locked` and renders the approved indicator.
- Copy modal excludes source, locked, and no-summary students from selectable targets.
- Copy modal still allows a target with a valid draft summary and score `0`.

Manual verification:

1. Select a class with more than 10 students.
2. Confirm the slider count matches the class roster.
3. Confirm students after the first 10 are not marked missing summary only because of pagination.
4. Confirm a student with `total_score = 0` but existing summary can be graded.
5. Confirm an approved student shows `Đã duyệt` and cannot be edited.
6. Open copy-score modal and confirm the selectable target list matches the same class roster rules.

## Out Of Scope

- Redesigning the grading page layout.
- Changing grading formulas or rank calculation rules.
- Changing permission phases beyond enforcing the current role/period/status rules.
- Backend data migration for already-created summary rows unless period-level summary matching is selected.
- Replacing the existing test framework.

## Recommended Next Task

Implement the remaining data-contract fixes first:

1. Fetch class roster with `classId`.
2. Resolve student self identity reliably.
3. Extract and test summary indexing/matching helpers.
4. Decide and implement the `periodId` behavior.
5. Run focused frontend tests for `/grading/score`, then run the broader frontend test/build verification before merge.
