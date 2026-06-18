# Task Scope: `/grading/score` Summary Point Workflow

## Context

The `/grading/score` page currently loads class rosters, matches students to `summaries_point` records, edits evaluation detail counts, and persists the calculated training score back to the summary record.

Related files:

- `frontend/src/app/grading/score/page.tsx`
- `frontend/src/app/grading/score/_types.ts`
- `frontend/src/app/grading/score/_utils/summary-matching.ts`
- `frontend/src/components/grading/ActiveStudentRankCard.tsx`
- `frontend/src/api/summaries-point-api.ts`
- `backend/src/summaries-point/summaries-point.service.ts`
- `backend/src/summaries-point/summaries-point.controller.ts`
- `backend/src/summaries-point/schemas/summary-point.schema.ts`

## Required Changes

1. Default summary initialization

- When `summaries_point` records are created for a class for the first time, every new summary must start with:
  - `total_score: 0`
  - `grading: "CHUA XEP LOAI"` or the app's existing Vietnamese display string for "CHUA XEP LOAI"
  - `status: "draft"`
  - no approved rank data
- The current backend initialization path in `SummariesPointService.initializeClass` creates records with `total_score: 100` and `grading: "Xuat sac"`; this must be changed.
- Existing summary records must not be overwritten by class initialization.

2. Delete one or many students' summary point records from the action toolbar

- Add a toolbar action on `/grading/score` that allows authorized non-student users to delete `summaries_point` records for one or multiple selected students.
- The action must delete summary records, not only evaluation detail history logs.
- Support single active student deletion and multi-select deletion from the visible roster/list.
- Show a confirmation modal with the selected student count and names when practical.
- Use the existing `DELETE /summaries-points/:id` API for one record, or add a bulk endpoint if the UI needs true batch behavior.
- Locked/approved summaries must remain protected. The backend already rejects deletion when `status === "locked"`; the UI should also communicate this clearly.
- After deletion, refresh or update local state so:
  - deleted summaries are removed from `apiSummariesPoints`
  - deleted students show `gradingStatus: "no_summary"`
  - `studentSummaryMap` no longer contains deleted students
  - score display returns to `0/100`

3. Active rank card class display

- The active rank card currently displays `classId`.
- Change the display to show the class name instead of the raw ID.
- Extend the frontend `StudentData` shape with a class display field, for example `className`.
- Populate that field in `mapRosterWithSummaries` from `student.class_id.class_name` when `class_id` is an object, with fallback to the selected class name or the raw ID only when no name is available.
- Update `ActiveStudentRankCard` to render the class name and keep the raw ID only as fallback/title metadata if useful.

4. Discipline criterion scoring logic and UI

- Discipline criteria should behave like a base score with deductions.
- Example: if the discipline criterion total/base score is `10` and one violation deducts `2`, the achieved criterion score must be `8`, not `-2`.
- Update the shared frontend score calculation logic so violation criteria use:
  - `baseScore = maxScore`
  - `deduction = count * abs(pointsPerUnit)`
  - `criterionScore = clamp(baseScore - deduction, minScore, maxScore)`
- Align category totals, realtime score, save payloads, copy-score persistence, history recalculation, and PDF/export calculations with the same rule.
- Review backend recomputation logic for embedded `details` so approved/locked summaries produce the same total as the frontend.
- Update the UI for discipline criteria to make the scoring easy to recognize:
  - show base score, deduction per violation, current violation count, and remaining score
  - visually distinguish discipline rows from reward rows
  - avoid displaying discipline achievement as a negative score when it represents remaining points

## Acceptance Criteria

- Initializing a class creates new `summaries_point` records with `0/100`, draft status, and "CHUA XEP LOAI".
- Reinitializing the same class/semester does not duplicate or reset existing summary records.
- Users can delete one selected student's summary point from the toolbar.
- Users can delete multiple selected students' summary points from the toolbar.
- Deleted summaries disappear from the current score page state without requiring a full browser reload.
- Locked summaries cannot be deleted and produce a clear error or disabled state.
- The active rank card shows class name instead of class ID.
- A discipline criterion with base `10`, `pointsPerUnit = -2`, and `count = 1` contributes `8` points.
- Reward criteria continue to use the existing additive capped behavior.
- Frontend realtime totals and persisted backend totals stay consistent after save, copy score, delete history, and approval.

## Suggested Verification

- Add or update backend tests for `initializeClass` default values and locked summary deletion.
- Add or update frontend utility tests for discipline score calculation, including the `10 - 2 = 8` case.
- Manually verify `/grading/score` with:
  - a newly initialized class
  - a student with no summary
  - one unlocked summary deletion
  - multi-delete with mixed unlocked and locked summaries
  - discipline criteria display on desktop and mobile widths
