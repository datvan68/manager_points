# Taskscope: Allow Valid Zero Approval Score For Fully Deducted Discipline Criteria

## Objective

Fix the `/grading` approval flow so a discipline criterion can be approved with score `0` when active academic records legitimately deduct the criterion down to its minimum score.

The reported failure happens while approving a conduct grading summary from `/grading`. The failing criterion is a discipline item for late attendance, skipping class, unexcused absence, private work during class, disorder, phone use, or entering/leaving class without lecturer permission. It has more than eight active records, so the score being deducted to `0` is expected and must not block approval.

## Target Areas

- Route: `/grading`
- Approval action from the grading list page
- Backend approval flow:
  - `backend/src/summaries-point/summaries-point.service.ts`
  - `approveGrading`
  - `syncSummaryWithAcademicRecords`
  - `recomputeTotalScore`
- Score helper and related tests if needed:
  - `backend/src/academic-record/academic-record.utils.ts`
  - `backend/src/academic-record/score-engine.service.ts`
  - `backend/src/summaries-point/test/summaries-point.service.spec.ts`

## Problem Statement

`approveGrading` currently performs a guard check after syncing active `academic_record` data. The guard rejects approval when:

- a criterion has active academic records
- the resolved approval score is `0` or `null`
- the calculated expected score is greater than `0`

For discipline criteria, the current expected-score check is wrong. The score helper already returns the raw score after deduction:

```ts
systemScore = clamp(maxScore - activeCount * abs(scorePerUnit), minScore, maxScore)
```

For a discipline criterion with:

- `max_score = 8`
- `score_per_unit = -1`
- `activeCount >= 8`
- `min_score = 0`

the valid derived score is:

```text
max(0, min(8, 8 - activeCount)) = 0
```

However, `approveGrading` then recalculates an additional discipline expected value with:

```ts
const calculatedExpected = isDiscipline
  ? (criterion.max_score || 10) - Math.abs(recordDerivedScore)
  : recordDerivedScore;
```

When `recordDerivedScore` is already `0`, this produces `8`, so the guard incorrectly treats the valid zero score as a conflict.

## Required Behavior

### 1. Treat Fully Deducted Discipline Score `0` As Valid

If a discipline criterion has active records and the derived score from those records is `0`, approval must succeed when `0` is the mathematically correct clamped score.

Valid example:

- criterion type: `ky_luat` or negative `score_per_unit`
- `max_score = 8`
- `min_score = 0`
- `score_per_unit = -1`
- `activeCount = 8` or more
- derived score: `0`
- approval result: success
- `detail.final_score`: `0`
- summary status: `locked`

### 2. Keep Conflict Protection For Invalid Zero Scores

The approval guard should still block suspicious zero scores for positive reward criteria or partially deducted discipline criteria.

Examples that should still fail unless intentionally reviewed:

- reward criterion with active records where expected score is positive but resolved score is `0`
- discipline criterion with active count below the full-deduction threshold where expected score is positive but resolved score is `0`

The existing intentionally reviewed zero behavior must remain:

- if the teacher reviewed the detail and set `gv_score = 0`, approval may preserve `0`
- existing `gv_reviewed`, `gv_reviewed_by`, or equivalent reviewed-state handling should not regress

### 3. Use One Consistent Record-Derived Score

Do not invert or re-derive the score after `calculateCriterionScoreHelper` has already returned a clamped raw score.

Recommended direction:

```ts
const recordDerivedScore = scoringResult.systemScore;
const calculatedExpected = recordDerivedScore;
```

If a different helper is used, it must follow the same rule: the value compared by the approval guard should be the score that active records actually imply for the criterion.

### 4. Preserve Academic Record As Source Of Truth

Approval must continue to sync from active `academic_record` data before locking the summary.

Do not change the one-way sync principle:

- `academic_record` is the source of truth
- `evaluation_detail.current_count` is a derived/cache value
- approval must not rely on stale frontend counts

### 5. Preserve Existing Approval Side Effects

After successful approval:

- details are locked
- `final_score` is set consistently
- `locked_at` and `locked_by` are populated
- status transition logs are written
- `summary.status` becomes `locked`
- `recomputeTotalScore(summaryId)` still runs
- realtime/event behavior remains unchanged

## Implementation Plan

### Phase 1: Confirm Current Failure Path

- Inspect `approveGrading` in `backend/src/summaries-point/summaries-point.service.ts`.
- Confirm the rejection comes from `GRADING_APPROVAL_SCORE_CONFLICT`.
- Confirm active record count is grouped by criterion before final score assignment.
- Confirm discipline scores are already clamped by `calculateCriterionScoreHelper`.

### Phase 2: Fix Expected Score Calculation

- Remove the extra discipline inversion in the approval guard.
- Use the helper's record-derived score directly as the expected approval score.
- Keep the existing guard shape for true conflicts:
  - active records exist
  - resolved score is zero or missing
  - record-derived expected score is positive
  - detail is not intentionally reviewed to zero

### Phase 3: Ensure Final Score Assignment Is Correct

- When active records exist and the derived score is `0`, set `detail.final_score = 0`.
- Do not fall back to criterion max score for fully deducted discipline criteria.
- Do not convert `0` to `null`, `undefined`, or a positive fallback value.

### Phase 4: Regression Tests

Add or update backend tests for `approveGrading`.

Required test cases:

- discipline criterion with `max_score = 8`, `score_per_unit = -1`, `activeCount = 8`, draft/unreviewed detail, derived score `0`, approval succeeds, `final_score = 0`
- discipline criterion with `max_score = 8`, `score_per_unit = -1`, `activeCount = 9`, approval succeeds, `final_score = 0`
- discipline criterion with `max_score = 8`, `score_per_unit = -1`, `activeCount = 1`, stale resolved score `0`, approval still throws `BadRequestException`
- reward criterion with active records and stale zero score still throws `BadRequestException`
- intentionally reviewed zero score still approves and preserves `0`

### Phase 5: Manual Verification

Verify from `/grading`:

- select a student whose discipline criterion has more than eight active records
- run approval from the list action
- confirm no toast/error appears
- confirm the summary becomes approved/locked
- confirm the discipline criterion remains `0`
- confirm total score and rank recompute correctly

## Acceptance Criteria

- `/grading` approval no longer fails when a discipline criterion is legitimately deducted to `0`.
- The reported criterion with more than eight active records can be approved.
- `GRADING_APPROVAL_SCORE_CONFLICT` is still thrown for true stale-zero conflicts.
- Fully deducted discipline criteria keep `final_score = 0` after approval.
- Partial discipline deductions still expect a positive score.
- Reward criteria conflict behavior does not regress.
- `academic_record` remains the source of truth for approval-time scoring.
- Backend regression tests cover both valid zero and invalid zero cases.

## Out Of Scope

- Redesigning the `/grading` UI.
- Changing the scoring model for reward criteria.
- Changing criterion configuration data.
- Changing academic record creation, deletion, or permission rules.
- Changing bulk approval UX beyond surfacing the corrected backend result.
- Reworking realtime events or report export logic.

## Notes

- This is a backend approval validation bug, not a frontend display bug.
- The key distinction is between a stale zero and a mathematically valid zero.
- For negative discipline criteria, `0` is a valid terminal score after enough violations.
- Avoid adding special handling for only the reported criterion name; the fix must apply to all discipline criteria with equivalent scoring rules.
