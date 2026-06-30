# Taskscope: `/grading/score` Realtime Count Sync And Decrement Score Safety

## Objective
Fix `/grading/score` so academic record changes are synchronized in realtime and every editable criterion score is calculated from the synchronized record count.

The immediate bug is a hanging score when the number of records decreases. Example: a reward criterion is reduced from `02` to `01` or `00`, but the row score, category score, roster score, or summary total still keeps the old positive points.

The fix must make the synchronized count the source of truth for editable draft scoring while preserving locked, reviewed, approved, and finalized score authority.

## Current Failure Modes

### 1. Count decreases but stale detail state keeps the old score
- The visible count can decrease from `02` to `01`.
- `evaluationCounts` shows the new count.
- `evaluationDetailsMap[criterionId]` can still contain `current_count = 2`, `system_score = 10`, `sv_score = 10`, or `gv_score = 10`.
- Score resolution can keep using the stale detail value.
- Result: the row displays `01` but still scores as if it were `02`.

### 2. Zero active records can still display positive points
- Backend or sync logic can determine that active record count is `0`.
- The count control shows `00`.
- A stale draft detail can still contain `system_score`, `sv_score`, `gv_score`, `selected_option_score`, or `selected_option_id`.
- Result: the row can show `00` with `+5`, and totals can keep that stale contribution.

### 3. Realtime payloads can be treated as partial patches instead of synchronized snapshots
- `academic_record_changed` can include `updatedDetails`, `updatedDetail`, `criterionIds`, and `totalScore`.
- If a criterion disappears from a synchronized detail snapshot because its count reached `0`, the frontend may not clear the old local count/detail.
- If `updatedDetails` contains multiple details, using the event-level `criterionId` for every item can map all details to the same criterion.

### 4. Active student totals can be skipped
- If an event contains `totalScore` but no detail payload, the active student's score can remain stale.
- Dirty local state can block a backend-confirmed total that belongs to the current intent.

### 5. Realtime score calculation can run with missing local maps
- An SSE event can arrive before `evaluationCountsRef.current[studentId]` or `selectedOptionsStateRef.current[studentId]` exists.
- Score helpers must not throw when maps are missing or only partially hydrated.

## Source Of Truth Rules

### Backend source of truth
- Active, non-deleted `AcademicRecord` rows are the source of truth for record counts.
- A valid active record is scoped by `student_id`, `semester_id`, and `criterion_id`, with `status = active` and `is_deleted != true`.
- `SummaryPoint.details` is a synchronized projection of active academic records for draft scoring.
- `SummaryPoint.total_score` must be recomputed only after details have been synchronized from the active-record count.

### Frontend source of truth
- `evaluationCounts[studentId][criterionId]` is the local synchronized count used for editable preview scoring.
- `selectedOptionsState[studentId][criterionId]` is the synchronized selected option for option criteria.
- `evaluationDetailsMap[criterionId]` stores backend detail metadata, but stale detail fields must not override a newer synchronized count for editable draft criteria.
- Row score, category score, active student score, roster score, and summary cache must all use the same synchronized snapshot.

### Locked or reviewed state
- Locked, reviewed, approved, and finalized details keep their persisted score authority.
- Automatic sync must not silently clear those scores.
- If active records go to `0` while a detail is locked, reviewed, approved, or finalized, report a skipped/locked mismatch with enough metadata for admin review.

## Affected Areas
- `frontend/src/app/(dashboard)/grading/score/page.tsx`
- `frontend/src/app/(dashboard)/grading/score/_utils/realtime-event.ts`
- `frontend/src/app/(dashboard)/grading/score/_utils/score-calculation.ts`
- `frontend/src/hooks/useGradingRealtime.ts`
- `backend/src/academic-record/academic-record.service.ts`
- `backend/src/summaries-point/summaries-point.service.ts`
- `backend/src/summaries-point/grading-realtime.service.ts`
- Related frontend and backend tests for these modules

## Implementation Scope

### 1. Synchronize backend details before emitting realtime events
Backend score-changing flows must synchronize from actual active records before returning or emitting.

Required flows:
- create academic record
- update academic record
- restore academic record
- soft delete academic record
- hard delete academic record
- import or bulk create records
- `increase`, `decrease`, `set_target_count`, `select_option`, and `clear_score` score intents

