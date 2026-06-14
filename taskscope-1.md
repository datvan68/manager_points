# Task Scope: Evaluation Detail PATCH 400 Bad Request

## User Report

The browser console reports:

```text
PATCH http://localhost:8000/evaluation-detail/<detailId> 400 (Bad Request)
httpClient @ http-client.ts:42
updateEvaluationDetail @ evaluation-detail-api.ts:96
page.tsx:1691
```

## Primary Finding

The failing request is most likely caused by the grading save flow sending lock-only fields through the normal `PATCH /evaluation-detail/:id` endpoint.

In `frontend/src/app/grading/score/page.tsx`, the save handler builds an `admin` payload with:

```ts
scorePayload.final_score = calculatedScore;
scorePayload.locked_at = new Date();
scorePayload.locked_by = currentUser?.id;
```

That payload is then spread into `evaluationDetailApi.updateEvaluationDetail(...)`.

The backend does not allow these fields on direct EvaluationDetail updates:

- `backend/src/main.ts` enables `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true`.
- `backend/src/evaluation-detail/dto/update-evaluation-detail.dto.ts` extends `CreateEvaluationDetailDto`.
- `CreateEvaluationDetailDto` does not define `final_score`, `locked_at`, or `locked_by`.
- `backend/src/evaluation-detail/evaluation-detail.service.ts` also explicitly rejects `final_score`, `locked_at`, and `locked_by` direct edits.

Therefore, when the logged-in user is detected as `admin`, the frontend sends fields that the backend intentionally rejects. This produces HTTP 400 before or during service handling.

## Contract Mismatch

`PATCH /evaluation-detail/:id` is intended for editable draft/review fields such as:

- `current_count`
- `log`
- `status` values other than `locked`
- `sv_score`
- `sv_submitted_at`
- `gv_score`
- `gv_reviewed_at`
- `gv_reviewed_by`
- `description`

It is not intended to finalize or lock detail rows.

Final approval belongs to the SummaryPoint approval flow:

- Frontend API: `summariesPointApi.approveGrading(id)`
- Backend route: `PATCH /summaries-points/:id/approve`
- Backend service: `SummariesPointService.approveGrading(...)`

That flow sets each detail row to `locked`, calculates `final_score`, fills `locked_at` and `locked_by`, appends approval logs, recomputes totals, and updates rank fields.

## Secondary Checks

If the request is failing for a non-admin user, inspect the response body in DevTools Network. Other possible 400 causes include:

- `status: "locked"` being sent to `PATCH /evaluation-detail/:id`; backend rejects direct locking.
- A non-MongoId value in `gv_reviewed_by` or `log[].updated_by`.
- A non-number value in `current_count`, `sv_score`, `gv_score`, or `log[].count`.
- Unknown fields in the request body, because `forbidNonWhitelisted` is enabled.

The current code already cleans most log fields before update, so the admin lock fields are the strongest match for the provided stack trace.

## Recommended Fix Scope

1. Remove admin-only lock fields from the normal detail save payload.

   In `frontend/src/app/grading/score/page.tsx`, the `admin` branch inside the save handler should not spread `final_score`, `locked_at`, or `locked_by` into `updateEvaluationDetail` or `createEvaluationDetail`.

2. Decide the intended admin save behavior.

   Conservative option:

   - Treat admin edits like reviewer edits during normal save.
   - Send `gv_score`, `gv_reviewed_at`, and `gv_reviewed_by`, or send only `current_count`, `log`, and `status: "draft"`.
   - Keep final locking behind the existing approve action.

   Approval option:

   - After saving detail edits successfully, call `summariesPointApi.approveGrading(summaryId)` only when the user explicitly triggers approval.
   - Do not call approval as a side effect of every normal save unless product wants that behavior.

3. Keep backend restrictions unchanged unless the product requirement changes.

   The backend tests already assert that direct detail updates must reject `status: "locked"`, `final_score`, `locked_at`, and `locked_by`. This is a deliberate integrity boundary.

## Files To Touch If Fixing

- `frontend/src/app/grading/score/page.tsx`

Possible test updates:

- Add or adjust a frontend/unit test around save payload construction if this page has test coverage.
- Keep existing backend tests in `backend/src/evaluation-detail/test/evaluation-detail.service.spec.ts` unchanged.

## Acceptance Criteria

- Normal save no longer sends `final_score`, `locked_at`, or `locked_by` to `PATCH /evaluation-detail/:id`.
- Normal save no longer sends `status: "locked"` to `PATCH /evaluation-detail/:id`.
- Admin normal save returns 200 for existing details when the payload contains only allowed fields.
- Creating a new detail as admin does not send lock-only fields to `POST /evaluation-detail`.
- Final approval still works through `PATCH /summaries-points/:id/approve`.
- Backend detail locking protections remain intact.

## Manual Verification

1. Log in as an admin or supervisor.
2. Open the grading score page for a student with an existing EvaluationDetail row.
3. Change a count and click the normal save action.
4. In DevTools Network, inspect `PATCH /evaluation-detail/<id>`.
5. Confirm the request body does not contain `final_score`, `locked_at`, `locked_by`, or `status: "locked"`.
6. Confirm the response is 200.
7. Use the explicit approve action and confirm it calls `PATCH /summaries-points/<summaryId>/approve`.
