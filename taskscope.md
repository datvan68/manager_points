# Taskscope: Fix `/grading/score` Student Identity Resolution

## Objective
Fix the `/grading/score` loading flow that logs:

```text
Error resolving student details: ApiError: Student with ID 1240510009 not found
```

The page must support links that arrive with either the canonical MongoDB student `_id` or a legacy/display student code such as `1240510009`, while all grading mutations continue to use the MongoDB ObjectId required by backend APIs.

## Problem Summary
`/grading/score` currently reads `studentId` from the URL and calls:

```ts
studentApi.getStudent(studentIdParam)
```

That API maps to:

```text
GET /students/:id
```

Backend `StudentsService.findOne(id)` validates `id` as a MongoDB ObjectId. A student code like `1240510009` is not a MongoDB ObjectId, so the backend correctly returns `404 Student with ID 1240510009 not found`.

The frontend catches the error and falls back, but the page still logs a browser error and may fail to auto-select the intended student.

## Current Findings
- `frontend/src/app/(dashboard)/grading/score/page.tsx` resolves `studentIdParam` by directly calling `studentApi.getStudent(studentIdParam)`.
- The same page later compares `studentIdParam` against `mappedStudents[].id`, where `mappedStudents[].id` is expected to be the MongoDB student `_id`.
- `frontend/src/app/(dashboard)/grading/page.tsx` builds table rows through `getSummaryStudentKey(summary, idx)`.
- `getSummaryStudentKey` currently prioritizes `student_code` before `_id`, so the row `student.id` can become a display code instead of the MongoDB ObjectId.
- The "Grade student" and "View score detail" actions in `/grading` pass `student.id` into the query string:

```ts
query.set("studentId", student.id);
router.push(`/grading/score?${query.toString()}`);
```

- Other frontend flows also store display-level `studentId` values as `student_code`, especially in `/students/record`.
- Backend already has `StudentsService.findByStudentCode(student_code)`, but it is not exposed through a scoped controller endpoint for this page flow.
- Backend grading APIs such as `academic-records/intent` require `student_id` to be a MongoDB ObjectId, so the UI must never send `student_code` to score mutation endpoints.

## Root Cause
The codebase mixes two different meanings under the same `studentId` name:

- `student._id`: canonical MongoDB ObjectId used by backend relations and grading mutation APIs.
- `student.student_code`: display/business identifier shown as MSSV.

The error happens when a display student code is passed through the URL as `studentId` and then treated as a MongoDB ObjectId by `/grading/score`.

## Required Direction
Separate canonical student identity from display student code.

Recommended naming:

```ts
studentObjectId // MongoDB _id, used for API relations and score mutations
studentCode     // MSSV/student_code, used for display and optional lookup
```

Avoid using a generic `studentId` variable unless the code clearly documents that it is the MongoDB ObjectId.

## Proposed Solution

### 1. Standardize `/grading` table row identity
Update `frontend/src/app/(dashboard)/grading/page.tsx` so table rows use MongoDB ObjectId as the row/action identity.

Required changes:
- Replace the current `getSummaryStudentKey` usage for action navigation with an ObjectId-first helper.
- Keep `studentCode` as a separate display field.
- Ensure `query.set("studentId", ...)` receives the MongoDB ObjectId whenever available.
- If only `student_code` is available, either resolve it before navigation or pass it as `studentCode`, not as `studentId`.

Suggested row shape:

```ts
{
  id: studentObjectId,
  studentObjectId,
  studentCode,
  name,
  summaryId,
  classId,
  semesterId,
}
```

### 2. Add a scoped student identity resolver
Add a small resolver that accepts either ObjectId or student code and returns the canonical student object.

Preferred backend endpoint:

```text
GET /students/resolve?identifier=<studentObjectId-or-studentCode>
```

Alternative endpoint:

```text
GET /students/by-code/:studentCode
```

Backend requirements:
- Protect the endpoint with `JwtAuthGuard`.
- Reuse the same scope rules as `findOne`:
  - Admin and supervisor can resolve any student.
  - Teacher can resolve only students in assigned classes.
  - Student can resolve only their own student profile.
- If `identifier` is a valid MongoDB ObjectId, resolve by `_id`.
- If `identifier` is not a valid ObjectId, resolve by exact `student_code`.
- Do not expose an unscoped `findByStudentCode` endpoint.

### 3. Update frontend student API
Update `frontend/src/api/student-api.ts` with a dedicated method:

```ts
resolveStudent(identifier: string): Promise<Student>
```

or:

```ts
getStudentByCode(studentCode: string): Promise<Student>
```

The score page should use this resolver for URL params, not raw `getStudent`, unless the value has already been validated as a MongoDB ObjectId.

### 4. Update `/grading/score` URL resolution
Update `frontend/src/app/(dashboard)/grading/score/page.tsx` to normalize the selected student before loading summaries.

Expected behavior:
- If `studentIdParam` is a valid MongoDB ObjectId, fetch by ObjectId.
- If `studentIdParam` is not a valid MongoDB ObjectId, treat it as a legacy student code and resolve it to the canonical student `_id`.
- Store the resolved ObjectId in a local variable such as `resolvedStudentObjectId`.
- Use `resolvedStudentObjectId` for:
  - `finalClassId` detection.
  - summary lookup.
  - `targetActiveId`.
  - score mutation payloads.
  - history/detail loading.
- Keep `studentCode` only for display and fallback messages.

Important: `studentApi.getStudent` must not be called with non-ObjectId values.