Required behavior:
- Run `syncStudentCriterionScore()` or `syncMultipleStudentCriterionScores()` after the record mutation.
- Recompute `SummaryPoint.total_score` after detail sync.
- Emit `academic_record_changed` only after the synchronized detail and recomputed total are available.
- Return the actual synchronized count and detail to the caller, not only the requested count.
- If a delete/decrease intent cannot remove enough records because of permission filtering, return an incomplete-delete status or error with the actual synchronized count.
- Do not swallow sync failures in destructive flows as if the score is already repaired. Return a visible sync status when sync fails or retries are exhausted.

### 2. Normalize no-record draft details
When active record count becomes `0`, editable draft details must no longer carry positive score authority.

For editable draft count criteria:
- Set `current_count = 0`.
- Set `system_score = 0` for reward criteria.
- Set `sv_score = 0` and `gv_score = 0` only when they are unreviewed draft values.
- Set `final_score = null`.
- Preserve existing violation scoring formulas, but calculate them from synchronized count `0`.

For editable draft `single_option` criteria with no active option record:
- Set `current_count = 0`.
- Set `system_score = 0`.
- Clear `selected_option_id`.
- Clear `selected_option_label`.
- Clear `selected_option_score`.
- Set unreviewed draft `sv_score` and `gv_score` to `0`.
- Set `final_score = null`.

For locked, reviewed, approved, or finalized details:
- Do not auto-clear persisted score lanes.
- Update or report the synchronized count according to the existing workflow boundary.
- Include a skipped mismatch reason such as `locked`, `reviewed`, `approved`, or `finalized`.

### 3. Make single and batch sync behavior equivalent
`syncStudentCriterionScore()` and `syncMultipleStudentCriterionScores()` must apply the same rules.

Required behavior:
- Both paths must use the same active-record filter.
- Both paths must compute the same `current_count`.
- Both paths must compute the same `system_score`.
- Both paths must clear no-record draft option fields the same way.
- Both paths must report the same skipped mismatch metadata for reviewed or locked details.
- Batch sync must not skip no-record repair for editable draft details.

### 4. Emit complete realtime payloads
`academic_record_changed` payloads must contain enough data for the frontend to update without guessing.

Required fields when available:
- `type`
- `classId`
- `semesterId`
- `studentId`
- `summaryId`
- `criterionId` for single-criterion events
- `criterionIds` for multi-criterion events
- `updatedDetail`
- `updatedDetails`
- `totalScore`
- `grading`
- `status`
- `updatedAt`

Required behavior:
- `updatedDetails` should represent synchronized details after backend repair, not stale pre-sync data.
- If a criterion count becomes `0`, either include its normalized zero detail or include a clear signal through `criterionIds` plus an explicit zero/removed detail contract.
- If the payload is a full detail snapshot, mark it clearly so the frontend can prune missing stale criteria.
- If the payload is a partial patch, include enough `criterionIds` for the frontend to clear affected criteria that no longer have details.

### 5. Merge realtime events as synchronized state, not stale patches
Update `mergeRealtimeEvent()` and the `/grading/score` realtime handler.

Required behavior:
- Derive `criterionId` from each detail first:
  - `detail.criterion_id._id`
  - `detail.criterion_id`
  - fallback to `event.criterionId` only for single-detail events
- Do not apply one event-level `criterionId` to every item in an `updatedDetails` array.
- Normalize `current_count`:
  - valid number: use it
  - numeric string: parse it
  - missing, null, or invalid: use existing count only for patch events; use `0` for explicit clear/no-record events
- Normalize option state:
  - non-empty `selected_option_id`: store it
  - explicit option clear: remove it
  - absent option field in a patch event: preserve the existing local option
  - absent option field in an authoritative no-record snapshot: clear it
- Preserve unrelated criteria on partial patch events.
- Prune stale criteria when the event declares an authoritative full snapshot.
- For each `criterionId` included in an event but missing from `updatedDetails`, set the local count to `0` when the event represents deletion, clear, or no active records.
- Build `nextCountsByStudent`, `nextOptionsByStudent`, and `nextDetailsMap` before calling React setters.
- Update refs from that snapshot before calculating totals.
- Pass the same snapshot into score calculation and state setters.

