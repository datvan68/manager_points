# Task Scope Review: Student Status Guard for Training Score Tables

## Objective

Review and define the missing work so training score tables (`summariesPoint` / `SummaryPoint`) are created only for students whose academic status is `Studying` (`Đang học`). If a student's status is changed from `Studying` to any other status, the user must be asked to confirm deletion of that student's training score tables.

## Current Review Result

The current implementation does not fully enforce this business rule yet.

Correct existing pieces:

- `Student.status` is modeled in the backend as `Studying`, `Reserved`, `Dropped`, `Graduated`, and `Suspended`.
- New students default to `Studying` in the UI.
- The student list already renders status labels including `Suspended`.
- `SummaryPoint` already has a backend delete endpoint: `DELETE /summaries-points/:id`.

Missing or incomplete pieces:

- `StudentsService.create(...)` auto-creates semester-level `SummaryPoint` rows for every newly created student, regardless of `createStudentDto.status`.
- `StudentsService.createBulk(...)` auto-creates summary rows for every imported student, regardless of each DTO status.
- `SummariesPointService.create(...)` accepts direct summary creation for any student and does not verify that the target student is currently `Studying`.
- `frontend/src/app/grading/page.tsx` auto-initializes missing score tables for every student in the selected class and does not skip non-`Studying` students.
- `ImportClassRecordPopup` creates a missing summary while importing class records and does not block students whose status is not `Studying`.
- `StudentsService.update(...)` updates student status without detecting the transition from `Studying` to another status and without deleting related `SummaryPoint` rows.
- `StudentPopup` saves a non-`Studying` status directly without a confirmation step explaining that the training score table will be deleted.
- `StudentPopup` does not expose the backend-supported `Suspended` option, so status handling is inconsistent between screens.
- Existing student service tests assert auto-summary creation for happy paths, but do not cover non-`Studying` students or status-change deletion behavior.

## Required Business Rules

### 1. Create score tables only for `Studying` students

Any automatic or manual `SummaryPoint` creation path must verify the student status before creating the score table.

Required backend enforcement:

- `StudentsService.create(...)`: only auto-create summary rows when `createdStudent.status === 'Studying'`.
- `StudentsService.createBulk(...)`: only build summary upsert operations for imported students whose status is `Studying`.
- `SummariesPointService.create(...)`: load the target student and reject creation when `student.status !== 'Studying'`.

Recommended error response:

```txt
400 Bad Request: Chỉ sinh viên đang học mới được tạo bảng điểm rèn luyện.
```

Required frontend handling:

- `/grading` score-table initialization must skip students whose status is not `Studying`.
- `ImportClassRecordPopup` must not create or attach training-score records for non-`Studying` students.
- Any skipped student should be reported in the import/init result with a clear reason such as `Student is not Studying`.

### 2. Confirm deletion when changing status away from `Studying`

When a user edits a student and changes status from `Studying` to any other status (`Reserved`, `Dropped`, `Graduated`, `Suspended`), show a confirmation dialog before saving.

Confirmation copy should clearly state:

- The student will no longer be eligible for a training score table.
- Existing training score tables for that student will be deleted.
- This action affects all semesters/periods for that student unless the product decides a narrower policy.

Recommended default policy:

- Delete all `SummaryPoint` rows where `student_id` is the updated student.
- Delete embedded score details together with the summary rows, because details are stored inside `SummaryPoint.details`.
- Do not delete academic/daily record history unless a separate business rule explicitly requires it.

If the user cancels the confirmation:

- Do not save the status change.
- Keep existing training score tables unchanged.

### 3. Restore eligibility when changing back to `Studying`

When a student status changes from a non-`Studying` status back to `Studying`, the system should not silently recreate historical deleted score tables without a clear policy.

Recommended behavior:

- Save the status change.
- Create missing score tables only through the existing initialization flow for active semesters, or provide an explicit "Create training score table" action.
- Document whether deleted historical summaries are intentionally not restored.

### 4. Keep UI status options consistent

`StudentPopup` should include all backend-supported student statuses:

- `Studying` (`Đang học`)
- `Reserved` (`Bảo lưu`)
- `Dropped` (`Thôi học`)
- `Graduated` (`Tốt nghiệp`)
- `Suspended` (`Đình chỉ`)

This prevents users from seeing `Suspended` in the list but being unable to select it in the edit form.

## Backend Implementation Scope

1. Add a reusable helper in `StudentsService` or a shared domain utility:

