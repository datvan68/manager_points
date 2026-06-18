# Task Scope: Add Bulk Approve Action And Default Pagination Size

## Target Page

- `frontend/src/app/grading/page.tsx`
- Main table: `/grading` student grading list
- Selected-row toolbar: `FloatingActionBar`
- Pagination component: `CustomPagination`

## User Request

1. Add a `Duyet` button to the selected-row action toolbar so users can approve many selected `summaries_points` records at once.
2. Set the default table pagination size to 20 rows.

## Current Context

- The selected toolbar appears when `selectedStudentIds.length > 0`.
- Current toolbar actions include:
  - `Xoa`
  - `Huy duyet`
  - `Xuat PDF`
- Single approval already exists through `handleApproveEvaluation(summaryId, studentName)`.
- The frontend API currently exposes `summariesPointApi.approveGrading(id)` for one summary point.
- Bulk cancel approval already exists through `summariesPointApi.cancelApprovalBulk(summaryIds)`.
- Pagination currently initializes `pageSize` with `10`.

## Required Change: Bulk Approve Button

1. Add a new `Duyet` button to `FloatingActionBar`.
2. Show the button only for users who can approve grades:
   - Admin
   - Supervisor
   - Quan sinh role if the current role check supports it
3. The button must approve `summaries_points` records, not student records.
4. Support both single selection and multi-selection through the same action.
5. Resolve selected students to summary point IDs before approving:
   - Use `selectedStudentIds`.
   - Match selected IDs against `apiSummariesPoints`.
   - Reuse existing helper logic such as `getSummaryStudentKey(summary)`.
6. Skip rows that cannot be approved:
   - No matching summary point.
   - Already approved or locked.
   - No evaluated criteria, if the current single-approve rule blocks approval for that case.
7. Show a confirmation modal before approving:
   - Title: `Xac nhan duyet bang diem`
   - Message should include the number of summary point records that will be approved.
   - If some selected rows are skipped, mention the skipped count and reason.
8. On confirm, approve all matched summary points:
   - If no backend bulk endpoint exists, use `summariesPointApi.approveGrading(summaryId)` for each summary.
   - Prefer `Promise.allSettled` so one failed approval does not hide the rest of the result.
   - If performance becomes a concern, add a backend bulk approve endpoint as a separate improvement.
9. After approval succeeds:
   - Update `apiSummariesPoints` with returned summary data.
   - Clear `selectedStudentIds` when all selected approval attempts are finished successfully.
   - Keep failed rows selected if some approvals fail.
   - Show success toast with approved count.
10. If some approvals fail:
   - Keep failed records visible.
   - Show warning/error toast with success and failure counts.

## Toolbar UI Notes

- Place `Duyet` near `Huy duyet` so approval actions are grouped together.
- Suggested icon: `CheckCircle` or `Check`.
- Suggested style: green/emerald success style, visually different from red destructive buttons.
- Button text:
  - Desktop: `Duyet`
  - Mobile/icon-only state can keep the icon visible with `title="Duyet bang diem"`.
- Preserve existing toolbar actions:
  - `Xoa`
  - `Huy duyet`
  - `Xuat PDF`

## Required Change: Default Pagination Size

1. Change the default page size from 10 rows to 20 rows.
2. Update the initial state:
   - From: `useState(10)`
   - To: `useState(20)`
3. Keep `20` in `pageSizeOptions`.
4. Do not remove other page-size options unless there is a product decision to simplify them.
5. Reset to page 1 when users manually change page size, keeping the current behavior.
6. Make sure desktop table fetch uses the updated default page size.
7. Do not change the mobile/tablet behavior that intentionally loads all rows if that behavior is still required.

## Safety Rules

- Do not approve student documents directly.
- Do not create or delete summary point records from the `Duyet` action.
- Only approve existing `summaries_points` records matched to selected rows.
- Respect backend permission and validation errors.
- Do not reset unrelated filters, selected semester, selected class, selected department, or search text after approval.
- Do not break existing `Xoa`, `Huy duyet`, and `Xuat PDF` toolbar actions.

## Acceptance Criteria

- Selecting one pending/unapproved student and clicking `Duyet` approves that student's `summaries_points` record after confirmation.
- Selecting multiple eligible students and clicking `Duyet` approves all matched records after confirmation.
- Selected rows without a summary point are skipped with a clear warning.
- Already approved/locked rows are skipped or reported clearly.
- Partial failure shows success and failure counts.
- Successful approvals update the table status/rank without requiring a full page reload.
- Existing toolbar actions still work.
- The default table pagination is 20 rows on first load.
- The pagination dropdown still includes the 20-row option.

## Suggested Verification

- Manual test with one selected row that can be approved.
- Manual test with multiple selected rows that can be approved.
- Manual test with mixed selected rows:
  - Has summary point and can be approved.
  - Missing summary point.
  - Already approved/locked.
  - Has no evaluated criteria.
- Manual test permission handling with a role that cannot approve.
- Manual test that default pagination displays 20 rows.
- Run the relevant frontend checks/tests if available.