### 6. Recalculate active student and roster consistently
Realtime updates must update every visible scoring surface from the same synchronized state.

Required behavior:
- Recalculate the active student's preview after every valid count sync.
- Apply `event.totalScore` to the active student when detail data is absent or when backend authority is required.
- Apply `event.totalScore` to roster rows and summary cache when present.
- Do not let `dirtyStudentIdsRef` block a backend confirmation that belongs to the current save/intent.
- Ignore stale class or semester events.
- Ignore unknown students safely.
- Do not mutate the active student's detail map for an event belonging to another student.

### 7. Make score calculation count-first for editable drafts
Update `score-calculation.ts` so editable draft scoring uses the synchronized count.

Required behavior:
- Score helpers must tolerate missing maps by defaulting to empty objects.
- `calculateCategoryScore()` must not throw when `counts`, `selectedOptionsState`, or `detailsMap` is missing.
- `calculateTotalScore()` must not pass undefined maps into category scoring.
- For editable draft count criteria, use the local synchronized `count` argument as the effective count.
- Remove behavior that treats `detail.current_count` as a minimum count, such as `max(detail.current_count, count)`.
- Keep `0` as a valid count.
- If an editable draft reward criterion has count `0` and no selected option, its raw score must be `0` even if stale `system_score`, `sv_score`, or `gv_score` exists.
- For editable draft violation criteria, compute from the synchronized count using the existing violation formula.
- For locked, reviewed, approved, or finalized details, preserve existing persisted-score authority.
- `mergeDetailsWithPreExistingCounts()` may hydrate initial counts from backend details, but once a local synchronized count exists, stale detail counts must not block decrements.

### 8. Separate SSE parse errors from handler errors
Update `useGradingRealtime()`.

Required behavior:
- Parse JSON inside a parse-only `try/catch`.
- Run `savedHandler.current(event)` inside a separate handler-only `try/catch`.
- Log invalid JSON as `Failed to parse SSE data`.
- Log handler failures as `Failed to handle SSE event` with event type, student ID, class ID, semester ID, and criterion ID when available.
- One malformed event or handler failure must not close or corrupt the SSE connection.

### 9. Reconcile after missed or reconnect events
Realtime is best-effort. The page must recover if an event is missed.

Required behavior:
- On reconnect, student switch, class switch, semester switch, or explicit refresh, reload the synchronized summary/details for the active context.
- Rebuild `evaluationCounts`, `selectedOptionsState`, and `evaluationDetailsMap` from synchronized backend data.
- Do not allow autosave to submit stale `00`, stale option null, or stale positive score over a freshly synchronized record state.

## Acceptance Criteria
- Reducing a reward criterion from `02` to `01` immediately changes row score from `+10` to `+5`.
- Reducing the same reward criterion from `01` to `00` immediately changes row score to `0`.
- A reward criterion with no active records shows count `00` and score `0`, not stale `+5`.
- Category totals drop at the same time as the row score.
- Active student score, roster score, and summary cache agree after a decrement.
- `academic_record_changed` before local count maps exist does not crash the page.
- Multi-detail realtime events map each detail to its own criterion.
- Realtime clear/delete/no-record events remove stale local counts and option selections.
- Active student receives backend `totalScore` when the event has no detail payload.
- Partial patch events do not clear unrelated criteria.
- Full snapshot events prune stale criteria missing from the snapshot.
- Locked, reviewed, approved, and finalized details are not silently cleared.
- Skipped locked/reviewed mismatches are reported with enough metadata for admin review.
- `syncStudentCriterionScore()` and `syncMultipleStudentCriterionScores()` produce equivalent repaired draft details.
- `recomputeTotalScore()` treats editable draft reward criteria with no active records as zero contribution even if stale draft score fields exist.
- SSE JSON parse errors and handler errors are logged separately.
- The SSE connection continues after a malformed or partial event.

## Test Plan

### Frontend score calculation tests
Add or update tests in `frontend/src/app/(dashboard)/grading/score/_utils/score-calculation.test.ts`.