### 5. Preserve active selected student behavior
After resolving the URL identifier, the page must activate the intended student.

Current comparison:

```ts
mappedStudents.some((s) => s.id === studentIdParam)
```

Required comparison:

```ts
mappedStudents.some((s) => s.id === resolvedStudentObjectId)
```

This preserves automatic activation for:
- Links from `/grading`.
- Legacy links that still pass `student_code` as `studentId`.
- Student self-view links.
- Task-linked links that may contain student code.

### 6. Handle not-found as expected state
When the resolver cannot find the student:
- Do not log it as an unhandled browser error.
- Show the existing warning toast.
- Keep fallback behavior to the selected/default class.
- Clear active student only when no valid fallback exists.

Use structured handling for expected 404 cases:

```ts
if (err instanceof ApiError && err.status === 404) {
  showStudentNotFoundWarning = true;
  return fallback;
}
```

Keep unexpected network or server errors visible for debugging.

## Files In Scope

### Frontend
- `frontend/src/app/(dashboard)/grading/page.tsx`
- `frontend/src/app/(dashboard)/grading/score/page.tsx`
- `frontend/src/api/student-api.ts`
- `frontend/src/app/(dashboard)/grading/score/_utils/summary-matching.ts`
- Existing `/grading/score` tests and new regression tests as needed.

### Backend
- `backend/src/students/students.controller.ts`
- `backend/src/students/students.service.ts`
- `backend/src/students/test/students.service.spec.ts`
- Optional controller test if the project already has controller coverage for students.

## Out Of Scope
- Changing score formulas.
- Changing grading permission rules.
- Refactoring autosave, realtime updates, copy score, delete summary, or history mapping.
- Renaming database fields.
- Changing the visual design of `/grading` or `/grading/score`.
- Making fuzzy student search part of this fix. The resolver should use exact ObjectId or exact `student_code`.

## Implementation Plan

### Phase 1: Fix source navigation identity
- Update `/grading` table row mapping so `id` is the student MongoDB ObjectId.
- Add `studentCode` as a separate display field.
- Update action buttons to pass `studentObjectId` in `studentId`.
- Confirm row selection, delete summary, and export logic still map summaries correctly.

### Phase 2: Add resolver for legacy links
- Add backend scoped resolve method.
- Add frontend API method.
- Add ObjectId detection helper in a shared frontend location or local score-page utility.
- Ensure legacy URLs like `/grading/score?studentId=1240510009` still load the correct student.

### Phase 3: Normalize `/grading/score` active student selection
- Resolve URL identity once at page-load time.
- Use `resolvedStudentObjectId` instead of raw `studentIdParam` for roster matching and active student selection.
- Keep existing warning toasts for inaccessible or missing students.
- Prevent score mutation if no canonical MongoDB ObjectId exists.

### Phase 4: Add regression coverage
- Add frontend tests for ObjectId URL and student-code URL.
- Add backend tests for resolver access scope.
- Add tests that verify `studentApi.getStudent` is not called with a non-ObjectId in the score-page flow.

## Acceptance Criteria
- Opening `/grading/score?studentId=<MongoObjectId>` loads the student and activates that student.
- Opening `/grading/score?studentId=1240510009` resolves the code to the correct MongoDB ObjectId and activates that student.
- The browser no longer logs `Error resolving student details` for valid student-code links.
- `/grading` action "Grade student" passes a MongoDB ObjectId as `studentId`.
- `/grading` action "View score detail" passes a MongoDB ObjectId as `studentId`.
- Score mutation payloads still send `student_id` as a MongoDB ObjectId.
- A teacher cannot resolve or grade a student outside assigned classes.
- A student cannot resolve or grade another student by guessing `student_code`.
- Admin and supervisor can resolve students according to existing grading access rules.
- Invalid or missing students show a controlled warning state instead of an unhandled browser error.
- Existing score totals, autosave behavior, realtime updates, summary delete behavior, and copy-score behavior are unchanged.

## Test Plan

### Backend tests
- Resolve by valid ObjectId returns the student.
- Resolve by exact `student_code` returns the same student.
- Invalid identifier returns 404.
- Teacher can resolve a student in an assigned class.
- Teacher cannot resolve a student outside assigned classes.
- Student can resolve self.
- Student cannot resolve another student by ObjectId or student code.
- Admin can resolve by ObjectId and by student code.

### Frontend tests
- `/grading` row action builds URL with MongoDB ObjectId.
- `/grading/score` resolves ObjectId URL and activates the selected student.
- `/grading/score` resolves legacy student-code URL and activates the selected student.
- `/grading/score` does not call `studentApi.getStudent` with a non-ObjectId.
- Missing student code shows warning and does not crash.
- Score intent is blocked when active student has no canonical ObjectId.

### Manual verification
1. Open `/grading`, choose a class and semester.
2. Click "Grade student" on a row whose MSSV is `1240510009`.
3. Confirm the URL contains a MongoDB ObjectId in `studentId`.
4. Confirm `/grading/score` opens with that student active.
5. Manually open `/grading/score?studentId=1240510009` and confirm the legacy code resolves.
6. Confirm no browser console error appears for valid student-code links.
7. Change to a teacher account and verify only assigned-class students resolve.
8. Change to a student account and verify only the student's own profile resolves.
9. Perform one score change and confirm the backend receives MongoDB ObjectId in `student_id`.

## Deliverable
A focused identity-resolution fix for `/grading/score` that separates MongoDB student ObjectId from MSSV/student_code, keeps legacy links working, and prevents valid student-code links from producing browser errors or failing active-student selection.