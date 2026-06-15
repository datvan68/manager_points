# Task Scope Review: `/grading/score` Latest Data Contract Review

## Objective

Review the latest `/grading/score` implementation and record what is now correct, what is still missing, and what should be verified next. This scope focuses on:

- Complete class roster rendering in the "Sinh viên đang chấm điểm" slider.
- Correct summary matching for students who already have `summariesPoint`.
- Clear approved/locked summary identification.
- Copy-score behavior staying consistent with the same roster and summary rules.

## Current Review Result

The implementation has improved compared with the previous scope. Several previously identified gaps are now addressed:

- `frontend/src/app/grading/score/_types.ts` now owns the route-local `GradingStatus` and `StudentData` types.
- `GradingStatus` includes `no_summary`.
- `renderGradingStatusBadge(...)` now renders `Chưa có bảng điểm` for missing summaries and `Đã duyệt` for locked summaries.
- `fetchAllSummaries(...)` now fetches summary pages with `limit: 100` and loops through all summary pages.
- Student users now resolve their own student record through `studentApi.getMyStudent()` before summary lookup.
- Non-student class grading now fetches the roster with `studentApi.getStudents({ classId: effectiveClassId })` instead of relying only on a client-side class filter.
- Summary matching now uses an inline `Map` index instead of doing `students * summaries` repeated `.find(...)` scans.
- `CopyScoreModal` now builds a `Map<summaryId, summary>` inside `useMemo`.
- Copy-score helper tests exist under `frontend/src/app/grading/score/_utils/copy-score.test.ts`.
- Copy-score modal tests cover source/locked/no-summary disabled states and success/error result banners.

These updates should be preserved.

## Remaining Gaps

### 1. Summary index still contains an unsafe key

The current summary index also stores:

```ts
summaryIndex.set(String(summary._id).trim().toLowerCase(), summary);
```

`summary._id` is the summary document id, not a student id. It should not be used as a fallback student key. A student should only match a summary through:

- `summary.student_id._id`
- `summary.student_id.id`
- `summary.student_id.student_code`
- raw `summary.student_id` when it is a string/ObjectId

Recommended fix:

- Remove `summary._id` from `summaryIndex` keys.
- Include `student.id` as an optional roster candidate if the API response ever provides it.
- Keep `summary._id` only as the value stored in `studentSummaryMap[studentId]`.

### 2. Old matching helpers appear to be dead code

These helpers still exist in `page.tsx`, but the new inline `summaryIndex` flow no longer uses them:

```ts
getSummaryStudentCode(...)
getSummaryStudentKey(...)
matchStudentToSummary(...)
```

Recommended fix:

- Remove unused helpers if they are truly obsolete.
- Or extract the summary-index behavior into route-local utilities and test those helpers directly.

This reduces build risk if the project enables stricter `noUnusedLocals` rules later.

### 3. Summary matching helpers should be extracted for testability

The current index-building and roster-to-summary mapping logic is inline inside `page.tsx`. That makes the most important bug fix hard to unit test.

Recommended extraction:

```txt
frontend/src/app/grading/score/_utils/summary-matching.ts
```

Suggested exported helpers:

```ts
buildSummaryIndex(summaries)
findSummaryForStudent(student, summaryIndex)
mapRosterWithSummaries(students, summaries)
```

Test cases should cover populated `student_id`, raw string/ObjectId `student_id`, `student_code`, score `0`, locked summaries, and missing summaries.

### 4. `periodId` is still not part of the list API contract

The frontend currently fetches all summaries for `semesterId` plus `classId`/`studentId`, then filters semester-level summaries with:

```ts
const summariesData = summariesRaw.filter((sum) => !sum.period_id || sum.period_id === null);
```

This is acceptable only if `/grading/score` is intentionally a semester-level page. It is still not a complete API contract because `GET /summaries-points` does not accept `periodId`, while the schema supports `period_id`.

Required decision:

- If `/grading/score` is semester-level only, document and enforce `period_id: null` on the backend list query.
- If `/grading/score` is period-level, add `periodId` to `summariesPointApi.getSummariesPoints(...)`, `SummariesPointController.findAll(...)`, and `SummariesPointService.findAll(...)`.

### 5. Type-only imports should use `import type`

The route-local types are now in `_types.ts`, which is good. However, the imports are still normal imports:

```ts
import { GradingStatus, StudentData } from "./_types";
import { GradingStatus, StudentData } from "../_types";
```

These are type-only values and should be imported as:

```ts
import type { StudentData } from "./_types";
import type { StudentData } from "../_types";
```

Also remove unused imported types, such as `GradingStatus` where it is not directly referenced. This avoids unnecessary runtime coupling and cleaner bundle output.

### 6. Duplicate and stale comments should be cleaned up

The summary-fetch comment is duplicated in `page.tsx`. Some comments still include older wording around the same flow.

Recommended fix:

- Keep one concise comment above `fetchAllSummaries(...)`.
- Remove comments that describe behavior that is no longer true.

### 7. Full slider behavior still lacks direct regression coverage

Current tests cover copy-score helper/modal behavior, but not the slider data contract itself.

Add tests around extracted utilities first, then optionally add a page-level test if the project already supports it.

Minimum regression coverage:

- Class roster with more than 10 students maps every student exactly once.
- Existing summary with `total_score: 0` maps to `draft`, not `no_summary`.
- Missing summary maps to `no_summary`.
- Locked summary maps to `locked` and should show `Đã duyệt`.
- Raw `summary.student_id` string matches a roster `_id`.
- Populated `summary.student_id.student_code` matches a roster `student_code`.
- A summary with non-null `period_id` is excluded only when the page is explicitly semester-level.

## Updated Acceptance Criteria

- The slider uses backend roster data scoped by `classId` for non-student users.
- Student users resolve their own student record through a reliable student endpoint before summary lookup.
- Every selected-class student appears exactly once in the slider.
- Students with an existing summary and `total_score: 0` are not treated as missing a summary.
- Only truly missing summary rows show `Chưa có bảng điểm`.
- Locked summaries show `Đã duyệt`.
- Locked summaries disable grading controls and copy-score target selection.
- Summary matching does not use `summary._id` as a student key.
- Summary matching behavior is covered by unit tests.
- Type-only imports from `_types.ts` use `import type`.
- The period-level versus semester-level summary rule is explicit and enforced consistently.

## Manual Verification Checklist

1. Select a class with more than 10 students.
2. Confirm the slider count matches the class roster count.
3. Confirm students after the first 10 are displayed and not marked missing summary because of pagination.
4. Confirm a student with `total_score = 0` and a valid summary can still be graded when role/period/status allow it.
5. Confirm a student with no matching summary shows `Chưa có bảng điểm`.
6. Confirm an approved/locked student shows `Đã duyệt`.
7. Confirm the approved/locked student cannot be edited.
8. Open the copy-score modal and confirm locked/no-summary/source students are disabled.
9. Confirm selectable copy-score targets are from the same selected class roster.
10. Switch class or semester and confirm stale students/summaries from the previous selection do not remain visible.

## Recommended Next Task

Finish the remaining correctness cleanup before broader UI work:

1. Remove `summary._id` from the student summary index.
2. Extract summary matching into `_utils/summary-matching.ts`.
3. Add focused tests for summary matching and slider data mapping.
4. Decide and implement the `periodId` contract.
5. Convert `_types.ts` imports to `import type` and remove unused type imports.
6. Run focused grading tests, then run the broader frontend test/build verification before merge.
