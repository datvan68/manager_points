# Task Scope: Student Still Sees Evaluation Period Progress In Admin Approval Phase

## User Report

When the current evaluation phase is shown as `Hội đồng phê duyệt` (`admin_phase`), the student account still sees the `Tiến trình kỳ đánh giá rèn luyện` bar on the grading score page.

## Root Cause

The progress bar is rendered by `frontend/src/app/grading/score/page.tsx` whenever the page has finished initial loading and an `activePeriod` exists.

Relevant render condition:

- `!isInitialLoading && activePeriod` at `frontend/src/app/grading/score/page.tsx:2017`

That condition does not check whether the logged-in user is a student, nor whether the current period status is `sv_phase`. Because of this, the student role still enters the evaluation progress section when the selected semester has any configured evaluation period.

The role-specific branching inside the same component only changes the content below the header:

- Admin/supervisor users see the full 4-step timeline.
- Non-admin users, including students, see the two role cards: their deadline and their operation permission.

This is why the student account still sees the section header, semester, and current phase badge even when `activePeriod.status === "admin_phase"`.

## Supporting Findings

- `frontend/src/app/grading/score/page.tsx:717` selects the `activePeriod` only by matching `semester_id` with the selected semester.
- `frontend/src/app/grading/score/page.tsx:749` hides the student slider for students with `shouldShowStudentSlider = currentUserRole !== "student"`, but there is no equivalent guard for the evaluation-period progress panel.
- `frontend/src/app/grading/score/page.tsx:769` correctly blocks score modification for students outside `sv_phase`.
- `frontend/src/app/grading/score/page.tsx:796` allows student editing only when `activePeriod.status === "sv_phase"` and the summary is still `draft`.
- `frontend/src/api/evaluation-period-api.ts:34` loads all evaluation periods through `GET /api/evaluation-periods`.
- `backend/src/evaluation-periods/evaluation-periods.controller.ts:32` allows any authenticated user to read evaluation periods.
- `backend/src/evaluation-periods/schemas/evaluation-period.schema.ts:21` defines `admin_phase` as a valid evaluation period status.

## Why This Is Not A Permission-Edit Bug

The student can see the progress panel, but the score editing permission is already blocked by `canModifyScore`.

For a student in `admin_phase`, `canModifyScore` becomes `false` because the student branch only returns true during `sv_phase`. The observed issue is therefore a visibility/UX scope issue, not direct write access.

## Recommended Fix Scope

Decide the intended student UX first:

1. Hide the whole evaluation progress panel for students once the period is outside `sv_phase`.
2. Keep the panel visible for transparency, but change the student-facing copy so it is clear that the period has moved to approval and the student can only view results.
3. Hide only the `Giai đoạn hiện tại` badge for students outside `sv_phase`, while keeping deadline/permission cards.

If the desired behavior is "student should not see the progress bar during `Hội đồng phê duyệt`", the frontend condition should be narrowed with a derived boolean, for example:

```ts
const shouldShowEvaluationProgress =
  !!activePeriod &&
  (currentUserRole !== "student" || activePeriod.status === "sv_phase");
```

Then replace the render guard around the evaluation-period section with `!isInitialLoading && shouldShowEvaluationProgress`.

## Files To Touch If Fixing

- `frontend/src/app/grading/score/page.tsx`

Optional backend change only if the product decision is that students should not receive evaluation-period metadata outside their own phase:

- `backend/src/evaluation-periods/evaluation-periods.controller.ts`
- `backend/src/evaluation-periods/evaluation-periods.service.ts`

## Acceptance Criteria

- Student account does not see `Tiến trình kỳ đánh giá rèn luyện` when the active period status is `admin_phase`, if hide behavior is chosen.
- Student account still cannot edit scores outside `sv_phase`.
- Admin/supervisor users still see the full evaluation period stepper in `admin_phase`.
- Teacher users keep the expected advisor-phase visibility/permission behavior.
- No changes are made to score approval or locking logic unless explicitly requested.

## Additional Review: Is `rankCard` Displayed For Students?

There is no literal `rankCard`, `RankCard`, or rank-card component rendered inside `frontend/src/app/grading/score/page.tsx`.

The student-facing rank UI currently exists in two other places:

1. `frontend/src/app/profile/page.tsx`
   - The profile page calls `summariesPointApi.getMyLatestSummary()` only when the logged-in profile is detected as a student.
   - The rank badge/card is rendered for students when `latestSummary && latestSummary.status === 'locked'`.
   - If no locked summary exists, the student still sees the fallback badge text meaning no finalized training score exists yet.

2. `frontend/src/components/layout/StudentCongratsModalGate.tsx`
   - This component calls `summariesPointApi.getMyLatestSummary()` only when `isStudentRole(user)` is true.
   - It opens the congratulation/rank modal when the latest summary exists and `summary.status === 'locked'`.
   - The modal is mounted globally from `frontend/src/components/layout/Header.tsx`, so every page that renders `Header` can show it for a student after a locked summary is available.
   - The modal is session-gated by `sessionStorage` using `congrats_shown_${userId}_${summaryId}_${lockedAt || 'locked'}`.

Backend support:

- `frontend/src/api/summaries-point-api.ts` calls `GET /summaries-points/me/latest`.
- `backend/src/summaries-point/summaries-point.controller.ts` exposes `GET /summaries-points/me/latest`.
- `backend/src/summaries-point/summaries-point.service.ts` implements `findLatestForStudent()` by querying the current student's latest summary with `status: 'locked'`.
- This backend query does not check the current evaluation period phase; it only checks that the summary is locked, plus optional `semesterId` or `periodId` filters when provided.

Conclusion:

- If `rankCard` means the rank badge on the profile page, then yes, it is intentionally displayed for student accounts after their latest summary is locked.
- If `rankCard` means the congratulation/rank modal, then yes, it can also be displayed for student accounts globally because `StudentCongratsModalGate` is mounted in `Header`.
- If `rankCard` means a card inside the grading score page, then no matching rank card is currently rendered there.

Potential mismatch:

The evaluation progress bar issue is controlled by `activePeriod.status` in the grading score page, while the rank card/modal is controlled by the latest locked summary. These are separate state models. A student can be in a current `admin_phase` period and still see rank UI if any latest summary is already `locked`.

Recommended clarification before fixing:

- Keep rank UI visible for students only when a summary is fully `locked`; this matches the current backend and profile behavior.
- If rank must be hidden while the current period is still `admin_phase`, the frontend must additionally pass the selected semester/period context into `getMyLatestSummary()` or compare the locked summary period with the current `activePeriod`.
- Avoid tying the profile rank badge to the grading score page's progress panel unless product wants one global visibility rule for both features.