```ts
const isTrainingScoreEligible = (student: { status?: string }) =>
  student.status === 'Studying';
```

2. Guard automatic summary creation in `StudentsService.create(...)`.
3. Guard automatic summary creation in `StudentsService.createBulk(...)`.
4. Guard direct summary creation in `SummariesPointService.create(...)`.
5. Update `StudentsService.update(...)` to:
   - Load the existing student before updating.
   - Detect `oldStatus === 'Studying' && newStatus !== 'Studying'`.
   - Require an explicit confirmation flag from the client before deleting summaries.
   - Delete related `SummaryPoint` rows only after confirmation.
6. Add a confirmation field to the update DTO or endpoint contract, for example:

```ts
deleteTrainingScoresConfirmed?: boolean;
```

7. Return a clear `400 Bad Request` when a status transition requires confirmation but the confirmation flag is missing.

## Frontend Implementation Scope

1. In `StudentPopup`, compare the initial status with the selected status.
2. If changing from `Studying` to another status, open a confirmation modal before calling `studentApi.updateStudent(...)`.
3. Pass `deleteTrainingScoresConfirmed: true` only after the user confirms.
4. Add the missing `Suspended` option.
5. In `/grading`, skip non-`Studying` students during automatic score-table initialization.
6. In `ImportClassRecordPopup`, reject or skip non-`Studying` students before creating summaries/evaluation details.
7. Show clear skipped-student messages so users understand why no score table was created.

## Acceptance Criteria

- Creating a student with status `Studying` creates/ensures semester-level training score tables as before.
- Creating a student with status `Reserved`, `Dropped`, `Graduated`, or `Suspended` does not create a `SummaryPoint`.
- Bulk import creates training score tables only for imported students with status `Studying`.
- Direct `POST /summaries-points` for a non-`Studying` student returns `400`.
- `/grading` auto-initialization does not create missing score tables for non-`Studying` students.
- Class-record import does not create score tables or evaluation details for non-`Studying` students.
- Changing a student from `Studying` to a different status prompts for confirmation.
- Cancelling the confirmation leaves the student status and score tables unchanged.
- Confirming the status change saves the new status and deletes related `SummaryPoint` rows.
- Changing a student from a non-`Studying` status back to `Studying` does not silently restore deleted historical score tables.
- The edit form exposes the `Suspended` status option consistently with the backend schema.

## Regression Tests To Add

Backend tests:

- `StudentsService.create(...)` creates summaries for `Studying`.
- `StudentsService.create(...)` does not create summaries for each non-`Studying` status.
- `StudentsService.createBulk(...)` creates summary upserts only for `Studying` students.
- `SummariesPointService.create(...)` rejects non-`Studying` students.
- `StudentsService.update(...)` requires confirmation when changing from `Studying` to another status.
- `StudentsService.update(...)` deletes summaries after confirmed status change.
- `StudentsService.update(...)` does not delete summaries when status remains `Studying`.

Frontend tests:

- `StudentPopup` shows confirmation when status changes from `Studying` to another status.
- `StudentPopup` does not call update when the user cancels deletion confirmation.
- `StudentPopup` calls update with `deleteTrainingScoresConfirmed: true` after confirmation.
- `StudentPopup` renders the `Suspended` option.
- `/grading` initialization skips non-`Studying` students.
- `ImportClassRecordPopup` reports non-`Studying` rows as skipped/error and does not create summaries.

## Manual Verification Checklist

1. Create a new student with status `Studying`; confirm summary rows are created.
2. Create a new student with status `Reserved`; confirm no summary row is created.
3. Import a mixed list of `Studying` and non-`Studying` students; confirm summaries are created only for `Studying`.
4. Open `/grading`, select a class with non-`Studying` students, and confirm auto-init skips them.
5. Edit a `Studying` student to `Dropped`; cancel confirmation and confirm no data changes.
6. Edit the same student to `Dropped`; confirm deletion and verify related `SummaryPoint` rows are removed.
7. Try `POST /summaries-points` for a non-`Studying` student; confirm the API rejects it.

## Out Of Scope

- Changing grading formulas, score ranking, or approval behavior.
- Deleting academic records, daily reports, notifications, or audit history.
- Restoring deleted historical summaries automatically when a student returns to `Studying`.
- Migrating existing invalid summaries for non-`Studying` students unless explicitly requested.

## Recommended Next Task

Implement backend guards first because they are the source of truth, then add the frontend confirmation flow and focused regression tests around status transitions.