Required tests:
- `calculateCategoryScore()` accepts missing count and option maps without throwing.
- `calculateTotalScore()` accepts missing count and option maps without throwing.
- Editable draft reward count `2 -> 1 -> 0` recalculates from the local synchronized count.
- Editable draft reward with local `count = 1` and stale `detail.current_count = 2` scores from `1`.
- Editable draft reward with local `count = 0` and stale positive `system_score`, `sv_score`, or `gv_score` scores as `0`.
- Editable draft violation criteria recalculate from the synchronized count after decrement.
- Locked, reviewed, approved, and finalized details keep persisted-score authority.
- Category score drops when an editable draft count is decremented.

### Frontend realtime merge tests
Add or update tests in `frontend/src/app/(dashboard)/grading/score/_utils/realtime-event.test.ts`.

Required tests:
- Active-student event with no existing count map builds a safe count map.
- `updatedDetails` with multiple criteria derives criterion IDs per detail.
- Event-level `criterionId` is used only as fallback for a single detail.
- Explicit `current_count = 0` clears the local count for that criterion.
- Explicit option clear removes only that criterion option.
- Missing option field in a partial patch preserves the existing option.
- Full snapshot mode prunes stale criteria missing from the snapshot.
- Deletion/no-record event with `criterionIds` but no detail sets affected counts to `0`.
- Unknown student or stale context event does not throw.

### Frontend page and hook tests
Add tests where the setup allows page or hook mocking.

Required tests:
- Active student receives `totalScore` even when event has no detail payload.
- Dirty local state does not block a backend-confirmed total for the current intent.
- Reconnect or refresh rebuilds counts/options/details from synchronized data.
- Invalid SSE JSON logs `Failed to parse SSE data`.
- Handler exception logs `Failed to handle SSE event`.
- Later valid events are still processed after one handler exception.

### Backend sync tests
Add or update tests for `backend/src/academic-record/academic-record.service.ts`.

Required tests:
- Deleting the last active reward record sets editable draft `current_count = 0`, `system_score = 0`, `sv_score = 0`, and `gv_score = 0`.
- Reducing active reward records from `2` to `1` lowers `current_count` and `system_score`.
- Clearing the last active option record clears selected option fields for editable draft details.
- `syncMultipleStudentCriterionScores()` matches `syncStudentCriterionScore()` for no-record draft repair.
- Reviewed, locked, approved, and finalized details are not auto-cleared and are reported as skipped mismatches.
- Decrease/clear operations return the synchronized actual count and detail.
- Incomplete deletion due to permissions reports actual remaining count.

### Backend summary and realtime tests
Add or update tests for `backend/src/summaries-point/summaries-point.service.ts` and realtime event payloads.

Required tests:
- `recomputeTotalScore()` gives editable draft reward criteria with no active records zero contribution even when stale draft score fields exist.
- Draft `single_option` with no active record and stale selected option does not keep positive contribution after sync.
- `academic_record_changed` is emitted after recompute.
- Emitted payload includes normalized detail, `criterionIds`, `totalScore`, `grading`, `studentId`, `semesterId`, `classId`, and `summaryId`.
- SSE stream filters stale class and semester events.

## Manual Verification
1. Open `/grading/score` for a class and semester.
2. Select a student with a reward criterion worth `+5`.
3. Increase the criterion to `02`; confirm row score is `+10`.
4. Decrease to `01`; confirm row score, category score, active student score, roster score, and summary cache all drop by `5`.
5. Decrease to `00`; confirm row score is `0` and no stale positive points remain.
6. Refresh the page; confirm the same count and score are still correct.
7. Trigger a record delete from another browser/session; confirm realtime updates the open page.
8. Trigger an option clear; confirm option state and score clear in realtime.
9. Trigger an event for another student; confirm only that roster row changes and the active student's detail map is not mutated.
10. Switch class or semester while realtime is connected; confirm stale context events do not change the current page.
11. Confirm locked or reviewed criteria are not silently cleared and are reported as skipped/locked mismatches.

## Out Of Scope
- Changing grading formulas.
- Changing category maximum caps or total score caps.
- Changing role permissions.
- Rewriting the grading workflow outside `/grading/score`.
- Changing the database schema.
- Deleting reviewed, locked, approved, or finalized score authority automatically.
- Replacing the SSE transport layer.

## Deliverable
A focused `/grading/score` fix where realtime academic-record synchronization fully updates counts, options, details, roster totals, and summary totals, and editable draft reward/violation scores are always recalculated from the synchronized count so points cannot hang when records are reduced or cleared.
